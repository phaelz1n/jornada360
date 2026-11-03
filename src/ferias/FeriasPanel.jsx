import { useEffect, useMemo, useState } from 'react';
import { businessDaysBefore, detectVacationConflicts, detectVacationImportConflicts, isDriverRole, validateVacationSuggestion, suggestVacation } from './ferias-model.js';
import { acceptSuggestion, cancelProgramacao, persistPersonShift, persistSuggestion, persistTurno, persistVacationImport, persistVacationPerson, subscribeFeriasData } from './ferias-store.js';
import { extractVacationPdf, parseVacationPdfText } from './pdf-import.js';

const emptyTurno = { name: '', description: '', days: 'Segunda a sábado' };

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`));
}

function printVacationReport(programacoes, feristas, turnos) {
  const oficiais = programacoes.filter(item => item.status === 'aprovada');
  if (!oficiais.length) return false;
  const rows = oficiais.map(item => {
    const ferista = feristas.find(candidate => candidate.id === item.feristaId)?.name || 'Não informado';
    const turno = turnos.find(candidate => candidate.id === item.shiftId)?.name || 'Não informado';
    return `<tr><td>${item.employeeName || '—'}</td><td>${formatDate(item.startDate)} a ${formatDate(item.endDate)}</td><td>${turno}</td><td>${ferista}</td><td>${formatDate(item.trainingStartDate)} a ${formatDate(item.trainingEndDate)}</td></tr>`;
  }).join('');
  const report = window.open('', '_blank', 'noopener,noreferrer');
  if (!report) return false;
  report.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de férias programadas</title><style>body{font-family:Arial,sans-serif;color:#173b67;padding:32px}h1{font-size:22px;margin:0 0 6px}p{color:#637d9d;margin:0 0 24px;font-size:12px}.brand{font-size:11px;letter-spacing:2px;color:#3474b8;font-weight:700;margin-bottom:10px}table{border-collapse:collapse;width:100%;font-size:11px}th{background:#1765b2;color:#fff;text-align:left;padding:9px}td{border:1px solid #dbe5ef;padding:8px;vertical-align:top}tr:nth-child(even){background:#f5f8fb}.footer{margin-top:22px;color:#7187a2;font-size:10px}@media print{body{padding:0}button{display:none}}</style></head><body><div class="brand">TRANSPI NHO · CONTROLE DE FÉRIAS</div><h1>Férias programadas</h1><p>Relatório gerado em ${new Intl.DateTimeFormat('pt-BR').format(new Date())} · ${oficiais.length} programação(ões) aprovada(s)</p><table><thead><tr><th>Funcionário</th><th>Período</th><th>Turno</th><th>Ferista</th><th>Treinamento</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Documento gerado pelo Jornada360. Somente programações aprovadas são exibidas.</div><script>window.onload=()=>window.print();</script></body></html>`);
  report.document.close();
  return true;
}

function StatusBadge({ children, tone = 'blue' }) {
  return <span className={`ferias-status ${tone}`}>{children}</span>;
}

