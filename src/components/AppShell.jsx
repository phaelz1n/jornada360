import blueLogo from '../assets/logo-transpinho-blue.png';
import { useEffect, useState } from 'react';
import { NAVIGATION_GROUPS } from './navigation.js';
import { SECTION_CONTENT } from './sections.js';
import { ImportacaoPanel } from '../importacao/ImportacaoPanel.jsx';
import { ChecklistPanel } from '../checklist/ChecklistPanel.jsx';
import { buildImportRecord } from '../dados/import-record.js';
import { MigrationPanel } from '../dados/MigrationPanel.jsx';
import { ProcessingPanel, ReportsPanel, RegistersPanel } from '../modules/OperationalModules.jsx';
import { extractPointRows, extractReportDate, extractScaleRows, extractStandardRows } from '../processamento/planilha-normalizer.js';
import { normalizeDriverName, prepareProcessedDay } from '../processamento/processamento-model.js';
import { crossSources } from '../processamento/cruzamento.js';
import { normalizeTrackerRows } from '../importacao/rastreador-normalizer.js';
import { InicioDashboard } from '../modules/InicioDashboard.jsx';
import { OcorrenciasPanel } from '../modules/OcorrenciasPanel.jsx';
import { dedupeSnapshots } from '../dados/snapshot-history.js';
import { DateCalendar } from '../modules/OperationalModules.jsx';
import { syncLabel, syncTone } from '../dados/sync-state.js';
import { FeriasPanel } from '../ferias/FeriasPanel.jsx';
import { SystemHub } from './SystemHub.jsx';
import { AccessManager } from './AccessManager.jsx';
import { canAccessSystem } from '../auth/system-access.js';
import { loadSystemPermission, subscribeSystemPermissions } from '../auth/permissions-store.js';

function ChecklistHistory({ liveData }) {
  const dates = dedupeSnapshots(liveData?.snapshots || []);
  const [dateKey, setDateKey] = useState(liveData?.dateKey || dates.at(-1)?.dateKey || 'latest');
  return <><div className="history-picker"><b>Dia do checklist</b>{dates.length ? <DateCalendar snapshots={dates} selected={dateKey} onSelect={setDateKey} /> : <span className="history-empty">Nenhuma data disponível</span>}</div><ChecklistPanel key={dateKey} snapshotItems={liveData?.items} snapshots={dates} dateKey={dateKey} /></>;
}

