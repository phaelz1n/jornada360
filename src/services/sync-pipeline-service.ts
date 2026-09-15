// ============================================================
// Pipeline de Sincronização e Auditoria Automática (Icarus & Cobli)
// ============================================================

import { getAdapter } from '@/lib/db';
import { IcarusClient } from '@/lib/icarus/client';
import { CobliClient } from '@/lib/cobli/client';
import { AuditEngine } from '@/services/audit-engine';
import { PendenciaService } from '@/services/pendencia-service';
import type { SyncOptions, SyncResult, SyncLogEntry } from '@/types/sync';
import type { AuditItem } from '@/types/audit';
import type { Pendencia } from '@/types/pendencia';
import { createDefaultConfig } from '@/types/workspace';
import fs from 'fs';
import path from 'path';

const LOGS_FILE = path.join(process.cwd(), '.data', 'sync_logs.json');

function ensureLogsDir() {
  const dir = path.dirname(LOGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function saveSyncLog(log: SyncLogEntry) {
  try {
    ensureLogsDir();
    let logs: SyncLogEntry[] = [];
    if (fs.existsSync(LOGS_FILE)) {
      logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8') || '[]');
    }
    logs.unshift(log);
    // Manter últimos 50 logs
    if (logs.length > 50) logs = logs.slice(0, 50);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar log de sincronização:', err);
  }
}

export function getSyncLogs(): SyncLogEntry[] {
  try {
    ensureLogsDir();
    if (!fs.existsSync(LOGS_FILE)) return [];
    return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8') || '[]');
  } catch (err) {
    console.error('Erro ao ler logs de sincronização:', err);
    return [];
  }
}

export async function syncAndAuditPipeline(options: SyncOptions): Promise<SyncResult> {
  const startTime = Date.now();
  const workspaceId = options.workspaceId || 'default';
  const trigger = options.trigger || 'manual';

  // Período padrão: dia anterior (D-1)
  const ontem = new Date(Date.now() - 86400000);
  const targetDate = ontem.toISOString().slice(0, 10);

  const startDate = options.startDate || targetDate;
  const endDate = options.endDate || targetDate;

  const erros: string[] = [];
  let icarusStatus: 'ok' | 'falha' | 'desativado' = 'desativado';
  let cobliStatus: 'ok' | 'falha' | 'desativado' = 'desativado';

  const adapter = await getAdapter();
  const workspace = await adapter.getWorkspace(workspaceId);
  const config = workspace?.config || createDefaultConfig();
  const integracoes = config.integracoes;

  // 1. Obter credenciais configuradas no Workspace ou fallback em variáveis de ambiente
  const icarusToken = integracoes?.icarus?.apiToken || process.env.ICARUS_API_TOKEN || '';
  const icarusBaseUrl = integracoes?.icarus?.baseUrl || process.env.ICARUS_BASE_URL || 'https://api.pontoicarus.com.br/v1';
  const icarusAtivo = integracoes?.icarus?.ativo ?? !!icarusToken;

  const cobliKey = integracoes?.cobli?.apiKey || process.env.COBLI_API_KEY || '';
  const cobliBaseUrl = integracoes?.cobli?.baseUrl || process.env.COBLI_BASE_URL || 'https://api.cobli.co';
  const cobliAtivo = integracoes?.cobli?.ativo ?? !!cobliKey;

  let rawPontosNormalized: any[] = [];
  let rawTrackingEvents: any[] = [];

  // Passo 1: Buscar marcações no Icarus
  if (icarusAtivo && icarusToken) {
    try {
      const icarus = new IcarusClient(icarusToken, icarusBaseUrl);
      rawPontosNormalized = await icarus.getEspelhoPontos(startDate, endDate);
      icarusStatus = 'ok';
    } catch (err: unknown) {
      icarusStatus = 'falha';
      erros.push(`Falha no conector Icarus: ${(err as Error).message}`);
    }
  }

  // Passo 2: Buscar telemetria/trajetos na Cobli
  if (cobliAtivo && cobliKey) {
    try {
      const cobli = new CobliClient(cobliKey, cobliBaseUrl);
      rawTrackingEvents = await cobli.getTrips(startDate, endDate);
      cobliStatus = 'ok';
    } catch (err: unknown) {
      cobliStatus = 'falha';
      erros.push(`Falha no conector Cobli: ${(err as Error).message}`);
    }
  }

  // Se ambos falharam ou ambos não estavam configurados
  if (rawPontosNormalized.length === 0 && rawTrackingEvents.length === 0) {
    const duracaoMs = Date.now() - startTime;
    const finalStatus = erros.length > 0 ? 'erro' : 'parcial';

    const log: SyncLogEntry = {
      id: `sync_${Date.now()}`,
      workspaceId,
      timestamp: new Date().toISOString(),
      trigger,
      status: finalStatus,
      periodo: { inicio: startDate, fim: endDate },
      metricas: {
        pontosRecebidos: 0,
        trajetosRecebidos: 0,
        motoristasAuditados: 0,
        pendenciasGeradas: 0,
        duracaoMs,
      },
      erros: erros.length > 0 ? erros : ['Nenhum dado retornado das APIs configuradas ou credenciais ausentes.'],
      detalhes: { icarusStatus, cobliStatus },
    };

    saveSyncLog(log);
    return { success: false, log };
  }

  // Passo 3: Converter para os formatos PointRecord e TrackingRecord
  const pontos = IcarusClient.toPointRecords(rawPontosNormalized);
  const rastreios = CobliClient.toTrackingRecords(rawTrackingEvents);

  // Passo 4: Executar Motor de Auditoria (AuditEngine)
  const engine = new AuditEngine(config);
  let auditedItems: AuditItem[] = [];
  let generatedPendencias: Pendencia[] = [];

  try {
    auditedItems = await engine.audit({
      pontos,
      rastreios,
      horarios: [], // Horários padrão salvos no workspace
      escalas: [],  // Escalas salvas no workspace
      dateKey: startDate,
      workspaceId,
    });

    // Passo 5: Salvar Snapshot do Dia e gerar Pendências
    if (auditedItems.length > 0) {
      await adapter.saveSnapshot(workspaceId, startDate, auditedItems);

      const pendenciaService = new PendenciaService(adapter);
      generatedPendencias = await pendenciaService.autoGerarDeAuditoria(auditedItems, workspaceId);
    }
  } catch (err: unknown) {
    erros.push(`Erro durante a execução do AuditEngine: ${(err as Error).message}`);
  }

  const duracaoMs = Date.now() - startTime;
  const status: 'sucesso' | 'parcial' | 'erro' =
    erros.length === 0 ? 'sucesso' : auditedItems.length > 0 ? 'parcial' : 'erro';

  const log: SyncLogEntry = {
    id: `sync_${Date.now()}`,
    workspaceId,
    timestamp: new Date().toISOString(),
    trigger,
    status,
    periodo: { inicio: startDate, fim: endDate },
    metricas: {
      pontosRecebidos: rawPontosNormalized.length,
      trajetosRecebidos: rawTrackingEvents.length,
      motoristasAuditados: auditedItems.length,
      pendenciasGeradas: generatedPendencias.length,
      duracaoMs,
    },
    erros: erros.length > 0 ? erros : undefined,
    detalhes: { icarusStatus, cobliStatus },
  };

  saveSyncLog(log);

  return {
    success: status !== 'erro',
    log,
    auditItems: auditedItems,
    pendencias: generatedPendencias,
  };
}
