// ============================================================
// Serviço de Processamento e Auditoria de Horas Extras (Excel)
// ============================================================

import path from 'path';
import fs from 'fs';
import * as xlsx from 'xlsx';
import {
  isDentroDoPadrao,
  type HoraExtraItem,
  type HorasExtrasSummary,
} from '@/lib/horas-extras-utils';

export type { HoraExtraItem, HorasExtrasSummary };
export { isDentroDoPadrao };

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

function parseTimeStringToMinutes(timeStr: unknown): number {
  if (!timeStr) return 0;
  if (typeof timeStr === 'number') {
    if (timeStr < 1) return Math.round(timeStr * 24 * 60);
    return Math.round(timeStr * 60);
  }
  const parts = String(timeStr).trim().split(':');
  if (parts.length === 2) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  }
  return 0;
}

/**
 * Carrega e processa os dados da planilha de horas extras (prioriza HE_ciclo_2026-08-28.xlsx)
 */
export function loadSetembroHorasExtras(
  overridesMap: Record<string, { justificativa: string; alteradoPor?: string; alteradoPorUid?: string; alteradoEm?: string; historico?: any[] }> = {}
): { items: HoraExtraItem[]; summary: HorasExtrasSummary } {
  const cicloPath = path.join(process.cwd(), 'HE_ciclo_2026-08-28.xlsx');
  const setembroPath = path.join(process.cwd(), 'Setembro.xlsx');
  const filePath = fs.existsSync(cicloPath) ? cicloPath : setembroPath;

  if (!fs.existsSync(filePath)) {
    throw new Error('Nenhuma planilha de horas extras encontrada na raiz do projeto.');
  }

  const isCicloSheet = filePath.endsWith('HE_ciclo_2026-08-28.xlsx');
  const fileBuffer = fs.readFileSync(filePath);
  const wb = xlsx.read(fileBuffer, { type: 'buffer' });

  const items: HoraExtraItem[] = [];

  // ============================================================
  // FLUXO 1: Planilha Oficial de Ciclo (HE_ciclo_2026-08-28.xlsx)
  // ============================================================
  if (isCicloSheet && wb.Sheets['DETALHAMENTO']) {
    const rows = xlsx.utils.sheet_to_json<any>(wb.Sheets['DETALHAMENTO']);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const colaborador = String(row['Colaborador'] || '').trim();
      if (!colaborador) continue;

      const dataStr = String(row['Dia'] || '').trim(); // DD/MM/YYYY
      const horarioPadrao = String(row['Horário padrão'] || '').trim();
      const he1Str = String(row['HE.1'] || '00:00').trim();
      const hePrevStr = String(row['HE prevista no padrão'] || '00:00').trim();
      const acimaStr = String(row['Acima do padrão'] || '00:00').trim();
      const situacao = String(row['Situação'] || '').trim();
      const setor = String(row['Setor/motivo'] || '').trim();
      const causa = String(row['Causa'] || '').trim();
      const justOriginal = String(row['Justificativa'] || '').trim();
      const conferido = String(row['Conferido'] || '').trim();
      const observacao = String(row['Observação'] || '').trim();

      const minutos = parseTimeStringToMinutes(he1Str);
      const hePrevMin = parseTimeStringToMinutes(hePrevStr);
      const acimaMin = parseTimeStringToMinutes(acimaStr);

      const cleanDate = dataStr.replace(/\//g, '');
      const cleanColab = colaborador.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const id = `he1_${cleanDate}_${cleanColab}`;
      const fallbackId = `he1_${cleanDate}_${cleanColab}_${i}`;

      const override = overridesMap[id] || overridesMap[fallbackId];
      const justificativaFinal = override?.justificativa !== undefined ? override.justificativa : justOriginal;
      const temJustificativa = !!justificativaFinal && justificativaFinal.trim().length > 0;
      const dentroDoPadrao = situacao === 'Dentro do padrão' || isDentroDoPadrao(setor, justificativaFinal);

      let possivelProblema = false;
      let problemaDescricao = '';

      if (dentroDoPadrao) {
        possivelProblema = false;
        problemaDescricao = 'Dentro do padrão (Programado)';
      } else if (!temJustificativa) {
        possivelProblema = true;
        problemaDescricao = 'Sem justificativa no ponto';
      } else if (conferido === 'não') {
        possivelProblema = true;
        problemaDescricao = 'Pendente de conferência';
      } else if (situacao === 'Sem referência') {
        possivelProblema = true;
        problemaDescricao = 'Sem horário padrão cadastrado';
      } else if (minutos >= 120) {
        possivelProblema = true;
        problemaDescricao = 'Hora extra elevada (> 2h)';
      }

      items.push({
        id,
        tipo: 'HE1',
        colaborador,
        data: dataStr,
        pontoRegistrado: horarioPadrao,
        horasExtrasDecimal: minutos / 60,
        horasExtrasFormatada: he1Str,
        minutosTotais: minutos,
        setorMotivo: setor,
        justificativaOriginal: justOriginal,
        horarioPadrao,
        hePrevistaFormatada: hePrevStr,
        hePrevistaMin: hePrevMin,
        acimaPadraoFormatada: acimaStr,
        acimaPadraoMin: acimaMin,
        situacao,
        causa,
        conferido,
        observacao,
        justificativa: justificativaFinal,
        temJustificativa,
        dentroDoPadrao,
        possivelProblema,
        problemaDescricao,
        alteradoPor: override?.alteradoPor,
        alteradoPorUid: override?.alteradoPorUid,
        alteradoEm: override?.alteradoEm,
        historicoAlteracoes: override?.historico,
      });
    }
  } else {
    // ============================================================
    // FLUXO 2: Planilha Legada (Setembro.xlsx)
    // ============================================================
    // 1. Processar 'HE1 total'
    const wsHE1 = wb.Sheets['HE1 total'];
    if (wsHE1) {
      const rawRows = xlsx.utils.sheet_to_json<any[]>(wsHE1, { header: 1 });
      for (let i = 2; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        let colData = row[0];
        let colColab = row[1];
        const colPonto = row[2] ? String(row[2]).trim() : '';
        const colHE = row[3];
        const colSetor = row[4] ? String(row[4]).trim() : '';
        const colJust = row[5] ? String(row[5]).trim() : '';

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
        const dentroDoPadrao = isDentroDoPadrao(colSetor, justificativaFinal);

        let possivelProblema = false;
        let problemaDescricao = '';

        if (dentroDoPadrao) {
          possivelProblema = false;
          problemaDescricao = 'Dentro do padrão (Programado)';
        } else if (!temJustificativa) {
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
          dentroDoPadrao,
          possivelProblema,
          problemaDescricao,
          alteradoPor: override?.alteradoPor,
          alteradoPorUid: override?.alteradoPorUid,
          alteradoEm: override?.alteradoEm,
          historicoAlteracoes: override?.historico,
        });
      }
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
      const dentroDoPadrao = isDentroDoPadrao('HE 2', justificativaFinal);

      let possivelProblema = false;
      let problemaDescricao = '';
      if (dentroDoPadrao) {
        possivelProblema = false;
        problemaDescricao = 'Dentro do padrão (Programado)';
      } else if (!temJustificativa) {
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
        dentroDoPadrao,
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
      const dentroDoPadrao = isDentroDoPadrao('HE 3', justificativaFinal);

      let possivelProblema = false;
      let problemaDescricao = '';
      if (dentroDoPadrao) {
        possivelProblema = false;
        problemaDescricao = 'Dentro do padrão (Programado)';
      } else if (!temJustificativa) {
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
        dentroDoPadrao,
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
  let dentroDoPadraoCount = 0;
  let justificadas = 0;
  let totalAcimaPadraoMinutos = 0;
  let conferidosCount = 0;
  let pendentesConferenciaCount = 0;

  for (const it of items) {
    totalMinutos += it.minutosTotais;
    if (it.tipo === 'HE1') totalHE1++;
    if (it.tipo === 'HE2') totalHE2++;
    if (it.tipo === 'HE3') totalHE3++;

    if (it.acimaPadraoMin) {
      totalAcimaPadraoMinutos += it.acimaPadraoMin;
    }
    if (it.conferido === 'sim') {
      conferidosCount++;
    } else if (it.conferido === 'não') {
      pendentesConferenciaCount++;
    }

    if (it.dentroDoPadrao) {
      dentroDoPadraoCount++;
    } else if (!it.temJustificativa) {
      pendentes++;
    } else {
      justificadas++;
    }
  }

  const hGeral = Math.floor(totalMinutos / 60);
  const mGeral = totalMinutos % 60;
  const horasTotaisFormatada = `${hGeral}h ${String(mGeral).padStart(2, '0')}m`;

  const hAcima = Math.floor(totalAcimaPadraoMinutos / 60);
  const mAcima = totalAcimaPadraoMinutos % 60;
  const totalAcimaPadraoFormatada = `${hAcima}h ${String(mAcima).padStart(2, '0')}m`;

  const summary: HorasExtrasSummary = {
    totalRegistros: items.length,
    totalHE1,
    totalHE2,
    totalHE3,
    pendentesJustificativa: pendentes,
    dentroDoPadrao: dentroDoPadraoCount,
    justificadas,
    minutosTotaisGeral: totalMinutos,
    horasTotaisFormatada,
    totalAcimaPadraoMinutos,
    totalAcimaPadraoFormatada,
    conferidosCount,
    pendentesConferenciaCount,
  };

  return { items, summary };
}
