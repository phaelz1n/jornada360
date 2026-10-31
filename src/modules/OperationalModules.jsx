import { useEffect, useMemo, useState } from 'react';
import { summarizeDay } from '../processamento/processamento-model.js';
import { competenciaParaData } from '../relatorios/competencia.js';
import { consultarDia, consultarPeriodo } from '../relatorios/relatorio-query.js';

export function ProcessingPanel({ items = [] }) {
  const summary = summarizeDay(items);
  const pending = items.filter(item => item.precisaVerificar || item.status === 'pendente').length;
  return <section className="module-panel"><span className="eyebrow">PROCESSAMENTO</span><h2>Comparação automática</h2><p>O cruzamento entre ponto, escala e rastreador usa o mesmo snapshot que alimenta o checklist e os relatórios.</p><div className="module-stats"><strong>{summary.registros}<small> registros carregados</small></strong><strong>{pending}<small> pendências para revisar</small></strong><strong>{summary.he1min}<small> min HE.1</small></strong><strong>{summary.he2min}<small> min HE.2</small></strong><strong>{summary.he3min}<small> min HE.3</small></strong><strong>{summary.interjornada}<small> interjornadas</small></strong><strong>{summary.intrajornada}<small> intrajornadas</small></strong></div><div className="comparison-list">{items.slice(0, 50).map(item => <article className="comparison-row" key={item.motorista}><div><strong>{item.motorista}</strong><small>{item.statusCruzamento || 'sem comparação'}{item.escala?.linha ? ` · ${item.escala.linha}` : ''}</small></div><div className="comparison-stops">{(item.paradasRastreador || []).map(stop => <span className={`stop-badge ${stop.status}`} key={`${stop.horario}-${stop.local}`}>{stop.horario} · {stop.status === 'possivel-transito' ? 'possível trânsito' : stop.status === 'nova' ? 'parada nova' : stop.status === 'confirmada' ? 'confirmada' : 'normal'}{stop.diferencaMin != null ? ` (${stop.diferencaMin} min)` : ''}</span>)}{!item.paradasRastreador?.length && <small>Sem paradas detalhadas no rastreador</small>}</div></article>)}</div>{!items.length && <p className="empty-state">Importe as planilhas do dia para iniciar a comparação.</p>}</section>;
}

export function DateCalendar({ snapshots = [], selected, onSelect, allowAny = false }) {
  const dates = [...new Set(snapshots.map(snapshot => snapshot.dateKey).filter(Boolean))].sort();
  if (!dates.length && !allowAny) return null;
  const selectedDate = new Date(`${selected || dates.at(-1)}T12:00:00`);
  const [month, setMonth] = useState(selectedDate.getMonth());
  const [year, setYear] = useState(selectedDate.getFullYear());
  const [open, setOpen] = useState(false);
  const available = new Set(dates);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  function moveMonth(amount) { const next = new Date(year, month + amount, 1); setMonth(next.getMonth()); setYear(next.getFullYear()); }
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  return <div className="report-date-picker"><button type="button" className="report-date-field" onClick={() => setOpen(value => !value)} aria-expanded={open}>{selected.split('-').reverse().join('/')}<span>▾</span></button>{open && <div className="report-calendar" role="dialog"><div className="report-calendar-head"><strong>{label}</strong><div><button type="button" onClick={() => moveMonth(-1)}>‹</button><button type="button" onClick={() => moveMonth(1)}>›</button></div></div><div className="report-calendar-week">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="report-calendar-grid">{cells.map((day, index) => { if (!day) return <span className="empty" key={`empty-${index}`} />; const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const hasReport = allowAny || available.has(date); return <button key={date} type="button" disabled={!hasReport} className={`${date === selected ? 'selected' : ''} ${hasReport ? 'available' : 'unavailable'}`} onClick={() => { onSelect(date); setOpen(false); }}>{day}</button>; })}</div>{!allowAny && <small><i className="calendar-dot available-dot" /> com relatório <i className="calendar-dot unavailable-dot" /> sem relatório</small>}</div>}</div>;
}

