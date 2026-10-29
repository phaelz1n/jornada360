import { useState } from 'react';
import blueLogo from '../assets/logo-transpinho-blue.png';
import whiteLogo from '../assets/logo-transpinho-white.png';

export function LoginScreen({ onLogin, loading = false, error = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    await onLogin(email, password);
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-panel-content">
          <img className="logo-white" src={whiteLogo} alt="Transpinho" />
          <span className="brand-kicker">OPERAÇÃO INTELIGENTE</span>
          <h1>Jornada360</h1>
          <p>Clareza para cuidar da jornada, das pessoas e da operação.</p>
          <div className="brand-pulse"><span /> Dados do dia, no controle.</div>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-card">
          <img className="logo-blue" src={blueLogo} alt="Transpinho" />
          <span className="eyebrow">ÁREA OPERACIONAL</span>
          <h2>Bem-vindo de volta</h2>
          <p className="login-intro">Entre para acompanhar horas extras, checklist e relatórios da operação.</p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">E-mail corporativo</label>
            <input id="email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@transpinho.com" autoComplete="username" required />
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Digite sua senha" autoComplete="current-password" required />
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar no Jornada360'} <span>→</span></button>
          </form>
          <p className="login-footer">Acesso restrito à equipe Transpinho</p>
        </div>
      </section>
    </main>
  );
}
