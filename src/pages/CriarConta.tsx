/* Criação de conta + primeira empresa vinculadas ao Firebase (E-mail e Senha).
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { useAuth, mensagemDeErro } from '../auth/AuthContext';
import { useSessao } from '../workspace/WorkspaceContext';

const SENHA_MINIMA = 8;

export default function CriarConta() {
  const { registrar } = useAuth();
  const { setWorkspaceAtivo, marcarRecemCriada } = useSessao();
  const navigate = useNavigate();

  const [form, setForm] = useState({ nome: '', email: '', senha: '', nomeEmpresa: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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
    if (enviando) return;

    const problema = validar();
    if (problema) return setErro(problema);

    setErro(null);
    setEnviando(true);
    try {
      const r = await registrar({
        nome: form.nome.trim(),
        email: form.email.trim(),
        senha: form.senha,
        nomeEmpresa: form.nomeEmpresa.trim(),
      });
      setForm((f) => ({ ...f, senha: '' }));
      if (r.tenants && r.tenants.length > 0) {
        marcarRecemCriada(r.tenants[0].id);
        setWorkspaceAtivo(r.tenants[0].id);
        navigate('/');
      } else {
        navigate('/bem-vindo');
      }
    } catch (err) {
      console.error('[CriarConta] Erro ao registrar:', err);
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
            <h1 className="portao-nome">Criar minha empresa</h1>
            <p className="portao-sub">Sua conta e o ambiente da sua empresa, em um passo</p>
          </div>
        </header>

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
            <button className="btn btn-primary" type="submit" disabled={enviando}>
              {enviando ? <><Loader2 size={14} className="girando" /> Criando…</> : <><UserPlus size={14} /> Criar conta e empresa</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