export function FeriasPanel({ user, motoristas = [] }) {
  const [tab, setTab] = useState('visao');
  const [turnos, setTurnos] = useState([]);
  const [feristas, setFeristas] = useState([]);
  const [feristaDraft, setFeristaDraft] = useState({ name: '', shiftIds: [], coverageScope: 'todos' });
  const [people, setPeople] = useState([]);
  const [personShifts, setPersonShifts] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [programacoes, setProgramacoes] = useState([]);
  const [turnoDraft, setTurnoDraft] = useState(emptyTurno);
  const [notice, setNotice] = useState('');
  const [syncError, setSyncError] = useState('');
  const [importedRecords, setImportedRecords] = useState([]);
  const [pendingImport, setPendingImport] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => subscribeFeriasData({
    onTurnos: setTurnos,
    onFeristas: setFeristas,
    onPeople: setPeople,
    onPersonShifts: records => setPersonShifts(records.reduce((map, item) => ({ ...map, [item.employeeCode || item.employeeName]: item.shiftId }), {})),
    onSuggestions: setSuggestions,
    onPrograms: setProgramacoes,
    onError: error => { setSyncError(error?.message || 'verifique a conexão e as permissões do Firebase.'); setNotice(`Não foi possível sincronizar férias agora: ${error?.message || 'verifique a conexão.'}`); }
  }), []);

  const metrics = useMemo(() => ({
    suggestions: suggestions.filter(item => item.status !== 'aceita').length,
    approved: programacoes.filter(item => item.status === 'aprovada').length,
    pending: suggestions.filter(item => item.status === 'com_pendencias').length,
    unassigned: people.filter(person => !personShifts[person.employeeCode || person.employeeName]).length,
    nonDrivers: people.filter(person => !isEligibleDriver(person)).length,
    conflicts: detectVacationConflicts(suggestions).length
  }), [suggestions, programacoes, people, personShifts, motoristas]);

  function normalizeName(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function isEligibleDriver(person) {
    if (person.role) return isDriverRole(person.role);
    if (!motoristas.length) return true;
    return motoristas.some(driver => normalizeName(driver.nome) === normalizeName(person.employeeName));
  }

  function addTurno(event) {
    event.preventDefault();
    if (!turnoDraft.name.trim()) return;
    const turno = { ...turnoDraft, id: `turno-${Date.now()}`, status: 'ativo' };
    setTurnos(items => [...items, turno]);
    setTurnoDraft(emptyTurno);
    persistTurno(turno, user?.email).then(() => setNotice('Turno salvo no Firebase.')).catch(error => setNotice(`Não foi possível salvar o turno: ${error?.message || 'verifique a conexão.'}`));
  }

  function generateExampleSuggestion() {
    if (!people.length) { setNotice('Importe a previsão de férias antes de gerar sugestões.'); setTab('importar'); return; }
    const employees = people.filter(isEligibleDriver);
    if (!employees.length) { setNotice('Nenhum motorista elegível foi encontrado no cadastro.'); return; }
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
    const ferista = { id: `ferista-${Date.now()}`, name: feristaDraft.name.trim(), shiftIds: feristaDraft.shiftIds, coverageScope: feristaDraft.coverageScope, status: 'ativo' };
    setFeristas(items => [...items, ferista]);
    setFeristaDraft({ name: '', shiftIds: [], coverageScope: 'todos' });
    import('./ferias-store.js').then(({ persistFerista }) => persistFerista(ferista, user?.email)).then(() => setNotice('Ferista salvo no Firebase.')).catch(error => setNotice(`Não foi possível salvar o ferista: ${error?.message || 'verifique a conexão.'}`));
  }

  function updateFeristaScope(ferista, coverageScope) {
    const updated = { ...ferista, coverageScope };
    setFeristas(items => items.map(item => item.id === ferista.id ? updated : item));
    import('./ferias-store.js').then(({ persistFerista }) => persistFerista(updated, user?.email)).then(() => setNotice(`${ferista.name} atualizado no Firebase.`)).catch(error => setNotice(`Alteração local, mas não sincronizada: ${error?.message || 'verifique a conexão.'}`));
  }

  function updatePersonDistance(person, garageDistance) {
    const updated = { ...person, garageDistance };
    setPeople(items => items.map(item => item.id === person.id ? updated : item));
    persistVacationPerson(updated, user?.email).then(() => setNotice(`${person.employeeName} atualizado no Firebase.`)).catch(error => setNotice(`Distância atualizada localmente, mas não sincronizada: ${error?.message || 'verifique a conexão.'}`));
  }

  function deactivateFerista(ferista) {
    const updated = { ...ferista, status: 'inativo', deactivatedAt: new Date().toISOString(), deactivatedBy: user?.email };
    setFeristas(items => items.map(item => item.id === ferista.id ? updated : item));
    import('./ferias-store.js').then(({ persistFerista }) => persistFerista(updated, user?.email)).then(() => setNotice('Ferista inativado e preservado no histórico.')).catch(error => setNotice(`Não foi possível inativar: ${error?.message || 'verifique a conexão.'}`));
  }

  function acceptSuggestion(item) {
    if (detectVacationConflicts(suggestions).some(conflict => conflict.ids.includes(item.id))) {
      setNotice('Esta sugestão possui conflito de cobertura com outra programação.');
      return;
    }
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

  function editSuggestion(item, changes) {
    const next = { ...item, ...changes };
    const selectedFerista = feristas.find(ferista => ferista.id === next.feristaId) || null;
    const shift = turnos.find(turno => turno.id === next.shiftId) || null;
    const validation = validateVacationSuggestion({
      today: new Date().toISOString().slice(0, 10), startDate: next.startDate, endDate: next.endDate,
      employee: { balanceDays: next.balanceDays, gozoLimit: next.gozoLimit }, shift, ferista: selectedFerista
    });
    const updated = { ...next, ...validation, startDate: next.startDate, endDate: next.endDate, feristaId: next.feristaId || null, shiftId: next.shiftId || null, trainingStartDate: businessDaysBefore(next.startDate, 2), trainingEndDate: next.startDate ? new Date(new Date(`${next.startDate}T12:00:00`).getTime() - 86400000).toISOString().slice(0, 10) : null, id: item.id };
    setSuggestions(items => items.map(current => current.id === item.id ? updated : current));
    persistSuggestion(updated, user?.email).catch(error => setNotice(`Alteração local, mas não sincronizada: ${error?.message || 'verifique a conexão.'}`));
  }

  function rejectSuggestion(item) {
    const rejected = { ...item, status: 'rejeitada', rejectedAt: new Date().toISOString(), rejectedBy: user?.email };
    setSuggestions(items => items.map(current => current.id === item.id ? rejected : current));
    persistSuggestion(rejected, user?.email).then(() => setNotice('Sugestão rejeitada e registrada no Firebase.')).catch(error => setNotice(`Sugestão rejeitada localmente, mas não sincronizada: ${error?.message || 'verifique a conexão.'}`));
  }

  function cancelApprovedProgram(item) {
    const reason = window.prompt('Informe a justificativa do cancelamento:');
    if (!reason?.trim()) return;
    cancelProgramacao(item, user?.email, reason).then(() => {
      setProgramacoes(items => items.map(current => current.id === item.id ? { ...current, status: 'cancelada', cancellationReason: reason } : current));
      setNotice('Programação cancelada e registrada na auditoria.');
    }).catch(error => setNotice(`Não foi possível cancelar: ${error?.message || 'verifique a conexão.'}`));
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
      const conflicts = detectVacationImportConflicts(people, records);
      if (conflicts.length) {
        setPendingImport({ records, fileName: file.name, conflicts });
        setNotice(`${conflicts.length} período(s) próximo(s) encontrado(s). Revise antes de salvar.`);
      } else {
        await persistVacationImport(records, user?.email, file.name);
        setPeople(records);
        setSyncError('');
        setNotice(`${records.length} pessoas importadas. O PDF original não foi armazenado.`);
      }
    } catch (error) {
      setNotice(`Não foi possível importar o PDF: ${error?.message || 'formato não reconhecido.'}`);
    } finally { setImporting(false); event.target.value = ''; }
  }

  async function replaceWithPendingImport() {
    if (!pendingImport) return;
    try {
      await persistVacationImport(pendingImport.records, user?.email, pendingImport.fileName);
      setPeople(pendingImport.records);
      setSyncError('');
      setPendingImport(null);
      setNotice(`${pendingImport.records.length} pessoas importadas; os períodos conflitantes foram substituídos.`);
    } catch (error) { setNotice(`Não foi possível substituir a importação: ${error?.message || 'verifique a conexão.'}`); }
  }

  return <div className="ferias-page">
    {notice && <div className="ferias-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}
    {syncError && <div className="ferias-notice ferias-sync-error" role="alert"><strong>Sincronização com Firebase:</strong> {syncError}<small>Se o navegador estiver bloqueando firestore.googleapis.com, desative o bloqueio para este domínio e recarregue a página.</small></div>}
    <div className="ferias-toolbar">
      <div><span className="eyebrow">CONTROLE DE FÉRIAS</span><h2>Planejamento de férias</h2><p>Revise as sugestões, organize a cobertura e aceite somente o que estiver conferido.</p></div>
      <button className="primary-button ferias-action" type="button" onClick={generateExampleSuggestion}>Gerar sugestões <span>→</span></button>
    </div>
    <div className="ferias-metrics">
      <article><strong>{metrics.suggestions}</strong><span>Sugestões pendentes</span></article>
      <article><strong>{metrics.approved}</strong><span>Programações aprovadas</span></article>
      <article className={metrics.pending ? 'warning' : ''}><strong>{metrics.pending}</strong><span>Com pendências</span></article>
      <article><strong>{metrics.unassigned}</strong><span>Sem turno</span></article>
      <article className={metrics.conflicts ? 'warning' : ''}><strong>{metrics.conflicts}</strong><span>Conflitos de cobertura</span></article>
    </div>
    <div className="ferias-tabs" role="tablist">{[['visao','Visão geral'],['importar','Importar PDF'],['sugestoes','Sugestões'],['programacoes','Programações'],['cadastros','Cadastros'],['turnos','Turnos e feristas']].map(([id,label]) => <button key={id} className={tab === id ? 'active' : ''} type="button" onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>{label}</button>)}</div>
    {tab === 'visao' && <section className="ferias-card"><div className="section-heading"><div><h3>Próximas etapas</h3><p>O PDF será importado e revisado antes de qualquer programação oficial.</p></div><StatusBadge>Rascunho seguro</StatusBadge></div><div className="ferias-checklist"><div><b>1</b><span><strong>Importar previsão de férias</strong><small>Extrair saldo, período aquisitivo e limite de gozo.</small></span></div><div><b>2</b><span><strong>Confirmar turnos e feristas</strong><small>O cadastro manual é a fonte oficial para cobertura.</small></span></div><div><b>3</b><span><strong>Aceitar as programações</strong><small>Somente o aceite cria a programação oficial.</small></span></div></div></section>}
    {tab === 'importar' && <section className="ferias-card"><div className="section-heading"><div><h3>Importar previsão de férias</h3><p>O processamento acontece no navegador. Salvamos somente os dados necessários para auditoria e planejamento.</p></div></div><label className="pdf-dropzone"><input type="file" accept="application/pdf,.pdf" onChange={handlePdfImport} disabled={importing} /><span>{importing ? 'Processando PDF…' : 'Selecionar PDF de previsão de férias'}</span><small>O arquivo original não é enviado nem armazenado.</small></label>{importedRecords.length > 0 && <div className="ferias-list import-preview">{importedRecords.slice(0, 12).map(item => <div className="ferias-row" key={`${item.employeeName}-${item.gozoLimit}`}><div><strong>{item.employeeName}</strong><span>Saldo: {item.balanceDays} dias · Limite: {formatDate(item.gozoLimit)}</span><small>Período aquisitivo: {item.accrualPeriod}</small></div><StatusBadge tone="green">Importado</StatusBadge></div>)}{importedRecords.length > 12 && <small className="preview-more">+ {importedRecords.length - 12} registros importados</small>}</div>}</section>}
    {tab === 'sugestoes' && <section className="ferias-card"><div className="section-heading"><div><h3>Sugestões para revisar</h3><p>Edite o período ou a cobertura; as regras são recalculadas antes do aceite.</p></div></div>{suggestions.length === 0 ? <div className="ferias-empty">Nenhuma sugestão gerada. Importe a previsão ou gere uma simulação para testar as regras.</div> : <div className="ferias-list">{suggestions.map(item => <div className="ferias-suggestion" key={item.id}><div className="ferias-row"><div><strong>{item.employeeName}</strong><span>{item.startDate ? `${formatDate(item.startDate)} a ${formatDate(item.endDate)}` : 'Período pendente'}</span><small>Treinamento: {formatDate(item.trainingStartDate)} a {formatDate(item.trainingEndDate)}</small></div><div className="ferias-row-meta"><StatusBadge tone={item.status === 'pronta' ? 'green' : item.status === 'rejeitada' ? 'blue' : 'red'}>{item.status === 'pronta' ? 'Pronta' : item.status === 'rejeitada' ? 'Rejeitada' : 'Com pendências'}</StatusBadge>{item.status !== 'aceita' && <><button className="secondary-button" type="button" onClick={() => acceptSuggestion(item)}>Aceitar</button><button className="secondary-button danger" type="button" onClick={() => rejectSuggestion(item)}>Rejeitar</button></>}</div></div>{item.status !== 'aceita' && item.status !== 'rejeitada' && <div className="ferias-edit-grid"><label>Início<input type="date" value={item.startDate || ''} onChange={event => editSuggestion(item, { startDate: event.target.value })} /></label><label>Fim<input type="date" value={item.endDate || ''} onChange={event => editSuggestion(item, { endDate: event.target.value })} /></label><label>Ferista<select value={item.feristaId || ''} onChange={event => editSuggestion(item, { feristaId: event.target.value })}><option value="">Selecionar</option>{feristas.map(ferista => <option key={ferista.id} value={ferista.id}>{ferista.name}</option>)}</select></label></div>}</div>)}</div>}</section>}
    {tab === 'programacoes' && <section className="ferias-card"><div className="section-heading"><div><h3>Calendário de programações</h3><p>Somente períodos aceitos pelo RH aparecem como oficiais.</p></div><button className="primary-button" type="button" onClick={() => { if (!printVacationReport(programacoes, feristas, turnos)) setNotice('Aceite ao menos uma programação para gerar o relatório.'); }}>Gerar relatório PDF <span>↓</span></button></div>{programacoes.length === 0 ? <div className="ferias-empty">Nenhuma programação aprovada.</div> : <div className="ferias-calendar">{programacoes.map(item => <div className={`ferias-calendar-item ${item.status === 'cancelada' ? 'cancelled' : ''}`} key={item.id}><b>{formatDate(item.startDate)}</b><span>{item.employeeName}</span><small>{formatDate(item.startDate)} a {formatDate(item.endDate)} · Ferista: {feristas.find(ferista => ferista.id === item.feristaId)?.name || 'não informado'} · {item.status}</small>{item.status === 'aprovada' && <button className="secondary-button danger" type="button" onClick={() => cancelApprovedProgram(item)}>Cancelar programação</button>}</div>)}</div>}</section>}
    {tab === 'cadastros' && <section className="ferias-card"><div className="section-heading"><div><h3>Cadastro operacional</h3><p>Defina o turno e a distância da garagem de cada pessoa importada. Essas informações orientam a escolha do ferista.</p></div><StatusBadge tone={people.length && people.every(person => personShifts[person.employeeCode || person.employeeName] && person.garageDistance !== 'nao_classificado') ? 'green' : 'red'}>{people.filter(person => personShifts[person.employeeCode || person.employeeName] && person.garageDistance !== 'nao_classificado').length}/{people.length} completos</StatusBadge></div>{people.length === 0 ? <div className="ferias-empty">Importe o PDF para carregar os nomes neste cadastro.</div> : <div className="ferias-list people-list">{people.map(person => <div className="ferias-row" key={person.id || person.employeeName}><div><strong>{person.employeeName}</strong><span>{person.role || 'Cargo não informado'} · Saldo: {person.balanceDays} dias</span><small>Limite de gozo: {formatDate(person.gozoLimit)}</small></div><label className="inline-field">Turno<select value={personShifts[person.employeeCode || person.employeeName] || ''} onChange={event => assignPersonShift(person, event.target.value)}><option value="">Selecionar turno</option>{turnos.map(turno => <option key={turno.id} value={turno.id}>{turno.name}</option>)}</select></label><label className="inline-field">Garagem<select aria-label={`Distância da garagem de ${person.employeeName}`} value={person.garageDistance || 'nao_classificado'} onChange={event => updatePersonDistance(person, event.target.value)}><option value="nao_classificado">Não classificado</option><option value="proximo">Próximo</option><option value="longe">Longe</option></select></label></div>)}</div>}</section>}
    {tab === 'turnos' && <section className="ferias-card"><div className="section-heading"><div><h3>Turnos e feristas</h3><p>Cadastre manualmente a base usada pelo motor de sugestões.</p></div></div><form className="ferias-form" onSubmit={addTurno}><label>Nome do turno<input value={turnoDraft.name} onChange={event => setTurnoDraft({ ...turnoDraft, name: event.target.value })} placeholder="Ex.: Motoristas manhã" /></label><label>Dias aplicáveis<input value={turnoDraft.days} onChange={event => setTurnoDraft({ ...turnoDraft, days: event.target.value })} /></label><button className="primary-button" type="submit">Cadastrar turno <span>+</span></button></form>{turnos.length === 0 ? <div className="ferias-empty">Nenhum turno cadastrado ainda.</div> : <div className="ferias-list">{turnos.map(item => <div className="ferias-row" key={item.id}><div><strong>{item.name}</strong><span>{item.days}</span></div><StatusBadge>{feristas.filter(ferista => ferista.status !== 'inativo' && ferista.shiftIds?.includes(item.id)).length} feristas compatíveis</StatusBadge></div>)}</div>}<form className="ferias-form ferista-form" onSubmit={addFerista}><label>Nome do ferista<input value={feristaDraft.name} onChange={event => setFeristaDraft({ ...feristaDraft, name: event.target.value })} placeholder="Ex.: Carlos da Silva" /></label><label>Turnos compatíveis<select multiple value={feristaDraft.shiftIds} onChange={event => setFeristaDraft({ ...feristaDraft, shiftIds: [...event.target.selectedOptions].map(option => option.value) })}>{turnos.map(turno => <option key={turno.id} value={turno.id}>{turno.name}</option>)}</select></label><label>Alcance da cobertura<select value={feristaDraft.coverageScope} onChange={event => setFeristaDraft({ ...feristaDraft, coverageScope: event.target.value })}><option value="todos">Todos os motoristas</option><option value="longe_garagem">Somente longe da garagem</option></select></label><button className="primary-button" type="submit">Cadastrar ferista <span>+</span></button></form><div className="feristas-summary">{feristas.length ? feristas.map(item => <span className="ferista-chip" key={item.id}><StatusBadge tone={item.status === 'inativo' ? 'red' : 'green'}>{item.name}{item.status === 'inativo' ? ' · inativo' : ''}</StatusBadge>{item.status !== 'inativo' && <><select aria-label={`Alcance da cobertura de ${item.name}`} value={item.coverageScope || 'todos'} onChange={event => updateFeristaScope(item, event.target.value)}><option value="todos">Todos</option><option value="longe_garagem">Longe da garagem</option></select><button type="button" onClick={() => deactivateFerista(item)} aria-label={`Inativar ${item.name}`}>×</button></>}</span>) : <span>Nenhum ferista cadastrado.</span>}</div><div className="section-heading people-heading"><div><h3>Pessoas importadas</h3><p>Confirme o turno e a distância da garagem de cada pessoa.</p></div><StatusBadge tone={people.filter(person => personShifts[person.employeeCode || person.employeeName]).length === people.length && people.length ? 'green' : 'red'}>{people.filter(person => personShifts[person.employeeCode || person.employeeName]).length}/{people.length} vinculadas</StatusBadge></div>{people.length === 0 ? <div className="ferias-empty">Importe o PDF para listar as pessoas.</div> : <div className="ferias-list people-list">{people.map(person => <div className="ferias-row" key={person.id || person.employeeName}><div><strong>{person.employeeName}</strong><span>Saldo: {person.balanceDays} dias · Limite: {formatDate(person.gozoLimit)}</span></div><select value={personShifts[person.employeeCode || person.employeeName] || ''} onChange={event => assignPersonShift(person, event.target.value)}><option value="">Selecionar turno</option>{turnos.map(turno => <option key={turno.id} value={turno.id}>{turno.name}</option>)}</select><select aria-label={`Distância da garagem de ${person.employeeName}`} value={person.garageDistance || 'nao_classificado'} onChange={event => updatePersonDistance(person, event.target.value)}><option value="nao_classificado">Distância não classificada</option><option value="proximo">Próximo da garagem</option><option value="longe">Longe da garagem</option></select></div>)}</div>}</section>}
    {pendingImport && tab === 'importar' && <section className="ferias-card ferias-import-warning"><strong>Períodos próximos encontrados</strong><p>{pendingImport.conflicts.map(item => `${item.employeeName}: cadastro ${formatDate(item.previous.startDate || item.previous.gozoLimit)} a ${formatDate(item.previous.endDate || item.previous.gozoLimit)} · novo ${formatDate(item.incoming.startDate || item.incoming.gozoLimit)} a ${formatDate(item.incoming.endDate || item.incoming.gozoLimit)}`).join(' · ')}</p><button className="primary-button" type="button" onClick={replaceWithPendingImport}>Substituir pelos dados novos</button><button className="secondary-button" type="button" onClick={() => { setPendingImport(null); setNotice('Cadastro atual mantido; a nova importação ficou apenas em prévia.'); }}>Manter cadastro atual</button></section>}
  </div>;
}
