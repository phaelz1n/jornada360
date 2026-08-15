/* Criar mais uma empresa para quem já tem conta.
 *
 * Também é onde um convite é resgatado — as duas ações respondem à mesma pergunta ("como eu entro
 * numa empresa a mais?") e separá-las em telas diferentes só faria a pessoa procurar.
 *
 * A empresa é criada no SERVIDOR, com regras padrão neutras, e nunca copia nada da empresa atual:
 * herdar configuração em silêncio é exatamente o que a portabilidade do produto proíbe. */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Ticket } from 'lucide-react';
import { useAuth, mensagemDeErro } from '../auth/AuthContext';
import { useSessao } from '../workspace/WorkspaceContext';

export default function NovaEmpresa() {
  const { criarEmpresa, resgatarConvite } = useAuth();
  const { setWorkspaceAtivo, marcarRecemCriada } = useSessao();
  const navigate = useNavigate();

  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<'criando' | 'resgatando' | null>(null);

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    if (!nome.trim()) return setErro('Informe o nome da empresa.');

    setErro(null);
    setOcupado('criando');
    try {
      const tenant = await criarEmpresa(nome.trim());
      /* Entra direto na empresa nova e marca para abrir o roteiro de configuração: quem acabou de
       * criar quer configurar. */
      marcarRecemCriada(tenant.id);
      setWorkspaceAtivo(tenant.id);
      navigate('/');
    } catch (err) {
      setErro(mensagemDeErro(err));
      setOcupado(null);
    }
  }

  async function resgatar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    if (!codigo.trim()) return setErro('Cole o código do convite.');

    setErro(null);
    setOcupado('resgatando');
    try {
      await resgatarConvite(codigo.trim());
      navigate('/bem-vindo');
    } catch (err) {
      setErro(mensagemDeErro(err));
      setOcupado(null);
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
            <h1 className="portao-nome">Entrar em outra empresa</h1>
            <p className="portao-sub">Crie uma nova ou use um convite que você recebeu</p>
          </div>
        </header>

        <form className="portao-form" onSubmit={criar}>
          <label className="field-label" htmlFor="nome-empresa">Criar uma empresa nova</label>
          <input
            id="nome-empresa"
            className="input"
            autoFocus
            placeholder="Ex.: Transportadora Aurora Ltda"
            value={nome}
            onChange={(ev) => setNome(ev.target.value)}
          />
          <div className="field-hint">Nasce vazia, com regras padrão. Nada é copiado da empresa atual nem da demonstração.</div>
          <div className="portao-form-acoes">
            <button className="btn btn-primary" type="submit" disabled={ocupado !== null}>
              {ocupado === 'criando' ? <><Loader2 size={14} className="girando" /> Criando…</> : <><Building2 size={14} /> Criar empresa</>}
            </button>
          </div>
        </form>

        <form className="portao-form" onSubmit={resgatar} style={{ marginTop: 18 }}>
          <label className="field-label" htmlFor="codigo-convite">Tenho um código de convite</label>
          <input
            id="codigo-convite"
            className="input"
            placeholder="Cole aqui o código que o administrador enviou"
            value={codigo}
            onChange={(ev) => setCodigo(ev.target.value)}
          />
          <div className="field-hint">
            O convite é nominal: só funciona para o e-mail da conta em que ele foi emitido.
          </div>
          <div className="portao-form-acoes">
            <button className="btn" type="submit" disabled={ocupado !== null}>
              {ocupado === 'resgatando' ? <><Loader2 size={14} className="girando" /> Validando…</> : <><Ticket size={14} /> Usar convite</>}
            </button>
          </div>
        </form>

        {erro && <div className="portao-erro" role="alert">{erro}</div>}
      </div>
    </div>
  );
}
