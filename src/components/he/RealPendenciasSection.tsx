import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { useHEEngineData } from '../../engine/useHEEngineData';
import { dkToLabel, minToStrSigned } from '../../engine/heEngineCore';
import { listarPendencias, statusDoCaso, type CasoPendente } from '../../services/pendingClassificationService';
import {
  atualizarPrazo,
  atualizarPrioridade,
  atualizarResponsavel,
  idDaPendencia,
  reabrirRevisao,
  sincronizarPendencias,
  sugerirPrazo,
} from '../../services/pendenciaService';
import { explicarPendencia } from '../../services/pendingExplanationService';
import { recomendarPrioridade } from '../../services/priorizacaoService';
import { calcularEstadoSla } from '../../services/slaService';
import { EstadoSlaBadge, ItemStatusBadge, PadraoStatusBadge, PrioridadeBadge, StatusPendenciaBadge } from '../ui/Badges';
import { Modal } from '../ui/Modal';
import { AmbienteSemDados } from '../ui/Indicadores';
import { initials } from '../../utils/text';
import { useAppState } from '../../state/AppState';
import { useWorkspace } from '../../workspace/WorkspaceContext';
import { calcularHoraExtra } from '../../services/overtimeService';
import { PRIORIDADE_LABEL, type Pendencia, type Prioridade } from '../../domain/Pendencia';
import { FeedbackGravacao } from '../ui/EstadosAsync';
import { useGravacao } from '../../data/useRecurso';

type Caso = CasoPendente;
const PRIORIDADES: Prioridade[] = ['baixa', 'media', 'alta', 'critica'];

