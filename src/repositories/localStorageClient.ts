/* Único lugar do projeto que fala com `localStorage` para os dados "próprios" do Jornada360
 * (workspace, empresa, colaboradores, escalas, auditoria...). O motor real de HE tem seu próprio
 * namespace (`assistente_he_local_...`, ver src/engine/heEngineBridge.ts) porque precisa
 * continuar compatível com o iframe do Assistente HE Diário — os dois nunca se misturam.
 *
 * Quando o Jornada360 ganhar um backend, só este arquivo (e os repositórios que o usam) precisa
 * ser reescrito para chamar uma API em vez de `localStorage`; nada acima na camada de serviços ou
 * na interface deveria precisar mudar. */

export const APP_PREFIX = 'jornada360:';

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  localStorage.removeItem(key);
}

export function listKeysWithPrefix(prefix: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) out.push(k);
  }
  return out;
}
