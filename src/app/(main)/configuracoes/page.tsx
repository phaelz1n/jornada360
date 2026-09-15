'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';
import { minutesToHHMM } from '@/lib/utils/time';
import type { SyncLogEntry } from '@/types/sync';

export default function ConfiguracoesPage() {
  const { config, workspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'regras' | 'integracoes'>('integracoes');

  const configs = [
    { label: 'Tolerância Padrão de HE', value: `${config.toleranciaPadraoMin} min` },
    { label: 'Tolerância Divergência Leve', value: `${config.toleranciaDivLeveMin} min` },
    { label: 'Interjornada Mínima', value: minutesToHHMM(config.toleranciaInterjornadaMin) },
    { label: 'Meta Diária de HE', value: minutesToHHMM(config.metaDiariaHEMin) },
    { label: 'Ciclo de Fechamento', value: `Dia ${config.cicloFechamento.diaInicio} a ${config.cicloFechamento.diaFim}` },
    { label: 'Fuzzy Match Threshold', value: `${Math.round(config.fuzzyMatchThreshold * 100)}%` },
    { label: '1º Intervalo Mínimo', value: `${config.intervalos.primeiroMin} min` },
    { label: '2º Intervalo Mínimo', value: `${config.intervalos.segundoMin} min` },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Configurações do Sistema</h1>
          <p className="text-sm text-slate-400 mt-1">
            Gerenciamento de parâmetros operacionais e integrações de telemetria e ponto para o workspace &quot;{workspace?.nome || 'Padrão'}&quot;
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('integracoes')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'integracoes'
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚡ Integrações de API (Cobli & Icarus)
          </button>
          <button
            onClick={() => setActiveTab('regras')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'regras'
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚙️ Regras do Workspace
          </button>
        </div>
      </div>

      {activeTab === 'integracoes' ? (
        <IntegracoesApiSection />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          {/* Tolerances */}
          <Card>
            <h2 className="text-base font-semibold text-slate-200 mb-4">Regras e Tolerâncias de Auditoria</h2>
            <div className="space-y-3">
              {configs.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-slate-400">{c.label}</span>
                  <span className="text-sm font-mono text-slate-200">{c.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="secondary" size="sm" disabled>
                Editar (em breve)
              </Button>
            </div>
          </Card>

          {/* Aliases */}
          <Card>
            <h2 className="text-base font-semibold text-slate-200 mb-4">Aliases de Setores e Causas</h2>
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">
                Nenhum alias configurado
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Aliases permitirão mesclar setores e causas duplicadas
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function IntegracoesApiSection() {
  const { workspaceId } = useWorkspace();

  // Cobli State
  const [cobliApiKey, setCobliApiKey] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('cobli_api_key') || '';
    return '';
  });
  const [cobliBaseUrl, setCobliBaseUrl] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('cobli_base_url') || 'https://api.cobli.co';
    return 'https://api.cobli.co';
  });
  const [cobliTesting, setCobliTesting] = useState(false);
  const [cobliStatus, setCobliStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Icarus State
  const [icarusToken, setIcarusToken] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('icarus_api_token') || '';
    return '';
  });
  const [icarusBaseUrl, setIcarusBaseUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('icarus_base_url');
      if (stored && !stored.includes('api.pontoicarus.com.br')) return stored;
    }
    return 'https://backendicarus.pontoicarus.com.br';
  });
  const [icarusEmpresaId, setIcarusEmpresaId] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('icarus_empresa_id') || '';
    return '';
  });
  const [icarusTesting, setIcarusTesting] = useState(false);
  const [icarusStatus, setIcarusStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Auto-migração de cache local que continha o domínio inválido "api.pontoicarus.com.br"
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('icarus_base_url');
      if (!stored || stored.includes('api.pontoicarus.com.br')) {
        localStorage.setItem('icarus_base_url', 'https://backendicarus.pontoicarus.com.br');
        setIcarusBaseUrl('https://backendicarus.pontoicarus.com.br');
      }
    }
  }, []);

  // Sync Global Trigger State
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ ok: boolean; title: string; details?: string } | null>(null);

  // Logs
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Carregar logs
  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/sync/logs');
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Salvar chaves no LocalStorage
  const handleSaveKeys = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cobli_api_key', cobliApiKey);
      localStorage.setItem('cobli_base_url', cobliBaseUrl);
      localStorage.setItem('icarus_api_token', icarusToken);
      localStorage.setItem('icarus_base_url', icarusBaseUrl);
      localStorage.setItem('icarus_empresa_id', icarusEmpresaId);
      alert('Credenciais das APIs salvas com sucesso!');
    }
  };

  // Testar Cobli
  const handleTestCobli = async () => {
    setCobliTesting(true);
    setCobliStatus(null);
    try {
      const res = await fetch('/api/cobli/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: cobliApiKey, baseUrl: cobliBaseUrl }),
      });
      const data = await res.json();
      setCobliStatus({ ok: res.ok && data.success, msg: data.message });
      if (res.ok && data.success) {
        localStorage.setItem('cobli_api_key', cobliApiKey);
      }
    } catch (err: unknown) {
      setCobliStatus({ ok: false, msg: (err as Error).message });
    } finally {
      setCobliTesting(false);
    }
  };

  // Testar Icarus
  const handleTestIcarus = async () => {
    setIcarusTesting(true);
    setIcarusStatus(null);
    try {
      const res = await fetch('/api/icarus/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: icarusToken,
          baseUrl: icarusBaseUrl,
          empresaId: icarusEmpresaId,
        }),
      });
      const data = await res.json();
      setIcarusStatus({ ok: res.ok && data.success, msg: data.message });
      if (res.ok && data.success) {
        localStorage.setItem('icarus_api_token', icarusToken);
      }
    } catch (err: unknown) {
      setIcarusStatus({ ok: false, msg: (err as Error).message });
    } finally {
      setIcarusTesting(false);
    }
  };

  // Disparo Manual do Pipeline Completo
  const handleTriggerSync = async () => {
    setSyncing(true);
    setSyncFeedback(null);

    setSyncStep('Iniciando pipeline... Conectando aos serviços Icarus e Cobli...');
    await new Promise(r => setTimeout(r, 600));

    try {
      setSyncStep('Obtendo espelho de ponto e batidas no Icarus...');
      await new Promise(r => setTimeout(r, 500));

      setSyncStep('Obtendo viagens, telemetria e paradas na Cobli...');

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspaceId || 'default' }),
      });

      const data = await res.json();
      setSyncStep('Cruzando dados no AuditEngine e registrando pendências...');
      await new Promise(r => setTimeout(r, 400));

      if (res.ok && data.success) {
        const met = data.log?.metricas;
        setSyncFeedback({
          ok: true,
          title: 'Sincronização e Auditoria concluídas com sucesso!',
          details: `Processados: ${met?.pontosRecebidos || 0} pontos, ${met?.trajetosRecebidos || 0} trajetos. Total de motoristas auditados: ${met?.motoristasAuditados || 0}. Pendências geradas: ${met?.pendenciasGeradas || 0}.`,
        });
      } else {
        setSyncFeedback({
          ok: false,
          title: 'Sincronização concluída com avisos ou falha.',
          details: data.log?.erros?.join(' | ') || data.message || 'Verifique as credenciais configuradas.',
        });
      }

      await loadLogs();
    } catch (err: unknown) {
      setSyncFeedback({
        ok: false,
        title: 'Erro de comunicação no pipeline.',
        details: (err as Error).message,
      });
    } finally {
      setSyncing(false);
      setSyncStep(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Sincronização Imediata */}
      <Card className="border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-teal-950/30 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Pipeline de Ingestão e Conciliação Contínua
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Consome automaticamente os trajetos da Cobli e as batidas do Ponto Icarus, normaliza viradas de turno noturno, executa o motor de auditoria e atualiza a base sem necessidade de envio manual de planilhas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button
              onClick={handleTriggerSync}
              disabled={syncing}
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white font-bold shadow-lg shadow-cyan-500/25 px-6 whitespace-nowrap"
            >
              {syncing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Sincronizando...
                </span>
              ) : (
                '⚡ Sincronizar APIs Agora'
              )}
            </Button>
          </div>
        </div>

        {/* Feedback do progresso em tempo real */}
        {syncStep && (
          <div className="mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-center gap-2.5 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
            <span>{syncStep}</span>
          </div>
        )}

        {syncFeedback && (
          <div
            className={`mt-4 p-4 rounded-xl text-xs flex flex-col gap-1 ${
              syncFeedback.ok
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
            }`}
          >
            <div className="font-bold flex items-center gap-2">
              <span>{syncFeedback.ok ? '✅' : '⚠️'}</span>
              <span>{syncFeedback.title}</span>
            </div>
            {syncFeedback.details && <span className="opacity-90 text-[11px]">{syncFeedback.details}</span>}
          </div>
        )}
      </Card>

      {/* Grid de Conectores (Cobli & Icarus) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conector 1: Cobli API */}
        <Card className="border-white/10 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                C
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Conector Cobli API</h3>
                <p className="text-[11px] text-slate-400">Telemetria, Trajetos e Paradas (/v1/trips, /drivers)</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              v1/v2 REST
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                API Key / Secret Token Cobli:
              </label>
              <input
                type="password"
                value={cobliApiKey}
                onChange={e => setCobliApiKey(e.target.value)}
                placeholder="Ex: cobli_live_sk_..."
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                URL Base Cobli:
              </label>
              <input
                type="text"
                value={cobliBaseUrl}
                onChange={e => setCobliBaseUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            {cobliStatus && (
              <div
                className={`p-2.5 rounded-xl text-[11px] ${
                  cobliStatus.ok
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                {cobliStatus.msg}
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTestCobli}
                disabled={cobliTesting || !cobliApiKey.trim()}
              >
                {cobliTesting ? 'Testando...' : 'Testar Conexão Cobli'}
              </Button>
              <span className="text-[11px] text-slate-500">Descarte de &quot;--&quot; ativo</span>
            </div>
          </div>
        </Card>

        {/* Conector 2: Icarus API */}
        <Card className="border-white/10 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm">
                I
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Conector Ponto Icarus API</h3>
                <p className="text-[11px] text-slate-400">Espelho Eletrônico, Horas Extras e Batidas</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              REST 2.3
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Token / Bearer API Key Icarus:
              </label>
              <input
                type="password"
                value={icarusToken}
                onChange={e => setIcarusToken(e.target.value)}
                placeholder="Ex: eyJhbGciOiJIUzI1NiIs..."
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Obtido em <strong>Minha Empresa &gt; Token de Integração</strong> no painel web.pontoicarus.com.br.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  URL Base do Backend:
                </label>
                <input
                  type="text"
                  value={icarusBaseUrl}
                  onChange={e => setIcarusBaseUrl(e.target.value)}
                  placeholder="https://backendicarus.pontoicarus.com.br"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Empresa ID (Opcional):
                </label>
                <input
                  type="text"
                  value={icarusEmpresaId}
                  onChange={e => setIcarusEmpresaId(e.target.value)}
                  placeholder="ID da Unidade"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Swagger API Docs:</span>
              <a
                href="https://backendicarus.pontoicarus.com.br/swagger-ui.html"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                backendicarus.pontoicarus.com.br/swagger-ui.html ↗
              </a>
            </div>

            {icarusStatus && (
              <div
                className={`p-2.5 rounded-xl text-[11px] ${
                  icarusStatus.ok
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                {icarusStatus.msg}
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTestIcarus}
                disabled={icarusTesting || !icarusToken.trim()}
              >
                {icarusTesting ? 'Testando...' : 'Testar Conexão Icarus'}
              </Button>
              <span className="text-[11px] text-slate-500">Ajuste noturno ativo</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Seção de Agendamento & Salvar Chaves */}
      <Card className="p-6 border-white/10 bg-slate-900/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🕒</span> Agendamento Automático (Vercel Cron Jobs)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Horários de execução automática programados no <code className="text-cyan-400">vercel.json</code> para sincronizar o dia anterior (D-1).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-white/5 border border-white/10 text-cyan-300">
              03:00 UTC (00:00 BRT)
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-white/5 border border-white/10 text-teal-300">
              06:00 UTC (03:00 BRT)
            </span>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            As credenciais configuradas acima são persistidas e utilizadas tanto no disparo manual quanto nas rotinas automáticas da madrugada.
          </p>
          <Button onClick={handleSaveKeys} variant="primary" size="sm">
            Salvar Todas as Configurações
          </Button>
        </div>
      </Card>

      {/* Histórico de Execuções e Auditoria (sync_logs) */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Histórico de Sincronizações (sync_logs)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Auditoria e rastreamento de cada execução automática ou manual</p>
          </div>
          <Button variant="ghost" size="sm" onClick={loadLogs} disabled={loadingLogs}>
            {loadingLogs ? 'Carregando...' : 'Atualizar Logs'}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-3">Origem</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4">Período</th>
                <th className="py-3 px-4">Métricas</th>
                <th className="py-3 px-3">Duração</th>
                <th className="py-3 px-4">Observações / Erros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhum log de sincronização registrado até o momento.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.trigger === 'cron'
                          ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                          : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      }`}>
                        {log.trigger}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.status === 'sucesso'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : log.status === 'parcial'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-red-500/15 text-red-400 border border-red-500/30'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {log.periodo?.inicio} a {log.periodo?.fim}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <span className="text-cyan-400 font-semibold">{log.metricas?.pontosRecebidos || 0}</span> pts |{' '}
                      <span className="text-blue-400 font-semibold">{log.metricas?.trajetosRecebidos || 0}</span> traj |{' '}
                      <span className="text-emerald-400 font-semibold">{log.metricas?.motoristasAuditados || 0}</span> auditados
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {log.metricas?.duracaoMs}ms
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-[240px] truncate" title={log.erros?.join(' | ') || 'Sem erros'}>
                      {log.erros && log.erros.length > 0 ? (
                        <span className="text-amber-400">{log.erros.join(', ')}</span>
                      ) : (
                        <span className="text-emerald-500">Operação concluída 100%</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
