/* SLA/acompanhamento de prazo (Fase 2, Etapa 7) — puramente derivado de `Pendencia.prazo`
 * (definido por alguém, Etapa 6) e `workspace.rules.alertaAntecedenciaDias` (configurável, nunca um
 * limiar fixo no código). Não recalcula nada do motor, não decide prioridade — só classifica um
 * prazo que já existe. Se `prazo` for null, o estado é sempre `sem_prazo`: nunca se inventa uma
 * data-limite implícita. */
import { estadoResolvido } from './pendenciaService';
import type { Pendencia } from '../domain/Pendencia';

export type EstadoSla =
  | 'sem_prazo'
  | 'dentro_prazo'
  | 'proximo_vencimento'
  | 'vencido'
  | 'resolvida_dentro_prazo'
  | 'resolvida_fora_prazo';

export const ESTADO_SLA_LABEL: Record<EstadoSla, string> = {
  sem_prazo: 'Sem prazo definido',
  dentro_prazo: 'Dentro do prazo',
  proximo_vencimento: 'Prazo próximo',
  vencido: 'Prazo vencido',
  resolvida_dentro_prazo: 'Resolvida dentro do prazo',
  resolvida_fora_prazo: 'Resolvida fora do prazo',
};

function hojeStr(hoje: Date): string {
  return hoje.toISOString().slice(0, 10);
}

/* `hoje` é parâmetro (default = agora) só pra permitir teste determinístico; a UI sempre chama sem
 * o segundo argumento, usando a data real do sistema — nunca uma data fixa (mesmo princípio já
 * aplicado em Sidebar.dataRodape() desde a Fase 1.1). */
export function calcularEstadoSla(pendencia: Pendencia, alertaAntecedenciaDias: number, hoje: Date = new Date()): EstadoSla {
  if (!pendencia.prazo) return 'sem_prazo';

  if (estadoResolvido(pendencia.status)) {
    if (!pendencia.resolvidaEm) return 'sem_prazo';
    const resolvidaData = pendencia.resolvidaEm.slice(0, 10);
    return resolvidaData <= pendencia.prazo ? 'resolvida_dentro_prazo' : 'resolvida_fora_prazo';
  }

  const agoraStr = hojeStr(hoje);
  if (agoraStr > pendencia.prazo) return 'vencido';

  const alerta = new Date(`${pendencia.prazo}T00:00:00`);
  alerta.setDate(alerta.getDate() - alertaAntecedenciaDias);
  if (agoraStr >= hojeStr(alerta)) return 'proximo_vencimento';

  return 'dentro_prazo';
}

/* Quantos dias de atraso (sempre ≥ 1) — só chamado quando o estado já é 'vencido', pra montar a
 * nota de explicação (pendingExplanationService). Não usa `Date.now()` implícito: `hoje` é sempre
 * passado explicitamente pelo chamador, pra ficar coerente com o que `calcularEstadoSla` já decidiu. */
export function diasDeAtraso(prazo: string, hoje: Date = new Date()): number {
  const prazoDate = new Date(`${prazo}T00:00:00`);
  const hojeDate = new Date(`${hojeStr(hoje)}T00:00:00`);
  const diffMs = hojeDate.getTime() - prazoDate.getTime();
  return Math.max(1, Math.round(diffMs / 86_400_000));
}
