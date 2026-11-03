import { useMemo, useState } from 'react';
import { competenciaAnterior, competenciaParaData } from '../relatorios/competencia.js';
import { consultarDia, consultarPeriodo } from '../relatorios/relatorio-query.js';
import { ExecutiveCards, ExecutiveEvents } from './ExecutiveCards.jsx';
import { DashboardCharts } from './DashboardCharts.jsx';
import { buildDashboardAnalytics } from '../dados/dashboard-analytics.js';
import { normalizeDriverName } from '../processamento/processamento-model.js';

const fmt = min => `${Math.floor((min || 0) / 60)}h${String((min || 0) % 60).padStart(2, '0')}`;

export function InicioDashboard({ snapshots = [], eventos = [], motoristas = [] }) {
  const snapshotsWithCadastro = useMemo(() => {
    const cadastro = new Map(motoristas.map(driver => [normalizeDriverName(driver.nome), driver.setor || driver.categoria]).filter(([, setor]) => setor));
    return snapshots.map(snapshot => ({ ...snapshot, items: (snapshot.items || []).map(item => {
      const setor = cadastro.get(normalizeDriverName(item.motorista || item.nome));
      return setor ? { ...item, setorAtual: setor, setor } : item;
    }) }));
  }, [snapshots, motoristas]);
  const latest = snapshotsWithCadastro.at(-1);
  const [mode, setMode] = useState('periodo');
  const [selectedDate, setSelectedDate] = useState(latest?.dateKey || '');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const dates = useMemo(() => snapshotsWithCadastro.map(snapshot => snapshot.dateKey).filter(Boolean).sort(), [snapshotsWithCadastro]);
  const periods = useMemo(() => [...new Map(dates.map(date => { const period = competenciaParaData(date); return [period.chave, period]; })).values()], [dates]);
  const period = periods.find(item => item.chave === selectedPeriod) || (selectedDate ? competenciaParaData(selectedDate) : null);
  const cadastro = useMemo(() => Object.fromEntries(motoristas.map(driver => [normalizeDriverName(driver.nome), driver])), [motoristas]);
  const report = useMemo(() => mode === 'dia' ? consultarDia(snapshotsWithCadastro, selectedDate, {}, cadastro) : period ? consultarPeriodo(snapshotsWithCadastro, period, {}, cadastro) : { items: [], summary: {} }, [mode, snapshotsWithCadastro, selectedDate, period, cadastro]);
  const previous = useMemo(() => {
    if (!period) return null;
    return consultarPeriodo(snapshotsWithCadastro, competenciaAnterior(period), {}, cadastro);
  }, [snapshotsWithCadastro, period, cadastro]);
  const hasPrevious = (previous?.diasProcessados || 0) > 0;
  const delta = hasPrevious ? (report.summary.totalHEmin || 0) - (previous?.summary.totalHEmin || 0) : null;
  const visibleDates = mode === 'dia' ? new Set(selectedDate ? [selectedDate] : []) : new Set((report.items || []).map(item => item.dateKey));
  const faltas = useMemo(() => eventos.filter(event => visibleDates.has(event.dataKey) && ['Falta', 'Atestado', 'Horas faltantes'].includes(event.tipo)), [eventos, visibleDates]);
  const setores = Object.entries(report.summary.porSetorDetalhado || {}).sort((a, b) => b[1].totalHEmin - a[1].totalHEmin);
  const allRanking = [...(report.porMotorista || [])].sort((a, b) => (b.he1min + b.he2min + b.he3min) - (a.he1min + a.he2min + a.he3min));
  const ranking = allRanking.slice(0, 15);
  const maxSetor = Math.max(...setores.map(([, row]) => row.he1min), 1);
  const top20Min = allRanking.slice(0, 20).reduce((sum, row) => sum + row.he1min, 0);
  const top20Share = report.summary.he1min ? Math.round(top20Min / report.summary.he1min * 100) : 0;
  const semPadraoMin = report.summary.semPadraoMin || 0;
  const analytics = useMemo(() => buildDashboardAnalytics({ report, snapshots: snapshotsWithCadastro, motoristas }), [report, snapshotsWithCadastro, motoristas]);
  const peopleBySector = useMemo(() => {
    const groups = new Map();
    (report.items || []).forEach(item => {
      const setor = item.setorAtual || item.setor || 'Sem setor';
      const current = groups.get(setor) || new Map();
      const name = item.motorista || 'Sem motorista';
      const person = current.get(name) || { motorista: name, totalHEmin: 0, he1min: 0 };
      person.he1min += Number(item.he1min) || 0;
      person.totalHEmin += Number(item.he1min) || 0;
      current.set(name, person);
      groups.set(setor, current);
    });
    return new Map([...groups].map(([sector, people]) => [sector, [...people.values()].sort((a, b) => b.totalHEmin - a.totalHEmin || a.motorista.localeCompare(b.motorista))]));
  }, [report.items]);
  const selectedSectorPeople = peopleBySector.get(selectedSector) || [];
  return <section className="executive-dashboard">
    <div className="executive-heading"><span className="eyebrow">PAINEL EXECUTIVO</span><h2>Resumo da operação</h2><p>{mode === 'dia' ? `Dia selecionado: ${selectedDate ? selectedDate.split('-').reverse().join('/') : '—'}` : `Período: ${period?.rotulo || '—'}`}</p></div>
    <div className="executive-filters"><button className={mode === 'dia' ? 'active' : ''} onClick={() => setMode('dia')}>Por dia</button><button className={mode === 'periodo' ? 'active' : ''} onClick={() => setMode('periodo')}>Por ciclo</button>{mode === 'dia' ? <select value={selectedDate} onChange={event => setSelectedDate(event.target.value)}>{dates.map(date => <option key={date} value={date}>{date.split('-').reverse().join('/')}</option>)}</select> : <select value={selectedPeriod} onChange={event => setSelectedPeriod(event.target.value)}><option value="">Último ciclo</option>{periods.map(item => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}</select>}</div>
    <ExecutiveCards summary={report.summary} delta={delta} faltas={faltas.length} />
    <DashboardCharts analytics={analytics} />
    <div className="executive-insights"><div className="executive-list"><b>Top 15 colaboradores por H.E.1</b><p className="chart-explanation">Mostra quem concentra mais hora extra no período selecionado. Use a lista para priorizar conferências e justificativas.</p>{ranking.map(row => <div key={row.motorista}><span>{row.motorista}</span><strong>{fmt(row.he1min)}</strong></div>)}{!ranking.length && <small>Nenhum registro no filtro.</small>}</div><div className="executive-bars"><b>H.E.1 por setor / motivo</b><p className="chart-explanation">Clique em um setor para ver as pessoas vinculadas e identificar quem está sem setor no cadastro.</p>{setores.map(([name, row]) => <button type="button" className={`executive-bar-row ${selectedSector === name ? 'selected' : ''}`} key={name} onClick={() => setSelectedSector(current => current === name ? '' : name)}><span>{name}</span><i><em style={{ width: `${Math.max(3, row.he1min / maxSetor * 100)}%` }} /></i><strong>{fmt(row.he1min)}</strong></button>)}{!setores.length && <small>Nenhum setor no filtro.</small>}{selectedSector && <div className="sector-drilldown"><div className="sector-drilldown-heading"><b>{selectedSector}</b><small>{selectedSectorPeople.length} pessoa(s)</small></div>{selectedSectorPeople.map(person => <div className="sector-person-row" key={person.motorista}><span>{person.motorista}</span><strong>{fmt(person.totalHEmin)}</strong></div>)}{!selectedSectorPeople.length && <small>Nenhuma pessoa encontrada neste recorte.</small>}{selectedSector === 'Sem setor' && <small className="sector-warning">Esses nomes não foram associados a um setor do cadastro.</small>}</div>}</div></div>
    <div className="executive-period"><b>Evolução por fechamento</b><span>{period?.rotulo || 'Sem período disponível'}</span><strong>{delta == null ? 'Sem dados do ciclo anterior para comparar' : `${delta <= 0 ? 'Redução' : 'Aumento'} de ${fmt(Math.abs(delta))} em relação ao ciclo anterior`}</strong></div>
    <ExecutiveEvents events={faltas} />
    <div className="executive-recommendations"><h3>→ O que verificar e o que dá para melhorar</h3><p className="chart-explanation">Leituras automáticas dos números acima para orientar a conversa com a liderança e as próximas ações do RH.</p><div className="recommendation-grid"><article><b>{ranking.length ? `${Math.min(20, ranking.length)} pessoas concentram ${top20Share}% da H.E.1 do período` : 'A concentração por motorista ainda não está disponível'}</b><span>Use o ranking para conferir recorrência, cobertura de férias e justificativas dos maiores volumes.</span></article><article><b>“Dentro do padrão” precisa ser acompanhado</b><span>{fmt(report.summary.heDentroPadraoMin || 0)} estão dentro da variação prevista. Esse volume pode indicar programação regular ou necessidade de revisar a tolerância.</span></article><article><b>{report.summary.motoristasSemPadrao || 0} lançamento(s) sem referência válida de horário padrão</b><span>{fmt(semPadraoMin)} ainda não pode ser classificado como dentro ou fora do padrão. Corrigir o cadastro evita distorção no painel.</span></article><article><b>Conferir o total antes de apresentar</b><span>Compare o total de {fmt(report.summary.totalHEmin || 0)} com o banco de horas e as folhas do período antes da reunião.</span></article></div></div>
  </section>;
}
