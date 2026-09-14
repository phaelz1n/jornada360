'use client';

// ============================================================
// Central de Relatórios & Analytics — Visão Executiva (Fase 5)
// ============================================================

import { useState, useMemo, useSyncExternalStore } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuditData } from '@/components/providers/AuditDataProvider';
import { reportService } from '@/services/report-service';
import { minutesToHHMM } from '@/lib/utils/time';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function RelatoriosPage() {
  const { auditItems, activeDate } = useAuditData();
  const mounted = useIsClient();
  const [periodoView, setPeriodoView] = useState<'dia' | 'mes' | 'ciclo'>('dia');
  const [isExporting, setIsExporting] = useState(false);

  // Métricas consolidadas
  const resumo = useMemo(() => reportService.gerarResumo(auditItems), [auditItems]);
  const setorStats = useMemo(() => reportService.gerarEstatisticasSetor(auditItems), [auditItems]);
  const diaSemanaStats = useMemo(() => reportService.gerarEstatisticasDiaSemana(auditItems), [auditItems]);
  const topMotoristas = useMemo(() => reportService.gerarTopMotoristasExcedente(auditItems, 5), [auditItems]);
  const reincidentes = useMemo(() => reportService.detectarReincidentes(auditItems, 3), [auditItems]);

  // Formatar dados para gráficos
  const chartDiaSemana = useMemo(() => {
    return diaSemanaStats.map(d => ({
      name: d.dia,
      heHoras: Number((d.totalHEMin / 60).toFixed(1)),
      excedenteHoras: Number((d.totalExcedenteMin / 60).toFixed(1)),
    }));
  }, [diaSemanaStats]);

  const chartSetores = useMemo(() => {
    return setorStats.map(s => ({
      name: s.setor,
      value: Number((s.totalHEMin / 60).toFixed(1)),
    }));
  }, [setorStats]);

  const handleExportXLSX = async () => {
    try {
      setIsExporting(true);
      await reportService.exportarExcel(auditItems, `Jornada360_Relatorio_${activeDate}.xlsx`);
    } catch (err) {
      console.error('Erro ao exportar:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Analytics & Relatórios</h1>
            <Badge variant="cyan">Fechamento Operacional</Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Análise agregada de horas extras, desvios por setor, conformidade e tendências semanais
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handlePrint}>
            🖨️ Imprimir / Salvar PDF
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportXLSX}
            disabled={isExporting || auditItems.length === 0}
          >
            {isExporting ? 'Exportando...' : '📥 Baixar Excel (.xlsx)'}
          </Button>
        </div>
      </div>

      {/* Period Selector Tabs */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/10 w-fit">
          <button
            onClick={() => setPeriodoView('dia')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              periodoView === 'dia' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Visão do Dia ({activeDate})
          </button>
          <button
            onClick={() => setPeriodoView('mes')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              periodoView === 'mes' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Mês Corrente
          </button>
          <button
            onClick={() => setPeriodoView('ciclo')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              periodoView === 'ciclo' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Ciclo Folha (28 a 27)
          </button>
        </div>

        <div className="text-xs text-slate-400">
          Base: <strong>{auditItems.length} registros auditados</strong>
        </div>
      </div>

      {/* Executive KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-white/5 bg-slate-900/60">
          <p className="text-xs text-slate-400 uppercase tracking-wider">HE Realizada Total</p>
          <p className="text-2xl font-bold text-white mt-1">{minutesToHHMM(resumo.totalHEMin)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{(resumo.totalHEMin / 60).toFixed(1)} horas apuradas</p>
        </Card>

        <Card className="p-4 border-white/5 bg-slate-900/60">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Excedente Não Previsto</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{minutesToHHMM(resumo.totalExcedenteMin)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{(resumo.totalExcedenteMin / 60).toFixed(1)} horas sem escala</p>
        </Card>

        <Card className="p-4 border-white/5 bg-slate-900/60">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Dentro da Tolerância</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{minutesToHHMM(resumo.totalDentroPadraoMin)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Homologado e justificado</p>
        </Card>

        <Card className="p-4 border-white/5 bg-slate-900/60">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Índice de Conformidade</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{resumo.percentualConformidade}%</p>
          <p className="text-xs text-slate-500 mt-0.5">Jornadas sem infrações CLT</p>
        </Card>
      </div>

      {/* Reincidência Alert Banner */}
      {reincidentes.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-300">
                Alerta de Reincidência Operacional ({reincidentes.length} colaboradores)
              </h3>
              <p className="text-xs text-amber-400/80 mt-0.5">
                Motoristas com ocorrências repetidas de horas extras excedentes no período:
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {reincidentes.map((r, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-medium bg-amber-950/60 text-amber-200 border border-amber-800/40 px-2.5 py-1 rounded-lg"
                  >
                    {r.motorista}: <strong>{r.count}x</strong> (+{minutesToHHMM(r.totalExcedenteMin)})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Charts Row */}
      {mounted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart: Dias da Semana */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Concentração por Dia da Semana</h3>
                <p className="text-xs text-slate-500">Volume de horas extras e excedente por dia</p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDiaSemana}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="heHoras" name="Total HE (h)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="excedenteHoras" name="Excedente (h)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Pie Chart: Distribuição por Setor */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Distribuição por Setor Responsável</h3>
                <p className="text-xs text-slate-500">Participação percentual do volume de horas</p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartSetores}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={3}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} (${((percent || 0) * 100).toFixed(0)}%)`}
                  >
                    {chartSetores.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* Drill-down por Setor Table */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Detalhamento por Setor Operacional</h3>
            <p className="text-xs text-slate-500">Métricas consolidadas para alinhamento com lideranças</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="pb-3 font-semibold">Setor</th>
                <th className="pb-3 font-semibold">Qtd Motoristas</th>
                <th className="pb-3 font-semibold">Ocorrências</th>
                <th className="pb-3 font-semibold">Total HE</th>
                <th className="pb-3 font-semibold">Excedente Total</th>
                <th className="pb-3 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {setorStats.map((st, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 font-semibold text-white">{st.setor}</td>
                  <td className="py-3 text-slate-300">{st.motoristasCount} colaboradores</td>
                  <td className="py-3 text-slate-300">{st.ocorrenciasCount}</td>
                  <td className="py-3 font-mono text-cyan-400">{minutesToHHMM(st.totalHEMin)}</td>
                  <td className="py-3 font-mono text-amber-400">{minutesToHHMM(st.totalExcedenteMin)}</td>
                  <td className="py-3 text-right">
                    <span className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium">
                      Ver detalhes
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top Motoristas com Excedente */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Top 5 Colaboradores com Maior Excedente</h3>
            <p className="text-xs text-slate-500">Casos prioritários para apuração e alinhamento de jornada</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {topMotoristas.map((m, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-800/50 border border-white/5 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-xs font-bold text-white truncate max-w-[180px]">{m.motorista}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  HE Total: <strong className="text-slate-200">{minutesToHHMM(m.heMin)}</strong>
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-red-400 font-mono">
                  +{minutesToHHMM(m.excedenteMin)}
                </span>
                <p className="text-[10px] text-slate-500">{m.count} registros</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
