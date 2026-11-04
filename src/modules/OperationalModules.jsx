import { useEffect, useMemo, useState } from 'react';
import { summarizeDay } from '../processamento/processamento-model.js';
import { competenciaParaData } from '../relatorios/competencia.js';
import { consultarDia, consultarPeriodo } from '../relatorios/relatorio-query.js';
import { asArray } from '../utils/collections.js';
import { saveDriver } from '../lib/firestore-writes.js';

function duplicateTokens(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).filter(Boolean);
}

function possibleDuplicate(name, candidates) {
  const tokens = duplicateTokens(name);
  const first = tokens[0];
  const last = tokens.at(-1);
  if (!first || !last) return false;
  return candidates.some(candidate => {
    if (candidate === name) return false;
    const other = duplicateTokens(candidate);
    const firstSimilar = other[0] === first || (first.startsWith(other[0]) && other[0].length >= 4) || (other[0].startsWith(first) && first.length >= 4);
    return firstSimilar && other.at(-1) === last;
  });
}

export function ProcessingPanel({ items = [] }) {
  items = asArray(items);
  const summary = summarizeDay(items);
  const pending = items.filter(item => item.precisaVerificar || item.status === 'pendente').length;
  return <section className="module-panel"><span className="eyebrow">PROCESSAMENTO</span><h2>Comparação automática</h2><p>O cruzamento entre ponto, escala e rastreador usa o mesmo snapshot que alimenta o checklist e os relatórios.</p><div className="module-stats"><strong>{summary.registros}<small> registros carregados</small></strong><strong>{pending}<small> pendências para revisar</small></strong><strong>{summary.he1min}<small> min HE.1</small></strong><strong>{summary.he2min}<small> min HE.2</small></strong><strong>{summary.he3min}<small> min HE.3</small></strong><strong>{summary.interjornada}<small> interjornadas</small></strong><strong>{summary.intrajornada}<small> intrajornadas</small></strong></div><div className="comparison-list">{items.slice(0, 50).map(item => { const stops = asArray(item.paradasRastreador); return <article className="comparison-row" key={item.motorista}><div><strong>{item.motorista}</strong><small>{item.statusCruzamento || 'sem comparação'}{item.escala?.linha ? ` · ${item.escala.linha}` : ''}</small></div><div className="comparison-stops">{stops.map(stop => <span className={`stop-badge ${stop.status}`} key={`${stop.horario}-${stop.local}`}>{stop.horario} · {stop.status === 'possivel-transito' ? 'possível trânsito' : stop.status === 'nova' ? 'parada nova' : stop.status === 'confirmada' ? 'confirmada' : 'normal'}{stop.diferencaMin != null ? ` (${stop.diferencaMin} min)` : ''}</span>)}{!stops.length && <small>Sem paradas detalhadas no rastreador</small>}</div></article>; })}</div>{!items.length && <p className="empty-state">Importe as planilhas do dia para iniciar a comparação.</p>}</section>;
}

