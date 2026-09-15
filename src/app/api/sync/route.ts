import { NextResponse } from 'next/server';
import { syncAndAuditPipeline } from '@/services/sync-pipeline-service';

/**
 * Disparo via Vercel Cron (GET diário às 03:00 e 06:00)
 */
export async function GET(request: Request) {
  try {
    // Validação opcional de segurança do Vercel Cron Secret
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, message: 'Não autorizado.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';

    const result = await syncAndAuditPipeline({
      workspaceId,
      trigger: 'cron',
    });

    return NextResponse.json(result, { status: result.success ? 200 : 207 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Disparo Manual via Interface ("Sincronizar APIs Agora")
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      workspaceId = 'default',
      startDate,
      endDate,
      icarusToken,
      icarusBaseUrl,
      cobliApiKey,
      cobliBaseUrl,
    } = body;

    const result = await syncAndAuditPipeline({
      workspaceId,
      startDate,
      endDate,
      trigger: 'manual',
      icarusToken,
      icarusBaseUrl,
      cobliApiKey,
      cobliBaseUrl,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 207 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
