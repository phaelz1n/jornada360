import { useState } from 'react';
import { SYSTEM_CATALOG, canAccessSystem } from '../auth/system-access.js';
import { persistSystemPermission } from '../auth/permissions-store.js';

export function SystemHub({ user, permissions, onOpen }) {
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState({ jornada: true, ferias: false });
  const [notice, setNotice] = useState('');
  const systems = SYSTEM_CATALOG.filter(system => canAccessSystem(user?.email, system.id, permissions));
  async function saveAccess(event) {
    event.preventDefault();
    try { await persistSystemPermission({ email, ...access }, user?.email); setNotice('Permissão salva no Firebase.'); setEmail(''); } catch (error) { setNotice(error?.message || 'Não foi possível salvar a permissão.'); }
  }
  return <section className="system-hub"><span className="eyebrow">TRANSPINHO / SISTEMAS</span><h2>Escolha o sistema</h2><p className="system-hub-intro">Acesse somente os módulos liberados para a sua conta.</p><div className="system-grid">{systems.map(system => <button className={`system-card ${system.tone}`} type="button" key={system.id} onClick={() => onOpen(system.id)}><span className="system-card-icon">{system.id === 'ferias' ? '▣' : '⌂'}</span><span><strong>{system.name}</strong><small>{system.description}</small></span><b>→</b></button>)}</div>{systems.length === 0 && <div className="ferias-empty">Nenhum sistema foi liberado para esta conta.</div>}{user?.email?.toLowerCase() === 'operacional4@transpinho.com' && <div className="permission-manager"><div><h3>Gerenciar acessos</h3><p>Libere ou revogue os sistemas para cada conta.</p></div><form onSubmit={saveAccess}><input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="e-mail do usuário" /><label><input type="checkbox" checked={access.jornada} onChange={event => setAccess({ ...access, jornada: event.target.checked })} /> Jornada360</label><label><input type="checkbox" checked={access.ferias} onChange={event => setAccess({ ...access, ferias: event.target.checked })} /> Férias</label><button className="primary-button" type="submit">Salvar acesso <span>→</span></button></form>{notice && <small className="permission-notice">{notice}</small>}</div>}</section>;
}