const AvailableReportDays = DateCalendar;

function ReportsPanelBody({ items = [], snapshots = [], initialDate }) {
  const [mode, setMode] = useState('dia');
  const latestDate = snapshots.map(snapshot => snapshot.dateKey).filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 10);
  const [dateKey, setDateKey] = useState(initialDate || latestDate);
  const [periodKey, setPeriodKey] = useState('');
  const [sector, setSector] = useState('Todos');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const sourceSnapshots = snapshots.length ? snapshots : (items.length ? [{ dateKey, items }] : []);
  useEffect(() => {
    const available = snapshots.map(snapshot => snapshot.dateKey).filter(Boolean).sort();
    if (available.length && !available.includes(dateKey)) setDateKey(available.at(-1));
  }, [snapshots, dateKey]);
  useEffect(() => {
    if (initialDate && initialDate !== dateKey) setDateKey(initialDate);
  }, [initialDate]);
  const periods = useMemo(() => [...new Map(sourceSnapshots.map(snapshot => { const period = competenciaParaData(snapshot.dateKey); return [period.chave, period]; })).values()], [sourceSnapshots]);
  const selectedPeriod = periods.find(period => period.chave === periodKey) || (dateKey ? competenciaParaData(dateKey) : periods[0]);
  const sectors = useMemo(() => ['Todos', ...new Set(sourceSnapshots.flatMap(snapshot => (snapshot.items || []).map(item => item.setorAtual || item.setor || 'Sem setor')))], [sourceSnapshots]);
  const report = useMemo(() => mode === 'dia' ? consultarDia(sourceSnapshots, dateKey, { setor: sector, motorista: search, categoria: category }) : consultarPeriodo(sourceSnapshots, selectedPeriod || { inicio: dateKey, fim: dateKey }, { setor: sector, motorista: search, categoria: category }), [mode, sourceSnapshots, dateKey, selectedPeriod, sector, search, category]);
  const filtered = report.items;
  const summary = report.summary;
  const format = value => `${Math.floor(value / 60)}h${String(value % 60).padStart(2, '0')}`;
  function downloadCsv() {
    const headers = ['Motorista', 'Setor', 'HE.1 (min)', 'HE.2 (min)', 'HE.3 (min)', 'Interjornada', 'Intrajornada'];
    const lines = [headers, ...filtered.map(item => [item.motorista, item.setorAtual || item.setor || 'Sem setor', item.he1min || 0, item.he2min || 0, item.he3min || 0, item.interjornada ? 'Sim' : 'Não', item.intrajornada || item.intraJornada || item.temLacuna ? 'Sim' : 'Não'])].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';'));
    const url = URL.createObjectURL(new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'jornada360-relatorio.csv'; link.click(); URL.revokeObjectURL(url);
  }
  return <section className="module-panel"><span className="eyebrow">RELATÓRIOS</span><h2>Resumo de horas extras</h2><p>Visão diária e por período de fechamento, atualizada automaticamente com os novos relatórios.</p><div className="report-mode"><button type="button" className={mode === 'dia' ? 'active' : ''} onClick={() => setMode('dia')}>Por dia</button><button type="button" className={mode === 'periodo' ? 'active' : ''} onClick={() => setMode('periodo')}>Por período</button></div><div className="report-filters">{mode === 'dia' ? <input type="date" value={dateKey} onChange={event => setDateKey(event.target.value)} aria-label="Data do relatório" /> : <select value={periodKey} onChange={event => setPeriodKey(event.target.value)} aria-label="Período de fechamento"><option value="">Selecione o período</option>{periods.map(period => <option key={period.chave} value={period.chave}>{period.rotulo}</option>)}</select>}<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar motorista" aria-label="Pesquisar motorista" /><select value={sector} onChange={event => setSector(event.target.value)} aria-label="Filtrar por setor">{sectors.map(option => <option key={option}>{option}</option>)}</select><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filtrar por categoria"><option>Todos</option><option>HE.1</option><option>HE.2</option><option>HE.3</option><option>Interjornada</option><option>Intrajornada</option></select><button type="button" className="module-link" onClick={downloadCsv}>Baixar CSV</button></div><div className="daily-summary-grid"><article><strong>{format(summary.totalHEmin || 0)}</strong><small>HE total do dia</small></article><article><strong className={(summary.excedenteVsMetaMin || 0) > 0 ? 'negative' : 'positive'}>{(summary.excedenteVsMetaMin || 0) >= 0 ? '+' : ''}{format(summary.excedenteVsMetaMin || 0)}</strong><small>Excedente vs meta {format(summary.metaDiaMin || 0)}</small></article><article><strong className="negative">{format(summary.heAcimaPadraoMin || 0)}</strong><small>HE acima do padrão cadastrado</small></article><article><strong className="positive">{format(summary.heDentroPadraoMin || 0)}</strong><small>HE dentro do padrão cadastrado</small></article><article><strong>{summary.motoristasComHE || 0}</strong><small>motoristas com HE ({summary.motoristasSemPadrao || 0} sem padrão)</small></article></div><div className="module-stats reports"><strong>{format(summary.he1min)}<small> HE.1</small></strong><strong>{format(summary.he2min)}<small> HE.2</small></strong><strong>{format(summary.he3min)}<small> HE.3</small></strong><strong>{summary.interjornada}<small> interjornadas</small></strong><strong>{summary.intrajornada}<small> intrajornadas</small></strong></div><div className="report-table">{filtered.slice(0, 30).map(item => <div className="report-row" key={`${item.motorista}-${item.dateKey || ''}-${item.batidas || ''}`}><span><b>{item.motorista}</b><small>{item.setorAtual || item.setor || 'Sem setor'}{item.dateKey ? ` · ${item.dateKey}` : ''}</small></span><span>HE.1 <b>{item.he1str || format(item.he1min || 0)}</b></span><span>HE.2 <b>{item.he2str || format(item.he2min || 0)}</b></span><span>HE.3 <b>{item.he3str || format(item.he3min || 0)}</b></span></div>)}</div>{!filtered.length && <p className="empty-state">Nenhum registro encontrado para os filtros atuais.</p>}</section>;
}

