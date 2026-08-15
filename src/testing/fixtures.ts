/* Fábricas de dados para os testes.
 *
 * Existem para que cada teste declare APENAS o que é relevante para a regra que ele exercita —
 * um teste de tolerância não deveria precisar montar 20 campos de `HEItemRaw` que não influenciam
 * o resultado. Cada fábrica devolve um objeto válido e realista, e o teste sobrescreve o que
 * importa.
 *
 * Todos os nomes aqui são fictícios e genéricos, sem relação com operação real nenhuma. */
import type { HEDiaSnapshot, HEItemRaw, ItemStatus, PadraoStatus } from '../engine/heEngineCore';
import type { HEDiaComputed, HEItemComputed } from '../engine/useHEEngineData';
import type { Pendencia, Prioridade, StatusPendencia } from '../domain/Pendencia';
import type { WorkspaceConfig } from '../domain';
import { novoWorkspace } from '../domain';

export function itemRaw(over: Partial<HEItemRaw> = {}): HEItemRaw {
  return {
    motorista: 'Colaborador Teste',
    he1min: 120,
    he1str: '02:00',
    status: 'forte',
    rastreioStatus: 'forte',
    detalhe: '',
    confirmadas: '3/4',
    batidas: '08:00✅ 12:00✅ 13:00✅ 19:00❌',
    contexto: '',
    padraoStatus: 'acima',
    padraoMin: 60,
    excedenteMin: 60,
    padraoDebug: '',
    padraoHorarios: ['08:00–18:00'],
    setorAtual: 'Operacional',
    causaAtual: null,
    causaFonte: null,
    interjornada: '',
    intervalo: '',
    diaAjustado: 0,
    temLacuna: false,
    precisaVerificar: true,
    ...over,
  };
}

/* `HEItemComputed` é o que as telas e a maioria dos services consomem: o item bruto do motor mais
 * os campos derivados (prefixo `_`) que `useHEEngineData` calcula. */
export function itemComputed(over: Partial<HEItemComputed> = {}): HEItemComputed {
  const base = itemRaw(over as Partial<HEItemRaw>);
  const heMin = over._heMin ?? base.he1min;
  return {
    ...base,
    _key: over._key ?? base.motorista.toUpperCase(),
    _heMin: heMin,
    _heStr: over._heStr ?? '02:00',
    _corrigido: over._corrigido ?? false,
    _status: (over._status ?? base.status) as ItemStatus,
    _padraoStatus: (over._padraoStatus ?? base.padraoStatus) as PadraoStatus,
    _excedenteMin: over._excedenteMin ?? base.excedenteMin,
    _done: over._done ?? false,
    _setor: over._setor ?? base.setorAtual,
    _causa: over._causa ?? '',
    _justificativa: over._justificativa ?? '',
    ...over,
  };
}

export function diaComputed(dateKey: string, items: HEItemComputed[]): HEDiaComputed {
  const totalHEAtual = items.reduce((s, i) => s + i._heMin, 0);
  return {
    dateKey,
    dateLabel: dateKey.split('-').reverse().join('/'),
    items,
    totalHEAtual,
    acimaHEAtual: items.filter((i) => i._padraoStatus === 'acima').reduce((s, i) => s + i._heMin, 0),
    programadoHEAtual: items.filter((i) => i._padraoStatus === 'dentro').reduce((s, i) => s + i._heMin, 0),
    pendentes: items.filter((i) => i._padraoStatus !== 'dentro' && !i._done).length,
  };
}

export function snapshot(dateKey: string, items: HEItemRaw[]): HEDiaSnapshot {
  return {
    dateKey,
    dateLabel: dateKey.split('-').reverse().join('/'),
    items,
    totalHE: items.reduce((s, i) => s + i.he1min, 0),
    acimaHE: 0,
    programadoHE: 0,
    semPadraoCount: 0,
    avisoPadrao: '',
  };
}

export function pendencia(over: Partial<Pendencia> = {}): Pendencia {
  const agora = '2026-08-01T10:00:00.000Z';
  return {
    id: 'pend-teste-2026-08-01-COLABORADOR TESTE',
    workspaceId: 'teste',
    colaboradorId: null,
    data: '2026-08-01',
    tipo: 'divergencia_he',
    categoria: 'Não classificada',
    status: 'divergencia' as StatusPendencia,
    prioridade: 'media' as Prioridade,
    origem: 'motor_he',
    descricao: '',
    evidencias: [],
    recomendacao: null,
    responsavelId: null,
    prazo: null,
    criadaEm: agora,
    atualizadaEm: agora,
    resolvidaEm: null,
    resolucao: null,
    revisadoPor: null,
    revisadoEm: null,
    observacaoRevisao: null,
    ...over,
  };
}

export function workspace(over: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
  return { ...novoWorkspace('teste', 'real', 'Empresa de Teste'), ...over };
}
