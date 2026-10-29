import { useMemo, useState } from 'react';
import { summarizeDay } from '../processamento/processamento-model.js';

function LegacyLink({ children = 'Abrir operação completa' }) { return <a className="module-link" href="/legacy/assistente_he_diario.original.html">{children} ↗</a>; }

export function ProcessingPanel({ items = [] }) {
  const summary = summarizeDay(items);
  const pending = items.filter(item => item.precisaVerificar || item.status === 'pendente').length;
  return <section className="module-panel"><span className="eyebrow">PROCESSAMENTO</span><h2>Comparação automática</h2><p>O cruzamento entre ponto, escala e rastreador está preservado no módulo operacional.</p><div className="module-stats"><strong>{summary.registros}<small> registros carregados</small></strong><strong>{pending}<small> pendências para revisar</small></strong><strong>{summary.interjornada}<small> interjornadas</small></strong><strong>{summary.intrajornada}<small> intrajornadas</small></strong></div><LegacyLink>Continuar processamento completo</LegacyLink></section>;
}

export function ReportsPanel({ items = [] }) {
  const [sector, setSector] = useState('Todos');
  const [search, setSearch] = useState('');
  const sectors = useMemo(() => ['Todos', ...new Set(items.map(item => item.setorAtual || item.setor || 'Sem setor'))], [items]);
  const filtered = useMemo(() => items.filter(item => (sector === 'Todos' || (item.setorAtual || item.setor || 'Sem setor') === sector) && String(item.motorista || '').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [items, sector, search]);
  const summary = summarizeDay(filtered);
  const format = value => `${Math.floor(value / 60)}h${String(value % 60).padStart(2, '0')}`;
  return <section className="module-panel"><span className="eyebrow">RELATÓRIOS</span><h2>Resumo de horas extras</h2><p>Filtre o dia importado por setor ou motorista e veja o resumo sem sair desta tela.</p><div className="report-filters"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar motorista" aria-label="Pesquisar motorista" /><select value={sector} onChange={event => setSector(event.target.value)} aria-label="Filtrar por setor">{sectors.map(option => <option key={option}>{option}</option>)}</select></div><div className="module-stats reports"><strong>{format(summary.he1min)}<small> HE.1</small></strong><strong>{format(summary.he2min)}<small> HE.2</small></strong><strong>{format(summary.he3min)}<small> HE.3</small></strong><strong>{summary.interjornada}<small> interjornadas</small></strong><strong>{summary.intrajornada}<small> intrajornadas</small></strong></div><div className="report-table">{filtered.slice(0, 30).map(item => <div className="report-row" key={`${item.motorista}-${item.batidas || ''}`}><span><b>{item.motorista}</b><small>{item.setorAtual || item.setor || 'Sem setor'}</small></span><span>HE.1 <b>{item.he1str || format(item.he1min || 0)}</b></span><span>HE.2 <b>{item.he2str || format(item.he2min || 0)}</b></span><span>HE.3 <b>{item.he3str || format(item.he3min || 0)}</b></span></div>)}</div><LegacyLink>Ver relatórios completos</LegacyLink></section>;
}

export function RegistersPanel({ items = [] }) {
  const [filter, setFilter] = useState('');
  const [sectors, setSectors] = useState(() => Object.fromEntries(items.map(item => [item.motorista, item.setorAtual || item.setor || 'Sem setor'])));
  const names = [...new Set(items.map(item => item.motorista).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const visible = names.filter(name => name.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR'))).slice(0, 50);
  async function save(name, sector) { setSectors(current => ({ ...current, [name]: sector })); try { const { saveDriver } = await import('../lib/firestore-writes.js'); await saveDriver({ nome: name, setor: sector }); } catch { /* permanece na sessão até o Firebase voltar */ } }
  return <section className="module-panel"><span className="eyebrow">CADASTROS</span><h2>Motoristas e setores</h2><p>{names.length} nomes reconhecidos no conteúdo migrado. Ajustes aqui serão reutilizados nas próximas importações.</p><input className="register-search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Pesquisar motorista" aria-label="Pesquisar motorista" /><div className="register-list">{visible.map(name => <div className="register-row" key={name}><span>{name}</span><select value={sectors[name] || 'Sem setor'} onChange={event => save(name, event.target.value)}><option>Motoristas</option><option>ADM</option><option>Manutenção</option><option>Reserva</option><option>Cobre férias</option><option>Folguista</option><option>Sem setor</option></select></div>)}</div><LegacyLink>Editar regras avançadas</LegacyLink></section>;
}