export function ReportsPanel(props) {
  const [selected, setSelected] = useState(() => props.snapshots?.map(item => item.dateKey).filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 10));
  return <><AvailableReportDays snapshots={props.snapshots || []} selected={selected} onSelect={setSelected} /><ReportsPanelBody {...props} initialDate={selected} /></>;
}

export function RegistersPanel({ items = [] }) {
  const [filter, setFilter] = useState('');
  const [sectors, setSectors] = useState(() => Object.fromEntries(items.map(item => [item.motorista, item.setorAtual || item.setor || 'Sem setor'])));
  const names = [...new Set(items.map(item => item.motorista).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const visible = names.filter(name => name.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR'))).slice(0, 50);
  async function save(name, sector) { setSectors(current => ({ ...current, [name]: sector })); try { const { saveDriver } = await import('../lib/firestore-writes.js'); await saveDriver({ nome: name, setor: sector }); } catch { /* permanece na sessão até o Firebase voltar */ } }
  return <section className="module-panel"><span className="eyebrow">CADASTROS</span><h2>Motoristas e setores</h2><p>{names.length} nomes reconhecidos no conteúdo migrado. Ajustes aqui serão reutilizados nas próximas importações.</p><input className="register-search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Pesquisar motorista" aria-label="Pesquisar motorista" /><div className="register-list">{visible.map(name => <div className="register-row" key={name}><span>{name}</span><select value={sectors[name] || 'Sem setor'} onChange={event => save(name, event.target.value)}><option>Motoristas</option><option>ADM</option><option>Manutenção</option><option>Reserva</option><option>Cobre férias</option><option>Folguista</option><option>Sem setor</option></select></div>)}</div></section>;
}
