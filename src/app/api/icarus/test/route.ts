import { NextResponse } from 'next/server';
import { IcarusClient } from '@/lib/icarus/client';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, baseUrl, empresaId } = body;

    const client = new IcarusClient(token, baseUrl, empresaId);
    const result = await client.testConnection();

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 200 }
    );
  }
}
