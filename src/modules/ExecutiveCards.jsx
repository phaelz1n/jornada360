const fmt = min => `${Math.floor((min || 0) / 60)}h${String((min || 0) % 60).padStart(2, '0')}`;

export function ExecutiveCards({ summary = {}, delta = 0, faltas = 0, selectedBucket = '', onSelectBucket, bucketDetails = [] }) {
  const cards = [
    [summary.registros || 0, 'registros', '', ''],
    [fmt(summary.totalHEmin), 'horas extras totais', '', ''],
    [fmt(summary.extraCandidataMin || 0), 'HE candidatas a conferir', '', ''],
    [fmt(summary.metaPeriodoMin || 0), 'meta do período (média do padrão)', '', ''],
    [fmt(summary.he1min || 0), 'HE.1', '', ''],
    [fmt(summary.he2min || 0), 'HE.2', '', 'he2min'],
    [fmt(summary.he3min || 0), 'HE.3', '', 'he3min'],
    [delta == null ? '—' : `${delta > 0 ? '+' : ''}${fmt(Math.abs(delta))}`, delta == null ? 'sem comparação anterior' : delta > 0 ? 'aumento vs anterior' : 'redução vs anterior', delta > 0 ? 'negative' : 'positive', ''],
    [fmt(summary.heDentroPadraoMin || 0), 'dentro do padrão', '', ''],
    [fmt(summary.foraPadraoAuditoriaMin ?? summary.heAcimaPadraoMin ?? 0), 'fora do padrão', '', ''],
    [fmt(summary.semPadraoMin || 0), 'sem padrão cadastrado', '', ''],
    [summary.interjornada || 0, 'interjornadas', '', ''],
    [summary.intrajornada || 0, 'intrajornadas', '', ''],
    [summary.motoristasComHE || 0, 'motoristas com extras', '', ''],
    [faltas, 'faltas/atestados/horas faltantes', '', '']
  ];
  return <><div className="executive-cards">{cards.map(([value, label, tone, bucket], index) => <article className={`${tone || ''} ${bucket ? 'executive-card-clickable' : ''} ${selectedBucket === bucket ? 'selected' : ''}`} key={`${label}-${index}`} onClick={() => bucket && onSelectBucket?.(selectedBucket === bucket ? '' : bucket)} role={bucket ? 'button' : undefined} tabIndex={bucket ? 0 : undefined} onKeyDown={event => bucket && event.key === 'Enter' && onSelectBucket?.(selectedBucket === bucket ? '' : bucket)}><strong>{value}</strong><small>{label}{bucket ? ' · clique para detalhar' : ''}</small></article>)}</div>{selectedBucket && <div className="executive-bucket-details"><b>Detalhamento de {selectedBucket === 'he2min' ? 'HE.2' : 'HE.3'}</b>{bucketDetails.map(item => <div key={`${item.motorista}-${item.dateKey}`}><span>{item.motorista}<small>{item.dateKey ? ` · ${item.dateKey.split('-').reverse().join('/')}` : ''}</small></span><strong>{fmt(item.minutos)}</strong></div>)}{!bucketDetails.length && <small>Nenhum registro encontrado.</small>}</div>}</>;
}

export function ExecutiveEvents({ events = [] }) {
  return <div className="executive-events"><b>Ocorrências lançadas</b>{events.slice(-8).reverse().map(event => <div key={event.id || `${event.dataKey}-${event.motorista}`}><span>{event.dataKey} · {event.motorista}</span><small>{event.tipo}{event.minutos ? ` · ${Math.floor(event.minutos / 60)}h${String(event.minutos % 60).padStart(2, '0')}` : ''}</small></div>)}{!events.length && <small>Nenhuma ocorrência lançada.</small>}</div>;
}
