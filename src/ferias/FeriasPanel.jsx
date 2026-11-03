import { useEffect, useMemo, useState } from 'react';
import { suggestVacation } from './ferias-model.js';
import { acceptSuggestion, persistPersonShift, persistSuggestion, persistTurno, persistVacationImport, subscribeFeriasData } from './ferias-store.js';
import { extractVacationPdf, parseVacationPdfText } from './pdf-import.js';

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
  const [feristaDraft, setFeristaDraft] = useState({ name: '', shiftIds: [] });
  const [people, setPeople] = useState([]);
  const [personShifts, setPersonShifts] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [programacoes, setProgramacoes] = useState([]);
  const [turnoDraft, setTurnoDraft] = useState(emptyTurno);
  const [notice, setNotice] = useState('');
  const [importedRecords, setImportedRecords] = useState([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => subscribeFeriasData({
    onTurnos: setTurnos,
    onFeristas: setFeristas,
    onPeople: setPeople,
    onPersonShifts: records => setPersonShifts(records.reduce((map, item) => ({ ...map, [item.employeeCode || item.employeeName]: item.shiftId }), {})),
    onSuggestions: setSuggestions,
    onPrograms: setProgramacoes,
    onError: error => setNotice(`Não foi possível sincronizar férias agora: ${error?.message || 'verifique a conexão.'}`)
  }), []);

  const metrics = useMemo(() => ({
    suggestions: suggestions.filter(item => item.status !== 'aceita').length,
    approved: programacoes.filter(item => item.status === 'aprovada').length,
    pending: suggestions.filter(item => item.status === 'com_pendencias').length,
    unassigned: 0
  }), [suggestions, programacoes]);

  function addTurno(event) {
    event.preventDefault();
    if (!turnoDraft.name.trim()) return;
    const turno = { ...turnoDraft, id: `turno-${Date.now()}`, status: 'ativo' };
    setTurnos(items => [...items, turno]);
    setTurnoDraft(emptyTurno);
    persistTurno(turno, user?.email).then(() => setNotice('Turno salvo no Firebase.')).catch(error => setNotice(`Não foi possível salvar o turno: ${error?.message || 'verifique a conexão.'}`));
  }

  function generateExampleSuggestion() {
    const employees = people.length ? people : [{ employeeCode: 'exemplo', employeeName: 'Funcionário aguardando importação', balanceDays: 30, gozoLimit: '2027-12-31' }];
    const generated = employees.map((employee, index) => {
      const shiftId = personShifts[employee.id || employee.employeeName] || turnos[0]?.id;
      const shift = turnos.find(item => item.id === shiftId) || null;
      return { ...suggestVacation({ today: new Date().toISOString().slice(0, 10), employee, shift, feristas }), id: `sugestao-${employee.employeeCode || index}-${Date.now()}` };
    });
    setSuggestions(items => [...generated, ...items.filter(item => !generated.some(next => next.employeeName === item.employeeName))]);
    Promise.all(generated.map(item => persistSuggestion(item, user?.email))).then(() => setNotice(`${generated.length} sugestões geradas e sincronizadas.`)).catch(error => setNotice(`Sugestões geradas, mas há falha na sincronização: ${error?.message || 'verifique a conexão.'}`));
    setTab('sugestoes');
  }

  function assignPersonShift(person, shiftId) {
    const key = person.employeeCode || person.employeeName;
    setPersonShifts(current => ({ ...current, [key]: shiftId }));
    const shift = turnos.find(item => item.id === shiftId);
    if (shift) persistPersonShift(person, shift.id, user?.email).catch(error => setNotice(`Turno selecionado, mas não sincronizado: ${error?.message || 'verifique a conexão.'}`));
  }

  function addFerista(event) {
    event.preventDefault();
    if (!feristaDraft.name.trim() || !feristaDraft.shiftIds.length) return;
    const ferista = { id: `ferista-${Date.now()}`, name: feristaDraft.name.trim(), shiftIds: feristaDraft.shiftIds, status: 'ativo' };
    setFeristas(items => [...items, ferista]);
    setFeristaDraft({ name: '', shiftIds: [] });
    import('./ferias-store.js').then(({ persistFerista }) => persistFerista(ferista, user?.email)).then(() => setNotice('Ferista salvo no Firebase.')).catch(error => setNotice(`Não foi possível salvar o ferista: ${error?.message || 'verifique a conexão.'}`));
  }

  function acceptSuggestion(item) {
    if (item.status !== 'pronta') {
      setNotice('Esta sugestão possui pendências e não pode ser aceita ainda.');
      return;
    }
    acceptSuggestion(item, user?.email).then(() => {
      setProgramacoes(items => [{ ...item, status: 'aprovada', acceptedBy: user?.email, acceptedAt: new Date().toISOString() }, ...items]);
      setSuggestions(items => items.map(current => current.id === item.id ? { ...current, status: 'aceita' } : current));
      setNotice('Programação aceita e sincronizada com o Firebase.');
    }).catch(error => setNotice(`Não foi possível aceitar a programação: ${error?.message || 'verifique a conexão.'}`));
  }

  async function handlePdfImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setNotice('Lendo o PDF no navegador…');
    try {
      const text = await extractVacationPdf(file);
      const records = parseVacationPdfText(text, `preview-${Date.now()}`);
      if (!records.length) throw new Error('Não encontrei registros no formato esperado do relatório.');
      setImportedRecords(records);
      await persistVacationImport(records, user?.email, file.name);
      setNotice(`${records.length} pessoas importadas. O PDF original não foi armazenado.`);
    } catch (error) {
      setNotice(`Não foi possível importar o PDF: ${error?.message || 'formato não reconhecido.'}`);
    } finally { setImporting(false); event.target.value = ''; }
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
    <div className="ferias-tabs" role="tablist">{[['visao','Visão geral'],['importar','Importar PDF'],['sugestoes','Sugestões'],['programacoes','Programações'],['turnos','Turnos e feristas']].map(([id,label]) => <button key={id} className={tab === id ? 'active' : ''} type="button" onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>{label}</button>)}</div>
    {tab === 'visao' && <section className="ferias-card"><div className="section-heading"><div><h3>Próximas etapas</h3><p>O PDF será importado e revisado antes de qualquer programação oficial.</p></div><StatusBadge>Rascunho seguro</StatusBadge></div><div className="ferias-checklist"><div><b>1</b><span><strong>Importar previsão de férias</strong><small>Extrair saldo, período aquisitivo e limite de gozo.</small></span></div><div><b>2</b><span><strong>Confirmar turnos e feristas</strong><small>O cadastro manual é a fonte oficial para cobertura.</small></span></div><div><b>3</b><span><strong>Aceitar as programações</strong><small>Somente o aceite cria a programação oficial.</small></span></div></div></section>}
    {tab === 'importar' && <section className="ferias-card"><div className="section-heading"><div><h3>Importar previsão de férias</h3><p>O processamento acontece no navegador. Salvamos somente os dados necessários para auditoria e planejamento.</p></div></div><label className="pdf-dropzone"><input type="file" accept="application/pdf,.pdf" onChange={handlePdfImport} disabled={importing} /><span>{importing ? 'Processando PDF…' : 'Selecionar PDF de previsão de férias'}</span><small>O arquivo original não é enviado nem armazenado.</small></label>{importedRecords.length > 0 && <div className="ferias-list import-preview">{importedRecords.slice(0, 12).map(item => <div className="ferias-row" key={`${item.employeeName}-${item.gozoLimit}`}><div><strong>{item.employeeName}</strong><span>Saldo: {item.balanceDays} dias · Limite: {formatDate(item.gozoLimit)}</span><small>Período aquisitivo: {item.accrualPeriod}</small></div><StatusBadge tone="green">Importado</StatusBadge></div>)}{importedRecords.length > 12 && <small className="preview-more">+ {importedRecords.length - 12} registros importados</small>}</div>}</section>}
    {tab === 'sugestoes' && <section className="ferias-card"><div className="section-heading"><div><h3>Sugestões para revisar</h3><p>Antecedência, limite de gozo e cobertura são recalculados após cada edição.</p></div></div>{suggestions.length === 0 ? <div className="ferias-empty">Nenhuma sugestão gerada. Importe a previsão ou gere uma simulação para testar as regras.</div> : <div className="ferias-list">{suggestions.map(item => <div className="ferias-row" key={item.id}><div><strong>{item.employeeName}</strong><span>{item.startDate ? `${formatDate(item.startDate)} a ${formatDate(item.endDate)}` : 'Período pendente'}</span><small>Treinamento: {formatDate(item.trainingStartDate)} a {formatDate(item.trainingEndDate)}</small></div><div className="ferias-row-meta"><StatusBadge tone={item.status === 'pronta' ? 'green' : 'red'}>{item.status === 'pronta' ? 'Pronta' : 'Com pendências'}</StatusBadge><button className="secondary-button" type="button" onClick={() => acceptSuggestion(item)}>Aceitar</button></div></div>)}</div>}</section>}
    {tab === 'programacoes' && <section className="ferias-card"><div className="section-heading"><div><h3>Programações aprovadas</h3><p>Somente registros aceitos pelo RH aparecem nesta lista.</p></div></div>{programacoes.length === 0 ? <div className="ferias-empty">Nenhuma programação aprovada.</div> : <div className="ferias-list">{programacoes.map(item => <div className="ferias-row" key={item.id}><div><strong>{item.employeeName}</strong><span>{formatDate(item.startDate)} a {formatDate(item.endDate)}</span></div><StatusBadge tone="green">Aprovada</StatusBadge></div>)}</div>}</section>}
    {tab === 'turnos' && <section className="ferias-card"><div className="section-heading"><div><h3>Turnos e feristas</h3><p>Cadastre manualmente a base usada pelo motor de sugestões.</p></div></div><form className="ferias-form" onSubmit={addTurno}><label>Nome do turno<input value={turnoDraft.name} onChange={event => setTurnoDraft({ ...turnoDraft, name: event.target.value })} placeholder="Ex.: Motoristas manhã" /></label><label>Dias aplicáveis<input value={turnoDraft.days} onChange={event => setTurnoDraft({ ...turnoDraft, days: event.target.value })} /></label><button className="primary-button" type="submit">Cadastrar turno <span>+</span></button></form>{turnos.length === 0 ? <div className="ferias-empty">Nenhum turno cadastrado ainda.</div> : <div className="ferias-list">{turnos.map(item => <div className="ferias-row" key={item.id}><div><strong>{item.name}</strong><span>{item.days}</span></div><StatusBadge>{feristas.filter(ferista => ferista.shiftIds?.includes(item.id)).length} feristas compatíveis</StatusBadge></div>)}</div>}<form className="ferias-form ferista-form" onSubmit={addFerista}><label>Nome do ferista<input value={feristaDraft.name} onChange={event => setFeristaDraft({ ...feristaDraft, name: event.target.value })} placeholder="Ex.: Carlos da Silva" /></label><label>Turnos compatíveis<select multiple value={feristaDraft.shiftIds} onChange={event => setFeristaDraft({ ...feristaDraft, shiftIds: [...event.target.selectedOptions].map(option => option.value) })}>{turnos.map(turno => <option key={turno.id} value={turno.id}>{turno.name}</option>)}</select></label><button className="primary-button" type="submit">Cadastrar ferista <span>+</span></button></form><div className="feristas-summary">{feristas.length ? feristas.map(item => <StatusBadge key={item.id} tone="green">{item.name}</StatusBadge>) : <span>Nenhum ferista cadastrado.</span>}</div><div className="section-heading people-heading"><div><h3>Pessoas importadas</h3><p>Confirme o turno de cada pessoa para liberar sugestões confiáveis.</p></div><StatusBadge tone={people.filter(person => personShifts[person.employeeCode || person.employeeName]).length === people.length && people.length ? 'green' : 'red'}>{people.filter(person => personShifts[person.employeeCode || person.employeeName]).length}/{people.length} vinculadas</StatusBadge></div>{people.length === 0 ? <div className="ferias-empty">Importe o PDF para listar as pessoas.</div> : <div className="ferias-list people-list">{people.map(person => <div className="ferias-row" key={person.id || person.employeeName}><div><strong>{person.employeeName}</strong><span>Saldo: {person.balanceDays} dias · Limite: {formatDate(person.gozoLimit)}</span></div><select value={personShifts[person.employeeCode || person.employeeName] || ''} onChange={event => assignPersonShift(person, event.target.value)}><option value="">Selecionar turno</option>{turnos.map(turno => <option key={turno.id} value={turno.id}>{turno.name}</option>)}</select></div>)}</div>}</section>}
  </div>;
}
