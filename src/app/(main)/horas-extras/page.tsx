'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/components/providers/AuthProvider';
import { isDentroDoPadrao, type HoraExtraItem, type HorasExtrasSummary } from '@/lib/horas-extras-utils';

export default function HorasExtrasPage() {
  const { user } = useAuth();

  const [items, setItems] = useState<HoraExtraItem[]>([]);
  const [summary, setSummary] = useState<HorasExtrasSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'TODAS' | 'HE1' | 'HE2' | 'HE3'>('TODAS');
  const [statusFilter, setStatusFilter] = useState<'TODAS' | 'PENDENTES' | 'DENTRO_PADRAO' | 'JUSTIFICADAS' | 'ALERTAS'>('TODAS');
  const [selectedDate, setSelectedDate] = useState('');

  // Paginação
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Modal de Justificativa
  const [modalItem, setModalItem] = useState<HoraExtraItem | null>(null);
  const [justificativaInput, setJustificativaInput] = useState('');
  const [savingJustificativa, setSavingJustificativa] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [sendingIcarus, setSendingIcarus] = useState(false);
  const [icarusMsg, setIcarusMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/horas-extras');
      const data = await res.json();
      if (res.ok && data.success) {
        setItems(data.items);
        setSummary(data.summary);
      } else {
        setError(data.message || 'Falha ao carregar registros de horas extras.');
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtragem dos itens
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (tipoFilter !== 'TODAS' && item.tipo !== tipoFilter) return false;

      if (statusFilter === 'PENDENTES' && (item.temJustificativa || item.dentroDoPadrao)) return false;
      if (statusFilter === 'DENTRO_PADRAO' && !item.dentroDoPadrao) return false;
      if (statusFilter === 'JUSTIFICADAS' && (!item.temJustificativa || item.dentroDoPadrao)) return false;
      if (statusFilter === 'ALERTAS' && !item.possivelProblema) return false;

      if (selectedDate && item.data !== selectedDate) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const matchColab = item.colaborador.toLowerCase().includes(query);
        const matchPonto = item.pontoRegistrado.toLowerCase().includes(query);
        const matchSetor = (item.setorMotivo || '').toLowerCase().includes(query);
        const matchJust = (item.justificativa || '').toLowerCase().includes(query);
        const matchAlt = (item.alteradoPor || '').toLowerCase().includes(query);
        if (!matchColab && !matchPonto && !matchSetor && !matchJust && !matchAlt) {
          return false;
        }
      }

      return true;
    });
  }, [items, tipoFilter, statusFilter, selectedDate, search]);

  // Lista de datas únicas para o filtro
  const uniqueDates = useMemo(() => {
    const dates = Array.from(new Set(items.map(i => i.data).filter(Boolean)));
    return dates.sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Itens paginados
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page]);

  // Abertura do modal
  const handleOpenModal = (item: HoraExtraItem) => {
    setModalItem(item);
    setJustificativaInput(item.justificativa || '');
    setSaveSuccessMsg(null);
    setIcarusMsg(null);
  };

  // Salvar justificativa e registrar usuário
  const handleSaveJustificativa = async () => {
    if (!modalItem) return;
    setSavingJustificativa(true);
    setSaveSuccessMsg(null);

    const currentUserEmail = user?.email || 'Administrador';
    const currentUserUid = user?.uid;

    try {
      const res = await fetch('/api/horas-extras/justificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modalItem.id,
          justificativa: justificativaInput,
          usuario: currentUserEmail,
          usuarioUid: currentUserUid,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccessMsg('Justificativa salva com auditoria!');

        // Atualizar estado local
        setItems(prev =>
          prev.map(it => {
            if (it.id === modalItem.id) {
              const justTrim = justificativaInput.trim();
              const temJust = justTrim.length > 0;
              const dentroPadrao = isDentroDoPadrao(it.setorMotivo, justTrim);
              return {
                ...it,
                justificativa: justTrim,
                temJustificativa: temJust,
                dentroDoPadrao: dentroPadrao,
                possivelProblema: dentroPadrao ? false : !temJust,
                problemaDescricao: dentroPadrao
                  ? 'Dentro do padrão (Programado)'
                  : temJust
                  ? ''
                  : 'Sem justificativa no ponto',
                alteradoPor: currentUserEmail,
                alteradoPorUid: currentUserUid,
                alteradoEm: data.record?.alteradoEm || new Date().toLocaleString(),
                historicoAlteracoes: data.record?.historico,
              };
            }
            return it;
          })
        );

        // Atualizar item no modal
        setModalItem(prev =>
          prev
            ? {
                ...prev,
                justificativa: justificativaInput.trim(),
                alteradoPor: currentUserEmail,
                alteradoEm: data.record?.alteradoEm || new Date().toLocaleString(),
              }
            : null
        );

        setTimeout(() => {
          setSaveSuccessMsg(null);
        }, 2500);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSavingJustificativa(false);
    }
  };

  // Enviar diretamente para a API do Ponto Icarus
  const handleSendToIcarus = async () => {
    if (!modalItem || !justificativaInput.trim()) return;
    setSendingIcarus(true);
    setIcarusMsg(null);

    const token = typeof window !== 'undefined' ? localStorage.getItem('icarus_api_token') || '' : '';
    const baseUrl = typeof window !== 'undefined' ? localStorage.getItem('icarus_base_url') || '' : '';

    if (!token) {
      setIcarusMsg('Configure o Token do Ponto Icarus em Configurações para sincronizar.');
      setSendingIcarus(false);
      return;
    }

    try {
      const res = await fetch('/api/icarus/justificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          baseUrl,
          payload: {
            colaboradorNome: modalItem.colaborador,
            data: modalItem.data,
            tipoHE: modalItem.tipo,
            motivo: modalItem.setorMotivo,
            justificativa: justificativaInput,
            usuarioResponsavel: user?.email || 'Administrador',
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIcarusMsg('Enviado com sucesso para o Ponto Icarus!');
      } else {
        setIcarusMsg(`Ponto Icarus: ${data.message || 'Erro no envio.'}`);
      }
    } catch (err: unknown) {
      setIcarusMsg(`Erro: ${(err as Error).message}`);
    } finally {
      setSendingIcarus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400">
          Processando planilha Setembro.xlsx e consolidando justificativas...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
          <Button onClick={fetchData} size="sm">Tentar Novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
            Auditoria de Horas Extras — Setembro
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Apontamento de HE 1, HE 2 e HE 3 da planilha Setembro.xlsx com justificativas auditadas por usuário.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={fetchData} variant="secondary" size="sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <Card className="border-white/5 bg-slate-900/60 p-4">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Registros</span>
            <div className="text-2xl font-bold text-white mt-1">{summary.totalRegistros}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">HE1: {summary.totalHE1} | HE2: {summary.totalHE2} | HE3: {summary.totalHE3}</div>
          </Card>

          <Card className="border-amber-500/20 bg-amber-500/5 p-4 cursor-pointer hover:bg-amber-500/10 transition-colors"
                onClick={() => setStatusFilter('PENDENTES')}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Sem Justificativa</span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            </div>
            <div className="text-2xl font-bold text-amber-300 mt-1">{summary.pendentesJustificativa}</div>
            <div className="text-[11px] text-amber-400/80 mt-0.5">Exigem preenchimento</div>
          </Card>

          <Card className="border-blue-500/20 bg-blue-500/5 p-4 cursor-pointer hover:bg-blue-500/10 transition-colors"
                onClick={() => setStatusFilter('DENTRO_PADRAO')}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Dentro do Padrão</span>
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            </div>
            <div className="text-2xl font-bold text-blue-300 mt-1">{summary.dentroDoPadrao}</div>
            <div className="text-[11px] text-blue-400/80 mt-0.5">Programado (não exige just.)</div>
          </Card>

          <Card className="border-emerald-500/20 bg-emerald-500/5 p-4 cursor-pointer hover:bg-emerald-500/10 transition-colors"
                onClick={() => setStatusFilter('JUSTIFICADAS')}>
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Justificadas</span>
            <div className="text-2xl font-bold text-emerald-300 mt-1">{summary.justificadas}</div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5">No ponto ou auditadas</div>
          </Card>

          <Card className="border-cyan-500/20 bg-cyan-500/5 p-4 col-span-2 md:col-span-1">
            <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Volume de Horas</span>
            <div className="text-2xl font-bold text-cyan-300 mt-1">{summary.horasTotaisFormatada}</div>
            <div className="text-[11px] text-cyan-400/80 mt-0.5">Mês de Setembro</div>
          </Card>
        </div>
      )}

      {/* Barra de Filtros */}
      <Card className="p-4 space-y-3 bg-slate-900/80 border-white/10">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Busca */}
          <div className="w-full md:w-80 relative">
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar colaborador, horário ou justificativa..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Abas Tipo de HE */}
          <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 self-start md:self-auto overflow-x-auto max-w-full">
            {(['TODAS', 'HE1', 'HE2', 'HE3'] as const).map(tipo => (
              <button
                key={tipo}
                onClick={() => { setTipoFilter(tipo); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  tipoFilter === tipo
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tipo === 'TODAS' ? 'Todas Abas' : tipo === 'HE1' ? 'HE 1 (Normal)' : tipo === 'HE2' ? 'HE 2 (Oficina)' : 'HE 3 (Domingos)'}
              </button>
            ))}
          </div>

          {/* Filtro por Data */}
          <div className="self-start md:self-auto">
            <select
              value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="">Todas as Datas ({uniqueDates.length} dias)</option>
              {uniqueDates.map(d => (
                <option key={d} value={d} className="bg-slate-900 text-slate-200">
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtros de Status */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
          <span className="text-xs text-slate-500 mr-1">Filtro Rápido:</span>
          {[
            { id: 'TODAS', label: 'Todos os Status' },
            { id: 'PENDENTES', label: '⚠️ Apenas Sem Justificativa' },
            { id: 'DENTRO_PADRAO', label: '⏱️ Dentro do Padrão (Programado)' },
            { id: 'JUSTIFICADAS', label: '✅ Apenas Justificados' },
            { id: 'ALERTAS', label: '🔥 Horas Elevadas / Alertas' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => { setStatusFilter(f.id as any); setPage(1); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === f.id
                  ? 'bg-white/15 text-white font-semibold'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            Exibindo <strong>{filteredItems.length}</strong> de {items.length} apontamentos
          </span>
        </div>
      </Card>

      {/* Tabela de Horas Extras */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Status / Problema</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3">Data</th>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Ponto Registrado</th>
                <th className="py-3 px-3">H.E.</th>
                <th className="py-3 px-4">Setor / Motivo</th>
                <th className="py-3 px-4">Justificativa</th>
                <th className="py-3 px-4">Auditoria / Usuário</th>
                <th className="py-3 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    Nenhum registro encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedItems.map(item => (
                  <tr
                    key={item.id}
                    className="hover:bg-white/[0.03] transition-colors group"
                  >
                    {/* Status */}
                    <td className="py-3 px-4">
                      {item.dentroDoPadrao ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20" title="Hora extra programada / dentro do padrão (não exige justificativa)">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                          No Padrão (Programado)
                        </span>
                      ) : item.possivelProblema ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          {item.problemaDescricao || 'Atenção'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Justificada
                        </span>
                      )}
                    </td>

                    {/* Tipo */}
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.tipo === 'HE1'
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          : item.tipo === 'HE2'
                          ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {item.tipo}
                      </span>
                    </td>

                    {/* Data */}
                    <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {item.data}
                    </td>

                    {/* Colaborador */}
                    <td className="py-3 px-4 font-medium text-white max-w-[200px] truncate" title={item.colaborador}>
                      {item.colaborador}
                    </td>

                    {/* Ponto Registrado */}
                    <td className="py-3 px-4 font-mono text-slate-400 max-w-[220px] truncate" title={item.pontoRegistrado}>
                      {item.pontoRegistrado || '—'}
                    </td>

                    {/* Duração HE */}
                    <td className="py-3 px-3 font-mono font-bold text-cyan-400 whitespace-nowrap">
                      {item.horasExtrasFormatada}
                    </td>

                    {/* Setor / Motivo */}
                    <td className="py-3 px-4 text-slate-400 max-w-[160px] truncate" title={item.setorMotivo}>
                      {item.setorMotivo || '—'}
                    </td>

                    {/* Justificativa */}
                    <td className="py-3 px-4 max-w-[220px]">
                      {item.justificativa ? (
                        <div className="truncate text-slate-200" title={item.justificativa}>
                          {item.justificativa}
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">Pendente</span>
                      )}
                    </td>

                    {/* Auditoria / Usuário */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.alteradoPor ? (
                        <div className="flex flex-col">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300">
                            <svg className="w-3 h-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {item.alteradoPor}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {item.alteradoEm}
                          </span>
                        </div>
                      ) : item.justificativaOriginal ? (
                        <span className="text-[10px] text-slate-500">
                          Original do Ponto
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">
                          Não alterado
                        </span>
                      )}
                    </td>

                    {/* Ação */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <Button
                        variant={item.temJustificativa ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => handleOpenModal(item)}
                      >
                        {item.temJustificativa ? 'Editar' : 'Justificar'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/5 text-xs text-slate-400">
            <div>
              Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({filteredItems.length} itens)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição de Justificativa */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                  Justificar Hora Extra ({modalItem.tipo})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {modalItem.colaborador} — {modalItem.data}
                </p>
              </div>
              <button
                onClick={() => setModalItem(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Informações do Ponto */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
                <div>
                  <span className="text-slate-500 block">Horário Registrado:</span>
                  <span className="text-slate-200 font-mono">{modalItem.pontoRegistrado || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Duração de HE:</span>
                  <span className="text-cyan-400 font-mono font-bold text-sm">{modalItem.horasExtrasFormatada}</span>
                </div>
                {modalItem.setorMotivo && (
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Setor / Motivo Original:</span>
                    <span className="text-slate-300">{modalItem.setorMotivo}</span>
                  </div>
                )}
              </div>

              {/* Auditoria do Usuário Atual */}
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-center justify-between">
                <div>
                  <span className="font-semibold block">Usuário Responsável pela Alteração:</span>
                  <span>{user?.email || 'Administrador (Modo Local)'}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-[10px] font-bold text-cyan-300">
                  Rastreamento Ativo
                </span>
              </div>

              {/* Presets Rápidos */}
              <div>
                <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">Preenchimento rápido:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Dentro do padrão',
                    'Ajuste de escala operacional',
                    'Trânsito / Congestionamento',
                    'Atraso no abastecimento / Garagem',
                    'Socorro mecânico / Oficina',
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setJustificativaInput(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                        preset === 'Dentro do padrão'
                          ? 'bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campo de Justificativa */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Descrição da Justificativa:
                </label>
                <textarea
                  rows={3}
                  value={justificativaInput}
                  onChange={e => setJustificativaInput(e.target.value)}
                  placeholder="Informe o motivo da hora extra (ex: Saída atrasada autorizada pela supervisão, socorro de veículo, trânsito)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              {/* Mensagens de Sucesso / Erro */}
              {saveSuccessMsg && (
                <div className="p-3 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {icarusMsg && (
                <div className="p-3 rounded-xl text-xs bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <span>{icarusMsg}</span>
                </div>
              )}

              {/* Histórico Anterior */}
              {modalItem.historicoAlteracoes && modalItem.historicoAlteracoes.length > 0 && (
                <div className="pt-2 border-t border-white/5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Histórico de Modificações Anteriores:
                  </span>
                  <div className="max-h-28 overflow-y-auto space-y-1.5">
                    {modalItem.historicoAlteracoes.map((h, i) => (
                      <div key={i} className="text-[11px] p-2 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="font-medium text-slate-300">{h.alteradoPor}</span>
                          <span>{h.alteradoEm}</span>
                        </div>
                        <p className="text-slate-400 mt-1 italic">&quot;{h.justificativa}&quot;</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendToIcarus}
                disabled={sendingIcarus || !justificativaInput.trim()}
                title="Sincroniza esta justificativa diretamente com a API do Ponto Icarus"
              >
                {sendingIcarus ? 'Enviando ao Icarus...' : 'Enviar ao Ponto Icarus'}
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setModalItem(null)}>
                  Fechar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveJustificativa}
                  disabled={savingJustificativa || !justificativaInput.trim()}
                >
                  {savingJustificativa ? 'Salvando...' : 'Salvar Justificativa'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
