/* Dashboard Executivo — visão consolidada da operação do workspace ativo.
 *
 * Toda a matemática vem do analyticsService; esta tela só escolhe o que mostrar e em que ordem.
 * Nenhum indicador aparece sem explicação (botão "?" ao lado do rótulo) e nenhum número é exibido
 * quando o dado não existe — nesse caso aparece "—" e o motivo. */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import { RefreshCw, ArrowRight, AlertTriangle, AlertCircle } from 'lucide-react';
import { useHEEngineData } from '../engine/useHEEngineData';
import { useWorkspace } from '../workspace/WorkspaceContext';
import { minToStrSigned } from '../engine/heEngineCore';
import {
  calcularVisaoGeral,
  calcularEvolucaoDiaria,
  calcularEvolucaoMensal,
  calcularPorColaborador,
  calcularPorSetor,
  calcularPorUnidade,
  calcularPrincipaisCausas,
  calcularIndicadoresPendencias,
  calcularPontosDeAtencao,
  rankingMaiorExcedente,
  rankingMenorConformidade,
  rankingSetoresComDivergencia,
  UNIDADE_NAO_VINCULADA,
} from '../services/analyticsService';
import { sincronizarPendencias } from '../services/pendenciaService';
import { CardIndicador, ExplicacaoIndicador, AvisoConfiguracao, AmbienteSemDados } from '../components/ui/Indicadores';
import { PainelOnboarding } from '../components/onboarding/PainelOnboarding';
import { calcularProgresso } from '../services/onboardingService';

const CHART_GRID = '#26312a';
const CHART_TICK = '#93a69b';
const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: '1px solid #26312a',
  background: '#121915',
  color: '#eaf1ec',
  fontSize: 12.5,
};

/* Acima deste número de dias processados a série diária vira ilegível — troca automaticamente para
 * a visão mensal. É uma escolha de apresentação (não de negócio): o usuário pode alternar na mão. */
const LIMITE_DIAS_SERIE_DIARIA = 45;

