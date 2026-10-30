import blueLogo from '../assets/logo-transpinho-blue.png';
import { useEffect, useState } from 'react';
import { NAVIGATION_GROUPS } from './navigation.js';
import { SECTION_CONTENT } from './sections.js';
import { ImportacaoPanel } from '../importacao/ImportacaoPanel.jsx';
import { ChecklistPanel } from '../checklist/ChecklistPanel.jsx';
import { buildImportRecord } from '../dados/import-record.js';
import { MigrationPanel } from '../dados/MigrationPanel.jsx';
import { ProcessingPanel, ReportsPanel, RegistersPanel } from '../modules/OperationalModules.jsx';
import { extractPointRows, extractStandardRows } from '../processamento/planilha-normalizer.js';
import { prepareProcessedDay } from '../processamento/processamento-model.js';
import { crossSources } from '../processamento/cruzamento.js';
import { normalizeTrackerRows } from '../importacao/rastreador-normalizer.js';
import { InicioDashboard } from '../modules/InicioDashboard.jsx';
import { OcorrenciasPanel } from '../modules/OcorrenciasPanel.jsx';

function ChecklistHistory({ liveData }) {
  const dates = liveData?.snapshots || [];
  const [dateKey, setDateKey] = useState(liveData?.dateKey || dates.at(-1)?.dateKey || 'latest');
  return <><div className="history-picker"><label>Dia do checklist <select value={dateKey} onChange={event => setDateKey(event.target.value)}>{dates.map(snapshot => <option key={snapshot.dateKey} value={snapshot.dateKey}>{snapshot.dateKey.split('-').reverse().join('/')}</option>)}</select></label></div><ChecklistPanel key={dateKey} snapshotItems={liveData?.items} snapshots={dates} dateKey={dateKey} /></>;
}

export function AppShell({ user, dashboardData, onLogout }) {
  const [activeSection, setActiveSection] = useState('Início');
  const [liveData, setLiveData] = useState(dashboardData || { items: [], snapshots: [] });
  const [eventos, setEventos] = useState([]);
  const section = SECTION_CONTENT[activeSection];

  useEffect(() => {
    setLiveData(dashboardData || { items: [], snapshots: [] });
  }, [dashboardData]);

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
    let unsubscribe = () => {};
    let unsubscribeEvents = () => {};
    import('../lib/firestore-store.js').then(({ firestoreStore }) => {
      unsubscribe = firestoreStore.subscribe('snapshots_dias', snapshots => {
        const ordered = snapshots.filter(item => item.dateKey).sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
        const latest = ordered.at(-1);
        if (latest) setLiveData(current => ({ ...current, items: latest.items || [], dateKey: latest.dateKey, snapshots: ordered, source: 'firebase' }));
      }, () => {});
      unsubscribeEvents = firestoreStore.subscribe('ocorrencias', setEventos, () => setEventos([]));
    }).catch(() => {});
    return () => { unsubscribe(); unsubscribeEvents(); };
  }, []);

  async function handleImportComplete(payload) {
    const pointRows = extractPointRows(payload.rowData?.espelhoHoje || []);
    const dateKey = payload.dateKey || new Date().toISOString().slice(0, 10);
    const items = crossSources({ pointRows: pointRows.map(row => ({ ...row, dateKey })), scaleRows: payload.rowData?.escala?.slice(1).map(row => ({ motorista: row?.[0], horario: row?.[1], linha: row?.[2], dados: row })) || [], trackerRows: normalizeTrackerRows(payload.rowData?.rastreador || []), standardRows: extractStandardRows(payload.rowData?.horarioPadrao || []) });
    const processedDay = prepareProcessedDay({ dateKey, items });
    const record = buildImportRecord(payload);
    try {
      const { saveImportRecord, saveProcessedDay } = await import('../lib/firestore-writes.js');
      await saveImportRecord(record);
      if (pointRows.length) await saveProcessedDay(processedDay);
      window.dispatchEvent(new CustomEvent('jornada360:data-updated', { detail: processedDay }));
    } catch (error) {
      console.warn('Não foi possível salvar o histórico de importação:', error);
      window.dispatchEvent(new CustomEvent('jornada360:sync-error', { detail: { message: error?.message || 'Não foi possível sincronizar com o Firebase.' } }));
    }
    setActiveSection('Processamento');
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo-wrap"><img src={blueLogo} alt="Transpinho" className="sidebar-logo" /></div>
        <div className="product-mark"><span className="product-dot" />Jornada360</div>
        <nav aria-label="Navegação principal">
          {NAVIGATION_GROUPS.map(group => <button className={`nav-item ${activeSection === group.label ? 'active' : ''}`} key={group.label} type="button" onClick={() => setActiveSection(group.label)}><span>{group.icon}</span>{group.label}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="secure-note"><span>●</span> Ambiente conectado</div><button className="logout-button" type="button" onClick={onLogout}>Sair da conta <span>↗</span></button></div>
      </aside>
      <main className="shell-content">
        <header className="topbar"><div><span className="eyebrow">PAINEL DE OPERAÇÃO</span><h1>Bom trabalho, equipe.</h1></div><div className="user-chip"><span className="avatar">{user?.email?.[0]?.toUpperCase() || 'U'}</span><span>{user?.email}</span></div></header>
        <section className="welcome-card"><div><span className="eyebrow">JORNADA360 / {activeSection.toUpperCase()}</span><h2>{section.title}</h2><p>{section.description} A lógica atual de processamento continua preservada durante a migração.</p></div></section>
        {activeSection === 'Início' && <section className="status-grid"><article onClick={() => setActiveSection('Importação')}><span className="status-icon blue">↥</span><div><strong>Importação</strong><p>Planilhas do dia e fontes operacionais</p></div><span className="arrow">→</span></article><article onClick={() => setActiveSection('Checklist')}><span className="status-icon green">✓</span><div><strong>Checklist</strong><p>Validações e pendências da jornada</p></div><span className="arrow">→</span></article><article onClick={() => setActiveSection('Relatórios')}><span className="status-icon orange">▥</span><div><strong>Relatórios</strong><p>HE.1, HE.2, HE.3, inter e intra</p></div><span className="arrow">→</span></article></section>}
        {activeSection === 'Importação' && <ImportacaoPanel onProcess={handleImportComplete} />}
        {activeSection === 'Checklist' && <ChecklistHistory liveData={liveData} />}
        {activeSection === 'Processamento' && <ProcessingPanel items={liveData?.items} />}
        {activeSection === 'Relatórios' && <ReportsPanel items={liveData?.items} snapshots={liveData?.snapshots} />}
        {activeSection === 'Cadastros' && <RegistersPanel items={liveData?.items} />}
        {activeSection === 'Firebase' && <MigrationPanel onMigrated={snapshot => dashboardData?.items !== snapshot.items && window.dispatchEvent(new CustomEvent('jornada360:data-updated', { detail: snapshot }))} />}
        {activeSection === 'Início' && <InicioDashboard snapshots={liveData?.snapshots || []} eventos={eventos} />}
        {activeSection === 'Ocorrências' && <OcorrenciasPanel />}
      </main>
    </div>
  );
}