export function AppShell({ user, dashboardData, onLogout }) {
  const initialPath = window.location.pathname;
  const initialAdminPage = initialPath === '/administracao/acessos';
  const initialJourneyPage = initialPath === '/jornada';
  const initialVacationPage = initialPath === '/ferias';
  const [activeSection, setActiveSection] = useState(initialAdminPage ? 'Acessos' : initialVacationPage ? 'Férias' : 'Início');
  const [showSystemHub, setShowSystemHub] = useState(!initialAdminPage && !initialJourneyPage && !initialVacationPage);
  const [systemPermissions, setSystemPermissions] = useState({});
  const [liveData, setLiveData] = useState(dashboardData || { items: [], snapshots: [] });
  const [motoristas, setMotoristas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [importDraft, setImportDraft] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [profileOpen, setProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('jornada360:dark-mode') === 'true');
  const section = SECTION_CONTENT[activeSection];
  const vacationPage = !showSystemHub && activeSection === 'Férias';

  useEffect(() => {
    if (user?.email?.toLowerCase() === 'operacional4@transpinho.com') return subscribeSystemPermissions(setSystemPermissions, () => {});
    let active = true;
    loadSystemPermission(user?.email).then(permissions => { if (active && permissions) setSystemPermissions(permissions); }).catch(() => {});
    return () => { active = false; };
  }, [user?.email]);

  useEffect(() => {
    if (!user || initialAdminPage || initialJourneyPage || initialVacationPage) return;
    window.history.replaceState({}, '', '/acessos');
  }, [user]);

  useEffect(() => {
    localStorage.setItem('jornada360:dark-mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    setLiveData(dashboardData || { items: [], snapshots: [] });
  }, [dashboardData]);

  useEffect(() => {
    if (!motoristas.length) return;
    const cadastro = Object.fromEntries(motoristas.map(driver => [normalizeDriverName(driver.nome), driver.setor || driver.categoria || 'Sem setor']));
    const applySectors = items => items.map(item => {
      const setor = cadastro[normalizeDriverName(item.motorista || item.nome)];
      return setor ? { ...item, setorAtual: setor, setor: setor } : item;
    });
    setLiveData(current => ({
      ...current,
      items: applySectors(current.items || []),
      snapshots: (current.snapshots || []).map(snapshot => ({ ...snapshot, items: applySectors(snapshot.items || []) })),
    }));
    import('../lib/firestore-writes.js').then(({ saveProcessedDay }) => Promise.all((liveData.snapshots || []).map(snapshot => saveProcessedDay({ ...snapshot, items: applySectors(snapshot.items || []) })))).catch(() => {});
  }, [motoristas, liveData.snapshots?.length]);

  useEffect(() => {
    const refreshSnapshot = event => {
      const detail = event.detail || {};
      if (!detail.dateKey) return;
      setLiveData(current => {
        const nextSnapshot = { dateKey: detail.dateKey, items: detail.items || [], summary: detail.summary || {}, updatedAt: detail.updatedAt || new Date().toISOString() };
        const snapshots = [...(current.snapshots || []).filter(snapshot => snapshot.dateKey !== detail.dateKey), nextSnapshot].sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
        return { ...current, items: detail.items || current.items, dateKey: detail.dateKey, snapshots, source: 'firebase' };
      });
    };
    window.addEventListener('jornada360:data-updated', refreshSnapshot);
    return () => window.removeEventListener('jornada360:data-updated', refreshSnapshot);
  }, []);

  useEffect(() => {
    const onSyncStart = () => setSyncStatus('saving');
    const onSyncSuccess = () => setSyncStatus('saved');
    const onSyncError = () => setSyncStatus('error');
    const onSyncReadError = () => setSyncStatus(current => current === 'saved' || current === 'idle' ? 'stale' : current);
    window.addEventListener('jornada360:sync-start', onSyncStart);
    window.addEventListener('jornada360:sync-success', onSyncSuccess);
    window.addEventListener('jornada360:sync-error', onSyncError);
    window.addEventListener('jornada360:sync-read-error', onSyncReadError);
    return () => { window.removeEventListener('jornada360:sync-start', onSyncStart); window.removeEventListener('jornada360:sync-success', onSyncSuccess); window.removeEventListener('jornada360:sync-error', onSyncError); window.removeEventListener('jornada360:sync-read-error', onSyncReadError); };
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    let unsubscribeEvents = () => {};
    let unsubscribeDrivers = () => {};
    import('../lib/firestore-store.js').then(({ firestoreStore }) => {
      unsubscribe = firestoreStore.subscribe('snapshots_dias', snapshots => {
        const ordered = dedupeSnapshots(snapshots);
        const latest = ordered.at(-1);
        if (latest) setLiveData(current => ({ ...current, items: latest.items || [], dateKey: latest.dateKey, snapshots: ordered, source: 'firebase' }));
      }, error => window.dispatchEvent(new CustomEvent('jornada360:sync-read-error', { detail: { message: error?.message || 'Não foi possível ler os snapshots do Firebase.' } })));
      unsubscribeEvents = firestoreStore.subscribe('ocorrencias', setEventos, error => { setEventos([]); window.dispatchEvent(new CustomEvent('jornada360:sync-read-error', { detail: { message: error?.message || 'Não foi possível ler as ocorrências do Firebase.' } })); });
      unsubscribeDrivers = firestoreStore.subscribe('motoristas', setMotoristas, error => { setMotoristas([]); window.dispatchEvent(new CustomEvent('jornada360:sync-read-error', { detail: { message: error?.message || 'Não foi possível ler o cadastro do Firebase.' } })); });
    }).catch(error => window.dispatchEvent(new CustomEvent('jornada360:sync-read-error', { detail: { message: error?.message || 'Não foi possível conectar ao Firebase.' } })));
    return () => { unsubscribe(); unsubscribeEvents(); unsubscribeDrivers(); };
  }, []);

  async function handleImportComplete(payload) {
    const pointRows = extractPointRows(payload.rowData?.espelhoHoje || []);
    const dateKey = extractReportDate(payload.rowData?.espelhoHoje || []) || payload.dateKey || new Date().toISOString().slice(0, 10);
    const previousPointRows = extractPointRows(payload.rowData?.espelhoOntem || []);
    const cadastro = Object.fromEntries(motoristas.map(driver => [normalizeDriverName(driver.nome), driver]));
    const items = crossSources({ pointRows: pointRows.map(row => ({ ...row, dateKey })), previousPointRows, scaleRows: extractScaleRows(payload.rowData?.escala || [], dateKey), trackerRows: normalizeTrackerRows(payload.rowData?.rastreador || []), standardRows: extractStandardRows(payload.rowData?.horarioPadrao || []), cadastro });
    const processedDay = prepareProcessedDay({ dateKey, items, cadastro });
    const record = buildImportRecord({ ...payload, actorEmail: user?.email });
    window.dispatchEvent(new CustomEvent('jornada360:sync-start'));
    try {
      const { saveImportRecord, saveProcessedDay, saveImportAndProcessedDay } = await import('../lib/firestore-writes.js');
      if (pointRows.length) await saveImportAndProcessedDay(record, processedDay);
      else await saveImportRecord(record);
      window.dispatchEvent(new CustomEvent('jornada360:data-updated', { detail: processedDay }));
      window.dispatchEvent(new CustomEvent('jornada360:sync-success'));
    } catch (error) {
      console.warn('Não foi possível salvar o histórico de importação:', error);
      window.dispatchEvent(new CustomEvent('jornada360:sync-error', { detail: { message: error?.message || 'Não foi possível sincronizar com o Firebase.' } }));
    }
    setActiveSection('Processamento');
  }

  return (
    <div className={`shell ${darkMode ? 'theme-dark' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-logo-wrap"><img src={blueLogo} alt="Transpinho" className="sidebar-logo" /></div>
        <div className="product-mark"><span className="product-dot" />{showSystemHub ? 'Sistemas' : vacationPage ? 'Férias' : 'Jornada360'}</div>
        {!showSystemHub && <nav aria-label="Navegação principal">
          {NAVIGATION_GROUPS.filter(group => !group.system || canAccessSystem(user?.email, group.system, systemPermissions)).filter(group => vacationPage ? group.label === 'Férias' : group.label !== 'Férias').map(group => <button className={`nav-item ${activeSection === group.label && !showSystemHub ? 'active' : ''}`} key={group.label} type="button" onClick={() => { setShowSystemHub(false); setActiveSection(group.label); }}><span>{group.icon}</span>{group.label}</button>)}
        </nav>}
        <div className="sidebar-bottom"><div className="secure-note"><span>●</span> Ambiente conectado</div><button className="logout-button" type="button" onClick={onLogout}>Sair da conta <span>↗</span></button></div>
      </aside>
      <main className="shell-content">
        <header className="topbar"><div><span className="eyebrow">PAINEL DE OPERAÇÃO</span><h1>Bom trabalho, equipe.</h1></div><div className="topbar-actions"><span className={`sync-indicator sync-${syncTone(syncStatus)}`} role="status">● {syncLabel(syncStatus)}</span><div className="profile-menu"><button type="button" className="user-chip" onClick={() => setProfileOpen(value => !value)} aria-expanded={profileOpen}><span className="avatar">{user?.email?.[0]?.toUpperCase() || 'U'}</span><span>{user?.email}</span><span className="profile-caret">▾</span></button>{profileOpen && <div className="profile-dropdown"><span className="profile-email">{user?.email}</span><button type="button" onClick={() => setDarkMode(value => !value)}><span>{darkMode ? '☀' : '◐'}</span>{darkMode ? 'Modo claro' : 'Modo escuro'}</button></div>}</div></div></header>
        {showSystemHub ? <><section className="welcome-card"><div><span className="eyebrow">TRANSPINHO / PORTAL</span><h2>Seus sistemas</h2><p>Escolha o ambiente que deseja acessar. As permissões são vinculadas à sua conta.</p></div></section><SystemHub user={user} permissions={systemPermissions} onOpen={system => { setShowSystemHub(false); setActiveSection(system === 'ferias' ? 'Férias' : 'Início'); window.history.pushState({}, '', system === 'ferias' ? '/ferias' : '/jornada'); }} /></> : activeSection === 'Acessos' ? <section className="welcome-card"><div><span className="eyebrow">TRANSPINHO / ADMINISTRAÇÃO</span><h2>Gerenciamento de acessos</h2><p>Administre os sistemas liberados para cada conta.</p></div></section> : <section className="welcome-card"><div><span className="eyebrow">{vacationPage ? 'FÉRIAS' : 'JORNADA360'} / {activeSection.toUpperCase()}</span><h2>{section.title}</h2><p>{section.description} A lógica atual de processamento continua preservada durante a migração.</p></div></section>}
        {!showSystemHub && <>
          {activeSection === 'Início' && <section className="status-grid"><article onClick={() => setActiveSection('Importação')}><span className="status-icon blue">↥</span><div><strong>Importação</strong><p>Planilhas do dia e fontes operacionais</p></div><span className="arrow">→</span></article><article onClick={() => setActiveSection('Checklist')}><span className="status-icon green">✓</span><div><strong>Checklist</strong><p>Validações e pendências da jornada</p></div><span className="arrow">→</span></article><article onClick={() => setActiveSection('Relatórios')}><span className="status-icon orange">▥</span><div><strong>Relatórios</strong><p>HE.1, HE.2, HE.3, inter e intra</p></div><span className="arrow">→</span></article></section>}
          {activeSection === 'Férias' && canAccessSystem(user?.email, 'ferias', systemPermissions) && <FeriasPanel user={user} />}
          {activeSection === 'Acessos' && user?.email?.toLowerCase() === 'operacional4@transpinho.com' && <AccessManager user={user} />}
          {activeSection === 'Importação' && <ImportacaoPanel draft={importDraft} onDraftChange={setImportDraft} onProcess={handleImportComplete} />}
          {activeSection === 'Checklist' && <ChecklistHistory liveData={liveData} />}
          {activeSection === 'Processamento' && <ProcessingPanel items={liveData?.items} />}
          {activeSection === 'Relatórios' && <ReportsPanel items={liveData?.items} snapshots={liveData?.snapshots} />}
          {activeSection === 'Cadastros' && <RegistersPanel items={liveData?.items} drivers={motoristas} />}
          {activeSection === 'Firebase' && <MigrationPanel onMigrated={snapshot => dashboardData?.items !== snapshot.items && window.dispatchEvent(new CustomEvent('jornada360:data-updated', { detail: snapshot }))} />}
          {activeSection === 'Início' && <InicioDashboard snapshots={liveData?.snapshots || []} eventos={eventos} motoristas={motoristas} />}
          {activeSection === 'Ocorrências' && <OcorrenciasPanel />}
        </>}
      </main>
    </div>
  );
}
