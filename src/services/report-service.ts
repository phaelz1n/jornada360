// ============================================================
// ReportService — Relatórios, Métricas & Exportação Multi-aba
// ============================================================

import * as XLSX from 'xlsx';
import type { AuditItem } from '@/types/audit';
import { minutesToHHMM } from '@/lib/utils/time';

export interface ReportSummary {
  totalHEMin: number;
  totalExcedenteMin: number;
  totalDentroPadraoMin: number;
  totalAcimaPadraoMin: number;
  motoristasPendentes: number;
  motoristasResolvidos: number;
  percentualConformidade: number;
}

export interface SetorStat {
  setor: string;
  totalHEMin: number;
  totalExcedenteMin: number;
  motoristasCount: number;
  ocorrenciasCount: number;
}

export interface DiaSemanaStat {
  dia: string;
  totalHEMin: number;
  totalExcedenteMin: number;
}

export class ReportService {
  /**
   * Gera resumo consolidado a partir de AuditItems.
   */
  gerarResumo(items: AuditItem[]): ReportSummary {
    const totalHEMin = items.reduce((s, i) => s + i.heEfetivaMin, 0);
    const totalExcedenteMin = items.reduce((s, i) => s + i.excedenteMin, 0);
    const totalDentroPadraoMin = items
      .filter(i => i.excedenteClassificacao === 'dentro_padrao')
      .reduce((s, i) => s + i.heEfetivaMin, 0);
    const totalAcimaPadraoMin = items
      .filter(i => i.excedenteClassificacao === 'acima_padrao')
      .reduce((s, i) => s + i.excedenteMin, 0);

    const motoristasPendentes = items.filter(i => !i.resolvido).length;
    const motoristasResolvidos = items.filter(i => i.resolvido).length;

    const conformes = items.filter(i => i.excedenteClassificacao === 'dentro_padrao' && !i.interjornadaDeficit).length;
    const percentualConformidade = items.length > 0 ? Math.round((conformes / items.length) * 100) : 100;

    return {
      totalHEMin,
      totalExcedenteMin,
      totalDentroPadraoMin,
      totalAcimaPadraoMin,
      motoristasPendentes,
      motoristasResolvidos,
      percentualConformidade,
    };
  }

  /**
   * Consolida métricas agrupadas por Setor.
   */
  gerarEstatisticasSetor(items: AuditItem[]): SetorStat[] {
    const map = new Map<string, { totalHE: number; totalExc: number; drivers: Set<string>; count: number }>();

    for (const item of items) {
      const setor = item.setor || 'Não informado';
      if (!map.has(setor)) {
        map.set(setor, { totalHE: 0, totalExc: 0, drivers: new Set(), count: 0 });
      }
      const st = map.get(setor)!;
      st.totalHE += item.heEfetivaMin;
      st.totalExc += item.excedenteMin;
      st.drivers.add(item.motoristaNormalizado);
      st.count += 1;
    }

    return Array.from(map.entries()).map(([setor, data]) => ({
      setor,
      totalHEMin: data.totalHE,
      totalExcedenteMin: data.totalExc,
      motoristasCount: data.drivers.size,
      ocorrenciasCount: data.count,
    })).sort((a, b) => b.totalExcedenteMin - a.totalExcedenteMin);
  }

  /**
   * Consolida métricas por dia da semana (Segunda a Domingo).
   */
  gerarEstatisticasDiaSemana(items: AuditItem[]): DiaSemanaStat[] {
    const nomesDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const map = new Map<number, { he: number; exc: number }>();
    for (let i = 0; i < 7; i++) map.set(i, { he: 0, exc: 0 });

    for (const item of items) {
      const d = new Date(item.data + 'T00:00:00');
      const dayIdx = isNaN(d.getDay()) ? 0 : d.getDay();
      const curr = map.get(dayIdx)!;
      curr.he += item.heEfetivaMin;
      curr.exc += item.excedenteMin;
    }

    // Ordenar de Segunda a Domingo
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map(idx => ({
      dia: nomesDias[idx],
      totalHEMin: map.get(idx)!.he,
      totalExcedenteMin: map.get(idx)!.exc,
    }));
  }

  /**
   * Top motoristas com maior volume de horas extras ou excedente.
   */
  gerarTopMotoristasExcedente(items: AuditItem[], topN = 5) {
    const map = new Map<string, { motorista: string; excedenteMin: number; heMin: number; count: number }>();
    for (const item of items) {
      if (!map.has(item.motoristaNormalizado)) {
        map.set(item.motoristaNormalizado, {
          motorista: item.motorista,
          excedenteMin: 0,
          heMin: 0,
          count: 0,
        });
      }
      const row = map.get(item.motoristaNormalizado)!;
      row.excedenteMin += item.excedenteMin;
      row.heMin += item.heEfetivaMin;
      row.count += 1;
    }

    return Array.from(map.values())
      .sort((a, b) => b.excedenteMin - a.excedenteMin)
      .slice(0, topN);
  }