export function RealPendenciasSection() {
  const { dias, refresh, marcarCampo } = useHEEngineData();
  const { registrarAuditoria, usuarioAtual } = useAppState();
  const { workspace, pendencias, gravar, recarregar, modo, pode } = useWorkspace();
  const gravacao = useGravacao();

  /* Os setores vem do cadastro ja carregado — nao ha uma segunda lista para manter em dia. */
  const setorOpts = useMemo(
    () => Array.from(new Set(workspace.departments.map((d) => d.nome.trim()).filter(Boolean))),
    [workspace.departments],
  );

  const podeTratar = pode('pendencia:tratar');
  const podeRevisar = pode('pendencia:revisar');
  const [mostrarResolvidas, setMostrarResolvidas] = useState(false);
  const [selecionado, setSelecionado] = useState<Caso | null>(null);
  const [rascunho, setRascunho] = useState<{ setor: string; causa: string; justificativa: string }>({
    setor: '',
    causa: '',
    justificativa: '',
  });

  const casos = useMemo(() => listarPendencias(dias, mostrarResolvidas), [dias, mostrarResolvidas]);

  /* Materializa a entidade Pendencia (Fase 2, Etapa 2) a partir dos casos do motor sempre que
   * `dias` muda — não a cada render. Não gera entrada de auditoria própria: reaproveita as que
   * `salvar()`/`marcarResolvido()` já registram, já que são elas que disparam a mudança em `dias`
   * (via marcarCampo → notifySync → refresh do hook) que este efeito está observando. */
  const pendenciaPorId = useMemo(() => new Map(pendencias.map((p) => [p.id, p])), [pendencias]);

  /* Materializa a entidade Pendencia a partir dos casos do motor sempre que `dias` muda — nunca a
   * cada render. `sincronizarPendencias` e puro e devolve SO o que precisa ser gravado; sem esse
   * filtro, abrir a tela reenviaria ao servidor centenas de pendencias identicas as que ja estao la.
   *
   * A gravacao e sequencial de proposito: um `Promise.all` de dezenas de requisicoes dispararia
   * tudo de uma vez contra o servidor logo na abertura da tela. */
  useEffect(() => {
    if (dias.length === 0) return;
    const alteradas = sincronizarPendencias(workspace.id, dias, pendencias, workspace.employees);
    if (alteradas.length === 0) return;

    let cancelado = false;
    void (async () => {
      for (const p of alteradas) {
        if (cancelado) return;
        try {
          await gravar((repo, ctx) => repo.salvarPendencia(ctx.empresaId, p));
        } catch {
          /* Falha ao materializar uma pendencia nao pode travar a tela: o restante continua, e a
           * proxima sincronizacao tenta de novo. O que a pessoa ve e a fila que o servidor tem. */
          return;
        }
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage a mudanca nos dias, nao a cada render
  }, [workspace.id, dias]);

  /* Deep-link do Centro de Ações (Fase 2, Etapa 3): "/pendencias?abrir=<id>" auto-abre o caso.
   * Busca INCLUINDO resolvidas (independente do toggle "mostrar resolvidas") — só assim um caso já
   * resolvido, vindo do Centro de Ações, também abre. Não cria um segundo mecanismo de abertura, só
   * chama a mesma função `abrir()` que o botão "Ver detalhes" já usa. */
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const idAlvo = searchParams.get('abrir');
    if (!idAlvo) return;
    const todos = listarPendencias(dias, true);
    const alvo = todos.find(({ dia, item }) => idDaPendencia(workspace.id, dia.dateKey, item) === idAlvo);
    if (alvo) abrir(alvo);
    /* Consome o parâmetro depois de abrir. Sem isso, fechar a ficha e clicar "Abrir" no MESMO caso
     * de novo não reabriria: a URL não mudaria, então este efeito não voltaria a rodar. Limpar
     * também evita que um F5 reabra sozinho uma ficha que a pessoa já tinha fechado. */
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à chegada via link, não a cada mudança de `dias`
  }, [searchParams]);

  /* O item selecionado ja carrega tudo que o calculo precisa (padrao, HE efetiva, correcao) —
   * buscar de novo no armazenamento seria uma segunda leitura do mesmo dado. */
  const heCalculada = useMemo(() => {
    if (!selecionado) return null;
    const it = selecionado.item;
    return calcularHoraExtra(it, { heCorrigida: it._corrigido ? it._heMin : undefined }, workspace.rules.toleranceMin);
  }, [selecionado, workspace.rules.toleranceMin]);

  const pendenciaSelecionada: Pendencia | null = selecionado
    ? pendenciaPorId.get(idDaPendencia(workspace.id, selecionado.dia.dateKey, selecionado.item)) ?? null
    : null;

  /* Explicabilidade (Fase 2, Etapa 4) — narra o que o sistema já decidiu, sem recalcular nada.
   * Só é computável quando a Pendencia já foi materializada (sempre o caso aqui, já que a
   * sincronização roda no efeito acima antes de qualquer "abrir" ser possível). Inclui
   * responsável/prazo/SLA desde a Etapa 6/7 — mesma função, sem uma segunda explicação. */
  const explicacao = selecionado && pendenciaSelecionada
    ? explicarPendencia(
        workspace.id,
        selecionado.dia.dateKey,
        pendenciaSelecionada,
        selecionado.item,
        workspace.rules.toleranceMin,
        workspace.users,
        workspace.rules.alertaAntecedenciaDias,
      )
    : null;
  const [explicacaoAberta, setExplicacaoAberta] = useState(false);

  /* SLA (Fase 2, Etapa 7) — mesma função pura usada no Centro de Ações, nenhuma regra duplicada. */
  const estadoSla = pendenciaSelecionada
    ? calcularEstadoSla(pendenciaSelecionada, workspace.rules.alertaAntecedenciaDias)
    : null;

  const [observacaoRevisao, setObservacaoRevisao] = useState('');

  /* Recomendação de prioridade (Fase 2, Etapa 5) — computada sob demanda a cada render, nunca
   * persistida. `pendenciaSelecionada` já reflete a prioridade EFETIVA (manual); a recomendação é
   * só uma sugestão ao lado, nunca sobrescreve nada sozinha. */
  const recomendacao = selecionado && pendenciaSelecionada
    ? recomendarPrioridade(pendenciaSelecionada, selecionado.item, dias, workspace.rules.recurrenceLimit)
    : null;

  /* Toda alteracao de pendencia passa por aqui: grava no conjunto ativo, recarrega, e so entao
   * registra a auditoria LOCAL (no modo conectado a trilha confiavel ja foi escrita pelo servidor,
   * com o autor vindo da sessao). */
  async function alterarPendencia(nova: Pendencia, trilha: Parameters<typeof registrarAuditoria>[0]) {
    const ok = await gravacao.executar(() => gravar((repo, ctx) => repo.salvarPendencia(ctx.empresaId, nova)));
    if (ok === null) return false;
    if (modo === 'local') registrarAuditoria(trilha);
    return true;
  }

  function mudarPrioridade(prioridade: Prioridade, origem: 'manual' | 'recomendacao' = 'manual') {
    if (!selecionado || !pendenciaSelecionada) return;
    const id = pendenciaSelecionada.id;
    const anterior = pendenciaSelecionada.prioridade;
    void alterarPendencia(atualizarPrioridade(pendenciaSelecionada, prioridade), {
      usuario: usuarioAtual,
      entidade: `Pendência ${id}`,
      acao: origem === 'recomendacao' ? 'Prioridade ajustada para recomendação do sistema' : 'Atualização de prioridade',
      valorAnterior: anterior ? PRIORIDADE_LABEL[anterior] : '—',
      valorNovo: PRIORIDADE_LABEL[prioridade],
      motivo: origem === 'recomendacao' ? (recomendacao?.motivo ?? 'Recomendação do sistema aplicada.') : 'Ajuste manual de prioridade.',
    });
  }

  /* Responsável + Prazo (Fase 2, Etapa 6) — mesmo padrão de mudarPrioridade: escrita imediata (sem
   * "Salvar" separado), auditoria própria, `responsavelId` referencia `UserAccess` de
   * `workspace.users` (nenhuma entidade nova criada). */
  function mudarResponsavel(responsavelId: string) {
    if (!selecionado || !pendenciaSelecionada) return;
    const id = pendenciaSelecionada.id;
    const valorFinal = responsavelId || null;
    const nomeAnterior = workspace.users.find((u) => u.id === pendenciaSelecionada.responsavelId)?.nome ?? '—';
    const nomeNovo = workspace.users.find((u) => u.id === valorFinal)?.nome ?? '—';
    void alterarPendencia(atualizarResponsavel(pendenciaSelecionada, valorFinal), {
      usuario: usuarioAtual,
      entidade: `Pendência ${id}`,
      acao: 'Responsável alterado',
      valorAnterior: nomeAnterior,
      valorNovo: nomeNovo,
      motivo: 'Atribuição manual de responsável.',
    });
  }

  function mudarPrazo(prazo: string) {
    if (!selecionado || !pendenciaSelecionada) return;
    const id = pendenciaSelecionada.id;
    const valorFinal = prazo || null;
    void alterarPendencia(atualizarPrazo(pendenciaSelecionada, valorFinal), {
      usuario: usuarioAtual,
      entidade: `Pendência ${id}`,
      acao: 'Prazo alterado',
      valorAnterior: pendenciaSelecionada.prazo ? dkToLabel(pendenciaSelecionada.prazo) : '—',
      valorNovo: valorFinal ? dkToLabel(valorFinal) : '—',
      motivo: 'Ajuste manual de prazo.',
    });
  }

  function aplicarPrazoSugerido() {
    if (!pendenciaSelecionada) return;
    mudarPrazo(sugerirPrazo(pendenciaSelecionada, workspace.rules.prazoPadraoDias));
  }

  /* Revisão / Aprovação / Reprovação (Fase 2, Etapa 8) — só chamável quando a pendência já está
   * 'justificado' (resolvida). "Resolvido" nunca vira "aprovado" sozinho: a UI só oferece este
   * bloco depois que a resolução já aconteceu, e é sempre uma ação humana explícita. */
  /* A revisao NAO passa por `salvarPendencia`: ela tem rota propria no servidor, com permissao
   * separada de tratamento, e o autor (`revisadoPor`) e resolvido a partir da SESSAO. E isso que
   * impede alguem registrar uma aprovacao em nome de outra pessoa — por isso o cliente nao envia
   * quem revisou. */
  async function revisar(decisao: 'aprovado' | 'reprovado') {
    if (!pendenciaSelecionada) return;
    const id = pendenciaSelecionada.id;
    const observacao = observacaoRevisao.trim() || null;
    const ok = await gravacao.executar(() =>
      gravar((repo, ctx) => repo.revisarPendencia(ctx.empresaId, id, decisao, observacao)),
    );
    if (ok === null) return;
    if (modo === 'local') {
      registrarAuditoria({
        usuario: usuarioAtual,
        entidade: `Pendência ${id}`,
        acao: decisao === 'aprovado' ? 'Pendência aprovada' : 'Pendência reprovada',
        valorAnterior: 'Justificado',
        valorNovo: decisao === 'aprovado' ? 'Aprovado' : 'Reprovado',
        motivo: observacao || `Revisão ${decisao === 'aprovado' ? 'aprovada' : 'reprovada'} sem observação.`,
      });
    }
    setObservacaoRevisao('');
  }

  function aprovar() {
    void revisar('aprovado');
  }

  function reprovar() {
    void revisar('reprovado');
  }

  /* Reabertura (Fase 2, Etapa 8) — só disponível para 'reprovado'. Reabre o CASO no motor pelo
   * caminho já existente (marcarCampo → HECaseState, nunca duplicado) e limpa só os campos de
   * revisão da entidade; o status em si é recalculado pela próxima sincronização, não aqui. */
  async function reabrir() {
    if (!selecionado || !pendenciaSelecionada) return;
    const { dia, item } = selecionado;
    const id = pendenciaSelecionada.id;
    /* Reabre o CASO no motor pelo caminho ja existente e limpa so os campos de revisao da
     * entidade; o status em si e recalculado pela proxima sincronizacao, nunca aqui. */
    await gravacao.executar(async () => {
      await marcarCampo(dia.dateKey, item.motorista, { done: false });
      await gravar((repo, ctx) => repo.salvarPendencia(ctx.empresaId, reabrirRevisao(pendenciaSelecionada)));
    });
    if (modo === 'local') {
      registrarAuditoria({
        usuario: usuarioAtual,
        entidade: `Pendência ${id}`,
        acao: 'Pendência reaberta',
        valorAnterior: 'Reprovado',
        valorNovo: 'Reaberta para tratamento',
        motivo: 'Reabertura manual após reprovação.',
      });
    }
    setSelecionado(null);
  }

  const totalDias = dias.length;
  const totalPendentes = dias.reduce((s, d) => s + d.pendentes, 0);
  const totalHE = dias.reduce((s, d) => s + d.totalHEAtual, 0);

  function abrir(caso: Caso) {
    setSelecionado(caso);
    setExplicacaoAberta(false);
    setObservacaoRevisao('');
    setRascunho({
      setor: caso.item._setor === 'Sem setor definido' ? '' : caso.item._setor,
      causa: caso.item._causa,
      justificativa: caso.item._justificativa,
    });
  }

  async function salvar() {
    if (!selecionado) return;
    const { dia, item } = selecionado;
    const ok = await gravacao.executar(() =>
      marcarCampo(dia.dateKey, item.motorista, {
        setor: rascunho.setor,
        causa: rascunho.causa,
        justificativa: rascunho.justificativa,
      }),
    );
    if (ok === null) return;
    if (modo === 'local') registrarAuditoria({
      usuario: usuarioAtual,
      entidade: `HE real ${dkToLabel(dia.dateKey)} — ${item.motorista}`,
      acao: 'Atualização de caso (Assistente HE)',
      valorAnterior: `setor=${item._setor}; causa=${item._causa || '—'}`,
      valorNovo: `setor=${rascunho.setor || '—'}; causa=${rascunho.causa || '—'}`,
      motivo: rascunho.justificativa || 'Sem justificativa registrada.',
    });
    setSelecionado(null);
  }

  async function marcarResolvido() {
    if (!selecionado) return;
    const { dia, item } = selecionado;
    const ok = await gravacao.executar(() => marcarCampo(dia.dateKey, item.motorista, { done: true }));
    if (ok === null) return;
    if (modo === 'local') registrarAuditoria({
      usuario: usuarioAtual,
      entidade: `HE real ${dkToLabel(dia.dateKey)} — ${item.motorista}`,
      acao: 'Resolução de caso (Assistente HE)',
      valorAnterior: 'pendente',
      valorNovo: 'resolvido',
      motivo: rascunho.justificativa || item._justificativa || 'Marcado como resolvido.',
    });
    setSelecionado(null);
  }

  return (
    <div className="card card-pad section-gap">
      <div className="card-title">
        Pendências reais — Assistente HE Diário
        <button className="btn btn-sm" onClick={refresh}>
          <RefreshCw size={13} />
          Sincronizar
        </button>
        <FeedbackGravacao estado={gravacao.estado} erro={gravacao.erro} aoRecarregar={() => void recarregar()} />
      </div>

      {/* Sem nenhum dia processado NÃO é "nada pendente": é "nada analisado". Confundir os dois faz
          uma empresa recém-criada parecer uma operação impecável. */}
      {totalDias === 0 ? (
        <AmbienteSemDados
          titulo="Nenhuma jornada foi analisada ainda"
          descricao="As pendências surgem do cruzamento entre ponto, escala, rastreio e horário padrão. Processe o primeiro dia para que as ocorrências apareçam aqui."
        />
      ) : (
        <>
          <div className="chip-row section-gap">
            <span className="badge badge-gray">{totalDias} dia(s) processado(s)</span>
            <span className="badge badge-blue">{minToStrSigned(totalHE)} de HE1 acumulado</span>
            <span className={`badge ${totalPendentes ? 'badge-red' : 'badge-green'}`}>{totalPendentes} pendente(s)</span>
          </div>

          <div className="toolbar">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={mostrarResolvidas} onChange={(e) => setMostrarResolvidas(e.target.checked)} />
              mostrar resolvidas
            </label>
            <div className="spacer" />
            <span className="text-faint" style={{ fontSize: 12.5 }}>
              {casos.length} caso(s)
            </span>
          </div>

          {casos.length === 0 ? (
            <div className="empty-state">
              <Sparkles size={26} />
              <div style={{ fontWeight: 600, marginTop: 8 }}>Operação sem pendências no período</div>
              <div style={{ marginTop: 4 }}>
                {totalDias} dia(s) analisado(s) e nenhuma ocorrência aguardando decisão.
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Data</th>
                    <th>HE.1</th>
                    <th>Status</th>
                    <th>Prioridade</th>
                    <th>Padrão</th>
                    <th>Confirmação</th>
                    <th>Setor</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {casos.map(({ dia, item }) => {
                    const pend = pendenciaPorId.get(idDaPendencia(workspace.id, dia.dateKey, item));
                    return (
                      <tr key={dia.dateKey + '_' + item._key}>
                        <td>
                          <div className="name-cell">
                            <span className="avatar">{initials(item.motorista)}</span>
                            <div className="meta">
                              <span className="cell-strong">{item.motorista}{item._done ? ' ✓' : ''}</span>
                            </div>
                          </div>
                        </td>
                        <td className="mono">{dkToLabel(dia.dateKey)}</td>
                        <td className="mono">
                          {item._heStr}
                          {item._corrigido && <span className="text-faint"> (orig. {item.he1str})</span>}
                        </td>
                        <td>
                          {/* Prefere o status PERSISTIDO na entidade: só ele reflete aprovado/reprovado
                              (Etapa 8) — statusDoCaso() nunca retorna esses dois, é só o cálculo ao vivo. */}
                          <StatusPendenciaBadge status={pend ? pend.status : statusDoCaso(item)} />
                        </td>
                        <td>{pend ? <PrioridadeBadge prioridade={pend.prioridade} /> : '—'}</td>
                        <td>
                          <PadraoStatusBadge status={item._padraoStatus} excedenteMin={item._excedenteMin} />
                        </td>
                        <td>
                          <ItemStatusBadge status={item._status} />
                        </td>
                        <td className="cell-muted">{item._setor}</td>
                        <td>
                          <button className="btn btn-sm" onClick={() => abrir({ dia, item })}>
                            Ver detalhes
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selecionado && (
        <Modal
          title={selecionado.item.motorista}
          subtitle={`${dkToLabel(selecionado.dia.dateKey)} · HE.1 ${selecionado.item._heStr}`}
          onClose={() => setSelecionado(null)}
          footer={
            <>
              <button className="btn btn-primary" onClick={() => void marcarResolvido()} disabled={selecionado.item._done || !podeTratar || gravacao.estado === 'salvando'}>
                {selecionado.item._done ? 'Já resolvido' : 'Marcar resolvido'}
              </button>
              <button className="btn btn-primary" onClick={() => void salvar()} disabled={!podeTratar || gravacao.estado === 'salvando'}>
                Salvar
              </button>
            </>
          }
        >
          <dl style={{ margin: 0 }}>
            <div className="definition-row">
              <dt>Status</dt>
              <dd>
                <StatusPendenciaBadge status={pendenciaSelecionada ? pendenciaSelecionada.status : statusDoCaso(selecionado.item)} />
              </dd>
            </div>
            <div className="definition-row">
              <dt>Responsável</dt>
              <dd>
                <select
                  className="select"
                  value={pendenciaSelecionada?.responsavelId ?? ''}
                  onChange={(e) => mudarResponsavel(e.target.value)}
                >
                  <option value="">Sem responsável atribuído</option>
                  {workspace.users.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </dd>
            </div>
            <div className="definition-row">
              <dt>Prazo</dt>
              <dd>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    className="input"
                    value={pendenciaSelecionada?.prazo ?? ''}
                    onChange={(e) => mudarPrazo(e.target.value)}
                  />
                  {!pendenciaSelecionada?.prazo && (
                    <button className="btn btn-sm" onClick={aplicarPrazoSugerido}>
                      Sugerir prazo padrão ({workspace.rules.prazoPadraoDias}d)
                    </button>
                  )}
                  {estadoSla && <EstadoSlaBadge estado={estadoSla} />}
                </div>
              </dd>
            </div>
            <div className="definition-row">
              <dt>Prioridade</dt>
              <dd>
                <select
                  className="select"
                  value={pendenciaSelecionada?.prioridade ?? 'media'}
                  onChange={(e) => mudarPrioridade(e.target.value as Prioridade)}
                >
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>
                  ))}
                </select>
              </dd>
            </div>
            {recomendacao && (
              <div className="definition-row">
                <dt>Recomendação do sistema</dt>
                <dd>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <PrioridadeBadge prioridade={recomendacao.prioridade} />
                    {recomendacao.prioridade === pendenciaSelecionada?.prioridade ? (
                      <span className="text-faint" style={{ fontSize: 12 }}>já é a prioridade efetiva</span>
                    ) : (
                      <button className="btn btn-sm" onClick={() => mudarPrioridade(recomendacao.prioridade, 'recomendacao')}>
                        Aplicar
                      </button>
                    )}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}>{recomendacao.motivo}</p>
                </dd>
              </div>
            )}
            <div className="definition-row">
              <dt>Padrão</dt>
              <dd>
                <PadraoStatusBadge status={selecionado.item._padraoStatus} excedenteMin={selecionado.item._excedenteMin} />
              </dd>
            </div>
            <div className="definition-row">
              <dt>Confirmação</dt>
              <dd>
                <ItemStatusBadge status={selecionado.item._status} /> <span className="text-faint">({selecionado.item.confirmadas} batidas)</span>
              </dd>
            </div>
            {heCalculada && (
              <>
                <div className="definition-row">
                  <dt>HE programada</dt>
                  <dd className="mono">{minToStrSigned(heCalculada.heProgramadaMin)}</dd>
                </div>
                <div className="definition-row">
                  <dt>HE realizada</dt>
                  <dd className="mono">{minToStrSigned(heCalculada.heRealizadaMin)}</dd>
                </div>
                <div className="definition-row">
                  <dt>HE excedente</dt>
                  <dd className="mono">{minToStrSigned(heCalculada.heExcedenteMin)}</dd>
                </div>
              </>
            )}
          </dl>

          {explicacao && (
            <div className="card card-pad" style={{ background: 'var(--surface-2, rgba(255,255,255,0.03))' }}>
              <button
                onClick={() => setExplicacaoAberta((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                  fontWeight: 700,
                  fontSize: 13.5,
                }}
              >
                {explicacaoAberta ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                Por que isso apareceu?
              </button>

              {explicacaoAberta && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div className="kpi-label" style={{ marginBottom: 6 }}>Motivo</div>
                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{explicacao.motivo}</p>
                  </div>

                  {explicacao.notaPrazo && (
                    <div>
                      <div className="kpi-label" style={{ marginBottom: 6 }}>Prazo</div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--danger, #ff6d5c)' }}>{explicacao.notaPrazo}</p>
                    </div>
                  )}

                  {explicacao.regraAplicada && (
                    <div>
                      <div className="kpi-label" style={{ marginBottom: 6 }}>Regra aplicada</div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{explicacao.regraAplicada}</p>
                    </div>
                  )}

                  <div>
                    <div className="kpi-label" style={{ marginBottom: 6 }}>Resultado</div>
                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{explicacao.resultado}</p>
                  </div>

                  <div>
                    <div className="kpi-label" style={{ marginBottom: 6 }}>Dados considerados</div>
                    <dl style={{ margin: 0 }}>
                      {explicacao.dadosConsiderados.map((d) => (
                        <div className="definition-row" key={d.label}>
                          <dt style={{ fontSize: 12.5 }}>{d.label}</dt>
                          <dd style={{ fontSize: 12.5 }} className={d.valor ? 'mono' : 'text-faint'}>
                            {d.valor ?? 'Não disponível'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  {explicacao.evidencias.length > 0 && (
                    <div>
                      <div className="kpi-label" style={{ marginBottom: 6 }}>Evidências</div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
                        {explicacao.evidencias.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="text-faint" style={{ fontSize: 11.5 }}>Origem: {explicacao.origem}</div>
                </div>
              )}
            </div>
          )}

          {selecionado.item.batidas && (
            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>Batidas do dia</div>
              <p style={{ margin: 0, fontSize: 13.5, fontFamily: 'monospace' }}>{selecionado.item.batidas}</p>
            </div>
          )}

          {selecionado.item.detalhe && (
            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>Detalhe</div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{selecionado.item.detalhe}</p>
            </div>
          )}

          <div className="setor-row" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div className="kpi-label" style={{ marginBottom: 6 }}>Setor responsável</div>
              <select className="select" style={{ width: '100%' }} value={rascunho.setor} onChange={(e) => setRascunho((r) => ({ ...r, setor: e.target.value }))}>
                <option value="">Setor responsável...</option>
                {setorOpts.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div className="kpi-label" style={{ marginBottom: 6 }}>Causa provável</div>
              <select className="select" style={{ width: '100%' }} value={rascunho.causa} onChange={(e) => setRascunho((r) => ({ ...r, causa: e.target.value }))}>
                <option value="">Causa provável...</option>
                {workspace.causaOpts.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="kpi-label" style={{ marginBottom: 6 }}>Justificativa</div>
            <textarea
              className="input"
              style={{ width: '100%', minHeight: 64, resize: 'vertical' }}
              value={rascunho.justificativa}
              onChange={(e) => setRascunho((r) => ({ ...r, justificativa: e.target.value }))}
            />
          </div>

          {/* Revisão (Fase 2, Etapa 8) — só aparece depois de resolvido. "Resolvido" nunca vira
              "Aprovado" sozinho: esta é sempre uma decisão humana separada e explícita. */}
          {pendenciaSelecionada?.status === 'justificado' && (
            <div className="card card-pad" style={{ borderTop: '2px solid var(--border)' }}>
              <div className="kpi-label" style={{ marginBottom: 6 }}>Revisão — aprovar ou reprovar a resolução</div>
              <textarea
                className="input"
                style={{ width: '100%', minHeight: 50, resize: 'vertical', marginBottom: 8 }}
                placeholder="Observação da revisão (opcional)"
                value={observacaoRevisao}
                onChange={(e) => setObservacaoRevisao(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={aprovar} disabled={!podeRevisar || gravacao.estado === 'salvando'}>Aprovar</button>
                <button className="btn btn-danger" onClick={reprovar} disabled={!podeRevisar || gravacao.estado === 'salvando'}>Reprovar</button>
              </div>
            </div>
          )}

          {(pendenciaSelecionada?.status === 'aprovado' || pendenciaSelecionada?.status === 'reprovado') && (
            <div className="card card-pad" style={{ borderTop: '2px solid var(--border)' }}>
              <div className="kpi-label" style={{ marginBottom: 6 }}>Revisão registrada</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                <StatusPendenciaBadge status={pendenciaSelecionada.status} /> por {pendenciaSelecionada.revisadoPor || '—'}
                {pendenciaSelecionada.revisadoEm ? ` em ${new Date(pendenciaSelecionada.revisadoEm).toLocaleString('pt-BR')}` : ''}
              </p>
              {pendenciaSelecionada.observacaoRevisao && (
                <p className="text-faint" style={{ margin: '6px 0 0', fontSize: 12.5 }}>{pendenciaSelecionada.observacaoRevisao}</p>
              )}
              {pendenciaSelecionada.status === 'reprovado' && (
                <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => void reabrir()} disabled={!podeTratar}>
                  Reabrir para novo tratamento
                </button>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
