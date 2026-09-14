'use client';

// ============================================================
// AuditDataProvider — Contexto Global de Auditoria e Dados
// ============================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuditItem } from '@/types/audit';
import type { Pendencia, PendenciaStatus } from '@/types/pendencia';
import { useWorkspace } from './WorkspaceProvider';
import { journeyService } from '@/services/journey-service';
import { AuditEngine } from '@/services/audit-engine';
import { PendenciaService } from '@/services/pendencia-service';
import { reportService, type ReportSummary } from '@/services/report-service';
import { SAMPLE_AUDIT_ITEMS } from '@/lib/mock-data';

interface ProcessFilesPayload {
  espelho?: File | null;
  rastreamento?: File | null;
  horario?: File | null;
  escala?: File | null;
  espelhoOntem?: File | null;
}

interface ProcessSummary {
  pontosCount: number;
  rastreioEventsCount: number;
  horariosCount: number;
  escalasCount: number;
  pontosOntemCount: number;
}

interface AuditDataContextValue {
  auditItems: AuditItem[];
  pendencias: Pendencia[];
  activeDate: string;
  setActiveDate: (date: string) => void;
  isProcessing: boolean;
  lastProcessSummary: ProcessSummary | null;
  stats: ReportSummary;
  processFiles: (files: ProcessFilesPayload) => Promise<{ success: boolean; error?: string }>;
  resolveAuditItem: (
    id: string,
    setor: string,
    causa: string,
    justificativa: string,
    heCorrigidaMin?: number
  ) => Promise<void>;
  updatePendenciaStatus: (
    id: string,
    status: PendenciaStatus,
    usuario: string,
    obs?: string
  ) => Promise<void>;
  resolverPendencia: (id: string, resolucao: string, usuario: string) => Promise<void>;
  resetToSampleData: () => Promise<void>;
}

const AuditDataContext = createContext<AuditDataContextValue | null>(null);

