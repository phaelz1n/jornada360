import { NextResponse } from 'next/server';
import { loadSetembroHorasExtras } from '@/services/excel-he-service';
import { getAllJustificativas } from '@/lib/db/justificativas-store';

export async function GET() {
  try {
    const overrides = getAllJustificativas();
    const result = loadSetembroHorasExtras(overrides);

    return NextResponse.json({
      success: true,
      items: result.items,
      summary: result.summary,
    });
  } catch (error: unknown) {
    console.error('Erro ao carregar horas extras:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
