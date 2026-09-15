import { NextResponse } from 'next/server';
import { loadRealAuditItems } from '@/services/real-data-service';
import { getAdapter } from '@/lib/db';
import { PendenciaService } from '@/services/pendencia-service';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { workspaceId = 'default', date } = body;

    const { items: allItems, availableDates } = loadRealAuditItems(workspaceId);
    if (allItems.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Planilha Setembro.xlsx não encontrada na raiz.' },
        { status: 404 }
      );
    }

    const adapter = await getAdapter();

    // Data alvo: a data informada ou a mais recente disponível
    const targetDate = date && availableDates.includes(date)
      ? date
      : (availableDates[availableDates.length - 1] || availableDates[0]);

    const targetItems = allItems.filter(it => it.data === targetDate);

    // Salvar snapshot real no adapter de forma resiliente
    try {
      await adapter.saveSnapshot(workspaceId, targetDate, targetItems);
    } catch (saveErr) {
      console.warn('Aviso: Não foi possível salvar snapshot no banco:', saveErr);
    }

    // Gerar pendências reais de forma resiliente
    let pendenciasCount = 0;
    try {
      const pendenciaService = new PendenciaService(adapter);
      const pendencias = await pendenciaService.autoGerarDeAuditoria(targetItems, workspaceId);
      pendenciasCount = pendencias.length;
    } catch (pendErr) {
      console.warn('Aviso: Não foi possível gerar pendências automáticas:', pendErr);
    }

    return NextResponse.json({
      success: true,
      message: `Auditoria real sincronizada com sucesso para ${targetDate}!`,
      activeDate: targetDate,
      availableDates,
      items: targetItems,
      totalRegistrosDia: targetItems.length,
      pendenciasCount,
    });
  } catch (error: unknown) {
    console.error('Erro ao sincronizar auditoria real:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