export function AuditDataProvider({ children }: { children: ReactNode }) {
  const { workspaceId, config, adapter } = useWorkspace();
  const [activeDate, setActiveDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessSummary, setLastProcessSummary] = useState<ProcessSummary | null>(null);

  // Carregar dados salvos do adapter ou inicializar com dados de exemplo
  useEffect(() => {
    if (!adapter) return;
    let cancelled = false;

    async function load() {
      try {
        const savedItems = await adapter!.getSnapshot(workspaceId, activeDate);
        const savedPendencias = await adapter!.getPendencias(workspaceId);

        if (cancelled) return;

        if (savedItems && savedItems.length > 0) {
          setAuditItems(savedItems);
        } else {
          // Primeira execução: salvar dados de amostra
          await adapter!.saveSnapshot(workspaceId, activeDate, SAMPLE_AUDIT_ITEMS);
          setAuditItems(SAMPLE_AUDIT_ITEMS);

          const pendenciaService = new PendenciaService(adapter!);
          const autoPendencias = await pendenciaService.autoGerarDeAuditoria(SAMPLE_AUDIT_ITEMS, workspaceId);
          setPendencias(autoPendencias);
          return;
        }

        if (savedPendencias) {
          setPendencias(savedPendencias);
        }
      } catch (err) {
        console.error('Erro ao carregar dados de auditoria:', err);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [adapter, workspaceId, activeDate]);

  // Processar arquivos importados
  const processFiles = useCallback(
    async (files: ProcessFilesPayload) => {
      if (!adapter) return { success: false, error: 'Adaptador de banco não inicializado' };
      setIsProcessing(true);

      try {
        let pontos: any[] = [];
        let rastreios: any[] = [];
        let horarios: any[] = [];
        let escalas: any[] = [];
        let pontosOntem: any[] = [];

        // 1. Espelho de Ponto
        if (files.espelho) {
          const buf = await files.espelho.arrayBuffer();
          pontos = await journeyService.parseEspelhoPonto(buf, files.espelho.name);
        }

        // 2. Rastreamento Cobli
        if (files.rastreamento) {
          const buf = await files.rastreamento.arrayBuffer();
          rastreios = await journeyService.parseRastreamento(buf);
        }

        // 3. Horário Padrão
        if (files.horario) {
          const buf = await files.horario.arrayBuffer();
          horarios = await journeyService.parseHorarioPadrao(buf);
        }

        // 4. Escala Operacional
        if (files.escala) {
          const buf = await files.escala.arrayBuffer();
          escalas = await journeyService.parseEscala(buf);
        }

        // 5. Espelho de Ontem (PDF ou Excel)
        if (files.espelhoOntem) {
          const buf = await files.espelhoOntem.arrayBuffer();
          pontosOntem = await journeyService.parseEspelhoPonto(buf, files.espelhoOntem.name);
        }

        // Determinar a data mais comum dos registros ou manter activeDate
        let targetDate = activeDate;
        if (pontos.length > 0 && pontos[0].data) {
          targetDate = pontos[0].data;
          setActiveDate(targetDate);
        }

        // Executar AuditEngine
        const engine = new AuditEngine(config);
        const audited = await engine.audit({
          pontos,
          rastreios,
          horarios,
          escalas,
          pontosOntem,
          dateKey: targetDate,
          workspaceId,
        });

        // Salvar snapshot
        await adapter.saveSnapshot(workspaceId, targetDate, audited);
        setAuditItems(audited);

        // Gerar pendências automáticas
        const pendenciaService = new PendenciaService(adapter);
        const novasPendencias = await pendenciaService.autoGerarDeAuditoria(audited, workspaceId);
        const todasPendencias = await pendenciaService.listar(workspaceId);
        setPendencias(todasPendencias);

        setLastProcessSummary({
          pontosCount: pontos.length,
          rastreioEventsCount: rastreios.reduce((s, r) => s + r.eventos.length, 0),
          horariosCount: horarios.length,
          escalasCount: escalas.length,
          pontosOntemCount: pontosOntem.length,
        });

        setIsProcessing(false);
        return { success: true };
      } catch (err: any) {
        console.error('Falha ao processar arquivos:', err);
        setIsProcessing(false);
        return { success: false, error: err?.message || 'Erro desconhecido ao processar' };
      }
    },
    [adapter, config, activeDate, workspaceId]
  );

  // Resolução inline de item de auditoria
  const resolveAuditItem = useCallback(
    async (
      id: string,
      setor: string,
      causa: string,
      justificativa: string,
      heCorrigidaMin?: number
    ) => {
      if (!adapter) return;

      const engine = new AuditEngine(config);
      const updated = auditItems.map(item => {
        if (item.id !== id) return item;

        let res = { ...item };
        if (heCorrigidaMin !== undefined && !isNaN(heCorrigidaMin)) {
          res = engine.recalcularExcedente(res, heCorrigidaMin);
        }

        return {
          ...res,
          setor,
          causaProvavel: causa,
          justificativa,
          resolvido: true,
          updatedAt: new Date(),
        };
      });

      setAuditItems(updated);
      await adapter.saveSnapshot(workspaceId, activeDate, updated);
    },
    [adapter, config, auditItems, workspaceId, activeDate]
  );

  // Atualizar status de pendência
  const updatePendenciaStatus = useCallback(
    async (id: string, status: PendenciaStatus, usuario: string, obs?: string) => {
      if (!adapter) return;
      const pendenciaService = new PendenciaService(adapter);
      await pendenciaService.atualizarStatus(id, status, usuario, obs, workspaceId);
      const reloaded = await pendenciaService.listar(workspaceId);
      setPendencias(reloaded);
    },
    [adapter, workspaceId]
  );

  // Resolver pendência
  const resolverPendencia = useCallback(
    async (id: string, resolucao: string, usuario: string) => {
      if (!adapter) return;
      const pendenciaService = new PendenciaService(adapter);
      await pendenciaService.resolver(id, resolucao, usuario, workspaceId);
      const reloaded = await pendenciaService.listar(workspaceId);
      setPendencias(reloaded);
    },
    [adapter, workspaceId]
  );

  // Restaurar dados de demonstração
  const resetToSampleData = useCallback(async () => {
    if (!adapter) return;
    await adapter.saveSnapshot(workspaceId, activeDate, SAMPLE_AUDIT_ITEMS);
    setAuditItems(SAMPLE_AUDIT_ITEMS);
    const pendenciaService = new PendenciaService(adapter);
    const autoPendencias = await pendenciaService.autoGerarDeAuditoria(SAMPLE_AUDIT_ITEMS, workspaceId);
    setPendencias(autoPendencias);
  }, [adapter, workspaceId, activeDate]);

  const stats = reportService.gerarResumo(auditItems);

  return (
    <AuditDataContext.Provider
      value={{
        auditItems,
        pendencias,
        activeDate,
        setActiveDate,
        isProcessing,
        lastProcessSummary,
        stats,
        processFiles,
        resolveAuditItem,
        updatePendenciaStatus,
        resolverPendencia,
        resetToSampleData,
      }}
    >
      {children}
    </AuditDataContext.Provider>
  );
}

export function useAuditData() {
  const ctx = useContext(AuditDataContext);
  if (!ctx) {
    throw new Error('useAuditData deve ser usado dentro de AuditDataProvider');
  }
  return ctx;
}
