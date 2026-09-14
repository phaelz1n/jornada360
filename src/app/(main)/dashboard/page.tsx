'use client';

// ============================================================
// Dashboard — Checklist Operacional de Jornada (Fase 4)
// ============================================================

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useAuditData } from '@/components/providers/AuditDataProvider';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';
import { minutesToHHMM, hhmmToMinutes } from '@/lib/utils/time';
import type { AuditItem } from '@/types/audit';

export default function DashboardPage() {
  const { config } = useWorkspace();
  const { auditItems, activeDate, stats, resolveAuditItem } = useAuditData();

  const [search, setSearch] = useState('');
  const [filterSetor, setFilterSetor] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form states for active expanded item
  const [editSetor, setEditSetor] = useState('');
  const [editCausa, setEditCausa] = useState('');
  const [editJustificativa, setEditJustificativa] = useState('');
  const [editHECorrigida, setEditHECorrigida] = useState('');
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null);

  // Sectors list
  const setoresDisponiveis = useMemo(() => {
    const s = new Set<string>();
    s.add('Operações');
    s.add('Logística');
    s.add('Tráfego');
    s.add('Manutenção');
    s.add('Recursos Humanos');
    auditItems.forEach(i => {
      if (i.setor) s.add(i.setor);
    });
    return Array.from(s);
  }, [auditItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return auditItems.filter(item => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = item.motorista.toLowerCase().includes(q);
        const matchesMat = item.matricula?.toLowerCase().includes(q);
        const matchesCpf = item.cpf?.includes(q);
        if (!matchesName && !matchesMat && !matchesCpf) return false;
      }

      if (filterSetor !== 'todos' && item.setor !== filterSetor) {
        return false;
      }

      if (filterStatus === 'pendentes' && item.resolvido) return false;
      if (filterStatus === 'resolvidos' && !item.resolvido) return false;
      if (filterStatus === 'acima_padrao' && item.excedenteClassificacao !== 'acima_padrao') return false;
      if (filterStatus === 'interjornada' && (!item.interjornadaDeficit || item.interjornadaDeficit <= 0)) return false;
      if (filterStatus === 'divergencia' && !item.batidasConciliadas.some(b => b.status === 'divergencia_forte')) return false;

      return true;
    });
  }, [auditItems, search, filterSetor, filterStatus]);

  const handleExpand = (item: AuditItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
    } else {
      setExpandedId(item.id);
      setEditSetor(item.setor || 'Operações');
      setEditCausa(item.causaProvavel || item.causaSugerida || 'Jornada Regular Homologada');
      setEditJustificativa(item.justificativa || '');
      setEditHECorrigida(item.heCorrigidaMin !== undefined ? minutesToHHMM(item.heCorrigidaMin) : minutesToHHMM(item.heEfetivaMin));
      setSaveSuccessId(null);
    }
  };

  const handleSaveResolution = async (id: string) => {
    const minCorrigido = editHECorrigida ? hhmmToMinutes(editHECorrigida) : undefined;
    await resolveAuditItem(id, editSetor, editCausa, editJustificativa, minCorrigido);
    setSaveSuccessId(id);
    setTimeout(() => setSaveSuccessId(null), 3000);
  };

  const resolutionRate = auditItems.length > 0
    ? Math.round((stats.motoristasResolvidos / auditItems.length) * 100)
    : 0;

  const metaDiariaMin = config.metaDiariaHEMin || 2170; // 36h10

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Checklist Operacional do Dia</h1>
            <Badge variant="cyan" dot>Data ativa: {activeDate}</Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Conferência diária, conciliação Ponto × Cobli e resolução colaborativa com gestores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/importacao">
            <Button variant="secondary" size="sm">
              📥 Importar Arquivos
            </Button>
          </Link>
          <Link href="/relatorios">
            <Button variant="primary" size="sm">
              📊 Ver Analytics
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="p-4 border-white/5 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-2xl">⏱️</span>
            <Badge variant="cyan">Total</Badge>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mt-2">HE Total Realizada</p>
          <p className="text-xl font-bold text-white mt-0.5">{minutesToHHMM(stats.totalHEMin)}</p>
          <p className="text-[11px] text-slate-500 mt-1">{(stats.totalHEMin / 60).toFixed(1)} horas totais</p>
        </Card>

        <Card className="p-4 border-white/5 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-2xl">🎯</span>
            <Badge variant="warning">Meta</Badge>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mt-2">Excedente vs Meta</p>
          <p className="text-xl font-bold text-amber-400 mt-0.5">{minutesToHHMM(stats.totalExcedenteMin)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Meta dia: {minutesToHHMM(metaDiariaMin)}</p>
        </Card>

        <Card className="p-4 border-white/5 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-2xl">✅</span>
            <Badge variant="success">Padrão</Badge>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mt-2">Dentro do Padrão</p>
          <p className="text-xl font-bold text-emerald-400 mt-0.5">{minutesToHHMM(stats.totalDentroPadraoMin)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Homologado e tolerado</p>
        </Card>

        <Card className="p-4 border-white/5 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-2xl">⚠️</span>
            <Badge variant="error">Desvio</Badge>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mt-2">Acima do Padrão</p>
          <p className="text-xl font-bold text-red-400 mt-0.5">{minutesToHHMM(stats.totalAcimaPadraoMin)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Necessita apuração</p>
        </Card>

        <Card className="p-4 border-white/5 bg-slate-900/60 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-2xl">📋</span>
            <Badge variant="neutral">{auditItems.length}</Badge>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mt-2">Pendências de Ação</p>
          <p className="text-xl font-bold text-white mt-0.5">{stats.motoristasPendentes} abertas</p>
          <p className="text-[11px] text-cyan-400 mt-1">{stats.motoristasResolvidos} resolvidas</p>
        </Card>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Progress & Quick Filters */}
        <div className="space-y-4 lg:col-span-1">
          {/* Resolution Ring */}
          <Card className="p-5 flex flex-col items-center justify-center text-center">
            <ProgressRing value={resolutionRate} size={110} strokeWidth={8} />
            <p className="text-sm font-semibold text-white mt-3">Taxa de Resolução</p>
            <p className="text-xs text-slate-400 mt-1">
              {stats.motoristasResolvidos} de {auditItems.length} motoristas concluídos
            </p>
          </Card>

          {/* Filters Card */}
          <Card className="p-4 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filtros Rápidos</h2>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Buscar Motorista</label>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Nome, CPF ou matrícula..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Setor</label>
              <select
                value={filterSetor}
                onChange={e => setFilterSetor(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800/80 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="todos">Todos os setores</option>
                {setoresDisponiveis.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800/80 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="todos">Todos os status</option>
                <option value="pendentes">Pendentes de Ação</option>
                <option value="resolvidos">Resolvidos</option>
                <option value="acima_padrao">Acima do Padrão</option>
                <option value="interjornada">Déficit de Interjornada (&lt; 11h)</option>
                <option value="divergencia">Divergência Cobli Severa</option>
              </select>
            </div>
          </Card>
        </div>

        {/* Right Area: Driver Cards List */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-300">
              Colaboradores em Análise ({filteredItems.length})
            </h2>
            {auditItems.length === 0 && (
              <span className="text-xs text-slate-500">Nenhum dado importado</span>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <Card className="py-12 text-center">
              <p className="text-sm text-slate-400">Nenhum colaborador encontrado com os filtros selecionados.</p>
            </Card>
          ) : (
            filteredItems.map(item => {
              const isExpanded = expandedId === item.id;
              const hasInterDeficit = item.interjornadaDeficit && item.interjornadaDeficit > 0;
              const hasDivergence = item.batidasConciliadas.some(b => b.status === 'divergencia_forte');

              return (
                <Card
                  key={item.id}
                  className={`border transition-all duration-200 ${
                    item.resolvido
                      ? 'border-emerald-500/20 bg-emerald-950/10'
                      : isExpanded
                      ? 'border-cyan-500/40 bg-slate-900/90 shadow-xl'
                      : 'border-white/10 hover:border-cyan-500/30 bg-slate-900/60'
                  }`}
                >
                  {/* Card Header Row */}
                  <div
                    onClick={() => handleExpand(item)}
                    className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        item.resolvido
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-cyan-500/15 text-cyan-400'
                      }`}>
                        {item.motorista.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white">{item.motorista}</h3>
                          {item.matricula && (
                            <span className="text-[11px] text-slate-500 font-mono">RE {item.matricula}</span>
                          )}
                          {item.resolvido ? (
                            <Badge variant="success">Resolvido</Badge>
                          ) : (
                            <Badge variant="warning">Pendente</Badge>
                          )}
                          {item.setor && (
                            <Badge variant="neutral">{item.setor}</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          <span>HE Efetiva: <strong className="text-white">{minutesToHHMM(item.heEfetivaMin)}</strong></span>
                          <span>Prevista: <strong className="text-slate-300">{minutesToHHMM(item.hePrevistaMin)}</strong></span>
                          {item.excedenteMin > 0 ? (
                            <span className="text-red-400 font-semibold">Excedente: +{minutesToHHMM(item.excedenteMin)}</span>
                          ) : (
                            <span className="text-emerald-400">Dentro do Padrão</span>
                          )}
                          {hasInterDeficit && (
                            <span className="text-red-400 font-bold">⚠️ Interjornada -{minutesToHHMM(item.interjornadaDeficit!)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                      {hasDivergence && (
                        <Badge variant="error" dot>Divergência Cobli</Badge>
                      )}
                      <button
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                      >
                        {isExpanded ? 'Recolher ▲' : 'Detalhes & Resolução ▼'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details & Form */}
                  {isExpanded && (
                    <div className="border-t border-white/10 p-5 space-y-5 bg-slate-950/40 rounded-b-2xl animate-fade-in">
                      {/* Timeline: Batidas Ponto vs Cobli */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                          Conciliação Ponto × Telemetria Cobli
                        </h4>

                        <div className="space-y-2">
                          {item.batidasConciliadas.map((bc, idx) => {
                            let statusBadge = <Badge variant="success">Confirmado (≤15m)</Badge>;
                            if (bc.status === 'divergencia_leve') statusBadge = <Badge variant="warning">Div. Leve (16-60m)</Badge>;
                            if (bc.status === 'divergencia_forte') statusBadge = <Badge variant="error">Div. Forte (&gt;60m)</Badge>;
                            if (bc.status === 'sem_cobertura') statusBadge = <Badge variant="neutral">Sem Sinal</Badge>;

                            return (
                              <div
                                key={idx}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                    bc.batida.type === 'entrada' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                  }`}>
                                    {bc.batida.type.toUpperCase()}
                                  </span>
                                  <span className="text-slate-300 font-mono text-sm font-semibold">
                                    {bc.batida.rawString}
                                  </span>
                                  <span className="text-slate-500">→</span>
                                  <span className="text-slate-400">
                                    Cobli: {bc.eventoRastreio
                                      ? (bc.batida.type === 'entrada'
                                          ? bc.eventoRastreio.partida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                          : bc.eventoRastreio.parada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
                                      : 'Nenhum sinal no intervalo'}
                                  </span>
                                  {bc.eventoRastreio?.placa && (
                                    <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
                                      Placa: {bc.eventoRastreio.placa}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3">
                                  {bc.diferencaMin !== 999 && (
                                    <span className="text-slate-400 font-mono">Δ {bc.diferencaMin} min</span>
                                  )}
                                  {statusBadge}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Interjornada Alert */}
                      {hasInterDeficit && (
                        <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 flex items-center gap-3 text-xs text-red-200">
                          <span className="text-xl">⚠️</span>
                          <div>
                            <p className="font-semibold text-red-300">Infração CLT Art. 66 — Interjornada Não Cumprida</p>
                            <p className="text-red-400/90 mt-0.5">
                              Descanso entre a última saída de ontem e a primeira entrada de hoje foi de{' '}
                              <strong>{minutesToHHMM(item.interjornadaMin!)}</strong> (mínimo legal: 11h00 = 660 min). Déficit de{' '}
                              <strong>{minutesToHHMM(item.interjornadaDeficit!)}</strong>.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Inline Resolution Form */}
                      <div className="p-4 rounded-xl border border-white/10 bg-slate-900/80 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                            Resolução Operacional & Justificativa
                          </h4>
                          {saveSuccessId === item.id && (
                            <Badge variant="success">Resolução salva com sucesso!</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">Setor Responsável</label>
                            <input
                              type="text"
                              value={editSetor}
                              onChange={e => setEditSetor(e.target.value)}
                              placeholder="Ex: Operações, Logística..."
                              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">Causa Provável / Motivo</label>
                            <input
                              type="text"
                              value={editCausa}
                              onChange={e => setEditCausa(e.target.value)}
                              placeholder="Ex: Viagem Longa, Manutenção..."
                              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">HE Corrigida (HH:MM)</label>
                            <input
                              type="text"
                              value={editHECorrigida}
                              onChange={e => setEditHECorrigida(e.target.value)}
                              placeholder="HH:MM"
                              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Justificativa Operacional / Parecer do Gestor</label>
                          <textarea
                            rows={2}
                            value={editJustificativa}
                            onChange={e => setEditJustificativa(e.target.value)}
                            placeholder="Descreva o motivo do excedente ou alinhamento com a equipe..."
                            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:border-cyan-500 resize-none"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setExpandedId(null)}
                          >
                            Fechar
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSaveResolution(item.id)}
                          >
                            💾 Salvar Resolução e Homologar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