export function DateCalendar({ snapshots = [], selected, onSelect, allowAny = false }) {
  snapshots = asArray(snapshots);
  const dates = [...new Set(snapshots.map(snapshot => typeof snapshot === 'string' ? snapshot : snapshot?.dateKey).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))))].sort();
  if (!dates.length && !allowAny) return null;
  const fallbackDate = dates.at(-1) || new Date().toISOString().slice(0, 10);
  const selectedKey = /^\d{4}-\d{2}-\d{2}$/.test(String(selected || '')) ? selected : fallbackDate;
  const selectedDate = new Date(`${selectedKey}T12:00:00`);
  const safeDate = Number.isNaN(selectedDate.getTime()) ? new Date() : selectedDate;
  const [month, setMonth] = useState(safeDate.getMonth());
  const [year, setYear] = useState(safeDate.getFullYear());
  const [open, setOpen] = useState(false);
  const available = new Set(dates);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  function moveMonth(amount) { const next = new Date(year, month + amount, 1); setMonth(next.getMonth()); setYear(next.getFullYear()); }
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  return <div className="report-date-picker"><button type="button" className="report-date-field" onClick={() => setOpen(value => !value)} aria-expanded={open}>{selectedKey.split('-').reverse().join('/')}<span>▾</span></button>{open && <div className="report-calendar" role="dialog"><div className="report-calendar-head"><strong>{label}</strong><div><button type="button" onClick={() => moveMonth(-1)}>‹</button><button type="button" onClick={() => moveMonth(1)}>›</button></div></div><div className="report-calendar-week">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="report-calendar-grid">{cells.map((day, index) => { if (!day) return <span className="empty" key={`empty-${index}`} />; const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const weekday = new Date(year, month, day).getDay(); const weekend = weekday === 0 || weekday === 6; const hasReport = allowAny || available.has(date); return <button key={date} type="button" disabled={!hasReport} className={`${date === selectedKey ? 'selected' : ''} ${hasReport ? 'available' : 'unavailable'} ${weekend ? 'weekend' : ''}`} onClick={() => { onSelect(date); setOpen(false); }}>{day}</button>; })}</div>{!allowAny && <small><i className="calendar-dot available-dot" /> com relatório <i className="calendar-dot unavailable-dot" /> sem relatório</small>}</div>}</div>;
}

const AvailableReportDays = DateCalendar;

