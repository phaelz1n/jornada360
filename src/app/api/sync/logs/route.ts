import { NextResponse } from 'next/server';
import { getSyncLogs } from '@/services/sync-pipeline-service';

export async function GET() {
  try {
    const logs = getSyncLogs();
    return NextResponse.json({ success: true, logs });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
