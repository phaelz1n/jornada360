/* Pedido de recuperação de senha.
 *
 * A tela mostra a MESMA confirmação exista ou não a conta — porque é isso que o servidor responde.
 * Dizer "e-mail não cadastrado" transformaria esta tela num verificador de quem tem conta no
 * sistema, anulando o cuidado que o login tem de nunca distinguir os dois casos.
 *
 * Quem digitou errado descobre porque o e-mail não chega, e a mensagem já diz o que fazer nesse
 * caso. É menos cômodo e é o certo. */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { pedirRecuperacao } from '../api/authService';
import { mensagemDeErro } from '../auth/AuthContext';

export default function EsqueciSenha() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      const r = await pedirRecuperacao(email.trim());
      setConfirmacao(r.mensagem);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="portao">
      <div className="portao-conteudo portao-conteudo--estreito">
        <button className="btn-voltar" onClick={() => navigate('/entrar')}>
          <ArrowLeft size={14} /> Voltar para a entrada
        </button>

        <header className="portao-marca">
          <div className="portao-logo">J</div>
          <div>
            <h1 className="portao-nome">Recuperar senha</h1>
            <p className="portao-sub">Enviamos um link para você escolher uma senha nova</p>
          </div>
        </header>

        {confirmacao ? (
          <div className="portao-form">
            <div className="portao-nota portao-nota--destaque">
              <CheckCircle2 size={16} />
              <div>
                <b>Pedido registrado.</b>
                <div style={{ marginTop: 4 }}>{confirmacao}</div>
                <div style={{ marginTop: 8, fontSize: 12.5 }}>
                  O link vale por <b>30 minutos</b> e só pode ser usado uma vez. Se não chegar em alguns minutos,
                  confira o endereço digitado e a caixa de spam.
                </div>
              </div>
            </div>
            <div className="portao-form-acoes">
              <button className="btn" onClick={() => { setConfirmacao(null); setEmail(''); }}>
                Enviar para outro e-mail
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/entrar')}>
                Voltar para a entrada
              </button>
            </div>
          </div>
        ) : (
          <form className="portao-form" onSubmit={enviar}>
            <label className="field-label" htmlFor="email">Seu e-mail</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
            />
            <div className="field-hint">
              Use o e-mail com que você entra no Jornada360.
            </div>

            {erro && <div className="portao-erro" role="alert">{erro}</div>}

            <div className="portao-form-acoes">
              <button type="button" className="btn" onClick={() => navigate('/entrar')}>Cancelar</button>
              <button className="btn btn-primary" type="submit" disabled={enviando}>
                {enviando ? <><Loader2 size={14} className="girando" /> Enviando…</> : <><Mail size={14} /> Enviar link</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
