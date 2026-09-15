// ============================================================
// Armazenamento e Auditoria de Justificativas
// ============================================================

import fs from 'fs';
import path from 'path';

export interface JustificativaRecord {
  id: string;
  justificativa: string;
  alteradoPor: string;
  alteradoPorUid?: string;
  alteradoEm: string;
  historico: Array<{
    justificativa: string;
    alteradoPor: string;
    alteradoEm: string;
  }>;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'justificativas.json');

function ensureStoreFile(): Record<string, JustificativaRecord> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      fs.writeFileSync(STORE_FILE, JSON.stringify({}, null, 2), 'utf-8');
      return {};
    }
    const content = fs.readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(content || '{}');
  } catch (err) {
    console.error('Erro ao ler justificativas:', err);
    return {};
  }
}

export function getAllJustificativas(): Record<string, JustificativaRecord> {
  return ensureStoreFile();
}

export function saveJustificativa(
  id: string,
  justificativa: string,
  usuario: string,
  usuarioUid?: string
): JustificativaRecord {
  const store = ensureStoreFile();
  const existing = store[id];

  const now = new Date();
  const nowFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const historico = existing?.historico ? [...existing.historico] : [];
  if (existing && existing.justificativa) {
    historico.push({
      justificativa: existing.justificativa,
      alteradoPor: existing.alteradoPor,
      alteradoEm: existing.alteradoEm,
    });
  }

  const record: JustificativaRecord = {
    id,
    justificativa,
    alteradoPor: usuario || 'Usuário Desconhecido',
    alteradoPorUid: usuarioUid,
    alteradoEm: nowFormatted,
    historico,
  };

  store[id] = record;

  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar justificativa:', err);
  }

  return record;
}
