// ============================================================
// Serviço de Processamento e Auditoria de Horas Extras (Excel)
// ============================================================

import path from 'path';
import fs from 'fs';
import * as xlsx from 'xlsx';

export interface HoraExtraItem {
  id: string;
  tipo: 'HE1' | 'HE2' | 'HE3';
  colaborador: string;
  data: string; // DD/MM/YYYY
  pontoRegistrado: string;
  horasExtrasDecimal: number;
  horasExtrasFormatada: string; // HH:mm
  minutosTotais: number;
  setorMotivo?: string;
  responsavelOriginal?: string;
  justificativaOriginal?: string;
  // Campos dinâmicos / Auditados
  justificativa: string;
  temJustificativa: boolean;
  possivelProblema: boolean;
  problemaDescricao: string;
  alteradoPor?: string;
  alteradoPorUid?: string;
  alteradoEm?: string;
  historicoAlteracoes?: Array<{
    justificativa: string;
    alteradoPor: string;
    alteradoEm: string;
  }>;
}

export interface HorasExtrasSummary {
  totalRegistros: number;
  totalHE1: number;
  totalHE2: number;
  totalHE3: number;
  pendentesJustificativa: number;
  justificadas: number;
  minutosTotaisGeral: number;
  horasTotaisFormatada: string;
}

/**
 * Converte número serial do Excel para DD/MM/YYYY
 */
export function excelSerialToDateStr(serial: unknown): string {
  if (!serial) return '';
  if (typeof serial === 'string') {
    if (serial.includes('/') || serial.includes('-')) return serial.trim();
    const num = Number(serial);
    if (!isNaN(num) && num > 30000) {
      serial = num;
    } else {
      return serial.trim();
    }
  }

  if (typeof serial === 'number') {
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  return String(serial);
}

/**
 * Converte fração decimal de dia do Excel (ex: 0.0243 = 35min) em HH:mm e minutos totais
 */
export function excelFractionToTime(val: unknown): { formatado: string; minutos: number } {
  if (val === null || val === undefined) return { formatado: '00:00', minutos: 0 };

  let num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(num)) return { formatado: '00:00', minutos: 0 };

  // Se o valor já for maior que 1, pode ser quantidade de horas inteiras (ex: 2.5 horas)
  let totalMinutos = 0;
  if (num < 1) {
    // É fração de 24h
    totalMinutos = Math.round(num * 24 * 60);
  } else {
    totalMinutos = Math.round(num * 60);
  }

  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  const formatado = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { formatado, minutos: totalMinutos };
}

/**
 * Gera um ID único e estável para cada linha de hora extra
 */
