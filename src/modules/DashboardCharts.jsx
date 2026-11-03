import { useState } from 'react';

const fmt = min => `${Math.floor((min || 0) / 60)}h${String((min || 0) % 60).padStart(2, '0')}`;
const colors = { he1min: '#2d68b1', he2min: '#c47b12', he3min: '#9b4d9b' };

function EmptyChart({ children = 'Sem dados suficientes para este gráfico.' }) {
  return <div className="dashboard-chart-empty">{children}</div>;
}

export function DashboardCharts({ analytics }) {
  const [selectedRisk, setSelectedRisk] = useState('');
  const daily = analytics?.dailySeries || [];
  const buckets = analytics?.bucketComposition || { he1min: 0, he2min: 0, he3min: 0, semPadraoMin: 0, totalHEmin: 0 };
  const drivers = (analytics?.driverDistribution || []).slice(0, 8);
  const sectors = (analytics?.sectorComparison || []).slice(0, 6);
  const risks = analytics?.riskMatrix || {};
  const riskDetails = analytics?.riskDetails || {};
  const maxDaily = Math.max(...daily.map(row => Math.max(row.totalHEmin, row.metaMin)), 1);
  const maxDriver = Math.max(...drivers.map(row => row.totalHEmin), 1);
  const maxSector = Math.max(...sectors.map(row => row.totalHEmin), 1);
  return <div className="dashboard-charts">
    <article className="dashboard-chart dashboard-chart-wide">
      <div className="dashboard-chart-heading"><div><b>Evolução diária</b><p>Compara HE realizada com a meta carregada em cada dia do período.</p></div><span>{fmt(buckets.totalHEmin)} no total</span></div>
      {daily.length ? <div className="dashboard-line-chart" role="img" aria-label="Evolução diária da hora extra e da meta">{daily.map((row, index) => <div className="dashboard-line-column" key={row.dateKey}><div className="dashboard-line-values"><i title={`HE ${fmt(row.totalHEmin)}`} style={{ height: `${Math.max(4, row.totalHEmin / maxDaily * 150)}px` }} /><em title={`Meta ${fmt(row.metaMin)}`} style={{ height: `${Math.max(4, row.metaMin / maxDaily * 150)}px` }} /></div><small>{row.dateKey === 'sem-data' ? 'Sem data' : row.dateKey.slice(5).split('-').reverse().join('/')}</small><span>{fmt(row.totalHEmin)}</span></div>)}</div> : <EmptyChart />}
      <div className="dashboard-legend"><span><i className="legend-he" /> HE realizada</span><span><i className="legend-meta" /> Meta</span></div>
    </article>
    <article className="dashboard-chart">
      <div className="dashboard-chart-heading"><div><b>Composição das extras</b><p>Distribui o volume entre HE.1, HE.2 e HE.3.</p></div><span>{fmt(buckets.totalHEmin)}</span></div>
      {buckets.totalHEmin ? <div className="dashboard-donut-wrap"><div className="dashboard-donut" style={{ background: `conic-gradient(${colors.he1min} 0 ${buckets.he1min / buckets.totalHEmin * 360}deg, ${colors.he2min} ${buckets.he1min / buckets.totalHEmin * 360}deg ${(buckets.he1min + buckets.he2min) / buckets.totalHEmin * 360}deg, ${colors.he3min} ${(buckets.he1min + buckets.he2min) / buckets.totalHEmin * 360}deg 360deg)` }}><strong>{fmt(buckets.totalHEmin)}</strong></div><div className="dashboard-legend dashboard-legend-stack">{['he1min', 'he2min', 'he3min'].map(bucket => <span key={bucket}><i style={{ background: colors[bucket] }} />{bucket.replace('min', '').toUpperCase()}: {fmt(buckets[bucket])}</span>)}{buckets.semPadraoMin > 0 && <span><i style={{ background: '#d94841' }} />SEM PADRÃO: {fmt(buckets.semPadraoMin)}</span>}</div></div> : <EmptyChart />}
    </article>
    <article className="dashboard-chart">
      <div className="dashboard-chart-heading"><div><b>Concentração por motorista</b><p>Prioriza quem acumula mais HE no período.</p></div></div>
      {drivers.length ? <div className="dashboard-horizontal-bars">{drivers.map(row => <div className="dashboard-hbar" key={row.motorista}><span title={row.motorista}>{row.motorista}</span><i><em style={{ width: `${Math.max(3, row.totalHEmin / maxDriver * 100)}%` }} /></i><strong>{fmt(row.totalHEmin)}</strong></div>)}</div> : <EmptyChart />}
    </article>
    <article className="dashboard-chart">
      <div className="dashboard-chart-heading"><div><b>Setores e riscos</b><p>Compara setores e sinaliza pontos que exigem conferência.</p></div></div>
      {sectors.length ? <div className="dashboard-sector-bars">{sectors.map(row => <div className="dashboard-sector-row" key={row.setor}><span>{row.setor}</span><div><i style={{ width: `${Math.max(3, row.totalHEmin / maxSector * 100)}%` }} /><small>{fmt(row.totalHEmin)} · acima {fmt(row.acimaPadraoMin)}</small></div></div>)}</div> : <EmptyChart />}
      <div className="dashboard-risk-grid">{[['interjornada', 'Interjornada'], ['intrajornada', 'Intrajornada'], ['foraDaEscala', 'Fora da escala'], ['semPadrao', 'Sem padrão'], ['rastreioDivergente', 'Rastreio divergente']].map(([key, label]) => <button type="button" className={`${risks[key] ? 'risk-active' : ''} ${selectedRisk === key ? 'risk-selected' : ''}`} onClick={() => setSelectedRisk(current => current === key ? '' : key)} key={key}><b>{risks[key] || 0}</b><small>{label}</small></button>)}</div>
      {selectedRisk && <div className="dashboard-risk-details"><b>{[['interjornada', 'Interjornada'], ['intrajornada', 'Intrajornada'], ['foraDaEscala', 'Fora da escala'], ['semPadrao', 'Sem padrão'], ['rastreioDivergente', 'Rastreio divergente']].find(([key]) => key === selectedRisk)?.[1]}</b>{(riskDetails[selectedRisk] || []).map(name => <span key={name}>{name}</span>)}{!(riskDetails[selectedRisk] || []).length && <small>Nenhuma pessoa neste recorte.</small>}</div>}
    </article>
  </div>;
}
