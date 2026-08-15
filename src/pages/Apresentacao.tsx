/* Apresentação comercial do Jornada360. Corporativa e sóbria, coerente com a interface do sistema —
 * não é uma landing page de marketing. Assim como o portfólio, não lê nenhum dado de empresa. */
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { buscarProjeto } from '../portfolio/projetos';

export default function Apresentacao() {
  const navigate = useNavigate();
  const projeto = buscarProjeto('jornada360');
  if (!projeto) return null;

  return (
    <div className="publico">
      <header className="publico-topo">
        <Link className="publico-voltar" to="/bem-vindo">
          <ArrowLeft size={14} /> Voltar
        </Link>
      </header>

      <div className="publico-conteudo">
        {/* -------------------------------------------------- hero */}
        <section className="hero">
          <div className="hero-marca">
            <div className="portao-logo">J</div>
            <div>
              <h1 className="hero-nome">JORNADA360</h1>
              <p className="hero-sub">Central Inteligente de Gestão e Auditoria de Jornada</p>
            </div>
          </div>

          <p className="hero-frase">Transforme dados de jornada em decisões.</p>

          <p className="hero-texto">{projeto.resumo}</p>

          <div className="hero-acoes">
            <button className="btn btn-primary" onClick={() => navigate('/bem-vindo')}>
              Criar minha empresa <ArrowRight size={14} />
            </button>
            <button className="btn" onClick={() => navigate('/bem-vindo')}>
              Ver demonstração
            </button>
            <Link className="btn" to="/portfolio">
              Ver detalhes técnicos
            </Link>
          </div>
        </section>

        {/* -------------------------------------------------- problemas */}
        <section className="publico-secao">
          <h2 className="publico-secao-titulo">Problemas que resolve</h2>
          <div className="problemas-grid">
            {projeto.problemas.map((p) => (
              <div key={p} className="problema">
                <AlertTriangle size={14} />
                <span>{p}</span>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------- fluxo */}
        <section className="publico-secao">
          <h2 className="publico-secao-titulo">Como funciona</h2>
          <div className="fluxo-horizontal">
            {projeto.fluxo.map((e, i) => (
              <div key={e.titulo} className="fluxo-passo">
                <div className="fluxo-passo-topo">
                  <span className="fluxo-num">{i + 1}</span>
                  {i < projeto.fluxo.length - 1 && <span className="fluxo-linha" />}
                </div>
                <div className="fluxo-titulo">{e.titulo}</div>
                <div className="fluxo-desc">{e.descricao}</div>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------- módulos */}
        <section className="publico-secao">
          <h2 className="publico-secao-titulo">O que está incluído</h2>
          <div className="modulos">
            {projeto.modulos.map((m) => (
              <div key={m.nome} className="modulo">
                <div className="modulo-nome">
                  <Check size={13} /> {m.nome}
                </div>
                <div className="modulo-desc">{m.descricao}</div>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------- honestidade */}
        <section className="publico-secao">
          <h2 className="publico-secao-titulo">O que ainda não é</h2>
          <div className="aviso-config" style={{ marginBottom: 0 }}>
            <AlertTriangle size={14} />
            <span>
              O Jornada360 roda inteiramente no navegador: os dados de cada empresa ficam neste computador, não em um
              servidor. Isso significa que ainda não há login, controle de acesso por papel, backup automático nem
              sincronização entre dispositivos. A arquitetura está preparada para essa evolução — a camada de dados foi
              desenhada para ser substituída por uma API sem reescrever as telas —, mas até lá o produto é uma ferramenta
              local, não um serviço em nuvem.
            </span>
          </div>
        </section>

        <section className="publico-cta">
          <h2 className="publico-secao-titulo">Comece agora</h2>
          <p className="publico-descricao" style={{ marginBottom: 16 }}>
            Crie sua empresa e configure sua operação, ou conheça o sistema funcionando com dados fictícios.
          </p>
          <div className="hero-acoes">
            <button className="btn btn-primary" onClick={() => navigate('/bem-vindo')}>
              Criar minha empresa <ArrowRight size={14} />
            </button>
            <button className="btn" onClick={() => navigate('/bem-vindo')}>
              Ver demonstração
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