function ReportsPanelBody({ items = [], snapshots = [], initialDate }) {
  items = asArray(items);
  snapshots = asArray(snapshots);
  const [mode, setMode] = useState('dia');
  const latestDate = snapshots.map(snapshot => snapshot.dateKey).filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 10);
  const [dateKey, setDateKey] = useState(initialDate || latestDate);
  const [periodKey, setPeriodKey] = useState('');
  const [sector, setSector] = useState('Todos');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const sourceSnapshots = (snapshots.length ? snapshots : (items.length ? [{ dateKey, items }] : [])).map(snapshot => ({
    ...snapshot,
    items: asArray(snapshot?.items)
  }));
  useEffect(() => {
    const available = snapshots.map(snapshot => snapshot.dateKey).filter(Boolean).sort();
    if (available.length && !available.includes(dateKey)) setDateKey(available.at(-1));
  }, [snapshots, dateKey]);
  useEffect(() => {
    if (initialDate && initialDate !== dateKey) setDateKey(initialDate);
  }, [initialDate]);
  useEffect(() => {
    const select = document.querySelector('.report-filters select[aria-label="Filtrar por categoria"]');
    if (!select) return;
    ['Rastreio divergente', 'Fora do padrão'].forEach(label => {
      if (![...select.options].some(option => option.value === label)) select.add(new Option(label, label));
    });
  });
  const periods = useMemo(() => [...new Map(sourceSnapshots.map(snapshot => { const period = competenciaParaData(snapshot.dateKey); return [period.chave, period]; })).values()], [sourceSnapshots]);
  const selectedPeriod = periods.find(period => period.chave === periodKey) || (dateKey ? competenciaParaData(dateKey) : periods[0]);
  const sectors = useMemo(() => ['Todos', ...new Set(sourceSnapshots.flatMap(snapshot => asArray(snapshot.items).map(item => item.setorAtual || item.setor || 'Sem setor')))], [sourceSnapshots]);
  const report = useMemo(() => mode === 'dia' ? consultarDia(sourceSnapshots, dateKey, { setor: sector, motorista: search, categoria: category }) : consultarPeriodo(sourceSnapshots, selectedPeriod || { inicio: dateKey, fim: dateKey }, { setor: sector, motorista: search, categoria: category }), [mode, sourceSnapshots, dateKey, selectedPeriod, sector, search, category]);
  const filtered = report.items;
  const summary = report.summary;
  const format = value => `${Math.floor(value / 60)}h${String(value % 60).padStart(2, '0')}`;
  function downloadCsv() {
    const headers = ['Motorista', 'Setor', 'HE.1 (min)', 'HE.2 (min)', 'HE.3 (min)', 'Interjornada', 'Intrajornada', 'Rastreio divergente', 'HE fora do padrão'];
    const lines = [headers, ...filtered.map(item => [item.motorista, item.setorAtual || item.setor || 'Sem setor', item.he1min || 0, item.he2min || 0, item.he3min || 0, item.interjornada ? 'Sim' : 'Não', item.intrajornada || item.intraJornada || item.temLacuna ? 'Sim' : 'Não', item.rastreadorStatus === 'divergente' ? 'Sim' : 'Não', format(Number(item.heAcimaPadraoMin || 0))])].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';'));
    const url = URL.createObjectURL(new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'jornada360-relatorio.csv'; link.click(); URL.revokeObjectURL(url);
  }
  return <section className="module-panel"><span className="eyebrow">RELATÓRIOS</span><h2>Resumo de horas extras</h2><p>Visão diária e por período de fechamento, atualizada automaticamente com os novos relatórios.</p><div className="report-mode"><button type="button" className={mode === 'dia' ? 'active' : ''} onClick={() => setMode('dia')}>Por dia</button><button type="button" className={mode === 'periodo' ? 'active' : ''} onClick={() => setMode('periodo')}>Por período</button></div><div className="report-filters">{mode === 'dia' ? <input type="date" value={dateKey} onChange={event => setDateKey(event.target.value)} aria-label="Data do relatório" /> : <select value={periodKey} onChange={event => setPeriodKey(event.target.value)} aria-label="Período de fechamento"><option value="">Selecione o período</option>{periods.map(period => <option key={period.chave} value={period.chave}>{period.rotulo}</option>)}</select>}<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar motorista" aria-label="Pesquisar motorista" /><select value={sector} onChange={event => setSector(event.target.value)} aria-label="Filtrar por setor">{sectors.map(option => <option key={option}>{option}</option>)}</select><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filtrar por categoria"><option>Todos</option><option>HE.1</option><option>HE.2</option><option>HE.3</option><option>Interjornada</option><option>Intrajornada</option></select><button type="button" className="module-link" onClick={downloadCsv}>Baixar CSV</button></div><div className="daily-summary-grid"><article><strong>{format(summary.totalHEmin || 0)}</strong><small>HE total do dia</small></article><article><strong className={(summary.excedenteVsMetaMin || 0) > 0 ? 'negative' : 'positive'}>{(summary.excedenteVsMetaMin || 0) >= 0 ? '+' : ''}{format(summary.excedenteVsMetaMin || 0)}</strong><small>Excedente vs meta {format(summary.metaDiaMin || 0)}</small></article><article><strong className="negative">{format(summary.heAcimaPadraoMin || 0)}</strong><small>HE acima do padrão cadastrado</small></article><article><strong className="positive">{format(summary.heDentroPadraoMin || 0)}</strong><small>HE dentro do padrão cadastrado</small></article><article><strong>{summary.motoristasComHE || 0}</strong><small>motoristas com HE ({summary.motoristasSemPadrao || 0} sem padrão)</small></article></div><div className="module-stats reports"><strong>{format(summary.he1min)}<small> HE.1</small></strong><strong>{format(summary.he2min)}<small> HE.2</small></strong><strong>{format(summary.he3min)}<small> HE.3</small></strong><strong>{summary.interjornada}<small> interjornadas</small></strong><strong>{summary.intrajornada}<small> intrajornadas</small></strong></div><div className="report-table">{filtered.slice(0, 30).map(item => <div className="report-row" key={`${item.motorista}-${item.dateKey || ''}-${item.batidas || ''}`}><span><b>{item.motorista}</b><small>{item.setorAtual || item.setor || 'Sem setor'}{item.dateKey ? ` · ${item.dateKey}` : ''}</small></span><span>HE.1 <b>{item.he1str || format(item.he1min || 0)}</b></span><span>HE.2 <b>{item.he2str || format(item.he2min || 0)}</b></span><span>HE.3 <b>{item.he3str || format(item.he3min || 0)}</b></span></div>)}</div>{!filtered.length && <p className="empty-state">Nenhum registro encontrado para os filtros atuais.</p>}</section>;
}

