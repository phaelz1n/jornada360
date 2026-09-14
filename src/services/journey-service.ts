// ============================================================
// JourneyService — Parsers de Arquivos (Excel & PDF)
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type { PointRecord, ClockEvent } from '@/types/point';
import type { TrackingRecord, VehicleEvent } from '@/types/tracking';
import type { StandardSchedule, ScheduleSlot, ScaleEntry } from '@/types/schedule';
import { normalizeName } from '@/lib/utils/normalize';
import { parseBatidas, isoToDate, minutesToHHMM } from '@/lib/utils/time';
import {
  readWorkbook,
  sheetToMatrix,
  findHeaderRow,
  parseCellToMinutes,
  parseCellToDateISO,
} from '@/lib/utils/excel';
import { extractTextFromPDF } from '@/lib/utils/pdf';

export class JourneyService {
  /**
   * Parseia o Espelho de Ponto (Excel ou PDF).
   */
  async parseEspelhoPonto(buffer: ArrayBuffer, fileName: string = ''): Promise<PointRecord[]> {
    const isPDF = fileName.toLowerCase().endsWith('.pdf');
    if (isPDF) {
      return this.parseEspelhoPontoPDF(buffer);
    }
    return this.parseEspelhoPontoExcel(buffer);
  }

  /**
   * Parser Excel para Espelho de Ponto.
   */
  async parseEspelhoPontoExcel(buffer: ArrayBuffer): Promise<PointRecord[]> {
    const wb = readWorkbook(buffer);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];

    const matrix = sheetToMatrix(ws);
    if (matrix.length === 0) return [];

    // Localizar cabeçalho
    const headerRowIdx = findHeaderRow(
      matrix,
      ['nome', 'colaborador', 'funcionario', 'data', 'batidas', 'marcacoes'],
      15
    );

    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 1;
    const header = (headerRowIdx >= 0 ? matrix[headerRowIdx] : matrix[0]).map(c =>
      String(c ?? '').toLowerCase().trim()
    );

    // Mapear índices de colunas
    const colNome = header.findIndex(h => h.includes('nome') || h.includes('colaborador') || h.includes('funcion') || h.includes('empregado'));
    const colData = header.findIndex(h => h.includes('data') || h.includes('dia'));
    const colBatidas = header.findIndex(h => h.includes('batida') || h.includes('marca') || h.includes('pontos') || h.includes('horario'));
    const colCpf = header.findIndex(h => h.includes('cpf'));
    const colMatricula = header.findIndex(h => h.includes('matric') || h.includes('registro') || h.includes('re '));
    const colHN = header.findIndex(h => h.includes('hn') || h.includes('normal') || h.includes('horas normais'));
    const colHE1 = header.findIndex(h => h.includes('he1') || h.includes('he 50') || h.includes('extra 1') || h.includes('extra 50') || h.includes('he '));
    const colHE2 = header.findIndex(h => h.includes('he2') || h.includes('he 100') || h.includes('extra 2') || h.includes('extra 100'));

    const records: PointRecord[] = [];
    let currentEmployee = '';
    let currentCpf = '';
    let currentMatricula = '';

