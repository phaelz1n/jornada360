import { useCallback, useEffect, useMemo } from 'react';
import {
  heEfetivo,
  itemKey,
  minToStr,
  resolvedSetor,
  type HECaseState,
  type HEItemRaw,
  type ItemStatus,
  type PadraoStatus,
} from './heEngineCore';
import { classificar } from '../services/toleranceService';
import { useWorkspace } from '../workspace/WorkspaceContext';
import type { DiaBruto } from '../data/tipos';

export interface HEItemComputed extends HEItemRaw {
  _key: string;
  _heMin: number;
  _heStr: string;
  _corrigido: boolean;
  _status: ItemStatus;
  _padraoStatus: PadraoStatus;
  _excedenteMin: number;
  _done: boolean;
  _setor: string;
  _causa: string;
  _justificativa: string;
}

export interface HEDiaComputed {
  dateKey: string;
  dateLabel: string;
  items: HEItemComputed[];
  totalHEAtual: number;
  acimaHEAtual: number;
  programadoHEAtual: number;
  pendentes: number;
}

/* Evento próprio para avisar que o motor (que roda dentro do iframe) gravou alguma coisa.
 *
 * O motor continua escrevendo no `localStorage` da própria origem — ele não foi alterado, e não
 * deve ser. Quem leva o resultado ao servidor é o adaptador em MotorHE.tsx, não o motor. */
const SYNC_EVENT = 'jornada360:he-sync';
export function notificarSincronizacao() {
  window.dispatchEvent(new Event(SYNC_EVENT));
}

function computeDia(dia: DiaBruto, toleranceMin: number): HEDiaComputed | null {
  const snap = dia.snapshot;
  if (!snap) return null;
  const cs = dia.caseState ?? {};
  const items: HEItemComputed[] = snap.items.map((it: HEItemRaw) => {
    const key = itemKey(it);
    const c: HECaseState = cs[key] || {};
    const heMin = heEfetivo(it, c);
    const reclass = classificar(it, heMin, toleranceMin);
    return {
      ...it,
      _key: key,
      _heMin: heMin,
      _heStr: minToStr(heMin),
      _corrigido: heMin !== it.he1min,
      _status: reclass.status,
      _padraoStatus: reclass.padraoStatus,
      _excedenteMin: reclass.excedenteMin,
      _done: !!c.done,
      _setor: resolvedSetor(it, c),
      _causa: (c.causa && c.causa.trim()) || it.causaAtual || '',
      _justificativa: c.justificativa || '',
    };
  });
  const totalHEAtual = items.reduce((s, it) => s + it._heMin, 0);
  const acimaHEAtual = items.filter((it) => it._padraoStatus === 'acima').reduce((s, it) => s + it._heMin, 0);
  const programadoHEAtual = items.filter((it) => it._padraoStatus === 'dentro').reduce((s, it) => s + it._heMin, 0);
  const pendentes = items.filter((it) => it._padraoStatus !== 'dentro' && !it._done).length;
  return {
    dateKey: snap.dateKey,
    dateLabel: snap.dateLabel,
    items,
    totalHEAtual,
    acimaHEAtual,
    programadoHEAtual,
    pendentes,
  };
}

/* Dias processados pelo motor, já reclassificados pela tolerância CONFIGURADA da empresa ativa.
 *
 * MUDANÇA DA FASE 4: os dias não são mais lidos do `localStorage` aqui. Eles chegam prontos do
 * provedor de empresa, que os buscou do servidor (empresa real) ou do navegador (demonstração).
 * O cálculo abaixo é EXATAMENTE o de antes — nenhuma regra mudou, nenhuma tela precisou mudar.
 *
 * As alterações (`marcarCampo`, `limparHistorico`) passam pelo conjunto de repositórios ativo e
 * recarregam o estado depois, para que a tela mostre o que o servidor confirmou, e não o que o
 * navegador supôs. */
export function useHEEngineData() {
  const { dias: diasBrutos, workspace, recarregar, gravar } = useWorkspace();
  const toleranceMin = workspace.rules.toleranceMin;

  /* O motor grava no localStorage de dentro do iframe; este evento avisa o app para reler. No modo
   * remoto, quem envia ao servidor é MotorHE.tsx — aqui só reagimos ao "algo mudou". */
  useEffect(() => {
    const aoSincronizar = () => void recarregar();
    window.addEventListener(SYNC_EVENT, aoSincronizar);
    return () => window.removeEventListener(SYNC_EVENT, aoSincronizar);
  }, [recarregar]);

  const dias = useMemo(
    () => diasBrutos.map((d) => computeDia(d, toleranceMin)).filter((d): d is HEDiaComputed => d !== null),
    [diasBrutos, toleranceMin],
  );

  const marcarCampo = useCallback(
    (dk: string, motorista: string, patch: Partial<HECaseState>) =>
      gravar((r, ctx) => r.atualizarCaso(ctx.empresaId, dk, itemKey({ motorista } as HEItemRaw), patch)),
    [gravar],
  );

  const limparHistorico = useCallback(() => gravar((r, ctx) => r.limparDias(ctx.empresaId)), [gravar]);

  const refresh = useCallback(() => void recarregar(), [recarregar]);

  return { dias, refresh, marcarCampo, limparHistorico };
}
