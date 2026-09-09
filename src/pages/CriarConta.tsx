/* Criação de conta + primeira empresa vinculadas ao Firebase.
 *
 * Suporta:
 *  - Criação direta com Google
 *  - Criação com E-mail, Senha e Nome da Empresa
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { useAuth, mensagemDeErro } from '../auth/AuthContext';

const SENHA_MINIMA = 8;

export default function CriarConta() {
  const { registrar, entrarComGoogle } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ nome: '', email: '', senha: '', nomeEmpresa: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviandoGoogle, setEnviandoGoogle] = useState(false);

  function campo(k: keyof typeof form) {
    return {
      value: form[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
    };
  }

  function validar(): string | null {
    if (form.nome.trim().length < 2) return 'Informe seu nome.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Informe um e-mail válido.';
    if (form.senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
    if (!form.nomeEmpresa.trim()) return 'Informe o nome da empresa.';
    return null;
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando || enviandoGoogle) return;

    const problema = validar();
    if (problema) return setErro(problema);

    setErro(null);
    setEnviando(true);
    try {
      await registrar({
        nome: form.nome.trim(),
        email: form.email.trim(),
        senha: form.senha,
        nomeEmpresa: form.nomeEmpresa.trim(),
      });
      setForm((f) => ({ ...f, senha: '' }));
      navigate('/bem-vindo');
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviando(false);
    }
  }

  async function criarGoogle() {
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
            <h1 className="portao-nome">Criar minha empresa</h1>
            <p className="portao-sub">Sua conta e o ambiente da sua empresa, em um passo</p>
          </div>
        </header>

        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn"
            onClick={criarGoogle}
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
          <span style={{ padding: '0 10px', fontSize: 12 }}>ou preencha os dados</span>
          <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
        </div>

        <form className="portao-form" onSubmit={enviar}>
          <label className="field-label" htmlFor="nome">Seu nome</label>
          <input id="nome" className="input" autoFocus required autoComplete="name" {...campo('nome')} />

          <label className="field-label" htmlFor="email" style={{ marginTop: 12 }}>Seu e-mail</label>
          <input id="email" className="input" type="email" required autoComplete="username" {...campo('email')} />

          <label className="field-label" htmlFor="senha" style={{ marginTop: 12 }}>Senha</label>
          <input id="senha" className="input" type="password" required autoComplete="new-password" {...campo('senha')} />
          <div className="field-hint">Mínimo de {SENHA_MINIMA} caracteres.</div>

          <label className="field-label" htmlFor="empresa" style={{ marginTop: 12 }}>Nome da empresa</label>
          <input id="empresa" className="input" required placeholder="Ex.: Transportadora Aurora Ltda" {...campo('nomeEmpresa')} />

          <p className="portao-nota">
            O ambiente nasce pronto para uso. Nada da demonstração é copiado.
          </p>

          {erro && <div className="portao-erro" role="alert">{erro}</div>}

          <div className="portao-form-acoes">
            <button type="button" className="btn" onClick={() => navigate('/entrar')}>Já tenho conta</button>
            <button className="btn btn-primary" type="submit" disabled={enviando || enviandoGoogle}>
              {enviando ? <><Loader2 size={14} className="girando" /> Criando…</> : <><UserPlus size={14} /> Criar conta e empresa</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
