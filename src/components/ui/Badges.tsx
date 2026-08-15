import type { ItemStatus, PadraoStatus } from '../../engine/heEngineCore';
import { statusLabel } from '../../engine/heEngineCore';
import type { Prioridade, StatusPendencia } from '../../domain/Pendencia';
import { PRIORIDADE_LABEL, STATUS_PENDENCIA_LABEL } from '../../domain/Pendencia';
import type { EstadoSla } from '../../services/slaService';
import { ESTADO_SLA_LABEL } from '../../services/slaService';

const ITEM_STATUS_MAP: Record<ItemStatus, string> = {
  forte: 'badge-red',
  leve: 'badge-orange',
  ok: 'badge-green',
  sem_dado: 'badge-gray',
};

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return <span className={`badge ${ITEM_STATUS_MAP[status]}`}>{statusLabel(status)}</span>;
}

const PADRAO_STATUS_MAP: Record<PadraoStatus, { label: string; cls: string }> = {
  acima: { label: 'Acima do padrão', cls: 'badge-red' },
  dentro: { label: 'Dentro do padrão', cls: 'badge-green' },
  sem_cadastro: { label: 'Sem padrão cadastrado', cls: 'badge-gray' },
  invalido: { label: 'Padrão parece errado', cls: 'badge-gray' },
};

export function PadraoStatusBadge({ status, excedenteMin }: { status: PadraoStatus; excedenteMin?: number }) {
  const p = PADRAO_STATUS_MAP[status];
  return (
    <span className={`badge ${p.cls}`}>
      {p.label}
      {status === 'acima' && typeof excedenteMin === 'number' ? ` (+${excedenteMin}min)` : ''}
    </span>
  );
}

/* StatusPendencia unificado (domain/Pendencia.ts). Os 5 primeiros vêm da derivação automática
 * (pendingClassificationService.statusDoCaso); 'aprovado'/'reprovado' só existem por decisão humana
 * de revisão (pendenciaService.aprovarPendencia/reprovarPendencia). */
const STATUS_PENDENCIA_MAP: Record<StatusPendencia, string> = {
  normal: 'badge-green',
  atencao: 'badge-yellow',
  divergencia: 'badge-red',
  pendente: 'badge-gray',
  justificado: 'badge-blue',
  aprovado: 'badge-purple',
  reprovado: 'badge-orange',
};

export function StatusPendenciaBadge({ status }: { status: StatusPendencia }) {
  return <span className={`badge ${STATUS_PENDENCIA_MAP[status]}`}>{STATUS_PENDENCIA_LABEL[status]}</span>;
}

/* Prioridade (Fase 2, Etapa 3) — cores em ordem decrescente de urgência visual, pra "o que é mais
 * urgente" saltar aos olhos na fila do Centro de Ações sem precisar ler o texto. */
const PRIORIDADE_MAP: Record<Prioridade, string> = {
  critica: 'badge-red',
  alta: 'badge-orange',
  media: 'badge-blue',
  baixa: 'badge-gray',
};

export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  return <span className={`badge ${PRIORIDADE_MAP[prioridade]}`}>{PRIORIDADE_LABEL[prioridade]}</span>;
}

/* Estado de SLA (Fase 2, Etapa 7) — vencido em vermelho pra saltar aos olhos no Centro de Ações. */
const ESTADO_SLA_MAP: Record<EstadoSla, string> = {
  sem_prazo: 'badge-gray',
  dentro_prazo: 'badge-green',
  proximo_vencimento: 'badge-yellow',
  vencido: 'badge-red',
  resolvida_dentro_prazo: 'badge-blue',
  resolvida_fora_prazo: 'badge-orange',
};

export function EstadoSlaBadge({ estado }: { estado: EstadoSla }) {
  return <span className={`badge ${ESTADO_SLA_MAP[estado]}`}>{ESTADO_SLA_LABEL[estado]}</span>;
}
