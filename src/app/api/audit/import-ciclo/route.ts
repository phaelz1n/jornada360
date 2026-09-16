// ============================================================
// Endpoint para Importar e Sincronizar o Ciclo Oficial de HE (HE_ciclo_2026-08-28.xlsx)
// ============================================================

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';
import { loadRealAuditItems } from '@/services/real-data-service';
import { getAdapter } from '@/lib/db';
import { PendenciaService } from '@/services/pendencia-service';
import { normalizeName } from '@/lib/utils/normalize';
import type { JustificativaRecord } from '@/lib/db/justificativas-store';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { workspaceId = 'default' } = body;

    const filePath = path.join(process.cwd(), 'HE_ciclo_2026-08-28.xlsx');
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, message: 'Planilha HE_ciclo_2026-08-28.xlsx não encontrada na raiz.' },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(filePath);
    const wb = xlsx.read(fileBuffer, { type: 'buffer' });

    // 1. Extrair todas as justificativas da planilha e salvar em .data/justificativas.json
    const dataDir = path.join(process.cwd(), '.data');
    const storeFile = path.join(dataDir, 'justificativas.json');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    let existingStore: Record<string, JustificativaRecord> = {};
    if (fs.existsSync(storeFile)) {
      try {
        existingStore = JSON.parse(fs.readFileSync(storeFile, 'utf-8') || '{}');
      } catch {
        existingStore = {};
      }
    }

    const wsDet = wb.Sheets['DETALHAMENTO'];
    let justCount = 0;

    if (wsDet) {
      const rows = xlsx.utils.sheet_to_json<any>(wsDet);
      for (const r of rows) {
        const just = String(r['Justificativa'] || '').trim();
        if (!just) continue;

        const diaStr = String(r['Dia'] || '').trim();
        const colab = String(r['Colaborador'] || '').trim();
        const cleanDate = diaStr.replace(/\//g, '');
        const normColab = colab.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

        const parts = diaStr.split('/');
        let dateISO = diaStr;
        if (parts.length === 3) {
          dateISO = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }

        const id1 = `he1_${cleanDate}_${normColab}`;
        const id2 = `he1_${dateISO}_${normColab}`;

        const record: JustificativaRecord = {
          id: id1,
          justificativa: just,
          alteradoPor: 'Planilha Ciclo 28/08',
          alteradoEm: '15/09/2026 11:16',
          historico: [
            {
              justificativa: just,
              alteradoPor: 'Planilha Oficial Ciclo 28/08 a 27/09/2026',
              alteradoEm: '15/09/2026 11:16',
            },
          ],
        };

        existingStore[id1] = record;
        existingStore[id2] = { ...record, id: id2 };
        justCount++;
      }

      fs.writeFileSync(storeFile, JSON.stringify(existingStore, null, 2), 'utf-8');
    }

    // 2. Carregar todos os 1002 itens de auditoria distribuídos nos 18 dias do ciclo
    const { items: allItems, availableDates } = loadRealAuditItems(workspaceId);

    // 3. Atualizar o banco de dados (Firestore / Adapter) com os snapshots de cada dia
    const adapter = await getAdapter();
    const savedSnapshots: string[] = [];
    let totalPendenciasCount = 0;
    const pendenciaService = new PendenciaService(adapter);

    for (const dateKey of availableDates) {
      const dayItems = allItems.filter(it => it.data === dateKey);
      try {
        await adapter.saveSnapshot(workspaceId, dateKey, dayItems);
        savedSnapshots.push(dateKey);

        const pends = await pendenciaService.autoGerarDeAuditoria(dayItems, workspaceId);
        totalPendenciasCount += pends.length;
      } catch (err) {
        console.warn(`Aviso ao salvar snapshot de ${dateKey}:`, err);
      }
    }

    // 4. Salvar configuração do ciclo no workspace
    try {
      const ws = await adapter.getWorkspace(workspaceId);
      if (ws) {
        ws.config.cicloFechamento = {
          diaInicio: 28,
          diaFim: 27,
        };
        await adapter.saveWorkspace(ws);
      }
    } catch (wsErr) {
      console.warn('Aviso ao salvar configuração de ciclo no workspace:', wsErr);
    }

    return NextResponse.json({
      success: true,
      message: `Ciclo 28/08 importado com sucesso! ${allItems.length} lançamentos distribuídos em ${availableDates.length} dias.`,
      planilha: 'HE_ciclo_2026-08-28.xlsx',
      totalLancamentos: allItems.length,
      diasProcessados: availableDates.length,
      datasDisponiveis: availableDates,
      justificativasImportadas: justCount,
      snapshotsGravados: savedSnapshots.length,
      pendenciasGeradas: totalPendenciasCount,
      periodo: {
        inicio: availableDates[0],
        fim: availableDates[availableDates.length - 1],
      },
    });
  } catch (error: unknown) {
    console.error('Erro ao importar ciclo:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
