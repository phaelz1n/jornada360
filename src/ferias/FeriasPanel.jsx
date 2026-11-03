import { useMemo, useState } from 'react';
import { suggestVacation } from './ferias-model.js';

const emptyTurno = { name: '', description: '', days: 'Segunda a sábado' };

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`));
}

function StatusBadge({ children, tone = 'blue' }) {
  return <span className={`ferias-status ${tone}`}>{children}</span>;
}

export function FeriasPanel({ user }) {
  const [tab, setTab] = useState('visao');
  const [turnos, setTurnos] = useState([]);
  const [feristas, setFeristas] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [programacoes, setProgramacoes] = useState([]);
  const [turnoDraft, setTurnoDraft] = useState(emptyTurno);
  const [notice, setNotice] = useState('');

  const metrics = useMemo(() => ({
    suggestions: suggestions.filter(item => item.status !== 'aceita').length,
    approved: programacoes.filter(item => item.status === 'aprovada').length,
    pending: suggestions.filter(item => item.status === 'com_pendencias').length,
    unassigned: 0
  }), [suggestions, programacoes]);

  function addTurno(event) {
    event.preventDefault();
    if (!turnoDraft.name.trim()) return;
    setTurnos(items => [...items, { ...turnoDraft, id: `turno-${Date.now()}` }]);
    setTurnoDraft(emptyTurno);
    setNotice('Turno criado como rascunho local. A sincronização será ativada nesta etapa do módulo.');
  }

  function generateExampleSuggestion() {
    const shift = turnos[0] || { id: 'turno-pendente', name: 'Turno ainda não cadastrado' };
    const employee = { employeeCode: 'exemplo', employeeName: 'Funcionário aguardando importação', balanceDays: 30, gozoLimit: '2027-12-31' };
    const result = suggestVacation({ today: new Date().toISOString().slice(0, 10), employee, shift, feristas });
    setSuggestions(items => [{ ...result, id: `sugestao-${Date.now()}` }, ...items]);
    setTab('sugestoes');
  }

  function acceptSuggestion(item) {
    if (item.status !== 'pronta') {
      setNotice('Esta sugestão possui pendências e não pode ser aceita ainda.');
      return;
    }
    setProgramacoes(items => [{ ...item, status: 'aprovada', acceptedBy: user?.email, acceptedAt: new Date().toISOString() }, ...items]);
    setSuggestions(items => items.map(current => current.id === item.id ? { ...current, status: 'aceita' } : current));
    setNotice('Programação aceita. Ela está pronta para ser sincronizada com o Firebase.');
  }

  return <div className="ferias-page">
    {notice && <div className="ferias-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}
    <div className="ferias-toolbar">
      <div><span className="eyebrow">CONTROLE DE FÉRIAS</span><h2>Planejamento de férias</h2><p>Revise as sugestões, organize a cobertura e aceite somente o que estiver conferido.</p></div>
      <button className="primary-button ferias-action" type="button" onClick={generateExampleSuggestion}>Gerar sugestões <span>→</span></button>
    </div>
    <div className="ferias-metrics">
      <article><strong>{metrics.suggestions}</strong><span>Sugestões pendentes</span></article>
      <article><strong>{metrics.approved}</strong><span>Programações aprovadas</span></article>
      <article className={metrics.pending ? 'warning' : ''}><strong>{metrics.pending}</strong><span>Com pendências</span></article>
      <article><strong>{metrics.unassigned}</strong><span>Sem turno</span></article>
    </div>
    <div className="ferias-tabs" role="tablist">{[['visao','Visão geral'],['sugestoes','Sugestões'],['programacoes','Programações'],['turnos','Turnos e feristas']].map(([id,label]) => <button key={id} className={tab === id ? 'active' : ''} type="button" onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>{label}</button>)}</div>
    {tab === 'visao' && <section className="ferias-card"><div className="section-heading"><div><h3>Próximas etapas</h3><p>O PDF será importado e revisado antes de qualquer programação oficial.</p></div><StatusBadge>Rascunho seguro</StatusBadge></div><div className="ferias-checklist"><div><b>1</b><span><strong>Importar previsão de férias</strong><small>Extrair saldo, período aquisitivo e limite de gozo.</small></span></div><div><b>2</b><span><strong>Confirmar turnos e feristas</strong><small>O cadastro manual é a fonte oficial para cobertura.</small></span></div><div><b>3</b><span><strong>Aceitar as programações</strong><small>Somente o aceite cria a programação oficial.</small></span></div></div></section>}
    {tab === 'sugestoes' && <section className="ferias-card"><div className="section-heading"><div><h3>Sugestões para revisar</h3><p>Antecedência, limite de gozo e cobertura são recalculados após cada edição.</p></div></div>{suggestions.length === 0 ? <div className="ferias-empty">Nenhuma sugestão gerada. Importe a previsão ou gere uma simulação para testar as regras.</div> : <div className="ferias-list">{suggestions.map(item => <div className="ferias-row" key={item.id}><div><strong>{item.employeeName}</strong><span>{item.startDate ? `${formatDate(item.startDate)} a ${formatDate(item.endDate)}` : 'Período pendente'}</span><small>Treinamento: {formatDate(item.trainingStartDate)} a {formatDate(item.trainingEndDate)}</small></div><div className="ferias-row-meta"><StatusBadge tone={item.status === 'pronta' ? 'green' : 'red'}>{item.status === 'pronta' ? 'Pronta' : 'Com pendências'}</StatusBadge><button className="secondary-button" type="button" onClick={() => acceptSuggestion(item)}>Aceitar</button></div></div>)}</div>}</section>}
    {tab === 'programacoes' && <section className="ferias-card"><div className="section-heading"><div><h3>Programações aprovadas</h3><p>Somente registros aceitos pelo RH aparecem nesta lista.</p></div></div>{programacoes.length === 0 ? <div className="ferias-empty">Nenhuma programação aprovada.</div> : <div className="ferias-list">{programacoes.map(item => <div className="ferias-row" key={item.id}><div><strong>{item.employeeName}</strong><span>{formatDate(item.startDate)} a {formatDate(item.endDate)}</span></div><StatusBadge tone="green">Aprovada</StatusBadge></div>)}</div>}</section>}
    {tab === 'turnos' && <section className="ferias-card"><div className="section-heading"><div><h3>Turnos e feristas</h3><p>Cadastre manualmente a base usada pelo motor de sugestões.</p></div></div><form className="ferias-form" onSubmit={addTurno}><label>Nome do turno<input value={turnoDraft.name} onChange={event => setTurnoDraft({ ...turnoDraft, name: event.target.value })} placeholder="Ex.: Motoristas manhã" /></label><label>Dias aplicáveis<input value={turnoDraft.days} onChange={event => setTurnoDraft({ ...turnoDraft, days: event.target.value })} /></label><button className="primary-button" type="submit">Cadastrar turno <span>+</span></button></form>{turnos.length === 0 ? <div className="ferias-empty">Nenhum turno cadastrado ainda.</div> : <div className="ferias-list">{turnos.map(item => <div className="ferias-row" key={item.id}><div><strong>{item.name}</strong><span>{item.days}</span></div><StatusBadge>{feristas.length} feristas compatíveis</StatusBadge></div>)}</div>}</section>}
  </div>;
}
