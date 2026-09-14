'use client';

// ============================================================
// Central de Pendências — Gestão de Ações, SLA e Workflow (Fase 4)
// ============================================================

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuditData } from '@/components/providers/AuditDataProvider';
import type { Pendencia, PendenciaStatus, Prioridade } from '@/types/pendencia';

export default function PendenciasPage() {
  const { pendencias, updatePendenciaStatus, resolverPendencia } = useAuditData();

  const [activeTab, setActiveTab] = useState<'todas' | 'abertas' | 'resolvidas'>('abertas');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterPrioridade, setFilterPrioridade] = useState<string>('todos');
  const [search, setSearch] = useState('');

  // Selected pendência for action
  const [selectedPendencia, setSelectedPendencia] = useState<Pendencia | null>(null);
  const [novoStatus, setNovoStatus] = useState<PendenciaStatus>('em_analise');
  const [observacaoStatus, setObservacaoStatus] = useState('');
  const [resolucaoTexto, setResolucaoTexto] = useState('');

  const filtered = useMemo(() => {
    return pendencias.filter(p => {
      // Tab filter
      if (activeTab === 'abertas' && (p.status === 'resolvida' || p.status === 'descartada')) return false;
      if (activeTab === 'resolvidas' && p.status !== 'resolvida') return false;

      // Type filter
      if (filterTipo !== 'todos' && p.tipo !== filterTipo) return false;

      // Priority filter
      if (filterPrioridade !== 'todos' && p.prioridade !== filterPrioridade) return false;

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesMotorista = p.motorista.toLowerCase().includes(q);
        const matchesDesc = p.descricao.toLowerCase().includes(q);
        if (!matchesMotorista && !matchesDesc) return false;
      }

      return true;
    });
  }, [pendencias, activeTab, filterTipo, filterPrioridade, search]);

  const handleOpenAction = (p: Pendencia) => {
    setSelectedPendencia(p);
    setNovoStatus(p.status);
    setObservacaoStatus('');
    setResolucaoTexto(p.resolucao || '');
  };

  const handleUpdateStatus = async () => {
    if (!selectedPendencia) return;
    await updatePendenciaStatus(selectedPendencia.id, novoStatus, 'Gestor Operacional', observacaoStatus);
    setSelectedPendencia(null);
  };

  const handleResolve = async () => {
    if (!selectedPendencia || !resolucaoTexto.trim()) return;
    await resolverPendencia(selectedPendencia.id, resolucaoTexto, 'Gestor Operacional');
    setSelectedPendencia(null);
  };

  const getPriorityBadge = (p: Prioridade) => {
    switch (p) {
      case 'critica':
        return <Badge variant="error">Crítica</Badge>;
      case 'alta':
        return <Badge variant="warning">Alta</Badge>;
      case 'media':
        return <Badge variant="info">Média</Badge>;
      case 'baixa':
      default:
        return <Badge variant="neutral">Baixa</Badge>;
    }
  };

  const getStatusBadge = (s: PendenciaStatus) => {
    switch (s) {
      case 'nova':
        return <Badge variant="cyan">Nova</Badge>;
      case 'em_analise':
        return <Badge variant="info">Em Análise</Badge>;
      case 'aguardando_gestor':
        return <Badge variant="warning">Aguardando Gestor</Badge>;
      case 'aguardando_rh':
        return <Badge variant="warning">Aguardando RH</Badge>;
      case 'resolvida':
        return <Badge variant="success">Resolvida</Badge>;
      case 'descartada':
        return <Badge variant="neutral">Descartada</Badge>;
    }
  };

  const abertasCount = pendencias.filter(p => p.status !== 'resolvida' && p.status !== 'descartada').length;
  const resolvidasCount = pendencias.filter(p => p.status === 'resolvida').length;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Central de Pendências</h1>
            <Badge variant="cyan" dot>{abertasCount} em aberto</Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Gestão de não-conformidades, SLA de apuração e fluxo de aprovação com gestores e RH
          </p>
        </div>
      </div>

      {/* Tabs and Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab('abertas')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'abertas'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Abertas ({abertasCount})
          </button>
          <button
            onClick={() => setActiveTab('resolvidas')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'resolvidas'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Resolvidas ({resolvidasCount})
          </button>
          <button
            onClick={() => setActiveTab('todas')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'todas'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todas ({pendencias.length})
          </button>
        </div>

        {/* Quick Search & Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por motorista ou texto..."
            className="px-3 py-2 text-xs rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-full sm:w-60"
          />

          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-900/80 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="todos">Todos os tipos</option>
            <option value="excedente">Excedente de HE</option>
            <option value="interjornada">Déficit Interjornada</option>
            <option value="divergencia">Divergência Cobli</option>
          </select>

          <select
            value={filterPrioridade}
            onChange={e => setFilterPrioridade(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-900/80 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="todos">Todas as prioridades</option>
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      </div>

      {/* Pendencias List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3 text-slate-500">
              ✓
            </div>
            <p className="text-sm text-slate-300 font-medium">Nenhuma pendência encontrada</p>
            <p className="text-xs text-slate-500 mt-1">
              Todas as não-conformidades desta visualização foram tratadas ou não existem filtros correspondentes.
            </p>
          </Card>
        ) : (
          filtered.map(item => (
            <Card
              key={item.id}
              className={`p-4 border transition-all duration-200 ${
                item.status === 'resolvida'
                  ? 'border-emerald-500/20 bg-emerald-950/5'
                  : item.prioridade === 'critica'
                  ? 'border-red-500/30 bg-red-950/10'
                  : 'border-white/10 hover:border-cyan-500/30 bg-slate-900/60'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-bold text-white">{item.motorista}</span>
                    <span className="text-xs text-slate-400 font-mono">📅 {item.data}</span>
                    {getPriorityBadge(item.prioridade)}
                    {getStatusBadge(item.status)}
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                      {item.tipo}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2">{item.descricao}</p>

                  {item.resolucao && (
                    <div className="mt-2 text-xs bg-emerald-950/30 border border-emerald-500/20 p-2.5 rounded-lg text-emerald-300">
                      <strong>Resolução registrada:</strong> {item.resolucao}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenAction(item)}
                  >
                    Gerenciar Ação →
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal de Gestão de Pendência */}
      <Modal
        isOpen={!!selectedPendencia}
        onClose={() => setSelectedPendencia(null)}
        title={selectedPendencia ? `Pendência: ${selectedPendencia.motorista}` : 'Gestão de Pendência'}
        size="lg"
      >
        {selectedPendencia && (
          <div className="space-y-5">
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Tipo da Não-Conformidade:</span>
                <span className="text-cyan-300 font-semibold uppercase">{selectedPendencia.tipo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Data de Referência:</span>
                <span className="text-white font-mono">{selectedPendencia.data}</span>
              </div>
              <p className="text-slate-300 pt-2 border-t border-white/5">{selectedPendencia.descricao}</p>
            </div>

            {/* Workflow de Status */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                Atualizar Etapa do Fluxo
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['nova', 'em_analise', 'aguardando_gestor', 'aguardando_rh', 'descartada'] as PendenciaStatus[]).map(st => (
                  <button
                    key={st}
                    onClick={() => setNovoStatus(st)}
                    className={`px-3 py-2 text-xs rounded-xl border text-left transition-all ${
                      novoStatus === st
                        ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'border-white/10 bg-slate-800/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    {getStatusBadge(st)}
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <input
                  type="text"
                  value={observacaoStatus}
                  onChange={e => setObservacaoStatus(e.target.value)}
                  placeholder="Adicionar nota/observação da mudança..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="mt-2 flex justify-end">
                <Button variant="secondary" size="sm" onClick={handleUpdateStatus}>
                  Atualizar Status
                </Button>
              </div>
            </div>

            {/* Resolução Direta */}
            <div className="border-t border-white/10 pt-4">
              <label className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 block">
                Conclusão & Resolução Definitiva
              </label>
              <textarea
                rows={3}
                value={resolucaoTexto}
                onChange={e => setResolucaoTexto(e.target.value)}
                placeholder="Descreva o alinhamento realizado, parecer do gestor ou comprovante anexado..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:border-cyan-500 resize-none"
              />
              <div className="mt-3 flex justify-end">
                <Button variant="primary" size="sm" onClick={handleResolve}>
                  ✓ Concluir e Marcar como Resolvida
                </Button>
              </div>
            </div>

            {/* Histórico */}
            {selectedPendencia.historicoStatus && selectedPendencia.historicoStatus.length > 0 && (
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Histórico de Tramitação
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedPendencia.historicoStatus.map((h, i) => (
                    <div key={i} className="text-[11px] text-slate-400 bg-white/[0.02] p-2 rounded-lg flex items-center justify-between">
                      <div>
                        <strong className="text-slate-200">{h.usuario}:</strong> {h.de} → {h.para}
                        {h.observacao && <span className="text-slate-400 italic"> ({h.observacao})</span>}
                      </div>
                      <span className="text-slate-500">
                        {new Date(h.timestamp).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
