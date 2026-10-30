import { useMemo, useState } from 'react';
import { competenciaParaData } from '../relatorios/competencia.js';
import { consultarDia, consultarPeriodo } from '../relatorios/relatorio-query.js';

const fmt = min => `${Math.floor((min || 0) / 60)}h${String((min || 0) % 60).padStart(2, '0')}`;

export function InicioDashboard({ snapshots = [], eventos = [] }) {
  const latest = snapshots.at(-1);
  const [mode, setMode] = useState('periodo');
  const [selectedDate, setSelectedDate] = useState(latest?.dateKey || '');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const dates = snapshots.map(snapshot => snapshot.dateKey).filter(Boolean).sort();
  const periods = [...new Map(dates.map(date => { const period = competenciaParaData(date); return [period.chave, period]; })).values()];
  const period = periods.find(item => item.chave === selectedPeriod) || (selectedDate ? competenciaParaData(selectedDate) : null);
  const report = useMemo(() => mode === 'dia' ? consultarDia(snapshots, selectedDate) : (period ? consultarPeriodo(snapshots, period) : { summary: {} }), [mode, snapshots, selectedDate, period]);
  const previous = useMemo(() => {
    if (!period) return null;
    const previousEnd = new Date(`${period.inicio}T12:00:00`); previousEnd.setDate(previousEnd.getDate() - 1);
    return consultarPeriodo(snapshots, competenciaParaData(previousEnd.toISOString().slice(0, 10)));
  }, [snapshots, period]);
  const delta = (report.summary.totalHEmin || 0) - (previous?.summary.totalHEmin || 0);
  const visibleDates = mode === 'dia' ? new Set([selectedDate]) : new Set(report.items.map(item => item.dateKey));
  const faltas = eventos.filter(event => visibleDates.has(event.dataKey) && ['Falta', 'Atestado', 'Horas faltantes'].includes(event.tipo));
  return <section className="executive-dashboard"><div className="executive-heading"><span className="eyebrow">PAINEL EXECUTIVO</span><h2>Resumo da operação</h2><p>{mode === 'dia' ? `Dia selecionado: ${selectedDate ? selectedDate.split('-').reverse().join('/') : '—'}` : `Período: ${period?.rotulo || '—'}`}</p></div><div className="executive-filters"><button className={mode === 'dia' ? 'active' : ''} onClick={() => setMode('dia')}>Por dia</button><button className={mode === 'periodo' ? 'active' : ''} onClick={() => setMode('periodo')}>Por ciclo</button>{mode === 'dia' ? <select value={selectedDate} onChange={event => setSelectedDate(event.target.value)}>{dates.map(date => <option key={date} value={date}>{date.split('-').reverse().join('/')}</option>)}</select> : <select value={selectedPeriod} onChange={event => setSelectedPeriod(event.target.value)}><option value="">Último ciclo</option>{periods.map(item => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}</select>}</div><div className="executive-cards"><article><strong>{report.summary.registros || 0}</strong><small>registros</small></article><article><strong>{fmt(report.summary.totalHEmin)}</strong><small>horas extras totais</small></article><article><strong>{fmt(report.summary.he1min || 0)}</strong><small>HE.1</small></article><article><strong>{fmt(report.summary.he2min || 0)}</strong><small>HE.2</small></article><article><strong>{fmt(report.summary.he3min || 0)}</strong><small>HE.3</small></article><article className={delta > 0 ? 'negative' : 'positive'}><strong>{delta > 0 ? '+' : ''}{fmt(Math.abs(delta))}</strong><small>{delta > 0 ? 'aumento' : 'redução'} vs anterior</small></article><article><strong>{fmt(report.summary.heDentroPadraoMin || 0)}</strong><small>dentro do padrão</small></article><article><strong>{fmt(report.summary.heAcimaPadraoMin || 0)}</strong><small>acima do padrão</small></article><article><strong>{report.summary.interjornada || 0}</strong><small>interjornadas</small></article><article><strong>{report.summary.intrajornada || 0}</strong><small>intrajornadas</small></article><article><strong>{report.summary.motoristasComHE || 0}</strong><small>motoristas com extras</small></article><article><strong>{faltas.length}</strong><small>faltas/atestados/horas faltantes</small></article></div><div className="executive-period"><b>Evolução por fechamento</b><span>{period?.rotulo || 'Sem período disponível'}</span><strong>{delta <= 0 ? 'Redução' : 'Aumento'} de {fmt(Math.abs(delta))} em relação ao ciclo anterior</strong></div><div className="executive-events"><b>Ocorrências lançadas</b>{faltas.slice(-8).reverse().map(event => <div key={event.id || `${event.dataKey}-${event.motorista}`}><span>{event.dataKey} · {event.motorista}</span><small>{event.tipo}{event.minutos ? ` · ${fmt(event.minutos)}` : ''}</small></div>)}{!faltas.length && <small>Nenhuma ocorrência lançada.</small>}</div></section>;
}
