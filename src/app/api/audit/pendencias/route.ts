import { NextResponse } from 'next/server';
import { loadRealAuditItems } from '@/services/real-data-service';
import { getAdapter } from '@/lib/db';
import { PendenciaService } from '@/services/pendencia-service';
import type { Pendencia } from '@/types/pendencia';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';

    const adapter = await getAdapter();
    const pendenciaService = new PendenciaService(adapter);

    // Listar pendências existentes
    let pendencias = await pendenciaService.listar(workspaceId);

    // Filtrar/expurgar dados mock de exemplo se ainda existirem
    const mockNames = new Set([
      'CARLOS EDUARDO SILVA',
      'MARCOS ANTONIO DE SOUZA',
      'ROBERTO CARLOS PEREIRA',
      'FERNANDO HENRIQUE COSTA',
      'LUCAS GABRIEL SANTOS',
    ]);
    const hasMocks = pendencias.some(p => mockNames.has(p.motorista) || p.id.startsWith('mock_') || p.id.startsWith('pend_mock'));

    // Se não há pendências ou se há dados mock, gerar a partir da auditoria real consolidada
    if (pendencias.length === 0 || hasMocks) {
      const { items } = loadRealAuditItems(workspaceId);
      if (items.length > 0) {
        pendencias = await pendenciaService.autoGerarDeAuditoria(items, workspaceId);
      }
    }

    // Ordenar: mais críticas primeiro, e depois por data decrescente
    const prioridadePeso = { critica: 4, alta: 3, media: 2, baixa: 1 };
    pendencias.sort((a, b) => {
      const diffPrio = (prioridadePeso[b.prioridade] || 0) - (prioridadePeso[a.prioridade] || 0);
      if (diffPrio !== 0) return diffPrio;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const abertas = pendencias.filter(p => p.status !== 'resolvida' && p.status !== 'descartada').length;
    const resolvidas = pendencias.filter(p => p.status === 'resolvida').length;

    return NextResponse.json({
      success: true,
      pendencias,
      total: pendencias.length,
      abertas,
      resolvidas,
    });
  } catch (error: unknown) {
    console.error('Erro ao listar pendências:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { workspaceId = 'default', forceRegenerate = false } = body;

    const adapter = await getAdapter();
    const pendenciaService = new PendenciaService(adapter);

    // Carregar itens reais da planilha / Icarus / Cobli
    const { items, availableDates } = loadRealAuditItems(workspaceId);
    if (items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Nenhum item de auditoria disponível para gerar pendências.' },
        { status: 404 }
      );
    }

    if (forceRegenerate) {
      // Limpar pendências antigas não resolvidas
      const existing = await pendenciaService.listar(workspaceId);
      for (const p of existing) {
        if (p.status !== 'resolvida') {
          try {
            await adapter.deletePendencia(p.id);
          } catch {}
        }
      }
    }

    // Auto-gerar pendências reais (já purga os mocks internamente)
    const geradas = await pendenciaService.autoGerarDeAuditoria(items, workspaceId);
    const todas = await pendenciaService.listar(workspaceId);

    // Ordenar
    const prioridadePeso = { critica: 4, alta: 3, media: 2, baixa: 1 };
    todas.sort((a, b) => {
      const diffPrio = (prioridadePeso[b.prioridade] || 0) - (prioridadePeso[a.prioridade] || 0);
      if (diffPrio !== 0) return diffPrio;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const abertas = todas.filter(p => p.status !== 'resolvida' && p.status !== 'descartada').length;
    const resolvidas = todas.filter(p => p.status === 'resolvida').length;

    return NextResponse.json({
      success: true,
      message: `Pendências sincronizadas com sucesso! ${geradas.length} geradas/atualizadas da auditoria real.`,
      pendencias: todas,
      total: todas.length,
      abertas,
      resolvidas,
      datasAuditadas: availableDates.length,
    });
  } catch (error: unknown) {
    console.error('Erro ao sincronizar pendências:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
