/* Aceite de convite — o caminho de entrada de quem foi chamado por uma empresa do piloto.
 *
 * POR QUE ESTA TELA EXISTE: o e-mail de convite sempre apontou para /convite?codigo=…, mas essa
 * rota não existia. Quem clicava caía no portão, e a única porta disponível era "criar minha
 * empresa" — que criaria uma empresa nova em vez de entrar na do colega. Com o cadastro fechado
 * pelo programa piloto, nem isso funcionava mais: a pessoa simplesmente não conseguia entrar.
 *
 * O e-mail não é pedido nem exibido como campo editável: quem o define é o convite, no servidor.
 * Deixar a pessoa digitá-lo permitiria usar um código alheio com outro endereço — exatamente o que
 * um convite nominal existe para impedir. */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { useAuth, mensagemDeErro } from '../auth/AuthContext';

const SENHA_MINIMA = 8;

export default function AceitarConvite() {
  const { estado, aceitarConvite, resgatarConvite, apiOnline } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [codigo, setCodigo] = useState(params.get('codigo') ?? '');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  /* Se o código veio na URL, ele fica fora da vista depois de lido: um código de acesso no
   * histórico do navegador é uma credencial deixada para trás. */
  useEffect(() => {
    if (params.get('codigo')) window.history.replaceState({}, '', '/convite');
  }, [params]);

  const jaLogado = estado === 'autenticado';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;

    if (!codigo.trim()) return setErro('Cole o código do convite.');
    if (!jaLogado) {
      if (nome.trim().length < 2) return setErro('Informe seu nome.');
      if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
    }

    setErro(null);
    setEnviando(true);
    try {
      /* Quem já está logado só precisa do vínculo — criar uma segunda conta partiria o histórico
       * dessa pessoa em dois usuários diferentes. */
      if (jaLogado) await resgatarConvite(codigo.trim());
      else await aceitarConvite({ codigo: codigo.trim(), nome: nome.trim(), senha });
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
            <h1 className="portao-nome">Aceitar convite</h1>
            <p className="portao-sub">Entrar na empresa que convidou você</p>
          </div>
        </header>

        <form className="portao-form" onSubmit={enviar}>
          <label className="field-label" htmlFor="codigo">Código do convite</label>
          <input
            id="codigo"
            className="input"
            required
            autoFocus={!codigo}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Cole aqui o código recebido"
          />
          <div className="field-hint">
            O convite é pessoal e de uso único: vale só para o e-mail que o recebeu, e expira em alguns dias.
          </div>

          {!jaLogado && (
            <>
              <label className="field-label" htmlFor="nome" style={{ marginTop: 12 }}>Seu nome</label>
              <input
                id="nome"
                className="input"
                required
                autoComplete="name"
                autoFocus={!!codigo}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />

              <label className="field-label" htmlFor="senha" style={{ marginTop: 12 }}>Crie uma senha</label>
              <input
                id="senha"
                className="input"
                type="password"
                required
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <div className="field-hint">
                Mínimo de {SENHA_MINIMA} caracteres. Seu e-mail vem do convite — você não precisa digitá-lo.
              </div>

              <p className="portao-nota">
                Você entra na empresa que convidou você, com o papel definido por quem enviou o convite. Nenhuma empresa
                nova é criada.
              </p>
            </>
          )}

          {erro && <div className="portao-erro" role="alert">{erro}</div>}

          <div className="portao-form-acoes">
            {!jaLogado && (
              <button type="button" className="btn" onClick={() => navigate('/entrar')}>Já tenho conta</button>
            )}
            <button className="btn btn-primary" type="submit" disabled={enviando || !apiOnline}>
              {enviando ? <><Loader2 size={14} className="girando" /> Entrando…</> : <><MailCheck size={14} /> Aceitar convite</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