    for (let r = startRow; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      // Verificar se há nome na linha
      const rowNome = colNome >= 0 ? String(row[colNome] ?? '').trim() : '';
      if (rowNome && !rowNome.toLowerCase().includes('total') && rowNome.length > 2) {
        currentEmployee = rowNome;
      }

      if (colCpf >= 0 && row[colCpf]) {
        currentCpf = String(row[colCpf]).trim();
      }
      if (colMatricula >= 0 && row[colMatricula]) {
        currentMatricula = String(row[colMatricula]).trim();
      }

      // Se não temos motorista corrente, pular
      if (!currentEmployee) continue;

      // Data do registro
      let dateISO = '';
      if (colData >= 0) {
        dateISO = parseCellToDateISO(row[colData]);
      }

      // Se não achou data explícita, procura na linha inteira
      if (!dateISO) {
        for (const cell of row) {
          const tryIso = parseCellToDateISO(cell);
          if (tryIso) {
            dateISO = tryIso;
            break;
          }
        }
      }

      if (!dateISO) continue;

      // Extrair batidas
      let rawBatidasStr = '';
      if (colBatidas >= 0 && row[colBatidas]) {
        rawBatidasStr = String(row[colBatidas]).trim();
      } else {
        // Coleta células formatadas como HH:MM
        const times: string[] = [];
        for (let c = 0; c < row.length; c++) {
          if (c === colNome || c === colData || c === colCpf || c === colMatricula) continue;
          const cellStr = String(row[c] ?? '').trim();
          const match = cellStr.match(/\b\d{1,2}:\d{2}\b/g);
          if (match) {
            times.push(...match);
          }
        }
        rawBatidasStr = times.join(' ');
      }

      // Parsear batidas com suporte a virada de turno
      const baseDate = isoToDate(dateISO);
      const dates = parseBatidas(rawBatidasStr, baseDate);

      const clockEvents: ClockEvent[] = dates.map((d, idx) => ({
        time: d,
        type: idx % 2 === 0 ? 'entrada' : 'saida',
        rawString: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      }));

      // Extrair horas normais e extras
      const hn = colHN >= 0 ? parseCellToMinutes(row[colHN]) : 0;
      const he1 = colHE1 >= 0 ? parseCellToMinutes(row[colHE1]) : 0;
      const he2 = colHE2 >= 0 ? parseCellToMinutes(row[colHE2]) : 0;

      records.push({
        id: uuidv4(),
        nome: currentEmployee,
        nomeNormalizado: normalizeName(currentEmployee),
        cpf: currentCpf || undefined,
        matricula: currentMatricula || undefined,
        data: dateISO,
        batidas: clockEvents,
        hnMin: hn,
        he1Min: he1,
        he2Min: he2,
        rawBatidas: rawBatidasStr,
      });
    }

