/*
 * Ponte de dados com o Assistente HE Diário (public/motor-he/index.html), que roda num iframe da
 * mesma origem. O motor lá dentro detecta que não está no ambiente do Claude (window.storage
 * indisponível) e cai no fallback local dele: localStorage com um prefixo por workspace (o iframe
 * lê esse mesmo workspace via querystring `?ws=`, ver src/pages/MotorHE.tsx). Como iframe e
 * página-pai da mesma origem compartilham o MESMO localStorage, lemos e escrevemos essas chaves
 * diretamente daqui — sem postMessage, sem duplicar o parsing de planilha (que continua só lá).
 *
 * Todo namespace é isolado por workspaceId — é isso que garante que o ambiente Demo nunca vaze
 * pro Real (e vice-versa): cada um vive sob um prefixo de chave completamente diferente.
 */
import { normName, type HECaseState, type HEDiaSnapshot } from './heEngineCore';

const SNAPSHOT_SUFFIX = 'he_dia_snapshot_';
const STORAGE_SUFFIX = 'he_diario_';

function prefixFor(workspaceId: string): string {
  return `assistente_he_local_${workspaceId}_`;
}

export function listProcessedDateKeys(workspaceId: string): string[] {
  const prefix = prefixFor(workspaceId) + SNAPSHOT_SUFFIX;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k.slice(prefix.length));
  }
  return keys.sort();
}

export function loadSnapshot(workspaceId: string, dk: string): HEDiaSnapshot | null {
  const raw = localStorage.getItem(prefixFor(workspaceId) + SNAPSHOT_SUFFIX + dk);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HEDiaSnapshot;
  } catch {
    return null;
  }
}

export function saveSnapshot(workspaceId: string, snapshot: HEDiaSnapshot): void {
  localStorage.setItem(prefixFor(workspaceId) + SNAPSHOT_SUFFIX + snapshot.dateKey, JSON.stringify(snapshot));
}

/* Mesma migração de formato antigo (booleano puro) que o motor faz ao carregar. */
export function loadCaseState(workspaceId: string, dk: string): Record<string, HECaseState> {
  const raw = localStorage.getItem(prefixFor(workspaceId) + STORAGE_SUFFIX + dk);
  if (!raw) return {};
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  const out: Record<string, HECaseState> = {};
  for (const k in parsed) {
    const v = parsed[k];
    out[k] = typeof v === 'boolean' ? { done: v } : ((v as HECaseState) || {});
  }
  return out;
}

function saveCaseState(workspaceId: string, dk: string, state: Record<string, HECaseState>) {
  localStorage.setItem(prefixFor(workspaceId) + STORAGE_SUFFIX + dk, JSON.stringify(state));
}

/* Atualiza um campo de um caso (dia + motorista) sem mexer nos demais — mesmo formato que o
 * motor grava, então o iframe (se recarregado, no mesmo workspace) lê a edição feita aqui
 * normalmente. */
export function updateCaseField(
  workspaceId: string,
  dk: string,
  motorista: string,
  patch: Partial<HECaseState>,
) {
  const state = loadCaseState(workspaceId, dk);
  const key = normName(motorista);
  state[key] = { ...state[key], ...patch };
  saveCaseState(workspaceId, dk, state);
  return state[key];
}

/* Apaga só os dias processados (snapshot + progresso) guardados NESTE navegador/origem, PARA ESTE
 * WORKSPACE — nunca toca em outro workspace, nem no arquivo original que o usuário abre por fora
 * (esse fica em outra origem, intocado). Usado quando o histórico daqui está desatualizado/confuso
 * e o usuário quer recomeçar limpo, processando só os próximos dias a partir de agora. */
export function limparTodosOsDiasProcessados(workspaceId: string): number {
  const prefix = prefixFor(workspaceId);
  const alvo: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith(prefix + SNAPSHOT_SUFFIX) || k.startsWith(prefix + STORAGE_SUFFIX))) {
      alvo.push(k);
    }
  }
  alvo.forEach((k) => localStorage.removeItem(k));
  return alvo.length;
}
