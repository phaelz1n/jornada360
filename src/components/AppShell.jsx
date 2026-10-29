import blueLogo from '../assets/logo-transpinho-blue.png';
import { useState } from 'react';
import { NAVIGATION_GROUPS } from './navigation.js';
import { SECTION_CONTENT } from './sections.js';
import { LegacyOperations } from '../legacy/LegacyOperations.jsx';
import { ImportacaoPanel } from '../importacao/ImportacaoPanel.jsx';
import { ChecklistPanel } from '../checklist/ChecklistPanel.jsx';
import { buildImportRecord } from '../dados/import-record.js';
import { MigrationPanel } from '../dados/MigrationPanel.jsx';
import { ProcessingPanel, ReportsPanel, RegistersPanel } from '../modules/OperationalModules.jsx';
import { extractPointRows } from '../processamento/planilha-normalizer.js';
import { prepareProcessedDay } from '../processamento/processamento-model.js';
import { crossSources } from '../processamento/cruzamento.js';

export function AppShell({ user, dashboardData, onLogout }) {
  const [activeSection, setActiveSection] = useState('Início');
  const section = SECTION_CONTENT[activeSection];

  async function handleImportComplete(payload) {
    const pointRows = extractPointRows(payload.rowData?.espelhoHoje || []);
    const items = crossSources({ pointRows, scaleRows: payload.rowData?.escala?.slice(1).map(row => ({ motorista: row?.[0], horario: row?.[1] })) || [], trackerRows: payload.rowData?.rastreador?.slice(1).map(row => ({ motorista: row?.[0], sinais: row?.length - 1 })) || [] });
    const processedDay = prepareProcessedDay({ dateKey: new Date().toISOString().slice(0, 10), items });
    const record = buildImportRecord(payload);
    try {
      const { saveImportRecord, saveProcessedDay } = await import('../lib/firestore-writes.js');
      await saveImportRecord(record);
      if (pointRows.length) await saveProcessedDay(processedDay);
      window.dispatchEvent(new CustomEvent('jornada360:data-updated', { detail: { items: processedDay.items, dateKey: processedDay.dateKey } }));
    } catch (error) {
      console.warn('Não foi possível salvar o histórico de importação:', error);
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
        <section className="welcome-card"><div><span className="eyebrow">JORNADA360 / {activeSection.toUpperCase()}</span><h2>{section.title}</h2><p>{section.description} A lógica atual de processamento continua preservada durante a migração.</p></div><div className="welcome-orbit">∞</div></section>
        {activeSection === 'Início' && <section className="status-grid"><article onClick={() => setActiveSection('Importação')}><span className="status-icon blue">↥</span><div><strong>Importação</strong><p>Planilhas do dia e fontes operacionais</p></div><span className="arrow">→</span></article><article onClick={() => setActiveSection('Checklist')}><span className="status-icon green">✓</span><div><strong>Checklist</strong><p>Validações e pendências da jornada</p></div><span className="arrow">→</span></article><article onClick={() => setActiveSection('Relatórios')}><span className="status-icon orange">▥</span><div><strong>Relatórios</strong><p>HE.1, HE.2, HE.3, inter e intra</p></div><span className="arrow">→</span></article></section>}
        {activeSection === 'Importação' && <ImportacaoPanel onProcess={handleImportComplete} />}
        {activeSection === 'Checklist' && <ChecklistPanel snapshotItems={dashboardData?.items} dateKey={dashboardData?.dateKey || 'latest'} />}
        {activeSection === 'Processamento' && <ProcessingPanel items={dashboardData?.items} />}
        {activeSection === 'Relatórios' && <ReportsPanel items={dashboardData?.items} />}
        {activeSection === 'Cadastros' && <RegistersPanel items={dashboardData?.items} />}
        {activeSection === 'Firebase' && <MigrationPanel onMigrated={snapshot => dashboardData?.items !== snapshot.items && window.dispatchEvent(new CustomEvent('jornada360:data-updated', { detail: snapshot }))} />}
        {activeSection === 'Início' && <LegacyOperations />}
      </main>
    </div>
  );
}
