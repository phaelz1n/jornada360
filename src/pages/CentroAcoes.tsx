/* Centro de Ações (Fase 2, Etapa 3) — fila operacional sobre a entidade Pendencia (Etapa 2). Não é
 * um segundo modelo de pendência: lê/ordena/filtra exatamente o que `pendenciaService` já expõe.
 * Resolução continua exclusiva do fluxo existente em /pendencias (RealPendenciasSection) — "Abrir"
 * aqui navega pra lá com `?abrir=<id>`, nunca duplica a edição de setor/causa/justificativa/done. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useHEEngineData, type HEItemComputed } from '../engine/useHEEngineData';
import { dkToLabel } from '../engine/heEngineCore';
import { useWorkspace } from '../workspace/WorkspaceContext';
import { useGravacao } from '../data/useRecurso';
import { FeedbackGravacao } from '../components/ui/EstadosAsync';
import { useAppState } from '../state/AppState';
import {
  acaoNecessaria,
  atualizarPrioridade,
  estadoResolvido,
  idDaPendencia,
  ordenarPendencias,
  resumoPendencias,
  sincronizarPendencias,
  situacaoRevisao,
} from '../services/pendenciaService';
import { recomendarPrioridade } from '../services/priorizacaoService';
import { calcularEstadoSla } from '../services/slaService';
import type { Pendencia, Prioridade, StatusPendencia } from '../domain/Pendencia';
import { PRIORIDADE_LABEL, STATUS_PENDENCIA_LABEL } from '../domain/Pendencia';
import { EstadoSlaBadge, StatusPendenciaBadge } from '../components/ui/Badges';
import { AmbienteSemDados } from '../components/ui/Indicadores';

const PRIORIDADES: Prioridade[] = ['critica', 'alta', 'media', 'baixa'];
/* 'normal' fica de fora do filtro de propósito: uma Pendencia nunca é criada com esse status (a
 * sincronização pula casos 'dentro do padrão' — não há o que rastrear), então oferecer esse filtro
 * seria uma opção que nunca traz resultado. */
const STATUS_FILTRAVEIS: StatusPendencia[] = ['divergencia', 'atencao', 'pendente', 'justificado', 'aprovado', 'reprovado'];

