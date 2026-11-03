const ADMIN_EMAIL = 'operacional4@transpinho.com';
const FERIAS_EMAILS = new Set(['operacional4@transpinho.com', 'rh@transpinho.com', 'tielle@transpinho.com']);

export function getSystemAccess(email, permissions = {}) {
  const normalized = String(email || '').trim().toLowerCase();
  const base = {
    admin: normalized === ADMIN_EMAIL,
    jornada: Boolean(normalized),
    ferias: FERIAS_EMAILS.has(normalized)
  };
  return Object.freeze({ ...base, ...(permissions[normalized] || {}) });
}

export function canAccessSystem(email, system, permissions = {}) {
  return Boolean(getSystemAccess(email, permissions)[system]);
}

export const SYSTEM_CATALOG = Object.freeze([
  { id: 'jornada', name: 'Jornada360', description: 'Ponto, escala, rastreador e checklist operacional.', path: '/jornada', tone: 'blue' },
  { id: 'ferias', name: 'Controle de férias', description: 'Planejamento, cobertura, turnos e aprovação do RH.', path: '/ferias', tone: 'green' }
]);
