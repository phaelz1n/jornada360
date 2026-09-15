// ============================================================
// Default Constants & Configuration
// ============================================================

export const DEFAULTS = {
  /** Tolerância de excedente de HE em minutos */
  TOLERANCIA_PADRAO_MIN: 10,
  /** Limite de divergência leve (minutos) */
  TOLERANCIA_DIV_LEVE_MIN: 60,
  /** Mínimo de interjornada em minutos (11 horas) */
  INTERJORNADA_MIN: 660,
  /** Meta diária de HE em minutos (36h10min = 2170min) */
  META_DIARIA_HE_MIN: 2170,
  /** Threshold de similaridade para fuzzy matching */
  FUZZY_THRESHOLD: 0.85,
  /** Ciclo de fechamento padrão */
  CICLO: { diaInicio: 28, diaFim: 27 },
  /** Intervalos mínimos em minutos */
  INTERVALOS: { primeiroMin: 60, segundoMin: 15 },
} as const;

/** Labels para status de pendência */
export const PENDENCIA_STATUS_LABELS: Record<string, string> = {
  nova: 'Nova',
  em_analise: 'Em Análise',
  aguardando_gestor: 'Aguardando Gestor',
  aguardando_rh: 'Aguardando RH',
  resolvida: 'Resolvida',
  descartada: 'Descartada',
};

/** Labels para prioridades */
export const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

/** Cores semânticas para status de conciliação */
export const CONCILIATION_COLORS: Record<string, string> = {
  confirmado: '#10b981',        // green
  divergencia_leve: '#f59e0b',  // amber
  divergencia_forte: '#ef4444', // red
  sem_cobertura: '#6b7280',     // gray
};

/** Labels para classificação de excedente */
export const EXCEDENTE_LABELS: Record<string, string> = {
  dentro_padrao: 'Dentro do Padrão',
  acima_padrao: 'Acima do Padrão',
  sem_referencia: 'Sem Referência',
  cadastro_inconsistente: 'Cadastro Inconsistente',
};

/** Rotas de navegação do sistema */
export const NAV_ROUTES = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/horas-extras', label: 'Horas Extras (Setembro)', icon: 'Clock' },
  { href: '/importacao', label: 'Importação', icon: 'Upload' },
  { href: '/pendencias', label: 'Pendências', icon: 'AlertTriangle' },
  { href: '/relatorios', label: 'Relatórios', icon: 'BarChart3' },
  { href: '/configuracoes', label: 'Configurações', icon: 'Settings' },
] as const;

