const fmt = min => `${Math.floor((min || 0) / 60)}h${String((min || 0) % 60).padStart(2, '0')}`;

export function ExecutiveCards({ summary = {}, delta = 0, faltas = 0 }) {
  const cards = [
    [summary.registros || 0, 'registros'],
    [fmt(summary.totalHEmin), 'horas extras totais'],
    [fmt(summary.he1min || 0), 'HE.1'],
    [fmt(summary.he2min || 0), 'HE.2'],
    [fmt(summary.he3min || 0), 'HE.3'],
    [`${delta > 0 ? '+' : ''}${fmt(Math.abs(delta))}`, delta > 0 ? 'aumento vs anterior' : 'redução vs anterior', delta > 0 ? 'negative' : 'positive'],
    [fmt(summary.heDentroPadraoMin || 0), 'dentro do padrão'],
    [fmt(summary.heAcimaPadraoMin || 0), 'acima do padrão'],
    [summary.interjornada || 0, 'interjornadas'],
    [summary.intrajornada || 0, 'intrajornadas'],
    [summary.motoristasComHE || 0, 'motoristas com extras'],
    [faltas, 'faltas/atestados/horas faltantes']
  ];
  return <div className="executive-cards">{cards.map(([value, label, tone], index) => <article className={tone || ''} key={`${label}-${index}`}><strong>{value}</strong><small>{label}</small></article>)}</div>;
}

export function ExecutiveEvents({ events = [] }) {
  return <div className="executive-events"><b>Ocorrências lançadas</b>{events.slice(-8).reverse().map(event => <div key={event.id || `${event.dataKey}-${event.motorista}`}><span>{event.dataKey} · {event.motorista}</span><small>{event.tipo}{event.minutos ? ` · ${Math.floor(event.minutos / 60)}h${String(event.minutos % 60).padStart(2, '0')}` : ''}</small></div>)}{!events.length && <small>Nenhuma ocorrência lançada.</small>}</div>;
}
