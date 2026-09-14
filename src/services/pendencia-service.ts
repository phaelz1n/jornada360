// ============================================================
// PendenciaService — Gestão Completa de Pendências e SLA
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type { Pendencia, PendenciaFilters, PendenciaStatus, StatusChange } from '@/types/pendencia';
import type { AuditItem } from '@/types/audit';
import type { IDataAdapter } from '@/lib/db/adapter';

export class PendenciaService {
  constructor(private adapter: IDataAdapter) {}

  async listar(workspaceId: string, filters?: PendenciaFilters): Promise<Pendencia[]> {
    return this.adapter.getPendencias(workspaceId, filters);
  }

  async criar(pendencia: Pendencia): Promise<void> {
    return this.adapter.savePendencia(pendencia);
  }

  async atualizarStatus(
    id: string,
    novoStatus: PendenciaStatus,
    usuario: string,
    observacao?: string,
    workspaceId: string = 'default'
  ): Promise<void> {
    const list = await this.adapter.getPendencias(workspaceId);
    const existing = list.find(p => p.id === id);

    const change: StatusChange = {
      de: existing ? existing.status : 'nova',
      para: novoStatus,
      usuario,
      timestamp: new Date(),
      observacao,
    };

    const historico = existing ? [...existing.historicoStatus, change] : [change];

    await this.adapter.updatePendencia(id, {
      status: novoStatus,
      historicoStatus: historico,
      updatedAt: new Date(),
    });
  }

  async resolver(
    id: string,
    resolucao: string,
    usuario: string,
    workspaceId: string = 'default'
  ): Promise<void> {
    await this.atualizarStatus(id, 'resolvida', usuario, `Resolvido: ${resolucao}`, workspaceId);
    await this.adapter.updatePendencia(id, {
      resolucao,
      updatedAt: new Date(),
    });
  }

  /**
   * Gera pendências automáticas a partir de itens de auditoria com não-conformidades.
   */
  async autoGerarDeAuditoria(items: AuditItem[], workspaceId: string): Promise<Pendencia[]> {
    const existing = await this.adapter.getPendencias(workspaceId);
    const existingMap = new Set(existing.map(p => `${p.auditItemId}_${p.tipo}`));
    const criadas: Pendencia[] = [];

    for (const item of items) {
      // 1. Excedente acima do padrão
      if (item.excedenteClassificacao === 'acima_padrao' && item.excedenteMin > 0) {
        const key = `${item.id}_excedente`;
        if (!existingMap.has(key)) {
          const p: Pendencia = {
            id: uuidv4(),
            workspaceId,
            auditItemId: item.id,
            motorista: item.motorista,
            data: item.data,
            tipo: 'excedente',
            descricao: `Excedente de HE de ${item.excedenteMin} min acima da previsão (${item.hePrevistaMin} min previstos, ${item.heEfetivaMin} min realizados). Causa sugerida: ${item.causaSugerida}`,
            prioridade: item.excedenteMin > 120 ? 'alta' : 'media',
            status: 'nova',
            slaVencimento: new Date(Date.now() + 48 * 3600 * 1000), // 48h SLA
            historicoStatus: [
              {
                de: 'nova',
                para: 'nova',
                usuario: 'Sistema Jornada360',
                timestamp: new Date(),
                observacao: 'Criado automaticamente pelo motor de auditoria',
              },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await this.adapter.savePendencia(p);
          criadas.push(p);
          existingMap.add(key);
        }
      }

      // 2. Interjornada não cumprida
      if (item.interjornadaDeficit && item.interjornadaDeficit > 0) {
        const key = `${item.id}_interjornada`;
        if (!existingMap.has(key)) {
          const p: Pendencia = {
            id: uuidv4(),
            workspaceId,
            auditItemId: item.id,
            motorista: item.motorista,
            data: item.data,
            tipo: 'interjornada',
            descricao: `Déficit de interjornada de ${item.interjornadaDeficit} min (apenas ${item.interjornadaMin} min de descanso entre jornadas, exigido 660 min).`,
            prioridade: 'critica',
            status: 'nova',
            slaVencimento: new Date(Date.now() + 24 * 3600 * 1000), // 24h SLA para CLT
            historicoStatus: [
              {
                de: 'nova',
                para: 'nova',
                usuario: 'Sistema Jornada360',
                timestamp: new Date(),
                observacao: 'Alerta legal CLT Art. 66',
              },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await this.adapter.savePendencia(p);
          criadas.push(p);
          existingMap.add(key);
        }
      }

      // 3. Divergência forte com rastreamento
      const hasDivForte = item.batidasConciliadas.some(b => b.status === 'divergencia_forte');
      if (hasDivForte) {
        const key = `${item.id}_divergencia`;
        if (!existingMap.has(key)) {
          const p: Pendencia = {
            id: uuidv4(),
            workspaceId,
            auditItemId: item.id,
            motorista: item.motorista,
            data: item.data,
            tipo: 'divergencia',
            descricao: `Divergência severa (> 60 min) entre batida de ponto e telemetria veicular. Necessária apuração operacional.`,
            prioridade: 'alta',
            status: 'nova',
            slaVencimento: new Date(Date.now() + 48 * 3600 * 1000),
            historicoStatus: [
              {
                de: 'nova',
                para: 'nova',
                usuario: 'Sistema Jornada360',
                timestamp: new Date(),
                observacao: 'Conflito de telemetria Cobli',
              },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await this.adapter.savePendencia(p);
          criadas.push(p);
          existingMap.add(key);
        }
      }
    }

    return criadas;
  }
}
