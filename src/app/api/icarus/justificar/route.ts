import { NextResponse } from 'next/server';
import { IcarusClient } from '@/lib/icarus/client';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, baseUrl, payload } = body;

    if (!payload?.justificativa || !payload?.colaboradorNome || !payload?.data) {
      return NextResponse.json(
        { success: false, message: 'Dados incompletos para envio da justificativa.' },
        { status: 400 }
      );
    }

    const client = new IcarusClient(token, baseUrl);
    const result = await client.enviarJustificativa(payload);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
