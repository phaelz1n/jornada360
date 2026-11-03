import { useState } from 'react';
import { persistSystemPermission } from '../auth/permissions-store.js';

export function AccessManager({ user }) {
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState({ jornada: true, ferias: false });
  const [notice, setNotice] = useState('');
  async function saveAccess(event) {
    event.preventDefault();
    try { await persistSystemPermission({ email, ...access }, user?.email); setNotice('Permissão salva no Firebase.'); setEmail(''); }
    catch (error) { setNotice(error?.message || 'Não foi possível salvar a permissão.'); }
  }
  return <section className="access-page"><span className="eyebrow">TRANSPINHO / ADMINISTRAÇÃO</span><h2>Gerenciar acessos</h2><p className="system-hub-intro">Libere ou revogue os sistemas disponíveis para cada conta.</p><div className="permission-manager access-card"><form onSubmit={saveAccess}><label className="access-email">E-mail do usuário<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="usuario@transpinho.com" /></label><label><input type="checkbox" checked={access.jornada} onChange={event => setAccess({ ...access, jornada: event.target.checked })} /> Jornada360</label><label><input type="checkbox" checked={access.ferias} onChange={event => setAccess({ ...access, ferias: event.target.checked })} /> Férias</label><button className="primary-button" type="submit">Salvar acesso <span>→</span></button></form>{notice && <small className="permission-notice">{notice}</small>}</div></section>;
}
