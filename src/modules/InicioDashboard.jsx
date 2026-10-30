import { useMemo } from 'react';
import { competenciaParaData } from '../relatorios/competencia.js';
import { consultarPeriodo } from '../relatorios/relatorio-query.js';

const fmt = min => `${Math.floor((min || 0) / 60)}h${String((min || 0) % 60).padStart(2, '0')}`;

export function InicioDashboard({ snapshots = [], eventos = [] }) {
  const latest = snapshots.at(-1);
  const period = latest?.dateKey ? competenciaParaData(latest.dateKey) : null;
  const report = useMemo(() => period ? consultarPeriodo(snapshots, period) : { summary: {} }, [snapshots, period]);
  const previous = useMemo(() => {
    if (!period) return null;
    const previousEnd = new Date(`${period.inicio}T12:00:00`); previousEnd.setDate(previousEnd.getDate() - 1);
    return consultarPeriodo(snapshots, competenciaParaData(previousEnd.toISOString().slice(0, 10)));
  }, [snapshots, period]);
  const delta = (report.summary.totalHEmin || 0) - (previous?.summary.totalHEmin || 0);
  const faltas = eventos.filter(event => ['Falta', 'Atestado', 'Horas faltantes'].includes(event.tipo));
  return <section className="executive-dashboard"><div className="executive-heading"><span className="eyebrow">PAINEL EXECUTIVO</span><h2>Resumo da operação</h2><p>{latest?.dateKey ? `Último relatório: ${latest.dateKey.split('-').reverse().join('/')}` : 'Importe os relatórios para iniciar o acompanhamento.'}</p></div><div className="executive-cards"><article><strong>{fmt(report.summary.totalHEmin)}</strong><small>extras no ciclo</small></article><article className={delta > 0 ? 'negative' : 'positive'}><strong>{delta > 0 ? '+' : ''}{fmt(Math.abs(delta))}</strong><small>{delta > 0 ? 'aumento' : 'redução'} vs ciclo anterior</small></article><article><strong>{report.summary.motoristasComHE || 0}</strong><small>motoristas com extras</small></article><article><strong>{faltas.length}</strong><small>faltas, atestados e horas faltantes</small></article></div><div className="executive-period"><b>Evolução por fechamento</b><span>{period?.rotulo || 'Sem período disponível'}</span><strong>{delta <= 0 ? 'Redução' : 'Aumento'} de {fmt(Math.abs(delta))} em relação ao ciclo anterior</strong></div><div className="executive-events"><b>Ocorrências lançadas</b>{faltas.slice(-8).reverse().map(event => <div key={event.id || `${event.dataKey}-${event.motorista}`}><span>{event.dataKey} · {event.motorista}</span><small>{event.tipo}{event.minutos ? ` · ${fmt(event.minutos)}` : ''}</small></div>)}{!faltas.length && <small>Nenhuma ocorrência lançada.</small>}</div></section>;
}
