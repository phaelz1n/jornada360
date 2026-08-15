import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, Loader2, MessageSquarePlus, X } from 'lucide-react';
import { useSessao } from '../../workspace/WorkspaceContext';
import { api, ErroApi } from '../../api/client';

/* Canal de feedback do programa piloto.
 *
 * Por que dentro do produto, e não um e-mail ou uma planilha: o relato mais valioso é o que a
 * pessoa faz NO MOMENTO em que tropeça. Qualquer coisa que a obrigue a sair do sistema, abrir
 * outro programa e lembrar do contexto faz a maior parte desse relato nunca acontecer — e um
 * piloto sem feedback não valida nada.
 *
 * A tela em que ela estava vai junto, automaticamente. Um relato sem contexto costuma custar uma
 * ida e volta inteira só para descobrir onde aconteceu.
 *
 * Não aparece na demonstração: lá não há empresa real, e o relato não teria de quem partir. */

const CATEGORIAS = [
  { id: 'erro', rotulo: 'Erro', ajuda: 'Algo não funcionou como deveria' },
  { id: 'dificuldade', rotulo: 'Dificuldade de uso', ajuda: 'Funciona, mas foi difícil de encontrar ou entender' },
  { id: 'sugestao', rotulo: 'Sugestão', ajuda: 'Uma ideia para melhorar algo que já existe' },
  { id: 'funcionalidade', rotulo: 'Funcionalidade solicitada', ajuda: 'Algo que falta e faria diferença' },
  { id: 'duvida', rotulo: 'Dúvida', ajuda: 'Não entendi como algo funciona' },
] as const;

export function BotaoFeedback() {
  const { workspaceIdAtivo, modo } = useSessao();
  const local = useLocation();

  const [aberto, setAberto] = useState(false);
  const [categoria, setCategoria] = useState<string>('dificuldade');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (modo !== 'remoto' || !workspaceIdAtivo) return null;

  function fechar() {
    setAberto(false);
    setEnviado(false);
    setMensagem('');
    setErro(null);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (mensagem.trim().length < 5) {
      setErro('Escreva um pouco mais para que possamos entender.');
      return;
    }

    setErro(null);
    setEnviando(true);
    try {
      await api.post(`/api/tenants/${encodeURIComponent(workspaceIdAtivo!)}/feedback`, {
        categoria,
        mensagem: mensagem.trim(),
        tela: local.pathname,
      });
      setEnviado(true);
      setMensagem('');
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível enviar agora.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button className="botao-feedback" onClick={() => setAberto(true)} title="Relatar algo para a equipe do Jornada360">
        <MessageSquarePlus size={15} />
        <span>Relatar</span>
      </button>

      {aberto && (
        <div className="modal-overlay" onClick={fechar}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>Relatar para a equipe do Jornada360</div>
              <button className="btn btn-sm" onClick={fechar} aria-label="Fechar"><X size={14} /></button>
            </div>

            {enviado ? (
              <>
                <div className="modal-body">
                  <div className="portao-nota portao-nota--destaque" style={{ marginTop: 0 }}>
                    <CheckCircle2 size={16} />
                    <div>
                      <b>Recebemos, obrigado.</b>
                      <div style={{ marginTop: 4 }}>
                        Seu relato entra na lista que define as próximas versões. Nem toda sugestão vira funcionalidade —
                        mas todas são lidas, e as decisões voltam para você.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn" onClick={() => setEnviado(false)}>Relatar outra coisa</button>
                  <button className="btn btn-primary" onClick={fechar}>Fechar</button>
                </div>
              </>
            ) : (
              <form onSubmit={enviar}>
                <div className="modal-body">
                  <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 0 }}>
                    O Jornada360 está em programa piloto. O que você relatar aqui orienta diretamente o que será feito a
                    seguir.
                  </p>

                  <div className="kpi-label" style={{ marginBottom: 8 }}>O que é?</div>
                  <div className="feedback-categorias">
                    {CATEGORIAS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`feedback-categoria ${categoria === c.id ? 'feedback-categoria--ativa' : ''}`}
                        onClick={() => setCategoria(c.id)}
                      >
                        <span className="feedback-categoria__rotulo">{c.rotulo}</span>
                        <span className="feedback-categoria__ajuda">{c.ajuda}</span>
                      </button>
                    ))}
                  </div>

                  <label className="kpi-label" htmlFor="feedback-msg" style={{ display: 'block', marginTop: 14, marginBottom: 6 }}>
                    Conte o que aconteceu
                  </label>
                  <textarea
                    id="feedback-msg"
                    className="input"
                    style={{ width: '100%', minHeight: 110, resize: 'vertical', fontFamily: 'inherit' }}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Quanto mais concreto, melhor: o que você estava fazendo, o que esperava e o que aconteceu."
                    autoFocus
                  />
                  <div className="field-hint">
                    Enviado junto: a tela em que você está ({local.pathname}) e seu nome. Nenhum dado de colaborador é
                    incluído.
                  </div>

                  {erro && <div className="portao-erro" role="alert">{erro}</div>}
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn" onClick={fechar}>Cancelar</button>
                  <button className="btn btn-primary" type="submit" disabled={enviando}>
                    {enviando ? <><Loader2 size={14} className="girando" /> Enviando…</> : 'Enviar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
