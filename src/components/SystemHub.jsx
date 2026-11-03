import { SYSTEM_CATALOG, canAccessSystem } from '../auth/system-access.js';

export function SystemHub({ user, permissions, onOpen }) {
  const systems = SYSTEM_CATALOG.filter(system => canAccessSystem(user?.email, system.id, permissions));
  return <section className="system-hub"><span className="eyebrow">TRANSPINHO / SISTEMAS</span><h2>Escolha o sistema</h2><p className="system-hub-intro">Acesse somente os módulos liberados para a sua conta.</p><div className="system-grid">{systems.map(system => <button className={`system-card ${system.tone}`} type="button" key={system.id} onClick={() => onOpen(system.id)}><span className="system-card-icon">{system.id === 'ferias' ? '▣' : '⌂'}</span><span><strong>{system.name}</strong><small>{system.description}</small></span><b>→</b></button>)}</div>{systems.length === 0 && <div className="ferias-empty">Nenhum sistema foi liberado para esta conta.</div>}{user?.email?.toLowerCase() === 'operacional4@transpinho.com' && <a className="access-link" href="/acessos">Gerenciar acessos →</a>}</section>;
}
