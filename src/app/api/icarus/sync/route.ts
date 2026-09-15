import { NextResponse } from 'next/server';
import { IcarusClient } from '@/lib/icarus/client';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, baseUrl, startDate, endDate } = body;

    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    const client = new IcarusClient(token, baseUrl);
    const result = await client.getBatidas(start, end);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