function makeItemId(tipo: string, data: string, colaborador: string, ponto: string, idx: number): string {
  const cleanColab = (colaborador || 'colab').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  const cleanDate = (data || '').replace(/\//g, '');
  return `${tipo.toLowerCase()}_${cleanDate}_${cleanColab}_${idx}`;
}

/**
 * Carrega e processa os dados do Setembro.xlsx na pasta raiz
 */
export function loadSetembroHorasExtras(
  overridesMap: Record<string, { justificativa: string; alteradoPor?: string; alteradoPorUid?: string; alteradoEm?: string; historico?: any[] }> = {}
): { items: HoraExtraItem[]; summary: HorasExtrasSummary } {
  const filePath = path.join(process.cwd(), 'Setembro.xlsx');
  if (!fs.existsSync(filePath)) {
    throw new Error('Arquivo Setembro.xlsx não encontrado na raiz do projeto.');
  }

  const fileBuffer = fs.readFileSync(filePath);
  const wb = xlsx.read(fileBuffer, { type: 'buffer' });

  const items: HoraExtraItem[] = [];

  // 1. Processar 'HE1 total'
  const wsHE1 = wb.Sheets['HE1 total'];
  if (wsHE1) {
    const rawRows = xlsx.utils.sheet_to_json<any[]>(wsHE1, { header: 1 });
    // Linha 0 é título, linha 1 cabeçalhos, dados começam na linha 2
    for (let i = 2; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      let colData = row[0];
      let colColab = row[1];
      const colPonto = row[2] ? String(row[2]).trim() : '';
      const colHE = row[3];
      const colSetor = row[4] ? String(row[4]).trim() : '';
      const colJust = row[5] ? String(row[5]).trim() : '';

      // Tratar caso em que Nome e Data foram invertidos no Excel
      if (typeof colData === 'string' && isNaN(Number(colData)) && typeof colColab === 'number') {
        const temp = colData;
        colData = colColab;
        colColab = temp;
      }

      const colaborador = colColab ? String(colColab).trim() : 'Não informado';
      if (!colaborador || colaborador === 'Não informado') continue;

      const dataStr = excelSerialToDateStr(colData);
      const { formatado, minutos } = excelFractionToTime(colHE);
      const id = makeItemId('HE1', dataStr, colaborador, colPonto, i);

      const override = overridesMap[id];
      const justificativaFinal = override?.justificativa !== undefined ? override.justificativa : colJust;
      const temJustificativa = !!justificativaFinal && justificativaFinal.trim().length > 0;

      let possivelProblema = false;
      let problemaDescricao = '';

      if (!temJustificativa) {
        possivelProblema = true;
        problemaDescricao = 'Sem justificativa no ponto';
      } else if (minutos >= 120) {
        possivelProblema = true;
        problemaDescricao = 'Hora extra elevada (> 2h)';
      } else if (!colSetor && !temJustificativa) {
        possivelProblema = true;
        problemaDescricao = 'Sem setor e sem justificativa';
      }

      items.push({
        id,
        tipo: 'HE1',
        colaborador,
        data: dataStr,
        pontoRegistrado: colPonto,
        horasExtrasDecimal: typeof colHE === 'number' ? colHE : 0,
        horasExtrasFormatada: formatado,
        minutosTotais: minutos,
        setorMotivo: colSetor,
        justificativaOriginal: colJust,
        justificativa: justificativaFinal,
        temJustificativa,
        possivelProblema,
        problemaDescricao,
        alteradoPor: override?.alteradoPor,
        alteradoPorUid: override?.alteradoPorUid,
        alteradoEm: override?.alteradoEm,
        historicoAlteracoes: override?.historico,
      });
    }
  }

  // 2. Processar 'HE2'
  const wsHE2 = wb.Sheets['HE2'];
  if (wsHE2) {
    const rawRows = xlsx.utils.sheet_to_json<any[]>(wsHE2, { header: 1 });
    // [Nome, Data, Entrada e Saída, H.E.2, Notas, Responsável]
    for (let i = 2; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const colNome = row[0] ? String(row[0]).trim() : '';
      if (!colNome) continue;

      const colData = row[1];
      const colPonto = row[2] ? String(row[2]).trim() : '';
      const colHE = row[3];
      const colNotas = row[4] ? String(row[4]).trim() : '';
      const colResp = row[5] ? String(row[5]).trim() : '';

      const dataStr = excelSerialToDateStr(colData);
      const { formatado, minutos } = excelFractionToTime(colHE);
      const id = makeItemId('HE2', dataStr, colNome, colPonto, i);

      const override = overridesMap[id];
      const justificativaFinal = override?.justificativa !== undefined ? override.justificativa : colNotas;
      const temJustificativa = !!justificativaFinal && justificativaFinal.trim().length > 0;

      let possivelProblema = false;
      let problemaDescricao = '';
      if (!temJustificativa) {
        possivelProblema = true;
        problemaDescricao = 'HE 2 sem justificativa/nota';
      }

      items.push({
        id,
        tipo: 'HE2',
        colaborador: colNome,
        data: dataStr,
        pontoRegistrado: colPonto,
        horasExtrasDecimal: typeof colHE === 'number' ? colHE : 0,
        horasExtrasFormatada: formatado,
        minutosTotais: minutos,
        setorMotivo: 'HE 2 / Garagem / Oficina',
        responsavelOriginal: colResp,
        justificativaOriginal: colNotas,
        justificativa: justificativaFinal,
        temJustificativa,
        possivelProblema,
        problemaDescricao,
        alteradoPor: override?.alteradoPor,
        alteradoPorUid: override?.alteradoPorUid,
        alteradoEm: override?.alteradoEm,
        historicoAlteracoes: override?.historico,
      });
    }
  }

  // 3. Processar 'HE3'
  const wsHE3 = wb.Sheets['HE3'];
  if (wsHE3) {
    const rawRows = xlsx.utils.sheet_to_json<any[]>(wsHE3, { header: 1 });
    // [Nome, Data, Entrada e Saída, H.E.3, Notas]
    for (let i = 2; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const colNome = row[0] ? String(row[0]).trim() : '';
      if (!colNome) continue;

      const colData = row[1];
      const colPonto = row[2] ? String(row[2]).trim() : '';
      const colHE = row[3];
      const colNotas = row[4] ? String(row[4]).trim() : '';

      const dataStr = excelSerialToDateStr(colData);
      const { formatado, minutos } = excelFractionToTime(colHE);
      const id = makeItemId('HE3', dataStr, colNome, colPonto, i);

      const override = overridesMap[id];
      const justificativaFinal = override?.justificativa !== undefined ? override.justificativa : colNotas;
      const temJustificativa = !!justificativaFinal && justificativaFinal.trim().length > 0;

      let possivelProblema = false;
      let problemaDescricao = '';
      if (!temJustificativa) {
        possivelProblema = true;
        problemaDescricao = 'HE 3 (Domingo/Feriado/Folga) sem justificativa';
      }

      items.push({
        id,
        tipo: 'HE3',
        colaborador: colNome,
        data: dataStr,
        pontoRegistrado: colPonto,
        horasExtrasDecimal: typeof colHE === 'number' ? colHE : 0,
        horasExtrasFormatada: formatado,
        minutosTotais: minutos,
        setorMotivo: 'HE 3 (Domingo / Feriado)',
        justificativaOriginal: colNotas,
        justificativa: justificativaFinal,
        temJustificativa,
        possivelProblema,
        problemaDescricao,
        alteradoPor: override?.alteradoPor,
        alteradoPorUid: override?.alteradoPorUid,
        alteradoEm: override?.alteradoEm,
        historicoAlteracoes: override?.historico,
      });
    }
  }

  // Estatísticas e resumo
  let totalMinutos = 0;
  let totalHE1 = 0;
  let totalHE2 = 0;
  let totalHE3 = 0;
  let pendentes = 0;
  let justificadas = 0;

  for (const it of items) {
    totalMinutos += it.minutosTotais;
    if (it.tipo === 'HE1') totalHE1++;
    if (it.tipo === 'HE2') totalHE2++;
    if (it.tipo === 'HE3') totalHE3++;

    if (!it.temJustificativa) {
      pendentes++;
    } else {
      justificadas++;
    }
  }

  const hGeral = Math.floor(totalMinutos / 60);
  const mGeral = totalMinutos % 60;
  const horasTotaisFormatada = `${hGeral}h ${String(mGeral).padStart(2, '0')}m`;

  const summary: HorasExtrasSummary = {
    totalRegistros: items.length,
    totalHE1,
    totalHE2,
    totalHE3,
    pendentesJustificativa: pendentes,
    justificadas,
    minutosTotaisGeral: totalMinutos,
    horasTotaisFormatada,
  };

  return { items, summary };
}
