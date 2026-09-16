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
  const {
    auditItems,
    activeDate,
    setActiveDate,
    availableDates,
    stats,
    resolveAuditItem,
    syncWithApis,
    loadRealSystemData,
    isProcessing,
  } = useAuditData();

  const [search, setSearch] = useState('');
  const [filterSetor, setFilterSetor] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Estados de Sincronização de APIs
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');
  const [syncFeedback, setSyncFeedback] = useState<{ ok: boolean; title: string; details: string } | null>(null);
  const [syncStartDate, setSyncStartDate] = useState(activeDate);
  const [syncEndDate, setSyncEndDate] = useState(activeDate);
  const [icarusToken, setIcarusToken] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('icarus_api_token') || '' : '');
  const [cobliApiKey, setCobliApiKey] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('cobli_api_key') || '' : '');
  const [loadingRealData, setLoadingRealData] = useState(false);
  const [realDataToast, setRealDataToast] = useState<string | null>(null);

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

  const handleTriggerApiSync = async () => {
    setSyncing(true);
    setSyncFeedback(null);
    setSyncStep('Iniciando conexão com as APIs...');

    try {
      setSyncStep('Conectando ao Ponto Icarus e buscando batidas de ponto...');
      await new Promise(r => setTimeout(r, 600));

      setSyncStep('Conectando à Cobli e obtendo trajetos e telemetria...');
      await new Promise(r => setTimeout(r, 600));

      setSyncStep('Auditando e cruzando no AuditEngine com regras CLT e de jornada...');

      const result = await syncWithApis({
        startDate: syncStartDate,
        endDate: syncEndDate,
        icarusToken: icarusToken.trim() || undefined,
        cobliApiKey: cobliApiKey.trim() || undefined,
      });

      if (result.success) {
        setSyncFeedback({
          ok: true,
          title: 'Sincronização de APIs concluída com sucesso!',
          details: `Checklist atualizado com os colaboradores auditados no período ${syncStartDate}.`,
        });
      } else {
        setSyncFeedback({
          ok: false,
          title: 'Sincronização concluída com avisos',
          details: result.message || 'Verifique as credenciais da Cobli e do Ponto Icarus.',
        });
      }
    } catch (err: unknown) {
      setSyncFeedback({
        ok: false,
        title: 'Erro de comunicação',
        details: (err as Error).message,
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleLoadRealData = async (targetDate?: string) => {
    setLoadingRealData(true);
    setRealDataToast(null);
    try {
      const res = await loadRealSystemData(targetDate);
      if (res.success) {
        setRealDataToast('Base de dados real carregada e calculada com sucesso!');
        setTimeout(() => setRealDataToast(null), 3500);
      } else {
        setRealDataToast(res.message || 'Falha ao carregar dados.');
      }
    } finally {
      setLoadingRealData(false);
    }
  };

  const resolutionRate = auditItems.length > 0
    ? Math.round((stats.motoristasResolvidos / auditItems.length) * 100)
    : 0;

  const metaDiariaMin = config.metaDiariaHEMin || 2170; // 36h10

  // Navegação ergonômica de datas
  const sortedAvailableDates = useMemo(() => {
    if (!availableDates) return [];
    return [...availableDates].sort();
  }, [availableDates]);

  const currentIndex = sortedAvailableDates.indexOf(activeDate);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < sortedAvailableDates.length - 1;

  const handlePrevDate = () => {
    if (hasPrevious) {
      const prev = sortedAvailableDates[currentIndex - 1];
      setActiveDate(prev);
      handleLoadRealData(prev);
    }
  };

  const handleNextDate = () => {
    if (hasNext) {
      const next = sortedAvailableDates[currentIndex + 1];
      setActiveDate(next);
      handleLoadRealData(next);
    }
  };

  const handleFirstDate = () => {
    if (sortedAvailableDates.length > 0) {
      const first = sortedAvailableDates[0];
      setActiveDate(first);
      handleLoadRealData(first);
    }
  };

  const handleLastDate = () => {
    if (sortedAvailableDates.length > 0) {
      const last = sortedAvailableDates[sortedAvailableDates.length - 1];
      setActiveDate(last);
      handleLoadRealData(last);
    }
  };

  const formatDateDisplay = (isoDate: string) => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-').map(Number);
    if (!year || !month || !day) return isoDate;
    const d = new Date(year, month - 1, day);
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dayName = weekDays[d.getDay()];
    const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    return `${formatted} (${dayName})`;
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Toast de Confirmação */}
      {realDataToast && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{realDataToast}</span>
          </div>
          <button onClick={() => setRealDataToast(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

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
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Sincronizar APIs */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSyncFeedback(null);
              setSyncModalOpen(true);
            }}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-md shadow-cyan-500/20"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sincronizar APIs (Icarus & Cobli)
            </span>
          </Button>

          {/* Botão Carregar Dados Reais */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleLoadRealData()}
            disabled={loadingRealData}
          >
            {loadingRealData ? 'Carregando...' : '📂 Base Real (Setembro)'}
          </Button>

          <Link href="/importacao">
            <Button variant="secondary" size="sm">
              📥 Importar
            </Button>
          </Link>
          <Link href="/relatorios">
            <Button variant="secondary" size="sm">
              📊 Analytics
            </Button>
          </Link>
        </div>
      </div>

      {/* Barra de Status das Conexões de API e Seletor de Datas */}
      <Card className="p-3.5 bg-slate-900/90 border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400 font-medium">Status de Integração:</span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium border ${
            cobliApiKey
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              : 'bg-white/5 border-white/10 text-slate-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cobliApiKey ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
            Cobli: {cobliApiKey ? 'Conectada' : 'Chave Pendente'}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium border ${
            icarusToken
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              : 'bg-white/5 border-white/10 text-slate-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${icarusToken ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
            Ponto Icarus: {icarusToken ? 'Conectado' : 'Token Pendente'}
          </span>
        </div>

        {/* Seletor Ergonômico de Datas Auditadas */}
        {sortedAvailableDates.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto bg-white/[0.04] p-1.5 rounded-xl border border-white/10">
            {/* Botão Primeiro / Início */}
            <button
              onClick={handleFirstDate}
              disabled={currentIndex <= 0}
              className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title={`Ir para o início do ciclo (${sortedAvailableDates[0]})`}
            >
              ⏮ Início
            </button>

            {/* Botão Anterior */}
            <button
              onClick={handlePrevDate}
              disabled={!hasPrevious}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Dia anterior"
            >
              ◀ Ant.
            </button>

            {/* Display e Picker Nativo de Calendário */}
            <div className="relative flex items-center gap-2 px-3 py-1 bg-slate-900/90 rounded-lg border border-cyan-500/30 text-cyan-300 font-medium text-xs shadow-inner cursor-pointer hover:border-cyan-500/60 transition-colors">
              <span className="text-xs">📅</span>
              <span className="font-semibold whitespace-nowrap">{formatDateDisplay(activeDate)}</span>
              <span className="text-[10px] text-cyan-500/70">▾</span>

              {/* Input nativo invisível sobreposto que abre o datepicker do navegador */}
              <input
                type="date"
                value={activeDate}
                min={sortedAvailableDates[0]}
                max={sortedAvailableDates[sortedAvailableDates.length - 1]}
                onChange={e => {
                  const val = e.target.value;
                  if (val) {
                    setActiveDate(val);
                    handleLoadRealData(val);
                  }
                }}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                title="Clique para escolher no calendário"
              />
            </div>

            {/* Botão Próximo */}
            <button
              onClick={handleNextDate}
              disabled={!hasNext}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Próximo dia"
            >
              Próx. ▶
            </button>

            {/* Botão Último / Mais Recente */}
            <button
              onClick={handleLastDate}
              disabled={currentIndex === sortedAvailableDates.length - 1}
              className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title={`Ir para o dia mais recente (${sortedAvailableDates[sortedAvailableDates.length - 1]})`}
            >
              Último ⏭
            </button>
          </div>
        )}
      </Card>

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

      {/* Modal de Sincronização Contínua de APIs (Icarus & Cobli) */}
      {syncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                  Sincronização Contínua — Icarus & Cobli
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Conexão direta aos serviços REST, cálculo no AuditEngine e atualização do checklist
                </p>
              </div>
              <button
                onClick={() => setSyncModalOpen(false)}
                disabled={syncing}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Seleção do Período */}
              <div className="space-y-2">
                <span className="font-semibold text-slate-300 block">Período de Extração:</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Data Início</label>
                    <input
                      type="date"
                      value={syncStartDate}
                      onChange={e => setSyncStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Data Fim</label>
                    <input
                      type="date"
                      value={syncEndDate}
                      onChange={e => setSyncEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Chaves Rápidas de Acesso às APIs */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">Credenciais das APIs</span>
                  <Link href="/configuracoes" className="text-[11px] text-cyan-400 hover:underline">
                    Gerenciar em Configurações →
                  </Link>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Token Ponto Icarus:</label>
                  <input
                    type="password"
                    value={icarusToken}
                    onChange={e => setIcarusToken(e.target.value)}
                    placeholder="Cole seu Bearer Token do Icarus..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">API Key Cobli (Telemetria):</label>
                  <input
                    type="password"
                    value={cobliApiKey}
                    onChange={e => setCobliApiKey(e.target.value)}
                    placeholder="Cole sua API Key Cobli..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Feedback e Progresso em Tempo Real */}
              {syncing && (
                <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <svg className="animate-spin h-4 w-4 text-cyan-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Executando Pipeline de Sincronização</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono">{syncStep}</p>
                </div>
              )}

              {syncFeedback && (
                <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                  syncFeedback.ok
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                }`}>
                  <p className="font-semibold">{syncFeedback.title}</p>
                  <p className="text-[11px] text-slate-300">{syncFeedback.details}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-white/10 bg-slate-900/50 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSyncModalOpen(false)}
                disabled={syncing}
              >
                Fechar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleTriggerApiSync}
                disabled={syncing}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
              >
                {syncing ? 'Sincronizando...' : 'Iniciar Sincronização'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
