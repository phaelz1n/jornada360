import { useMemo, useState } from 'react';
import { competenciaParaData } from '../relatorios/competencia.js';
import { consultarDia, consultarPeriodo } from '../relatorios/relatorio-query.js';
import { ExecutiveCards, ExecutiveEvents } from './ExecutiveCards.jsx';

const fmt = min => `${Math.floor((min || 0) / 60)}h${String((min || 0) % 60).padStart(2, '0')}`;

export function InicioDashboard({ snapshots = [], eventos = [] }) {
  const latest = snapshots.at(-1);
  const [mode, setMode] = useState('periodo');
  const [selectedDate, setSelectedDate] = useState(latest?.dateKey || '');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const dates = useMemo(() => snapshots.map(snapshot => snapshot.dateKey).filter(Boolean).sort(), [snapshots]);
  const periods = useMemo(() => [...new Map(dates.map(date => { const period = competenciaParaData(date); return [period.chave, period]; })).values()], [dates]);
  const period = periods.find(item => item.chave === selectedPeriod) || (selectedDate ? competenciaParaData(selectedDate) : null);
  const report = useMemo(() => mode === 'dia' ? consultarDia(snapshots, selectedDate) : period ? consultarPeriodo(snapshots, period) : { items: [], summary: {} }, [mode, snapshots, selectedDate, period]);
  const previous = useMemo(() => {
    if (!period) return null;
    const previousEnd = new Date(`${period.inicio}T12:00:00`);
    previousEnd.setDate(previousEnd.getDate() - 1);
    return consultarPeriodo(snapshots, competenciaParaData(previousEnd.toISOString().slice(0, 10)));
  }, [snapshots, period]);
  const delta = (report.summary.totalHEmin || 0) - (previous?.summary.totalHEmin || 0);
  const visibleDates = mode === 'dia' ? new Set(selectedDate ? [selectedDate] : []) : new Set((report.items || []).map(item => item.dateKey));
  const faltas = useMemo(() => eventos.filter(event => visibleDates.has(event.dataKey) && ['Falta', 'Atestado', 'Horas faltantes'].includes(event.tipo)), [eventos, visibleDates]);
  const setores = Object.entries(report.summary.porSetorDetalhado || {}).sort((a, b) => b[1].totalHEmin - a[1].totalHEmin);
  const ranking = [...(report.porMotorista || [])].sort((a, b) => (b.he1min + b.he2min + b.he3min) - (a.he1min + a.he2min + a.he3min)).slice(0, 8);
  const maxSetor = Math.max(...setores.map(([, row]) => row.totalHEmin), 1);
  return <section className="executive-dashboard">
    <div className="executive-heading"><span className="eyebrow">PAINEL EXECUTIVO</span><h2>Resumo da operação</h2><p>{mode === 'dia' ? `Dia selecionado: ${selectedDate ? selectedDate.split('-').reverse().join('/') : '—'}` : `Período: ${period?.rotulo || '—'}`}</p></div>
    <div className="executive-filters"><button className={mode === 'dia' ? 'active' : ''} onClick={() => setMode('dia')}>Por dia</button><button className={mode === 'periodo' ? 'active' : ''} onClick={() => setMode('periodo')}>Por ciclo</button>{mode === 'dia' ? <select value={selectedDate} onChange={event => setSelectedDate(event.target.value)}>{dates.map(date => <option key={date} value={date}>{date.split('-').reverse().join('/')}</option>)}</select> : <select value={selectedPeriod} onChange={event => setSelectedPeriod(event.target.value)}><option value="">Último ciclo</option>{periods.map(item => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}</select>}</div>
    <ExecutiveCards summary={report.summary} delta={delta} faltas={faltas.length} />
    <div className="executive-insights"><div className="executive-list"><b>Maiores extras por motorista</b>{ranking.map(row => <div key={row.motorista}><span>{row.motorista}</span><strong>{fmt(row.he1min + row.he2min + row.he3min)}</strong></div>)}{!ranking.length && <small>Nenhum registro no filtro.</small>}</div><div className="executive-bars"><b>Horas extras por setor</b>{setores.map(([name, row]) => <div className="executive-bar-row" key={name}><span>{name}</span><i><em style={{ width: `${Math.max(3, row.totalHEmin / maxSetor * 100)}%` }} /></i><strong>{fmt(row.totalHEmin)}</strong></div>)}{!setores.length && <small>Nenhum setor no filtro.</small>}</div></div>
    <div className="executive-period"><b>Evolução por fechamento</b><span>{period?.rotulo || 'Sem período disponível'}</span><strong>{delta <= 0 ? 'Redução' : 'Aumento'} de {fmt(Math.abs(delta))} em relação ao ciclo anterior</strong></div>
    <ExecutiveEvents events={faltas} />
  </section>;
}