export default function CentroAcoes() {
  const { dias } = useHEEngineData();
  const { workspace, pendencias, gravar, recarregar, modo } = useWorkspace();
  const { registrarAuditoria, usuarioAtual } = useAppState();
  const gravacao = useGravacao();
  const navigate = useNavigate();

  /* Mesma materialização da Etapa 2 — garante que a entidade esteja em dia mesmo se a pessoa
   * chegar direto nesta tela sem nunca ter aberto /pendencias antes. `sincronizarPendencias` é
   * pura e devolve só o que mudou; sem esse filtro, abrir a tela regravaria a fila inteira. */
  useEffect(() => {
    if (dias.length === 0) return;
    const alteradas = sincronizarPendencias(workspace.id, dias, pendencias, workspace.employees);
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
        console.warn('[CentroAcoes] Aviso ao sincronizar pendências:', err);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage à mudança nos dias, não a cada render
  }, [workspace.id, dias]);

  const todas = pendencias;
  const resumo = useMemo(() => resumoPendencias(todas), [todas]);

  /* Nome real do motorista via join com o motor pelo mesmo id determinístico (mesma técnica usada
   * pra Prioridade na Etapa 2) — `colaboradorId` da entidade é best-effort demais (fica null na
   * maioria dos casos, ver BUSINESS_RULES.md) pra exibir ou filtrar com confiança; o nome bruto que
   * o motor leu da planilha, esse sim é a mesma fonte que todas as outras telas já mostram. */
  const nomePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const dia of dias) {
      for (const item of dia.items) {
        m.set(idDaPendencia(workspace.id, dia.dateKey, item), item.motorista);
      }
    }
    return m;
  }, [dias, workspace.id]);

  /* Mesmo join da Etapa 2/3, mas guardando o item inteiro (não só o nome) — é o que
   * `priorizacaoService.recomendarPrioridade` precisa (reincidência do colaborador vem de `dias`). */
  const itemPorId = useMemo(() => {
    const m = new Map<string, HEItemComputed>();
    for (const dia of dias) {
      for (const item of dia.items) {
        m.set(idDaPendencia(workspace.id, dia.dateKey, item), item);
      }
    }
    return m;
  }, [dias, workspace.id]);

  const colaboradoresDisponiveis = useMemo(
    () => [...new Set(todas.map((p) => nomePorId.get(p.id)).filter((n): n is string => !!n))].sort(),
    [todas, nomePorId],
  );

  const feedback = <FeedbackGravacao estado={gravacao.estado} erro={gravacao.erro} aoRecarregar={() => void recarregar()} />;

  const [filtroStatus, setFiltroStatus] = useState<StatusPendencia | ''>('');
  const [filtroPrioridade, setFiltroPrioridade] = useState<Prioridade | ''>('');
  const [filtroColaborador, setFiltroColaborador] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroDe, setFiltroDe] = useState('');
  const [filtroAte, setFiltroAte] = useState('');
  const [mostrarResolvidas, setMostrarResolvidas] = useState(false);

  const filtradas = useMemo(() => {
    return todas.filter((p) => {
      if (filtroStatus && p.status !== filtroStatus) return false;
      if (filtroPrioridade && p.prioridade !== filtroPrioridade) return false;
      if (filtroColaborador && nomePorId.get(p.id) !== filtroColaborador) return false;
      if (filtroResponsavel && p.responsavelId !== filtroResponsavel) return false;
      if (filtroDe && p.data < filtroDe) return false;
      if (filtroAte && p.data > filtroAte) return false;
      return true;
    });
  }, [todas, filtroStatus, filtroPrioridade, filtroColaborador, filtroResponsavel, filtroDe, filtroAte, nomePorId]);

  const abertas = useMemo(() => ordenarPendencias(filtradas.filter((p) => !estadoResolvido(p.status))), [filtradas]);
  const resolvidas = useMemo(() => ordenarPendencias(filtradas.filter((p) => estadoResolvido(p.status))), [filtradas]);

  /* Vencidas (Fase 2, Etapa 7) — sobre a lista COMPLETA (não filtrada), mesmo princípio dos outros
   * cards de resumo: número estável enquanto o usuário ajusta o filtro da fila abaixo. */
  const vencidas = useMemo(
    () => todas.filter((p) => calcularEstadoSla(p, workspace.rules.alertaAntecedenciaDias) === 'vencido').length,
    [todas, workspace.rules.alertaAntecedenciaDias],
  );

  /* Resolvidas que ainda não passaram por aprovação/reprovação — o gargalo mais fácil de esquecer,
   * porque elas somem da fila aberta mas o ciclo ainda não fechou. */
  const aguardandoRevisao = useMemo(() => todas.filter((p) => p.status === 'justificado').length, [todas]);

  function abrirNaFila(p: Pendencia) {
    navigate(`/pendencias?abrir=${encodeURIComponent(p.id)}`);
  }

  async function mudarPrioridadeInline(p: Pendencia, prioridade: Prioridade) {
    if (prioridade === p.prioridade) return;
    const ok = await gravacao.executar(() =>
      gravar((repo, ctx) => repo.salvarPendencia(ctx.empresaId, atualizarPrioridade(p, prioridade))),
    );
    if (ok === null) return;
    /* No modo conectado a trilha confiável já foi escrita pelo servidor, com o autor da sessão. */
    if (modo === 'local') registrarAuditoria({
      usuario: usuarioAtual,
      entidade: `Pendência ${p.id}`,
      acao: 'Atualização de prioridade (Centro de Ações)',
      valorAnterior: PRIORIDADE_LABEL[p.prioridade],
      valorNovo: PRIORIDADE_LABEL[prioridade],
      motivo: 'Ajuste manual de prioridade.',
    });
  }

  /* Uma única definição de linha para as duas tabelas (aberta e resolvida) — por isso as duas usam
   * exatamente o mesmo cabeçalho, definido em COLUNAS_FILA. */
  function linha(p: Pendencia) {
    const nome = nomePorId.get(p.id);
    const item = itemPorId.get(p.id);
    const recomendacao = item ? recomendarPrioridade(p, item, dias, workspace.rules.recurrenceLimit) : null;
    const responsavel = workspace.users.find((u) => u.id === p.responsavelId)?.nome;
    const estadoSla = calcularEstadoSla(p, workspace.rules.alertaAntecedenciaDias);
    return (
      <tr key={p.id}>
        <td>
          <select
            className="select"
            style={{ minWidth: 110 }}
            value={p.prioridade}
            onChange={(e) => void mudarPrioridadeInline(p, e.target.value as Prioridade)}
          >
            {PRIORIDADES.map((pr) => (
              <option key={pr} value={pr}>{PRIORIDADE_LABEL[pr]}</option>
            ))}
          </select>
          {recomendacao && recomendacao.prioridade !== p.prioridade && (
            <div className="text-faint" style={{ fontSize: 11, marginTop: 3 }} title={recomendacao.motivo}>
              Sistema sugere: {PRIORIDADE_LABEL[recomendacao.prioridade]}
            </div>
          )}
        </td>
        <td>
          <StatusPendenciaBadge status={p.status} />
          <div className="text-faint" style={{ fontSize: 11, marginTop: 3 }}>
            {situacaoRevisao(p)}
          </div>
        </td>
        <td>
          <EstadoSlaBadge estado={estadoSla} />
          {p.prazo && (
            <div className="text-faint mono" style={{ fontSize: 11, marginTop: 3 }}>
              {dkToLabel(p.prazo)}
            </div>
          )}
        </td>
        <td className="mono">{dkToLabel(p.data)}</td>
        <td>{nome ?? <span className="text-faint">Não identificado</span>}</td>
        <td className="cell-muted">{responsavel ?? <span className="text-faint">Não atribuído</span>}</td>
        <td className="cell-muted" style={{ maxWidth: 230 }}>
          <div>{p.categoria}</div>
          {p.descricao && (
            <div className="text-faint" style={{ fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>
              {p.descricao}
            </div>
          )}
        </td>
        <td className="cell-muted" style={{ maxWidth: 240, fontSize: 12, lineHeight: 1.45 }}>
          {acaoNecessaria(p)}
        </td>
        <td>
          <button className="btn btn-sm" onClick={() => abrirNaFila(p)}>
            Abrir <ArrowUpRight size={13} />
          </button>
        </td>
      </tr>
    );
  }

  const cabecalhoFila = (
    <thead>
      <tr>
        <th>Prioridade</th>
        <th>Situação</th>
        <th>Prazo</th>
        <th>Data</th>
        <th>Colaborador</th>
        <th>Responsável</th>
        <th>Motivo</th>
        <th>Ação necessária</th>
        <th />
      </tr>
    </thead>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Centro de Ações</h1>
          <p className="page-subtitle">O que precisa da sua atenção agora — ordenado por prioridade e, em empate, pelo caso mais antigo</p>
        </div>
        {feedback}
      </div>

      {/* Os cards são sempre sobre a empresa inteira, não sobre o filtro da fila abaixo: eles
          respondem "como está a operação", enquanto os filtros servem para trabalhar um recorte. */}
      <div className="kpi-grid section-gap">
        <div className="kpi-card">
          <div className="kpi-label">Abertas</div>
          <div className="kpi-value">{resumo.abertas}</div>
          <div className="kpi-foot">aguardando decisão</div>
        </div>
        <div className={`kpi-card${resumo.criticas ? ' accent-red' : ''}`}>
          <div className="kpi-label">Críticas</div>
          <div className="kpi-value">{resumo.criticas}</div>
          <div className="kpi-foot">prioridade crítica, em aberto</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Alta prioridade</div>
          <div className="kpi-value">{resumo.altaPrioridade}</div>
          <div className="kpi-foot">prioridade alta, em aberto</div>
        </div>
        <div className={`kpi-card${vencidas ? ' accent-red' : ''}`}>
          <div className="kpi-label">Prazo vencido</div>
          <div className="kpi-value">{vencidas}</div>
          <div className="kpi-foot">prazo passou e segue aberta</div>
        </div>
        <div className={`kpi-card${aguardandoRevisao ? ' accent-orange' : ''}`}>
          <div className="kpi-label">Aguardando revisão</div>
          <div className="kpi-value">{aguardandoRevisao}</div>
          <div className="kpi-foot">resolvidas, sem aprovação</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Resolvidas</div>
          <div className="kpi-value">{resumo.resolvidas}</div>
          <div className="kpi-foot">total já tratado</div>
        </div>
      </div>

      <div className="card card-pad section-gap">
        <div className="card-title">Filtros</div>
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
          <select className="select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as StatusPendencia | '')}>
            <option value="">Status: todos</option>
            {STATUS_FILTRAVEIS.map((s) => (
              <option key={s} value={s}>{STATUS_PENDENCIA_LABEL[s]}</option>
            ))}
          </select>
          <select className="select" value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value as Prioridade | '')}>
            <option value="">Prioridade: todas</option>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>
            ))}
          </select>
          <select className="select" value={filtroColaborador} onChange={(e) => setFiltroColaborador(e.target.value)} disabled={colaboradoresDisponiveis.length === 0}>
            <option value="">Colaborador: todos</option>
            {colaboradoresDisponiveis.map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>
          <select className="select" value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} disabled={workspace.users.length === 0}>
            <option value="">Responsável: todos</option>
            {workspace.users.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-muted)' }}>
            de
            <input type="date" className="input" value={filtroDe} onChange={(e) => setFiltroDe(e.target.value)} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-muted)' }}>
            até
            <input type="date" className="input" value={filtroAte} onChange={(e) => setFiltroAte(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="card card-pad section-gap">
        <div className="card-title">
          Fila aberta
          <span className="text-faint" style={{ fontSize: 12.5, fontWeight: 400 }}>{abertas.length} caso(s)</span>
        </div>
        {/* Três estados distintos, de propósito: nada analisado ainda / analisado e sem problemas /
            existe caso mas o filtro escondeu. Colapsar os três num "0" faria uma empresa vazia
            parecer uma operação impecável. */}
        {abertas.length === 0 ? (
          dias.length === 0 ? (
            <AmbienteSemDados
              titulo="Nenhuma jornada foi analisada ainda"
              descricao="A fila de trabalho é montada a partir das ocorrências detectadas. Processe o primeiro dia para que os casos apareçam aqui."
            />
          ) : (
            <div className="empty-state">
              <Sparkles size={26} />
              <div style={{ fontWeight: 600, marginTop: 8 }}>
                {todas.length === 0 ? 'Operação sem pendências no período' : 'Nada em aberto com estes filtros'}
              </div>
              <div style={{ marginTop: 4 }}>
                {todas.length === 0
                  ? `${dias.length} dia(s) analisado(s) e nenhuma jornada ficou fora do padrão configurado.`
                  : 'Ajuste os filtros acima para ver outros casos, ou marque "Resolvidas" para ver o que já foi tratado.'}
              </div>
            </div>
          )
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              {cabecalhoFila}
              <tbody>{abertas.map(linha)}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-pad section-gap">
        <div className="card-title">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={mostrarResolvidas} onChange={(e) => setMostrarResolvidas(e.target.checked)} />
            Resolvidas
          </label>
          <span className="text-faint" style={{ fontSize: 12.5, fontWeight: 400 }}>{resolvidas.length} caso(s)</span>
        </div>
        {mostrarResolvidas && (
          resolvidas.length === 0 ? (
            <div className="empty-state">
              <Sparkles size={26} />
              <div>Nenhum caso resolvido com esse filtro ainda.</div>
            </div>
          ) : (
            <div className="table-wrap" style={{ opacity: 0.8 }}>
              <table className="data-table">
                {cabecalhoFila}
                <tbody>{resolvidas.map(linha)}</tbody>
              </table>
            </div>
          )
        )}
      </div>
    </>
  );
}
