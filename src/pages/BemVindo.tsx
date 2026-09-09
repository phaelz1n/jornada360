/* Portão de entrada do Jornada360 — o que um visitante vê antes de existir qualquer empresa ativa.
 *
 * Por que esta tela existe: antes, o sistema criava sozinho uma empresa chamada "Minha Empresa" e
 * já colocava o visitante dentro dela. Quem abrisse o produto entrava numa empresa que não criou,
 * com um nome que não é dele, sem saber se aquilo era demonstração ou produção. Aqui a escolha é
 * explícita e o visitante sempre sabe onde está entrando.
 *
 * FASE 4: "Já tenho acesso" deixou de ser uma explicação e virou um login de verdade. O que NÃO
 * mudou é a honestidade da tela: a demonstração continua sendo local e sem conta, e quando o
 * servidor não responde a tela diz isso em vez de fingir que o login está indisponível "por
 * instabilidade". */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, PlayCircle, LogIn, ArrowRight, ShieldCheck, ServerOff, PauseCircle } from 'lucide-react';
import { useSessao, ID_DEMO } from '../workspace/WorkspaceContext';
import { useAuth } from '../auth/AuthContext';

export default function BemVindo() {
  const { setWorkspaceAtivo, empresas } = useSessao();
  const { estado, usuario, tenants, apiOnline, cadastroAberto, reconectar, sair } = useAuth();
  const navigate = useNavigate();

  const [verificandoConexao, setVerificandoConexao] = useState(false);

  const autenticado = estado === 'autenticado';
  const empresasReais = empresas.filter((e) => e.environment !== 'demo');

  function abrir(id: string) {
    setWorkspaceAtivo(id);
    navigate('/');
  }

  async function tentarConectar() {
    setVerificandoConexao(true);
    await reconectar();
    setVerificandoConexao(false);
  }

  return (
    <div className="portao">
      <div className="portao-conteudo">
        <header className="portao-marca">
          <div className="portao-logo">J</div>
          <div>
            <h1 className="portao-nome">JORNADA360</h1>
            <p className="portao-sub">Central Inteligente de Gestão e Auditoria de Jornada</p>
          </div>
        </header>

        <p className="portao-pitch">Transforme dados de jornada em decisões.</p>

        {estado === 'verificando' ? (
          <div className="portao-opcoes"><div className="estado-async">Verificando sua sessão…</div></div>
        ) : autenticado ? (
          /* ---------------------------------------------- já entrou: escolher empresa */
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="portao-saudacao" style={{ marginBottom: 0 }}>
                Olá, <b>{usuario?.nome}</b>. {empresasReais.length === 1
                  ? 'Sua empresa está pronta.'
                  : `Você tem acesso a ${empresasReais.length} empresas.`}
              </div>
              <button className="btn btn-sm" onClick={() => void sair()} style={{ fontSize: 13 }}>
                Sair
              </button>
            </div>

            <div className="portao-opcoes">
              {empresasReais.map((e) => {
                /* Uma empresa suspensa continua na lista, marcada — some da lista pareceria defeito
                 * do sistema, e a pessoa perderia a informação de que os dados dela existem. */
                const suspensa = e.status === 'suspensa';
                return (
                  <button
                    key={e.id}
                    className={`portao-opcao ${suspensa ? 'portao-opcao--suspensa' : 'portao-opcao-principal'}`}
                    onClick={() => abrir(e.id)}
                  >
                    {suspensa ? <PauseCircle size={20} /> : <Building2 size={20} />}
                    <div>
                      <div className="portao-opcao-titulo">{e.nome}</div>
                      <div className="portao-opcao-desc">
                        {suspensa
                          ? 'Acesso suspenso — seus dados estão preservados. Fale conosco para reativar.'
                          : `Seu papel nesta empresa: ${e.papel}`}
                      </div>
                    </div>
                    <ArrowRight size={16} className="portao-seta" />
                  </button>
                );
              })}

              {cadastroAberto && (
                <button className="portao-opcao" onClick={() => navigate('/nova-empresa')}>
                  <Building2 size={20} />
                  <div>
                    <div className="portao-opcao-titulo">Criar outra empresa</div>
                    <div className="portao-opcao-desc">Ambiente novo e vazio. Nada é copiado da empresa atual.</div>
                  </div>
                  <ArrowRight size={16} className="portao-seta" />
                </button>
              )}

              <button className="portao-opcao" onClick={() => abrir(ID_DEMO)}>
                <PlayCircle size={20} />
                <div>
                  <div className="portao-opcao-titulo">Ver demonstração</div>
                  <div className="portao-opcao-desc">Ambiente fictício, separado da sua empresa.</div>
                </div>
                <ArrowRight size={16} className="portao-seta" />
              </button>
            </div>
          </>
        ) : (
          /* ---------------------------------------------- visitante */
          <div className="portao-opcoes">
            {/* Com o cadastro fechado (programa piloto), o botão de criar empresa não aparece.
                Mostrá-lo desabilitado, ou pior, levar ao formulário para recusar no fim, faria a
                pessoa preencher tudo para descobrir que nunca houve essa porta. Quem entra é
                quem já foi liberado — e é esse o caminho que fica em destaque. */}
            {cadastroAberto && (
              <button
                className="portao-opcao portao-opcao-principal"
                onClick={() => navigate('/criar-conta')}
                disabled={!apiOnline}
              >
                <Building2 size={20} />
                <div>
                  <div className="portao-opcao-titulo">Criar minha empresa</div>
                  <div className="portao-opcao-desc">
                    Conta e ambiente novos, guardados no servidor. Nenhum dado de exemplo é copiado.
                  </div>
                </div>
                <ArrowRight size={16} className="portao-seta" />
              </button>
            )}

            <button className="portao-opcao" onClick={() => abrir(ID_DEMO)}>
              <PlayCircle size={20} />
              <div>
                <div className="portao-opcao-titulo">Ver demonstração</div>
                <div className="portao-opcao-desc">
                  Ambiente de apresentação com dados fictícios. Funciona sem conta e sem servidor.
                </div>
              </div>
              <ArrowRight size={16} className="portao-seta" />
            </button>

            <button
              className={`portao-opcao ${cadastroAberto ? '' : 'portao-opcao-principal'}`}
              onClick={() => navigate('/entrar')}
              disabled={!apiOnline}
            >
              <LogIn size={20} />
              <div>
                <div className="portao-opcao-titulo">Já tenho acesso</div>
                <div className="portao-opcao-desc">Entrar na empresa da qual já faço parte.</div>
              </div>
              <ArrowRight size={16} className="portao-seta" />
            </button>
          </div>
        )}

        {/* A ausência do servidor é dita, não escondida. Sem isso, os dois botões desabilitados
            pareceriam um defeito da aplicação. */}
        {!apiOnline && estado !== 'verificando' && (
          <div className="portao-aviso">
            <ServerOff size={15} />
            <div>
              <b>Servidor não encontrado.</b> Criar conta e entrar dependem dele — os dados de uma empresa real ficam no
              servidor, não neste navegador. A demonstração continua disponível.
              <button className="btn-link" onClick={tentarConectar} disabled={verificandoConexao}>
                {verificandoConexao ? 'Verificando…' : 'Tentar novamente'}
              </button>
            </div>
          </div>
        )}

        {/* Programa piloto dito na cara, para o visitante e para o cliente. Sem isto, a ausência
            do botão de criar empresa pareceria funcionalidade faltando em vez de decisão. */}
        {apiOnline && !cadastroAberto && estado !== 'verificando' && (
          <div className="portao-aviso">
            <ShieldCheck size={15} />
            <div>
              <b>Programa piloto.</b> O Jornada360 está em uso por um número limitado de empresas, com acesso liberado
              pela nossa equipe. Se você quer participar, fale conosco — a demonstração continua aberta a qualquer um.
            </div>
          </div>
        )}

        <footer className="portao-rodape">
          <ShieldCheck size={13} />
          <span>
            Empresas reais ficam no servidor, isoladas por conta: ninguém enxerga a empresa de outro. A demonstração usa
            dados fictícios e vive apenas neste navegador.
          </span>
        </footer>

        <button className="portao-link-portfolio" onClick={() => navigate('/portfolio')}>
          Conhecer o projeto e o portfólio
        </button>

        {autenticado && tenants.length === 0 && (
          <div className="portao-nota">
            Sua conta ainda não está vinculada a nenhuma empresa. Crie uma, ou peça a um administrador que gere um convite
            para você.
          </div>
        )}
      </div>
    </div>
  );
}
