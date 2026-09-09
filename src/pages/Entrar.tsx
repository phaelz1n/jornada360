/* Tela de entrada vinculada com o Firebase Authentication.
 *
 * Suporta:
 *  - Login com Google (popup direto com GoogleAuthProvider)
 *  - Login com E-mail e Senha
 *  - Link para redefinição de senha via Firebase Auth
 *  - Criação de nova conta
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, LogIn } from 'lucide-react';
import { useAuth, mensagemDeErro } from '../auth/AuthContext';
import { useSessao, ID_DEMO } from '../workspace/WorkspaceContext';

export default function Entrar() {
  const { entrar, entrarComGoogle, cadastroAberto } = useAuth();
  const { setWorkspaceAtivo } = useSessao();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviandoGoogle, setEnviandoGoogle] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando || enviandoGoogle) return;
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
      setSenha('');
      navigate('/bem-vindo');
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviando(false);
    }
  }

  async function entrarGoogle() {
    if (enviando || enviandoGoogle) return;
    setErro(null);
    setEnviandoGoogle(true);
    try {
      await entrarComGoogle();
      navigate('/bem-vindo');
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviandoGoogle(false);
    }
  }

  return (
    <div className="portao">
      <div className="portao-conteudo portao-conteudo--estreito">
        <button className="btn-voltar" onClick={() => navigate('/bem-vindo')}>
          <ArrowLeft size={14} /> Voltar
        </button>

        <header className="portao-marca">
          <div className="portao-logo">J</div>
          <div>
            <h1 className="portao-nome">Entrar</h1>
            <p className="portao-sub">Acesse a empresa da qual você faz parte</p>
          </div>
        </header>

        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn"
            onClick={entrarGoogle}
            disabled={enviando || enviandoGoogle}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: '#ffffff',
              color: '#3c4043',
              border: '1px solid #dadce0',
              borderRadius: 6,
              padding: '10px 16px',
              fontWeight: 500,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            {enviandoGoogle ? 'Conectando ao Google…' : 'Continuar com o Google'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', margin: '18px 0 14px', color: '#666' }}>
          <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
          <span style={{ padding: '0 10px', fontSize: 12 }}>ou com e-mail e senha</span>
          <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
        </div>

        <form className="portao-form" onSubmit={enviar}>
          <label className="field-label" htmlFor="email">E-mail</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="field-label" htmlFor="senha" style={{ marginTop: 12 }}>Senha</label>
          <input
            id="senha"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />

          {erro && <div className="portao-erro" role="alert" style={{ marginTop: 12 }}>{erro}</div>}

          <div className="portao-form-acoes">
            <button type="button" className="btn-link" onClick={() => navigate('/esqueci-senha')}>
              Esqueci minha senha
            </button>
            <button className="btn btn-primary" type="submit" disabled={enviando || enviandoGoogle}>
              {enviando ? <><Loader2 size={14} className="girando" /> Entrando…</> : <><LogIn size={14} /> Entrar</>}
            </button>
          </div>
        </form>

        <div className="portao-alternativas">
          {cadastroAberto && (
            <>
              <button className="btn-link" onClick={() => navigate('/criar-conta')}>Criar uma conta</button>
              <span aria-hidden>·</span>
            </>
          )}
          <button className="btn-link" onClick={() => { setWorkspaceAtivo(ID_DEMO); navigate('/'); }}>
            Ver a demonstração
          </button>
        </div>
      </div>
    </div>
  );
}
