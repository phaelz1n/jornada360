/* Portfólio — vitrine profissional, separada do sistema operacional.
 *
 * Não lê nenhum dado de empresa: renderiza exclusivamente o catálogo estático de
 * src/portfolio/projetos.ts. Isso é intencional — o portfólio nunca deve poder exibir, nem por
 * acidente, informação de uma operação real. */
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Layers, Boxes, Lightbulb } from 'lucide-react';
import { PROJETOS, ESTADO_PROJETO_LABEL } from '../portfolio/projetos';

export default function Portfolio() {
  return (
    <div className="publico">
      <header className="publico-topo">
        <Link className="publico-voltar" to="/bem-vindo">
          <ArrowLeft size={14} /> Voltar
        </Link>
      </header>

      <div className="publico-conteudo">
        <div className="publico-cabecalho">
          <h1 className="publico-titulo">Portfólio</h1>
          <p className="publico-descricao">
            Produtos, ferramentas e soluções desenvolvidas — com o problema que resolvem, a arquitetura por trás e as
            decisões de engenharia que sustentam cada uma.
          </p>
        </div>

        {PROJETOS.map((p) => (
          <article key={p.id} className="projeto">
            <div className="projeto-cabecalho">
              <div>
                <h2 className="projeto-nome">{p.nome}</h2>
                <p className="projeto-subtitulo">{p.subtitulo}</p>
              </div>
              <span className="badge badge-green">{ESTADO_PROJETO_LABEL[p.estado]}</span>
            </div>

            <p className="projeto-resumo">{p.resumo}</p>

            <div className="projeto-stack">
              {p.stack.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>

            {/* -------------------------------------------------- problemas */}
            <section className="projeto-secao">
              <h3 className="projeto-secao-titulo">
                <Lightbulb size={15} /> Problemas que resolve
              </h3>
              <ul className="projeto-lista-problemas">
                {p.problemas.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>

            {/* -------------------------------------------------- fluxo */}
            <section className="projeto-secao">
              <h3 className="projeto-secao-titulo">
                <ArrowRight size={15} /> Como funciona
              </h3>
              <ol className="fluxo">
                {p.fluxo.map((e, i) => (
                  <li key={e.titulo}>
                    <span className="fluxo-num">{i + 1}</span>
                    <div>
                      <div className="fluxo-titulo">{e.titulo}</div>
                      <div className="fluxo-desc">{e.descricao}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* -------------------------------------------------- módulos */}
            <section className="projeto-secao">
              <h3 className="projeto-secao-titulo">
                <Boxes size={15} /> Módulos
              </h3>
              <div className="modulos">
                {p.modulos.map((m) => (
                  <div key={m.nome} className="modulo">
                    <div className="modulo-nome">{m.nome}</div>
                    <div className="modulo-desc">{m.descricao}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* -------------------------------------------------- arquitetura */}
            <section className="projeto-secao">
              <h3 className="projeto-secao-titulo">
                <Layers size={15} /> Arquitetura
              </h3>
              <div className="arquitetura">
                {p.arquitetura.map((b) => (
                  <div key={b.camada} className="arquitetura-camada">
                    <div className="arquitetura-nome">{b.camada}</div>
                    <div className="arquitetura-itens">
                      {b.itens.map((i) => (
                        <span key={i} className="chip chip-sutil">
                          {i}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* -------------------------------------------------- decisões */}
            <section className="projeto-secao">
              <h3 className="projeto-secao-titulo">Decisões de engenharia</h3>
              <div className="decisoes">
                {p.decisoes.map((d) => (
                  <div key={d.titulo} className="decisao">
                    <div className="decisao-titulo">{d.titulo}</div>
                    <p className="decisao-texto">{d.texto}</p>
                  </div>
                ))}
              </div>
            </section>

            {p.acoes && p.acoes.length > 0 && (
              <div className="projeto-acoes">
                {p.acoes.map((a) => (
                  <Link key={a.destino} className={`btn ${a.principal ? 'btn-primary' : ''}`} to={a.destino}>
                    {a.label} <ArrowRight size={14} />
                  </Link>
                ))}
              </div>
            )}
          </article>
        ))}

        <div className="projeto-futuro">
          Novos projetos, produtos, ferramentas e automações entram nesta mesma vitrine — o catálogo é uma lista de dados
          (<code>src/portfolio/projetos.ts</code>), então adicionar um não exige alterar nenhuma tela.
        </div>
      </div>
    </div>
  );
}
