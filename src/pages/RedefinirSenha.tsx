/* Escolha da nova senha, a partir do link recebido por e-mail.
 *
 * O link é VALIDADO AO ABRIR a tela, antes de qualquer campo aparecer. Deixar a pessoa escolher e
 * confirmar uma senha para só então dizer "seu link expirou" é gastar o tempo dela num caminho que
 * já se sabia inválido.
 *
 * Depois de trocar, a tela NÃO abre a sessão automaticamente: manda entrar com a senha nova. Isso
 * confirma, ali mesmo, que a senha realmente funciona — em vez de a pessoa descobrir na próxima vez
 * que precisar entrar. E é também o que torna visível o encerramento das outras sessões. */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { redefinirSenha, verificarLinkRecuperacao } from '../api/authService';
import { mensagemDeErro } from '../auth/AuthContext';

const SENHA_MINIMA = 8;

export default function RedefinirSenha() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const codigo = params.get('codigo') ?? '';

  const [estadoLink, setEstadoLink] = useState<'verificando' | 'valido' | 'invalido'>('verificando');
  const [erroLink, setErroLink] = useState<string | null>(null);

  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!codigo) {
      setEstadoLink('invalido');
      setErroLink('O endereço não traz o código de redefinição. Abra o link do e-mail por inteiro.');
      return;
    }
    let cancelado = false;
    void (async () => {
      try {
        await verificarLinkRecuperacao(codigo);
        if (!cancelado) setEstadoLink('valido');
      } catch (e) {
        if (cancelado) return;
        setEstadoLink('invalido');
        setErroLink(mensagemDeErro(e));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [codigo]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;

    if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
    if (senha !== repetir) return setErro('As duas senhas não são iguais.');

    setErro(null);
    setEnviando(true);
    try {
      await redefinirSenha(codigo, senha);
      /* Tira a senha da memória assim que ela deixa de ser necessária. */
      setSenha('');
      setRepetir('');
      setPronto(true);
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviando(false);
    }
  }

  return (
    <div className="portao">
      <div className="portao-conteudo portao-conteudo--estreito">
        <header className="portao-marca">
          <div className="portao-logo">J</div>
          <div>
            <h1 className="portao-nome">Nova senha</h1>
            <p className="portao-sub">Escolha uma senha para voltar a acessar o Jornada360</p>
          </div>
        </header>

        {estadoLink === 'verificando' && <div className="estado-async">Conferindo o link…</div>}

        {estadoLink === 'invalido' && (
          <div className="portao-form">
            <div className="portao-nota portao-nota--destaque">
              <AlertTriangle size={16} />
              <div>
                <b>Este link não pode ser usado.</b>
                <div style={{ marginTop: 4 }}>{erroLink}</div>
              </div>
            </div>
            <div className="portao-form-acoes">
              <button className="btn btn-primary" onClick={() => navigate('/esqueci-senha')}>
                Pedir um link novo
              </button>
            </div>
          </div>
        )}

        {estadoLink === 'valido' && !pronto && (
          <form className="portao-form" onSubmit={enviar}>
            <label className="field-label" htmlFor="senha">Nova senha</label>
            <input
              id="senha"
              className="input"
              type="password"
              autoComplete="new-password"
              autoFocus
              required
              value={senha}
              onChange={(ev) => setSenha(ev.target.value)}
            />
            <div className="field-hint">Mínimo de {SENHA_MINIMA} caracteres.</div>

            <label className="field-label" htmlFor="repetir" style={{ marginTop: 12 }}>Repita a nova senha</label>
            <input
              id="repetir"
              className="input"
              type="password"
              autoComplete="new-password"
              required
              value={repetir}
              onChange={(ev) => setRepetir(ev.target.value)}
            />

            <p className="portao-nota">
              Ao trocar a senha, <b>todas as sessões abertas desta conta serão encerradas</b> — inclusive em outros
              computadores. É o que garante que ninguém continue dentro com o acesso antigo.
            </p>

            {erro && <div className="portao-erro" role="alert">{erro}</div>}

            <div className="portao-form-acoes">
              <button className="btn btn-primary" type="submit" disabled={enviando}>
                {enviando ? <><Loader2 size={14} className="girando" /> Salvando…</> : <><KeyRound size={14} /> Trocar senha</>}
              </button>
            </div>
          </form>
        )}

        {pronto && (
          <div className="portao-form">
            <div className="portao-nota portao-nota--destaque">
              <CheckCircle2 size={16} />
              <div>
                <b>Senha alterada.</b>
                <div style={{ marginTop: 4 }}>Entre com a senha nova para continuar.</div>
              </div>
            </div>
            <div className="portao-form-acoes">
              <button className="btn btn-primary" onClick={() => navigate('/entrar')}>Ir para a entrada</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
