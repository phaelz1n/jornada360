// ============================================================
// AuditEngine — Motor de Conciliação e Auditoria Completo
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type { AuditItem, BatidaConciliada, ConciliationStatus, ExcedenteClassificacao } from '@/types/audit';
import type { PointRecord, ClockEvent } from '@/types/point';
import type { TrackingRecord, VehicleEvent } from '@/types/tracking';
import type { StandardSchedule, ScaleEntry } from '@/types/schedule';
import type { WorkspaceConfig } from '@/types/workspace';
import { findBestMatch } from '@/lib/utils/matching';
import { diffMinutes } from '@/lib/utils/time';

export interface AuditInput {
  pontos: PointRecord[];
  rastreios: TrackingRecord[];
  horarios: StandardSchedule[];
  escalas: ScaleEntry[];
  pontosOntem?: PointRecord[];
  dateKey?: string;
  workspaceId?: string;
}

export class AuditEngine {
  constructor(private config: WorkspaceConfig) {}

  /**
   * Executa a auditoria completa cruzando todas as fontes de dados.
   */
  async audit(input: AuditInput): Promise<AuditItem[]> {
    const {
      pontos,
      rastreios,
      horarios,
      escalas,
      pontosOntem = [],
      dateKey = new Date().toISOString().slice(0, 10),
      workspaceId = 'default',
    } = input;

    // Indexar rastreios por motorista normalizado e data
    const trackingByDriver = new Map<string, VehicleEvent[]>();
    for (const tr of rastreios) {
      for (const ev of tr.eventos) {
        if (!trackingByDriver.has(ev.motoristaNormalizado)) {
          trackingByDriver.set(ev.motoristaNormalizado, []);
        }
        trackingByDriver.get(ev.motoristaNormalizado)!.push(ev);
      }
    }

    // Indexar horários por motorista normalizado
    const scheduleByDriver = new Map<string, StandardSchedule>();
    for (const h of horarios) {
      scheduleByDriver.set(h.nomeNormalizado, h);
    }

    // Indexar escalas por motorista normalizado
    const scaleByDriver = new Map<string, ScaleEntry>();
    for (const sc of escalas) {
      scaleByDriver.set(sc.motoristaNormalizado, sc);
    }

    // Indexar pontos de ontem por motorista normalizado
    const pontoOntemByDriver = new Map<string, PointRecord>();
    for (const po of pontosOntem) {
      pontoOntemByDriver.set(po.nomeNormalizado, po);
    }

    const auditItems: AuditItem[] = [];

    for (const ponto of pontos) {
      const driverNorm = ponto.nomeNormalizado;

      // 1. Encontrar Horário Padrão (direto ou fuzzy match)
      let schedule = scheduleByDriver.get(driverNorm);
      if (!schedule && horarios.length > 0) {
        const match = findBestMatch(
          driverNorm,
          ponto.cpf,
          ponto.matricula,
          horarios.map(h => ({ nome: h.nome, nomeNormalizado: h.nomeNormalizado })),
          this.config.fuzzyMatchThreshold || 0.85
        );
        if (match) {
          schedule = scheduleByDriver.get(match.target) || horarios.find(h => h.nome === match.target);
        }
      }

      // 2. Encontrar Escala
      let scale = scaleByDriver.get(driverNorm);
      if (!scale && escalas.length > 0) {
        const match = findBestMatch(
          driverNorm,
          ponto.cpf,
          ponto.matricula,
          escalas.map(s => ({ nome: s.motorista, nomeNormalizado: s.motoristaNormalizado })),
          this.config.fuzzyMatchThreshold || 0.85
        );
        if (match) {
          scale = scaleByDriver.get(match.target) || escalas.find(s => s.motorista === match.target);
        }
      }

      // 3. Encontrar Eventos de Rastreamento (com busca por match se necessário)
      let vehicleEvents = trackingByDriver.get(driverNorm) || [];
      if (vehicleEvents.length === 0 && rastreios.length > 0) {
        const candidateNames = Array.from(trackingByDriver.keys()).map(nameNorm => ({
          nome: nameNorm,
          nomeNormalizado: nameNorm,
        }));
        const match = findBestMatch(
          driverNorm,
          ponto.cpf,
          ponto.matricula,
          candidateNames,
          this.config.fuzzyMatchThreshold || 0.85
        );
        if (match) {
          vehicleEvents = trackingByDriver.get(match.target) || [];
        }
      }

      // 4. Calcular bestDayShift (-1, 0, 1)
      const { bestShift, shiftedEvents } = this.calculateBestDayShift(ponto.batidas, vehicleEvents);

      // 5. Conciliação batida a batida
      const batidasConciliadas = this.conciliarBatidas(ponto.batidas, shiftedEvents);

      // 6. Cálculo de Horas Extras e Excedente
      const heEfetivaMin = ponto.he1Min + ponto.he2Min;
      const hePrevistaMin = schedule ? Math.max(0, schedule.extraPadraoMin) : 0;
      
      let excedenteMin = 0;
      let excedenteClassificacao: ExcedenteClassificacao = 'dentro_padrao';

      if (!schedule) {
        excedenteClassificacao = 'sem_referencia';
        excedenteMin = heEfetivaMin;
      } else if (schedule.isInconsistente) {
        excedenteClassificacao = 'cadastro_inconsistente';
        excedenteMin = heEfetivaMin;
      } else {
        const diff = heEfetivaMin - hePrevistaMin;
        const tol = this.config.toleranciaPadraoMin ?? 10;
        if (diff > tol) {
          excedenteClassificacao = 'acima_padrao';
          excedenteMin = Math.max(0, diff);
        } else {
          excedenteClassificacao = 'dentro_padrao';
          excedenteMin = 0;
        }
      }

      // 7. Cálculo de Interjornada
      let interjornadaMin: number | undefined = undefined;
      let interjornadaDeficit: number | undefined = undefined;

      const pontoOntem = pontoOntemByDriver.get(driverNorm);
      if (pontoOntem && pontoOntem.batidas.length > 0 && ponto.batidas.length > 0) {
        const lastExitYesterday = pontoOntem.batidas[pontoOntem.batidas.length - 1].time;
        const firstEntryToday = ponto.batidas[0].time;

        const diffMs = firstEntryToday.getTime() - lastExitYesterday.getTime();
        interjornadaMin = Math.round(diffMs / 60000);

        const requiredMin = this.config.toleranciaInterjornadaMin || 660; // 11h
        if (interjornadaMin < requiredMin && interjornadaMin > 0) {
          interjornadaDeficit = requiredMin - interjornadaMin;
        }
      }

      // 8. Heurística de Causa Provável e Setor
      const { causaSugerida, setorSugerido } = this.inferirCausaESetor(
        ponto,
        batidasConciliadas,
        excedenteMin,
        excedenteClassificacao,
        interjornadaDeficit
      );

      const auditItem: AuditItem = {
        id: uuidv4(),
        workspaceId,
        data: ponto.data || dateKey,
        motorista: ponto.nome,
        motoristaNormalizado: driverNorm,
        cpf: ponto.cpf,
        matricula: ponto.matricula,

        ponto,
        rastreio: vehicleEvents.length > 0 ? { id: uuidv4(), data: ponto.data, eventos: vehicleEvents } : undefined,
        horarioPadrao: schedule,
        escala: scale,

        batidasConciliadas,
        bestDayShift: bestShift,

        heEfetivaMin,
        hePrevistaMin,
        excedenteMin,
        excedenteClassificacao,

        interjornadaMin,
        interjornadaDeficit,

        resolvido: false,
        causaSugerida,
        causaProvavel: causaSugerida,
        setor: setorSugerido,

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      auditItems.push(auditItem);
    }

    return auditItems;
  }

  /**
   * Avalia shifts de dia (-1, 0, +1) para encontrar a melhor correlação de horário.
   */
  private calculateBestDayShift(
    batidas: ClockEvent[],
    events: VehicleEvent[]
  ): { bestShift: -1 | 0 | 1; shiftedEvents: VehicleEvent[] } {
    if (batidas.length === 0 || events.length === 0) {
      return { bestShift: 0, shiftedEvents: events };
    }

    const shifts: (-1 | 0 | 1)[] = [0, 1, -1];
    let minScore = Infinity;
    let bestShift: -1 | 0 | 1 = 0;

    for (const shift of shifts) {
      let totalDiff = 0;
      for (const b of batidas) {
        let bestEvDiff = Infinity;
        for (const ev of events) {
          // Ajusta a data do evento pelo shift em dias
          const shiftedPartida = new Date(ev.partida.getTime() + shift * 86400000);
          const diffP = diffMinutes(b.time, shiftedPartida);
          const shiftedParada = new Date(ev.parada.getTime() + shift * 86400000);
          const diffF = diffMinutes(b.time, shiftedParada);
          const d = Math.min(diffP, diffF);
          if (d < bestEvDiff) bestEvDiff = d;
        }
        totalDiff += bestEvDiff;
      }

      if (totalDiff < minScore) {
        minScore = totalDiff;
        bestShift = shift;
      }
    }

    // Aplica o melhor shift nos eventos para a conciliação
    const shiftedEvents = events.map(ev => ({
      ...ev,
      partida: new Date(ev.partida.getTime() + bestShift * 86400000),
      parada: new Date(ev.parada.getTime() + bestShift * 86400000),
    }));

    return { bestShift, shiftedEvents };
  }

  /**
   * Cruza cada batida com o evento de rastreio mais próximo.
   */
  private conciliarBatidas(
    batidas: ClockEvent[],
    events: VehicleEvent[]
  ): BatidaConciliada[] {
    const toleranciaPadrao = this.config.toleranciaPadraoMin ?? 15;
    const toleranciaLeve = this.config.toleranciaDivLeveMin ?? 60;

    return batidas.map(b => {
      if (events.length === 0) {
        return {
          batida: b,
          diferencaMin: 999,
          status: 'sem_cobertura',
        };
      }

      let closestEv: VehicleEvent | undefined = undefined;
      let minDiff = Infinity;

      for (const ev of events) {
        // Se a batida for entrada, compara com início/partida do veículo
        // Se for saída, compara com fim/parada do veículo
        const evTarget = b.type === 'entrada' ? ev.partida : ev.parada;
        const diff = diffMinutes(b.time, evTarget);
        if (diff < minDiff) {
          minDiff = diff;
          closestEv = ev;
        }
      }

      let status: ConciliationStatus = 'sem_cobertura';
      if (minDiff <= toleranciaPadrao) {
        status = 'confirmado';
      } else if (minDiff <= toleranciaLeve) {
        status = 'divergencia_leve';
      } else if (minDiff <= 240) { // até 4 horas
        status = 'divergencia_forte';
      } else {
        status = 'sem_cobertura';
      }

      return {
        batida: b,
        eventoRastreio: closestEv,
        diferencaMin: Math.round(minDiff),
        status,
      };
    });
  }

  /**
   * Motor heurístico para identificar causas e sugerir o setor responsável.
   */
  private inferirCausaESetor(
    ponto: PointRecord,
    batidasConciliadas: BatidaConciliada[],
    excedenteMin: number,
    excedenteClassificacao: ExcedenteClassificacao,
    interjornadaDeficit?: number
  ): { causaSugerida: string; setorSugerido: string } {
    // 1. Déficit de Interjornada
    if (interjornadaDeficit && interjornadaDeficit > 0) {
      return {
        causaSugerida: 'Déficit de Interjornada (< 11h regulamentares)',
        setorSugerido: 'Operações',
      };
    }

    // 2. Cadastro inconsistente / Sem horário padrão
    if (excedenteClassificacao === 'cadastro_inconsistente') {
      return {
        causaSugerida: 'Cadastro de Horário Padrão Inconsistente (EXTRA negativo)',
        setorSugerido: 'Recursos Humanos',
      };
    }
    if (excedenteClassificacao === 'sem_referencia') {
      return {
        causaSugerida: 'Motorista sem Horário Padrão Homologado',
        setorSugerido: 'Recursos Humanos',
      };
    }

    // 3. Batidas sem cobertura de rastreador
    const semCob = batidasConciliadas.filter(b => b.status === 'sem_cobertura');
    if (semCob.length === batidasConciliadas.length && batidasConciliadas.length > 0) {
      return {
        causaSugerida: 'Veículo Sem Comunicação / Rastreador Inativo',
        setorSugerido: 'Manutenção',
      };
    }

    // 4. Divergência forte (> 60 min)
    const divForte = batidasConciliadas.find(b => b.status === 'divergencia_forte');
    if (divForte) {
      if (divForte.batida.type === 'saida') {
        return {
          causaSugerida: 'Retardo de Saída no Ponto vs Desligamento do Veículo',
          setorSugerido: 'Operações',
        };
      }
      return {
        causaSugerida: 'Início de Rota Divergente do Ponto Registrado',
        setorSugerido: 'Tráfego',
      };
    }

    // 5. Excedente elevado com rastreamento confirmado
    if (excedenteMin > 120) {
      return {
        causaSugerida: 'Viagem Longa / Rota Estendida por Demanda',
        setorSugerido: 'Logística',
      };
    }
    if (excedenteMin > 0) {
      return {
        causaSugerida: 'Atraso Operacional em Rota',
        setorSugerido: 'Operações',
      };
    }

    // 6. Jornada regular dentro do esperado
    return {
      causaSugerida: 'Jornada Regular Homologada',
      setorSugerido: 'Operações',
    };
  }

  /**
   * Recalcula o excedente após correção manual pelo usuário.
   */
  recalcularExcedente(item: AuditItem, heCorrigidaMin: number): AuditItem {
    const hePrevista = item.hePrevistaMin;
    const diff = heCorrigidaMin - hePrevista;
    const tol = this.config.toleranciaPadraoMin ?? 10;

    let novoExcedente = 0;
    let novaClassificacao: ExcedenteClassificacao = 'dentro_padrao';

    if (!item.horarioPadrao) {
      novaClassificacao = 'sem_referencia';
      novoExcedente = heCorrigidaMin;
    } else if (item.horarioPadrao.isInconsistente) {
      novaClassificacao = 'cadastro_inconsistente';
      novoExcedente = heCorrigidaMin;
    } else if (diff > tol) {
      novaClassificacao = 'acima_padrao';
      novoExcedente = Math.max(0, diff);
    } else {
      novaClassificacao = 'dentro_padrao';
      novoExcedente = 0;
    }

    return {
      ...item,
      heCorrigidaMin,
      excedenteMin: novoExcedente,
      excedenteClassificacao: novaClassificacao,
      resolvido: true,
      updatedAt: new Date(),
    };
  }
}
