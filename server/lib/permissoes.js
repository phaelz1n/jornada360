/* RBAC — matriz de permissões por papel.
 *
 * Papéis vindos do `UserAccess` que já existia no frontend; nenhum foi inventado aqui.
 *
 * PRINCÍPIO: esconder um botão na interface não é segurança. Toda rota que altera ou lê dado
 * sensível verifica a permissão NO SERVIDOR (ver middlewares/autorizar.js). A interface pode usar
 * a mesma matriz para esconder o que não faz sentido mostrar, mas isso é conveniência, não
 * controle de acesso.
 *
 * As permissões são poucas e agrupadas por AÇÃO DE NEGÓCIO, não por endpoint. Criar uma permissão
 * por rota geraria dezenas de nomes arbitrários que ninguém consegue auditar depois. */

export const PAPEIS = ['administrador', 'rh', 'gestor', 'auditor', 'colaborador'];

export const PERMISSOES = {
  /* Cadastro da empresa: unidades, setores, escalas, colaboradores, regras, integrações. */
  CONFIG_LER: 'config:ler',
  CONFIG_ESCREVER: 'config:escrever',

  /* Usuários e papéis dentro do tenant — separado de CONFIG porque conceder acesso é uma
   * decisão de outra natureza que cadastrar um setor. */
  USUARIOS_GERIR: 'usuarios:gerir',

  /* Dados operacionais: dias processados pelo motor. */
  DADOS_LER: 'dados:ler',
  DADOS_ESCREVER: 'dados:escrever',

  /* Pendências: tratar (setor/causa/justificativa/resolver) é diferente de revisar
   * (aprovar/reprovar) — a separação existe justamente para que possam ser pessoas diferentes. */
  PENDENCIA_LER: 'pendencia:ler',
  PENDENCIA_TRATAR: 'pendencia:tratar',
  PENDENCIA_REVISAR: 'pendencia:revisar',

  AUDITORIA_LER: 'auditoria:ler',
  RELATORIO_EXPORTAR: 'relatorio:exportar',

  /* Excluir a empresa inteira. Deliberadamente exclusivo do administrador. */
  TENANT_EXCLUIR: 'tenant:excluir',
};

const P = PERMISSOES;

/* Matriz papel → permissões.
 *
 * Decisões que valem explicação:
 * - `auditor` lê tudo e exporta, mas NÃO altera nada. É o papel de quem confere, e dar-lhe
 *   escrita descaracterizaria a função.
 * - `gestor` trata pendências mas não revisa: quem executa não deveria aprovar o próprio
 *   trabalho. Revisar é de RH/DP e administrador.
 * - `colaborador` vê apenas as próprias pendências (filtro aplicado na consulta) e não configura
 *   nada. É o papel mais restrito, preparado para um futuro portal do colaborador. */
export const MATRIZ = {
  administrador: Object.values(P),

  rh: [
    P.CONFIG_LER, P.CONFIG_ESCREVER,
    P.DADOS_LER, P.DADOS_ESCREVER,
    P.PENDENCIA_LER, P.PENDENCIA_TRATAR, P.PENDENCIA_REVISAR,
    P.AUDITORIA_LER, P.RELATORIO_EXPORTAR,
  ],

  gestor: [
    P.CONFIG_LER,
    P.DADOS_LER,
    P.PENDENCIA_LER, P.PENDENCIA_TRATAR,
    P.RELATORIO_EXPORTAR,
  ],

  auditor: [
    P.CONFIG_LER,
    P.DADOS_LER,
    P.PENDENCIA_LER,
    P.AUDITORIA_LER, P.RELATORIO_EXPORTAR,
  ],

  colaborador: [
    P.PENDENCIA_LER,
  ],
};

export function permissoesDoPapel(papel) {
  return MATRIZ[papel] ?? [];
}

export function podeExecutar(papel, permissao) {
  return permissoesDoPapel(papel).includes(permissao);
}
