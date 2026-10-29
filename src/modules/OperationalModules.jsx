import { summarizeDay } from '../processamento/processamento-model.js';

function LegacyLink({ children = 'Abrir operação completa' }) { return <a className="module-link" href="/legacy/assistente_he_diario.original.html">{children} ↗</a>; }

export function ProcessingPanel({ items = [] }) {
  const summary = summarizeDay(items);
  const pending = items.filter(item => item.precisaVerificar || item.status === 'pendente').length;
  return <section className="module-panel"><span className="eyebrow">PROCESSAMENTO</span><h2>Comparação automática</h2><p>O cruzamento entre ponto, escala e rastreador está preservado no módulo operacional.</p><div className="module-stats"><strong>{summary.registros}<small> registros carregados</small></strong><strong>{pending}<small> pendências para revisar</small></strong><strong>{summary.interjornada}<small> interjornadas</small></strong><strong>{summary.intrajornada}<small> intrajornadas</small></strong></div><LegacyLink>Continuar processamento completo</LegacyLink></section>;
}

export function ReportsPanel({ items = [] }) {
  const summary = summarizeDay(items);
  return <section className="module-panel"><span className="eyebrow">RELATÓRIOS</span><h2>Resumo de horas extras</h2><p>Visão consolidada dos registros importados, separada por tipo de hora extra.</p><div className="module-stats reports"><strong>{summary.he1min}<small> HE.1 minutos</small></strong><strong>{summary.he2min}<small> HE.2 minutos</small></strong><strong>{summary.he3min}<small> HE.3 minutos</small></strong></div><div className="module-breakdown">{Object.entries(summary.porSetor).map(([sector, count]) => <span key={sector}>{sector}: <b>{count}</b></span>)}</div><LegacyLink>Ver relatórios completos</LegacyLink></section>;
}

export function RegistersPanel({ items = [] }) {
  const names = [...new Set(items.map(item => item.motorista).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return <section className="module-panel"><span className="eyebrow">CADASTROS</span><h2>Motoristas e setores</h2><p>{names.length} nomes reconhecidos no conteúdo migrado. A classificação consolidada será usada nas próximas importações.</p><div className="name-list">{names.slice(0, 16).map(name => <span key={name}>{name}</span>)}</div><LegacyLink>Editar regras no módulo atual</LegacyLink></section>;
}