export default function Dashboard() {
  const { dias, refresh } = useHEEngineData();
  const { workspace, workspaceIdAtivo, pendencias, gravar } = useWorkspace();
  const regras = workspace.rules;

  const [granularidade, setGranularidade] = useState<'auto' | 'dia' | 'mes'>('auto');

  /* Materializa as Pendencias antes de ler — sem isso, o Dashboard mostraria zero pendências para
   * quem entra direto nele sem nunca ter passado por /pendencias ou /centro-de-acoes, enquanto o
   * badge da barra lateral (que conta do motor) mostraria dezenas. Mesma chamada idempotente que as
   * outras duas telas já fazem. */
  useEffect(() => {
    if (dias.length === 0) return;
    const alteradas = sincronizarPendencias(workspaceIdAtivo, dias, pendencias, workspace.employees);
    if (alteradas.length === 0) return;

    let cancelado = false;
    void (async () => {
      if (cancelado) return;
      try {
        await gravar(async (repo, ctx) => {
          for (const p of alteradas) {
            if (cancelado) return;
            await repo.salvarPendencia(ctx.empresaId, p);
          }
        });
      } catch (err) {
        console.warn('[Dashboard] Aviso ao sincronizar pendências:', err);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage à mudança nos dias, não a cada render
  }, [workspaceIdAtivo, dias]);

  const visaoGeral = useMemo(() => calcularVisaoGeral(dias, regras.dailyGoalMin), [dias, regras.dailyGoalMin]);
  const evolucaoDiaria = useMemo(() => calcularEvolucaoDiaria(dias), [dias]);
  const evolucaoMensal = useMemo(() => calcularEvolucaoMensal(dias), [dias]);
  const colaboradores = useMemo(() => calcularPorColaborador(dias, regras.recurrenceLimit), [dias, regras.recurrenceLimit]);
  const setores = useMemo(() => calcularPorSetor(dias), [dias]);
  const causas = useMemo(() => calcularPrincipaisCausas(dias), [dias]);

  const unidades = useMemo(
    () => calcularPorUnidade(dias, workspace.employees, workspace.units),
    [dias, workspace.employees, workspace.units],
  );

  const indicadoresPendencias = useMemo(
    () => calcularIndicadoresPendencias(pendencias, regras.alertaAntecedenciaDias),
    [pendencias, regras.alertaAntecedenciaDias],
  );

  const pontosDeAtencao = useMemo(
    () => calcularPontosDeAtencao(dias, pendencias, regras.recurrenceLimit, regras.alertaAntecedenciaDias),
    [dias, pendencias, regras.recurrenceLimit, regras.alertaAntecedenciaDias],
  );

  const usarMensal = granularidade === 'mes' || (granularidade === 'auto' && evolucaoDiaria.length > LIMITE_DIAS_SERIE_DIARIA);
  const serie = usarMensal ? evolucaoMensal : evolucaoDiaria;

  const topExcedente = useMemo(() => rankingMaiorExcedente(colaboradores), [colaboradores]);
  const piorConformidade = useMemo(() => rankingMenorConformidade(colaboradores), [colaboradores]);
  const setoresDivergencia = useMemo(() => rankingSetoresComDivergencia(setores), [setores]);

  const semVinculoCadastro = unidades.find((u) => u.unidade === UNIDADE_NAO_VINCULADA);

  const progresso = useMemo(
    () => calcularProgresso(workspace, dias.length > 0),
    [workspace, dias.length],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Executivo</h1>
          <p className="page-subtitle">
            {visaoGeral.diasProcessados > 0
              ? `${visaoGeral.diasProcessados} dia(s) analisado(s) · ${visaoGeral.registrosAnalisados} registro(s) · ${visaoGeral.colaboradoresDistintos} colaborador(es)`
              : 'Visão consolidada da operação'}
          </p>
        </div>
        <button className="btn" onClick={refresh}>
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {/* O painel de configuração aparece enquanto faltar algum passo essencial e some sozinho
          quando a empresa estiver pronta — não há flag salva, o progresso é derivado do cadastro. */}
      {!progresso.prontoParaOperar && <PainelOnboarding progresso={progresso} />}

      {dias.length === 0 ? (
        <div className="card card-pad">
          <AmbienteSemDados />
        </div>
      ) : (
        <>
          {/* ------------------------------------------------ pontos de atenção */}
          {pontosDeAtencao.length > 0 && (
            <div className="card card-pad section-gap">
              <div className="card-title">O que exige atenção agora</div>
              <div className="atencao-lista">
                {pontosDeAtencao.map((p) => (
                  <Link key={p.chave} to={p.destino} className={`atencao-item atencao-${p.severidade}`}>
                    {p.severidade === 'alta' ? <AlertTriangle size={15} /> : <AlertCircle size={15} />}
                    <div>
                      <div className="atencao-titulo">{p.titulo}</div>
                      <div className="atencao-detalhe">{p.detalhe}</div>
                    </div>
                    <ArrowRight size={14} className="atencao-seta" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ------------------------------------------------ indicadores de qualidade */}
          <div className="card card-pad section-gap">
            <div className="card-title">Qualidade da operação</div>
            <div className="kpi-grid">
              {visaoGeral.indicadores.map((i) => (
                <CardIndicador key={i.chave} indicador={i} />
              ))}
            </div>
          </div>

          {/* ------------------------------------------------ evolução temporal */}
          <div className="card card-pad section-gap">
            <div className="card-title">
              <span>
                Evolução no período
                <ExplicacaoIndicador
                  comoFoiCalculado="Um ponto por dia processado (ou por mês, quando o período é longo). A linha mostra a HE1 total e as barras mostram quantos registros ficaram como divergência ou atenção naquele período."
                  porqueAparece="Um número isolado não diz se a operação está melhorando ou piorando. A série mostra tendência — se o volume de hora extra e de divergências está subindo ou caindo."
                />
              </span>
              <span className="seg-control">
                <button className={`seg-btn ${!usarMensal ? 'ativo' : ''}`} onClick={() => setGranularidade('dia')}>
                  Por dia
                </button>
                <button className={`seg-btn ${usarMensal ? 'ativo' : ''}`} onClick={() => setGranularidade('mes')}>
                  Por mês
                </button>
              </span>
            </div>

            {serie.length < 2 ? (
              <div className="empty-state" style={{ padding: '18px 12px' }}>
                É preciso pelo menos dois {usarMensal ? 'meses' : 'dias'} processados para desenhar uma tendência.
              </div>
            ) : (
              <div className="grid-2">
                <div>
                  <div className="chart-caption">Hora extra acumulada</div>
                  <ResponsiveContainer width="100%" height={210}>
                    <LineChart data={serie} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_TICK }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: CHART_TICK }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [minToStrSigned(Number(v)), 'HE1 total']} />
                      <Line type="monotone" dataKey="heTotalMin" stroke="#3fc98f" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div className="chart-caption">Registros com divergência ou atenção</div>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={serie} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_TICK }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: CHART_TICK }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), 'Ocorrências']} />
                      <Bar dataKey="divergencias" fill="#f4a83f" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* ------------------------------------------------ pendências e SLA */}
          <div className="card card-pad section-gap">
            <div className="card-title">
              <span>Pendências, prazos e revisão</span>
              <Link className="link-inline" to="/centro-de-acoes">
                Abrir Centro de Ações <ArrowRight size={13} />
              </Link>
            </div>

            {indicadoresPendencias.total === 0 ? (
              <div className="empty-state" style={{ padding: '18px 12px' }}>
                Nenhuma pendência registrada no período — todos os registros ficaram dentro do padrão configurado.
              </div>
            ) : (
              <>
                <div className="kpi-grid">
                  <div className="kpi-card">
                    <div className="kpi-label">Abertas</div>
                    <div className="kpi-value">{indicadoresPendencias.abertas}</div>
                    <div className="kpi-foot">de {indicadoresPendencias.total} no total</div>
                  </div>
                  <div className={`kpi-card ${indicadoresPendencias.vencidas ? 'accent-red' : ''}`}>
                    <div className="kpi-label">Prazo vencido</div>
                    <div className="kpi-value">{indicadoresPendencias.vencidas}</div>
                    <div className="kpi-foot">prazo já passou e segue aberta</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">
                      Aderência ao prazo
                      <ExplicacaoIndicador
                        comoFoiCalculado="Pendências resolvidas dentro do prazo, divididas pelas resolvidas que tinham prazo definido. Quem foi resolvida sem prazo não entra na conta."
                        porqueAparece="Mostra se os prazos definidos estão sendo cumpridos na prática. Sem nenhuma resolvida com prazo, o indicador não pode ser medido."
                      />
                    </div>
                    <div className="kpi-value">
                      {indicadoresPendencias.aderenciaPrazoPct === null ? '—' : `${indicadoresPendencias.aderenciaPrazoPct}%`}
                    </div>
                    <div className="kpi-foot">
                      {indicadoresPendencias.aderenciaPrazoPct === null
                        ? 'nenhuma resolvida tinha prazo definido'
                        : 'das resolvidas com prazo'}
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">
                      Tempo médio de resolução
                      <ExplicacaoIndicador
                        comoFoiCalculado="Média de dias entre a criação da pendência e o momento em que foi marcada como resolvida, considerando só as que já foram resolvidas."
                        porqueAparece="Indica a velocidade real do tratamento, independente de haver prazo definido."
                      />
                    </div>
                    <div className="kpi-value">
                      {indicadoresPendencias.tempoMedioResolucaoDias === null
                        ? '—'
                        : `${indicadoresPendencias.tempoMedioResolucaoDias}d`}
                    </div>
                    <div className="kpi-foot">
                      {indicadoresPendencias.tempoMedioResolucaoDias === null ? 'nenhuma resolvida ainda' : 'da criação até a resolução'}
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">
                      Taxa de aprovação
                      <ExplicacaoIndicador
                        comoFoiCalculado="Pendências aprovadas divididas pelo total de pendências revisadas (aprovadas + reprovadas). Resolvidas que ainda não passaram por revisão não entram."
                        porqueAparece="Mostra a qualidade do tratamento: uma taxa de aprovação baixa indica que as justificativas registradas não estão convencendo quem revisa."
                      />
                    </div>
                    <div className="kpi-value">
                      {indicadoresPendencias.taxaAprovacaoPct === null ? '—' : `${indicadoresPendencias.taxaAprovacaoPct}%`}
                    </div>
                    <div className="kpi-foot">
                      {indicadoresPendencias.taxaAprovacaoPct === null
                        ? 'nenhuma revisada ainda'
                        : `${indicadoresPendencias.aprovadas} aprovada(s) · ${indicadoresPendencias.reprovadas} reprovada(s)`}
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Aguardando revisão</div>
                    <div className="kpi-value">{indicadoresPendencias.aguardandoRevisao}</div>
                    <div className="kpi-foot">resolvidas, ainda sem aprovação</div>
                  </div>
                </div>

                <div className="grid-2" style={{ marginTop: 14 }}>
                  <div>
                    <div className="chart-caption">Distribuição por status</div>
                    <DistribuicaoLista itens={indicadoresPendencias.porStatus} />
                  </div>
                  <div>
                    <div className="chart-caption">Situação de prazo</div>
                    <DistribuicaoLista itens={indicadoresPendencias.porSla} />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ------------------------------------------------ rankings */}
          <div className="grid-2 section-gap">
            <div className="card card-pad">
              <div className="card-title">
                <span>
                  Maior excedente por colaborador
                  <ExplicacaoIndicador
                    comoFoiCalculado="Soma do excedente (hora extra realizada menos a programada) de cada colaborador, considerando só os dias classificados como acima do padrão."
                    porqueAparece="Concentra a atenção em quem gerou mais hora extra não prevista no período — o maior impacto de custo."
                  />
                </span>
                <Link className="link-inline" to="/he1">
                  Ver detalhe <ArrowRight size={13} />
                </Link>
              </div>
              {topExcedente.length === 0 ? (
                <div className="empty-state" style={{ padding: '16px 12px' }}>
                  Nenhum colaborador ficou acima do padrão no período.
                </div>
              ) : (
                <RankingLista linhas={topExcedente} formato="minutos" rotuloSecundario="dia(s) acima" />
              )}
            </div>

            <div className="card card-pad">
              <div className="card-title">
                <span>
                  Menor conformidade
                  <ExplicacaoIndicador
                    comoFoiCalculado="Percentual de dias dentro do padrão de cada colaborador, do menor para o maior. Só entram colaboradores com pelo menos um dia fora do padrão."
                    porqueAparece="Complementa o ranking de excedente: alguém pode ter pouco excedente em minutos e ainda assim ficar fora do padrão quase todo dia."
                  />
                </span>
                <Link className="link-inline" to="/score">
                  Ver score <ArrowRight size={13} />
                </Link>
              </div>
              {piorConformidade.length === 0 ? (
                <div className="empty-state" style={{ padding: '16px 12px' }}>
                  Todos os colaboradores ficaram 100% dentro do padrão no período.
                </div>
              ) : (
                <RankingLista linhas={piorConformidade} formato="percentual" rotuloSecundario="dia(s) analisado(s)" />
              )}
            </div>
          </div>

          {/* ------------------------------------------------ setor e causa */}
          <div className="grid-2 section-gap">
            <div className="card card-pad">
              <div className="card-title">
                <span>
                  Setores com mais divergência
                  <ExplicacaoIndicador
                    comoFoiCalculado="Quantidade de registros com status divergência ou atenção atribuídos a cada setor responsável, usando a mesma regra de rateio da tela Análise por Setor."
                    porqueAparece="Divergência costuma ter causa estrutural (rota, escala, equipamento). Ver por setor aponta onde agir, em vez de tratar caso a caso."
                  />
                </span>
                <Link className="link-inline" to="/setores">
                  Ver análise <ArrowRight size={13} />
                </Link>
              </div>
              {setoresDivergencia.length === 0 ? (
                <div className="empty-state" style={{ padding: '16px 12px' }}>
                  Nenhuma divergência atribuída a um setor no período.
                </div>
              ) : (
                <RankingLista linhas={setoresDivergencia} formato="inteiro" rotuloSecundario="" mostrarSecundario={false} />
              )}
            </div>

            <div className="card card-pad">
              <div className="card-title">
                <span>
                  Principais causas
                  <ExplicacaoIndicador
                    comoFoiCalculado="Contagem das causas prováveis registradas nos casos fora do padrão — a causa marcada por quem tratou o caso, ou a sugerida pelo motor quando ninguém marcou."
                    porqueAparece="Mostra o padrão por trás das ocorrências. Muitos casos em 'Não classificada' indicam que o tratamento está sendo feito sem registrar o motivo."
                  />
                </span>
              </div>
              {causas.length === 0 ? (
                <div className="empty-state" style={{ padding: '16px 12px' }}>
                  Nenhuma ocorrência fora do padrão no período.
                </div>
              ) : (
                <DistribuicaoLista itens={causas} />
              )}
            </div>
          </div>

          {/* ------------------------------------------------ por unidade */}
          <div className="card card-pad section-gap">
            <div className="card-title">
              <span>
                Indicadores por unidade
                <ExplicacaoIndicador
                  comoFoiCalculado="Os registros são ligados a uma unidade pelo nome do colaborador, casando com o cadastro em Configurações → Colaboradores. Quem não casa aparece separado, sem ser distribuído entre as unidades."
                  porqueAparece="Permite comparar unidades entre si. Só é confiável na medida em que o cadastro de colaboradores estiver completo — por isso o não vinculado fica visível."
                />
              </span>
              <Link className="link-inline" to="/configuracoes">
                Configurar cadastro <ArrowRight size={13} />
              </Link>
            </div>

            {semVinculoCadastro && (
              <AvisoConfiguracao>
                {semVinculoCadastro.registros} registro(s) não puderam ser ligados a uma unidade porque o colaborador não está no
                cadastro. Cadastre-os em Configurações → Colaboradores para que apareçam na unidade correta.
              </AvisoConfiguracao>
            )}

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Colaboradores</th>
                    <th>Registros</th>
                    <th>HE1 total</th>
                    <th>Excedente</th>
                    <th>Divergências</th>
                    <th>Conformidade</th>
                  </tr>
                </thead>
                <tbody>
                  {unidades.map((u) => (
                    <tr key={u.unidade}>
                      <td className="cell-strong">{u.unidade}</td>
                      <td>{u.colaboradores}</td>
                      <td>{u.registros}</td>
                      <td className="mono">{minToStrSigned(u.heTotalMin)}</td>
                      <td className="mono">{minToStrSigned(u.excedenteTotalMin)}</td>
                      <td>{u.divergencias}</td>
                      <td className="mono">{u.conformidadePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- subcomponentes locais */

function DistribuicaoLista({ itens }: { itens: { label: string; valor: number; pct: number }[] }) {
  return (
    <ul className="distribuicao">
      {itens.map((i) => (
        <li key={i.label}>
          <div className="distribuicao-topo">
            <span>{i.label}</span>
            <span className="cell-strong mono">
              {i.valor} <span className="text-faint">({i.pct}%)</span>
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${i.pct}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function RankingLista({
  linhas,
  formato,
  rotuloSecundario,
  mostrarSecundario = true,
}: {
  linhas: { chave: string; label: string; sublabel: string; valor: number; valorSecundario: number }[];
  formato: 'minutos' | 'percentual' | 'inteiro';
  rotuloSecundario: string;
  mostrarSecundario?: boolean;
}) {
  function fmt(v: number) {
    if (formato === 'minutos') return minToStrSigned(v);
    if (formato === 'percentual') return `${v}%`;
    return String(v);
  }
  return (
    <ol className="ranking-lista">
      {linhas.map((l, i) => (
        <li key={l.chave}>
          <span className="ranking-pos">{i + 1}</span>
          <div className="ranking-nome">
            <div className="cell-strong">{l.label}</div>
            <div className="text-faint" style={{ fontSize: 11.5 }}>
              {l.sublabel}
            </div>
          </div>
          <div className="ranking-valor">
            <div className="cell-strong mono">{fmt(l.valor)}</div>
            {mostrarSecundario && (
              <div className="text-faint" style={{ fontSize: 11.5 }}>
                {l.valorSecundario} {rotuloSecundario}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