    return records;
  }

  /**
   * Parser PDF para Espelho de Ponto (ex: relatório espelho diário de ontem).
   */
  async parseEspelhoPontoPDF(buffer: ArrayBuffer): Promise<PointRecord[]> {
    const text = await extractTextFromPDF(buffer);
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const records: PointRecord[] = [];
    let currentEmployee = 'MOTORISTA DESCONHECIDO';

    for (const line of lines) {
      // Detectar nome do funcionário
      const empMatch = line.match(/(?:funcion[aá]rio|colaborador|nome|empregado|motorista)[:\s]+([A-Z\s]{3,})/i);
      if (empMatch && empMatch[1]) {
        currentEmployee = empMatch[1].trim();
      }

      // Detectar linha com data DD/MM/AAAA
      const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (dateMatch) {
        const brDate = dateMatch[1];
        const [d, m, y] = brDate.split('/');
        const dateISO = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

        // Extrair todos os horários HH:MM presentes na linha
        const timeMatches = line.match(/\b\d{2}:\d{2}\b/g) || [];
        if (timeMatches.length > 0) {
          const rawBatidas = timeMatches.join(' ');
          const baseDate = isoToDate(dateISO);
          const dates = parseBatidas(rawBatidas, baseDate);

          const clockEvents: ClockEvent[] = dates.map((dt, idx) => ({
            time: dt,
            type: idx % 2 === 0 ? 'entrada' : 'saida',
            rawString: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
          }));

          records.push({
            id: uuidv4(),
            nome: currentEmployee,
            nomeNormalizado: normalizeName(currentEmployee),
            data: dateISO,
            batidas: clockEvents,
            hnMin: 0,
            he1Min: 0,
            he2Min: 0,
            rawBatidas,
          });
        }
      }
    }

    return records;
  }

  /**
   * Parseia o Rastreamento Cobli a partir de um ArrayBuffer (xlsx).
   * Aba "Detalhado" com cabeçalho na linha ~5.
   */
  async parseRastreamento(buffer: ArrayBuffer): Promise<TrackingRecord[]> {
    const wb = readWorkbook(buffer);
    // Tenta aba "Detalhado" primeiro, ou a primeira aba disponível
    const sheetName = wb.SheetNames.find(s => s.toLowerCase().includes('detalhad')) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];

    const matrix = sheetToMatrix(ws);
    if (matrix.length === 0) return [];

    // Localizar linha de cabeçalho
    const headerRowIdx = findHeaderRow(
      matrix,
      ['motorista', 'partida', 'parada', 'inicio', 'veiculo', 'placa'],
      15
    );

    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 5;
    const header = (headerRowIdx >= 0 ? matrix[headerRowIdx] : (matrix[4] || matrix[0])).map(c =>
      String(c ?? '').toLowerCase().trim()
    );

    const colMotorista = header.findIndex(h => h.includes('motorista') || h.includes('condutor'));
    const colPartida = header.findIndex(h => h.includes('partida') || h.includes('início') || h.includes('inicio') || h.includes('saida'));
    const colParada = header.findIndex(h => h.includes('parada') || h.includes('fim') || h.includes('término') || h.includes('chegada'));
    const colPlaca = header.findIndex(h => h.includes('placa') || h.includes('veículo') || h.includes('veiculo'));

    const eventsByDate = new Map<string, VehicleEvent[]>();

    for (let r = startRow; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      const motorista = colMotorista >= 0 ? String(row[colMotorista] ?? '').trim() : '';
      if (!motorista || motorista.toLowerCase().includes('total')) continue;

      const rawPartida = colPartida >= 0 ? row[colPartida] : null;
      const rawParada = colParada >= 0 ? row[colParada] : null;
      const placa = colPlaca >= 0 ? String(row[colPlaca] ?? '').trim() : '';

      const dtPartida = this.parseDateTime(rawPartida);
      const dtParada = this.parseDateTime(rawParada);

      if (!dtPartida) continue;

      const dateISO = `${dtPartida.getFullYear()}-${String(dtPartida.getMonth() + 1).padStart(2, '0')}-${String(dtPartida.getDate()).padStart(2, '0')}`;

      const event: VehicleEvent = {
        motorista,
        motoristaNormalizado: normalizeName(motorista),
        partida: dtPartida,
        parada: dtParada || dtPartida,
        placa,
      };

      if (!eventsByDate.has(dateISO)) {
        eventsByDate.set(dateISO, []);
      }
      eventsByDate.get(dateISO)!.push(event);
    }

    // Gerar lista de TrackingRecord
    const trackingRecords: TrackingRecord[] = [];
    for (const [dateISO, events] of eventsByDate.entries()) {
      trackingRecords.push({
        id: uuidv4(),
        data: dateISO,
        eventos: events.sort((a, b) => a.partida.getTime() - b.partida.getTime()),
      });
    }

    return trackingRecords;
  }

  /**
   * Parseia o Horário Padrão a partir de um ArrayBuffer (xlsx).
   * Suporta seriais fracionários do Excel * 1440 e detecção de EXTRA negativo.
   */
  async parseHorarioPadrao(buffer: ArrayBuffer): Promise<StandardSchedule[]> {
    const wb = readWorkbook(buffer);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];

    const matrix = sheetToMatrix(ws);
    if (matrix.length === 0) return [];

    const headerRowIdx = findHeaderRow(
      matrix,
      ['motorista', 'nome', 'horario', 'carga', 'total', 'extra'],
      10
    );

    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 1;
    const header = (headerRowIdx >= 0 ? matrix[headerRowIdx] : matrix[0]).map(c =>
      String(c ?? '').toLowerCase().trim()
    );

    const colNome = header.findIndex(h => h.includes('motorista') || h.includes('nome') || h.includes('colaborador'));
    const colCarga = header.findIndex(h => h.includes('carga'));
    const colTotal = header.findIndex(h => h.includes('total'));
    const colExtra = header.findIndex(h => h.includes('extra'));

    const schedules: StandardSchedule[] = [];

    for (let r = startRow; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      const nome = colNome >= 0 ? String(row[colNome] ?? '').trim() : '';
      if (!nome || nome.toLowerCase().includes('total')) continue;

      // Buscar horários (slots de entrada e saída)
      const slots: ScheduleSlot[] = [];
      for (let c = 0; c < row.length; c++) {
        if (c === colNome || c === colCarga || c === colTotal || c === colExtra) continue;
        const cellVal = row[c];
        if (cellVal !== null && cellVal !== undefined && cellVal !== '') {
          const min = parseCellToMinutes(cellVal);
          if (min > 0) {
            // Se tivermos pares, formamos slots
            const hhmm = minutesToHHMM(min);
            if (slots.length > 0 && !slots[slots.length - 1].saida) {
              const last = slots[slots.length - 1];
              last.saida = hhmm;
              last.duracaoMin = Math.max(0, min - (parseCellToMinutes(last.entrada) || 0));
            } else {
              slots.push({ entrada: hhmm, saida: '', duracaoMin: 0 });
            }
          }
        }
      }

      const cargaHMin = colCarga >= 0 ? parseCellToMinutes(row[colCarga]) : 440; // default 7h20
      const totalMin = colTotal >= 0 ? parseCellToMinutes(row[colTotal]) : cargaHMin;
      const extraPadraoMin = colExtra >= 0 ? parseCellToMinutes(row[colExtra]) : (totalMin - cargaHMin);

      schedules.push({
        nome,
        nomeNormalizado: normalizeName(nome),
        horarios: slots,
        totalMin,
        cargaHMin,
        extraPadraoMin,
        isInconsistente: extraPadraoMin < 0,
      });
    }

    return schedules;
  }

  /**
   * Parseia a Escala Operacional a partir de um ArrayBuffer (xlsx multi-aba).
   */
  async parseEscala(buffer: ArrayBuffer): Promise<ScaleEntry[]> {
    const wb = readWorkbook(buffer);
    const entries: ScaleEntry[] = [];

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      const matrix = sheetToMatrix(ws);
      if (matrix.length === 0) continue;

      const headerRowIdx = findHeaderRow(
        matrix,
        ['motorista', 'nome', 'horario', 'linha', 'descricao'],
        10
      );

      const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 1;
      const header = (headerRowIdx >= 0 ? matrix[headerRowIdx] : matrix[0]).map(c =>
        String(c ?? '').toLowerCase().trim()
      );

      const colMotorista = header.findIndex(h => h.includes('motorista') || h.includes('nome'));
      const colHorario = header.findIndex(h => h.includes('horario') || h.includes('turno'));
      const colDesc = header.findIndex(h => h.includes('linha') || h.includes('desc') || h.includes('rota') || h.includes('servico'));
      const colSub = header.findIndex(h => h.includes('substitu') || h.includes('troca'));

      for (let r = startRow; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.length === 0) continue;

        const motorista = colMotorista >= 0 ? String(row[colMotorista] ?? '').trim() : '';
        if (!motorista || motorista.toLowerCase().includes('total')) continue;

        const horario = colHorario >= 0 ? String(row[colHorario] ?? '').trim() : '';
        const descricao = colDesc >= 0 ? String(row[colDesc] ?? '').trim() : sheetName;
        const substituicao = colSub >= 0 ? String(row[colSub] ?? '').trim() : undefined;

        entries.push({
          motorista,
          motoristaNormalizado: normalizeName(motorista),
          data: '', // preenchido na associação ou se houver coluna de data
          horario,
          descricao,
          substituicao: substituicao || undefined,
        });
      }
    }

    return entries;
  }

  /**
   * Helper para converter strings ou Dates em objetos Date válidos.
   */
  private parseDateTime(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;

    const str = String(val).trim();
    // Ex: "28/02/2025 08:30" ou "2025-02-28 08:30:00"
    const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})/);
    if (brMatch) {
      let y = parseInt(brMatch[3], 10);
      if (y < 100) y += 2000;
      const m = parseInt(brMatch[2], 10) - 1;
      const d = parseInt(brMatch[1], 10);
      const hh = parseInt(brMatch[4], 10);
      const mm = parseInt(brMatch[5], 10);
      return new Date(y, m, d, hh, mm);
    }

    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})/);
    if (isoMatch) {
      return new Date(
        parseInt(isoMatch[1], 10),
        parseInt(isoMatch[2], 10) - 1,
        parseInt(isoMatch[3], 10),
        parseInt(isoMatch[4], 10),
        parseInt(isoMatch[5], 10)
      );
    }

    const dt = new Date(str);
    return isNaN(dt.getTime()) ? null : dt;
  }
}

export const journeyService = new JourneyService();
