import { NextResponse } from 'next/server';
import { saveJustificativa } from '@/lib/db/justificativas-store';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { id, justificativa, usuario, usuarioUid } = body;

    if (!id || justificativa === undefined) {
      return NextResponse.json(
        { success: false, message: 'Parâmetros "id" e "justificativa" são obrigatórios.' },
        { status: 400 }
      );
    }

    const record = saveJustificativa(
      id,
      String(justificativa).trim(),
      usuario || 'Usuário Atual',
      usuarioUid
    );

    return NextResponse.json({
      success: true,
      message: 'Justificativa salva e auditada com sucesso!',
      record,
    });
  } catch (error: unknown) {
    console.error('Erro ao salvar justificativa:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