  /**
   * Identifica motoristas com reincidência de excedente (> threshold no ciclo).
   */
  detectarReincidentes(items: AuditItem[], threshold = 5) {
    const counts = new Map<string, { motorista: string; count: number; totalExcedenteMin: number }>();
    for (const item of items) {
      if (item.excedenteMin > 0) {
        if (!counts.has(item.motoristaNormalizado)) {
          counts.set(item.motoristaNormalizado, {
            motorista: item.motorista,
            count: 0,
            totalExcedenteMin: 0,
          });
        }
        const c = counts.get(item.motoristaNormalizado)!;
        c.count += 1;
        c.totalExcedenteMin += item.excedenteMin;
      }
    }

    return Array.from(counts.values())
      .filter(c => c.count >= threshold)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Exporta relatório completo para XLSX (múltiplas abas) com download automático.
   */
  async exportarExcel(items: AuditItem[], filename = 'Jornada360_Relatorio_Auditoria.xlsx'): Promise<void> {
    const wb = XLSX.utils.book_new();

    // 1. Aba Resumo Geral
    const resumo = this.gerarResumo(items);
    const resumoAoa = [
      ['Jornada360 — Relatório Consolidado de Auditoria'],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      [],
      ['Métrica', 'Minutos', 'Formato HH:MM'],
      ['Total Horas Extras Efetivas', resumo.totalHEMin, minutesToHHMM(resumo.totalHEMin)],
      ['Total Horas Excedentes', resumo.totalExcedenteMin, minutesToHHMM(resumo.totalExcedenteMin)],
      ['Total Dentro do Padrão', resumo.totalDentroPadraoMin, minutesToHHMM(resumo.totalDentroPadraoMin)],
      ['Total Acima do Padrão', resumo.totalAcimaPadraoMin, minutesToHHMM(resumo.totalAcimaPadraoMin)],
      ['Total de Registros Auditados', items.length, ''],
      ['Conformidade Global (%)', `${resumo.percentualConformidade}%`, ''],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoAoa);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Geral');

    // 2. Aba Auditoria Detalhada
    const detalhadoAoa: any[][] = [
      [
        'Data',
        'Motorista',
        'CPF',
        'Matrícula',
        'Setor',
        'Causa Provável',
        'HE Efetiva (min)',
        'HE Efetiva (HH:MM)',
        'HE Prevista (min)',
        'Excedente (min)',
        'Classificação Excedente',
        'Interjornada (min)',
        'Déficit Interjornada (min)',
        'Status Resolução',
        'Justificativa',
      ],
    ];

    for (const item of items) {
      detalhadoAoa.push([
        item.data,
        item.motorista,
        item.cpf || '',
        item.matricula || '',
        item.setor || '',
        item.causaProvavel || item.causaSugerida || '',
        item.heEfetivaMin,
        minutesToHHMM(item.heEfetivaMin),
        item.hePrevistaMin,
        item.excedenteMin,
        item.excedenteClassificacao,
        item.interjornadaMin ?? '',
        item.interjornadaDeficit ?? '',
        item.resolvido ? 'Resolvido' : 'Pendente',
        item.justificativa || '',
      ]);
    }
    const wsDetalhado = XLSX.utils.aoa_to_sheet(detalhadoAoa);
    XLSX.utils.book_append_sheet(wb, wsDetalhado, 'Auditoria Detalhada');

    // 3. Aba Batidas Conciliadas
    const batidasAoa: any[][] = [
      [
        'Motorista',
        'Data',
        'Tipo Batida',
        'Horário Ponto',
        'Horário Rastreio Cobli',
        'Diferença (min)',
        'Status Conciliação',
        'Placa Veículo',
      ],
    ];

    for (const item of items) {
      for (const bc of item.batidasConciliadas) {
        batidasAoa.push([
          item.motorista,
          item.data,
          bc.batida.type,
          bc.batida.rawString,
          bc.eventoRastreio ? (bc.batida.type === 'entrada' ? bc.eventoRastreio.partida.toLocaleTimeString('pt-BR') : bc.eventoRastreio.parada.toLocaleTimeString('pt-BR')) : 'Sem sinal',
          bc.diferencaMin === 999 ? 'N/A' : bc.diferencaMin,
          bc.status,
          bc.eventoRastreio?.placa || '',
        ]);
      }
    }
    const wsBatidas = XLSX.utils.aoa_to_sheet(batidasAoa);
    XLSX.utils.book_append_sheet(wb, wsBatidas, 'Batidas Conciliadas');

    // 4. Aba Resumo por Setor
    const setorStats = this.gerarEstatisticasSetor(items);
    const setorAoa: any[][] = [
      ['Setor', 'Total HE (min)', 'Total HE (HH:MM)', 'Excedente (min)', 'Excedente (HH:MM)', 'Qtd Motoristas', 'Ocorrências'],
    ];
    for (const st of setorStats) {
      setorAoa.push([
        st.setor,
        st.totalHEMin,
        minutesToHHMM(st.totalHEMin),
        st.totalExcedenteMin,
        minutesToHHMM(st.totalExcedenteMin),
        st.motoristasCount,
        st.ocorrenciasCount,
      ]);
    }
    const wsSetor = XLSX.utils.aoa_to_sheet(setorAoa);
    XLSX.utils.book_append_sheet(wb, wsSetor, 'Resumo por Setor');

    // Download no browser
    XLSX.writeFile(wb, filename);
  }
}

export const reportService = new ReportService();
