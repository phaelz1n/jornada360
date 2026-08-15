/* Taxonomia unificada de status de uma ocorrência (Fase 2, Etapa 1 — ver ROADMAP.md). Nenhuma
 * lógica de cálculo vive aqui — a derivação a partir do que o motor real já calcula vive em
 * services/pendingClassificationService.ts, com a regra de cada valor documentada lá e em
 * BUSINESS_RULES.md. */
export type StatusPendencia =
  | 'normal'
  | 'atencao'
  | 'divergencia'
  | 'pendente'
  | 'justificado'
  | 'aprovado'
  | 'reprovado';

export const STATUS_PENDENCIA_LABEL: Record<StatusPendencia, string> = {
  normal: 'Normal',
  atencao: 'Atenção',
  divergencia: 'Divergência',
  pendente: 'Pendente',
  justificado: 'Justificado',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
};

/* Prioridade (Fase 2, Etapa 2) — sem algoritmo automático ainda. Toda Pendencia nova nasce em
 * PRIORIDADE_NEUTRA; mudar a prioridade é uma ação manual (ver pendenciaService.atualizarPrioridade),
 * preparada pra virar automática numa etapa futura (ex.: derivar de excedente/reincidência/tempo em
 * aberto) sem precisar mudar o tipo nem quem já consome `prioridade`. */
export type Prioridade = 'baixa' | 'media' | 'alta' | 'critica';

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const PRIORIDADE_NEUTRA: Prioridade = 'media';

/* Só existe uma origem hoje (o Assistente HE Diário) — união de um valor só, deliberadamente, pra
 * não inventar fontes que ainda não existem. Cresce quando houver outro detector real (ex.:
 * interjornada/intervalo via journeyService, ou uma integração de rastreamento). */
export type OrigemPendencia = 'motor_he';

/* Unidade de trabalho rastreável do Jornada360 (Fase 2, Etapa 2). Representa uma ocorrência que
 * precisa ser acompanhada — criada a partir do que o motor real já analisa, não uma reimplementação
 * da análise. O motor continua responsável por decidir "há uma divergência aqui"; esta entidade é
 * responsável por rastrear o QUE fazer com isso (prioridade, responsável, prazo, resolução, revisão).
 *
 * Ver services/pendenciaService.ts para como cada campo é preenchido, e BUSINESS_RULES.md para as
 * limitações de cada um (em especial `colaboradorId`, que hoje é best-effort por decisão explícita,
 * não por omissão). */
export interface Pendencia {
  id: string;
  workspaceId: string;
  /** Best-effort: match por nome normalizado contra EmployeeRepository. null se não encontrado —
   *  cadastro de Colaboradores não é obrigatório bater com a planilha (ver CONFIGURATION.md). */
  colaboradorId: string | null;
  data: string;
  tipo: string;
  categoria: string;
  status: StatusPendencia;
  prioridade: Prioridade;
  origem: OrigemPendencia;
  descricao: string;
  evidencias: string[];
  /** Sempre null nesta etapa — não existe motor de recomendação ainda (ver ROADMAP.md). */
  recomendacao: string | null;
  /** Fase 2, Etapa 6 — id de um `UserAccess` de `workspace.users`. null até alguém atribuir. */
  responsavelId: string | null;
  /** Fase 2, Etapa 6 — data-limite (`YYYY-MM-DD`), definida manualmente ou a partir da sugestão de
   *  `pendenciaService.sugerirPrazo` (nunca aplicada sozinha). null até alguém definir. */
  prazo: string | null;
  criadaEm: string;
  atualizadaEm: string;
  resolvidaEm: string | null;
  resolucao: string | null;
  /** Fase 2, Etapa 8 — quem revisou (string livre, mesmo padrão de `AuditEntry.usuario`; não há
   *  login real ainda, ver limitação em BUSINESS_RULES.md). null antes de qualquer revisão. */
  revisadoPor: string | null;
  /** Fase 2, Etapa 8 — quando a revisão (aprovação/reprovação) aconteceu. null antes disso. */
  revisadoEm: string | null;
  /** Fase 2, Etapa 8 — observação opcional da revisão. null se não preenchida. */
  observacaoRevisao: string | null;
}
