/* Papéis de acesso.
 *
 * Esta lista é a MESMA de `server/lib/permissoes.js`, e agora isso importa de verdade: desde a
 * Fase 4 o papel não é mais rótulo organizacional — é o que o servidor consulta para autorizar ou
 * recusar cada requisição. Um papel que exista aqui e não lá seria aceito na tela e rejeitado na
 * chamada, o pior dos dois mundos.
 *
 * `visualizador` foi renomeado para `colaborador` para casar com o backend. Cadastros antigos
 * (ambiente de demonstração de versões anteriores) são convertidos na leitura por
 * `normalizarPapel` — ninguém perde um vínculo por causa de um nome que mudou. */
export type UserRole = 'administrador' | 'rh' | 'gestor' | 'auditor' | 'colaborador';

export interface UserAccess {
  id: string;
  nome: string;
  papel: UserRole;
}

export const PAPEL_LABEL: Record<UserRole, string> = {
  administrador: 'Administrador',
  rh: 'RH',
  gestor: 'Gestor',
  auditor: 'Auditor',
  colaborador: 'Colaborador',
};

const PAPEIS_VALIDOS = new Set<string>(Object.keys(PAPEL_LABEL));

export function normalizarPapel(papel: string): UserRole {
  if (papel === 'visualizador') return 'colaborador';
  return PAPEIS_VALIDOS.has(papel) ? (papel as UserRole) : 'colaborador';
}
