import { NextResponse } from 'next/server';
import { CobliClient } from '@/lib/cobli/client';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { apiKey, baseUrl } = body;

    const client = new CobliClient(apiKey, baseUrl);
    const result = await client.testConnection();

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