export function ReportsPanel(props) {
  const snapshots = asArray(props.snapshots);
  const [selected, setSelected] = useState(() => snapshots.map(item => item.dateKey).filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 10));
  return <><AvailableReportDays snapshots={snapshots} selected={selected} onSelect={setSelected} /><ReportsPanelBody {...props} snapshots={snapshots} initialDate={selected} /></>;
}

export function RegistersPanel({ items = [], drivers = [] }) {
  items = asArray(items);
  drivers = asArray(drivers);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [patternFilter, setPatternFilter] = useState('todos');
  const pageSize = 25;
  const records = useMemo(() => {
    const byName = new Map(drivers.map(driver => [driver.nome, driver]));
    items.forEach(item => { if (item.motorista && !byName.has(item.motorista)) byName.set(item.motorista, { nome: item.motorista, setor: item.setorAtual || item.setor || 'Sem setor', horarios: [], extraNormalPadrao: 0, padraoStatus: 'pendente' }); });
    return [...byName.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  }, [drivers, items]);
  const filteredRecords = records.filter(driver => {
    const matchesName = String(driver.nome).toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR'));
    const hasPattern = driver.horarios?.length >= 2;
    const matchesPattern = patternFilter === 'todos' || (patternFilter === 'sem-padrao' ? !hasPattern : hasPattern);
    return matchesName && matchesPattern;
  });
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const names = records.map(driver => driver.nome);
  const duplicateNames = new Set(records.filter(driver => possibleDuplicate(driver.nome, names)).map(driver => driver.nome));
  const complete = records.filter(driver => driver.horarios?.length >= 2).length;
  function openEditor(driver) { setEditing(driver.nome); setDraft({ ...driver, horarios: Array.isArray(driver.horarios) ? [...driver.horarios] : [] }); setNotice(''); }
  function newDriver() { openEditor({ nome: '', setor: 'Motoristas', horarios: [], extraNormalPadrao: 0, padraoStatus: 'pendente' }); }
  function updateSchedule(index, value) { setDraft(current => ({ ...current, horarios: current.horarios.map((hour, position) => position === index ? value : hour) })); }
  function addSchedule() { setDraft(current => ({ ...current, horarios: [...current.horarios, ''] })); }
  function removeSchedule(index) { setDraft(current => ({ ...current, horarios: current.horarios.filter((_, position) => position !== index) })); }
  async function saveDraft(event) {
    event.preventDefault();
    const nome = String(draft?.nome || '').trim();
    if (!nome) { setNotice('Informe o nome do motorista.'); return; }
    const horarios = (draft.horarios || []).map(value => String(value).trim()).filter(Boolean);
    const payload = { ...draft, nome, horarios, extraNormalPadrao: Number(draft.extraNormalPadrao) || 0, padraoStatus: horarios.length >= 2 ? 'completo' : 'pendente' };
    try { await saveDriver(payload); setNotice('Cadastro salvo.'); setEditing(nome); setDraft(payload); } catch { setNotice('Não foi possível salvar agora; tente novamente.'); }
  }
  return <section className="module-panel register-module"><div className="register-hero"><div><span className="eyebrow">CADASTRO OPERACIONAL</span><h2>Motoristas e padrões</h2><p>O padrão cadastrado é a fonte dos cálculos da jornada. A planilha diária atualiza apenas os registros operacionais.</p></div><button className="primary-button register-new-button" type="button" onClick={newDriver}>Novo motorista <span>+</span></button></div><div className="register-metrics"><article><strong>{records.length}</strong><span>Motoristas cadastrados</span></article><article><strong>{complete}</strong><span>Com padrão completo</span></article><article className={records.length - complete ? 'warning' : ''}><strong>{records.length - complete}</strong><span>Pendentes de padrão</span></article></div><div className="register-toolbar"><input className="register-search" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }} placeholder="Pesquisar motorista" aria-label="Pesquisar motorista" /><select className="register-pattern-filter" value={patternFilter} onChange={event => { setPatternFilter(event.target.value); setPage(1); }} aria-label="Filtrar padrão"><option value="todos">Todos os cadastros</option><option value="sem-padrao">Somente sem padrão</option><option value="com-padrao">Somente com padrão</option></select><span>{filteredRecords.length} exibidos</span></div><div className="register-pagination"><button type="button" className="secondary-button" disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>← Anterior</button><span>Página {currentPage} de {totalPages}</span><button type="button" className="secondary-button" disabled={currentPage === totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Próxima →</button></div><div className="register-list modern-register-list">{visible.map(driver => { const hasPattern = driver.horarios?.length >= 2; return <button className="register-card" type="button" key={driver.nome} onClick={() => openEditor(driver)}><span className="register-avatar">{driver.nome?.[0]?.toUpperCase() || '?'}</span><span className="register-card-copy"><strong>{driver.nome}</strong><small>{driver.setor || driver.categoria || 'Sem setor'} · {hasPattern ? `${driver.horarios.length / 2} período(s) cadastrado(s)` : 'Padrão pendente'}</small></span>{duplicateNames.has(driver.nome) && <small className="register-duplicate-warning">Possível duplicidade</small>}<span className={`register-status ${hasPattern ? 'complete' : 'pending'}`}>{hasPattern ? 'Completo' : 'Pendente'}</span><span className="register-arrow">→</span></button>; })}</div>{editing !== null && draft && <div className="register-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}><form className="register-editor" onSubmit={saveDraft}><div className="register-editor-head"><div><span className="eyebrow">PADRÃO DO MOTORISTA</span><h3>{draft.nome || 'Novo motorista'}</h3></div><button type="button" className="register-close" onClick={() => setEditing(null)} aria-label="Fechar">×</button></div><label>Nome<input value={draft.nome || ''} onChange={event => setDraft(current => ({ ...current, nome: event.target.value }))} required /></label><label>Setor<select value={draft.setor || 'Motoristas'} onChange={event => setDraft(current => ({ ...current, setor: event.target.value }))}><option>Motoristas</option><option>ADM</option><option>Manutenção</option><option>Reserva</option><option>Cobre férias</option><option>Folguista</option><option>Sem setor</option></select></label><div className="register-editor-section"><div><strong>Horários da jornada</strong><small>Cadastre entrada e saída em sequência. Você pode adicionar quantos períodos forem necessários.</small></div>{draft.horarios?.map((hour, index) => <div className="schedule-input" key={`schedule-${index}`}><span>{index % 2 === 0 ? 'Entrada' : 'Saída'} {Math.floor(index / 2) + 1}</span><input type="time" value={hour} onChange={event => updateSchedule(index, event.target.value)} /><button type="button" onClick={() => removeSchedule(index)} aria-label={`Remover horário ${index + 1}`}>×</button></div>)}<button type="button" className="secondary-button" onClick={addSchedule}>Adicionar horário</button></div><label>Extra prevista (minutos)<input type="number" min="0" value={draft.extraNormalPadrao ?? 0} onChange={event => setDraft(current => ({ ...current, extraNormalPadrao: event.target.value }))} /><small>O sistema calcula automaticamente jornada, HE, interjornada e intrajornada.</small></label>{notice && <p className="register-notice">{notice}</p>}<button className="primary-button" type="submit">Salvar padrão <span>✓</span></button></form></div>}</section>;
}




