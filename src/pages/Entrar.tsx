/* Tela de entrada vinculada com o Firebase Authentication (E-mail e Senha).
 *
 * Suporta:
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
  const { entrar, cadastroAberto } = useAuth();
  const { setWorkspaceAtivo } = useSessao();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
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
            <button className="btn btn-primary" type="submit" disabled={enviando}>
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
