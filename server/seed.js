/* Seed de DEMONSTRAÇÃO do backend.
 *
 * Deliberadamente separado de qualquer dado de produção e executado só por comando explícito
 * (`npm run server:seed`) — nunca no boot do servidor. Um seed que roda sozinho é a forma mais
 * fácil de dado fictício acabar num ambiente real.
 *
 * O tenant criado aqui nasce com `environment: 'demo'`, que é o que a interface usa para estampar
 * o aviso roxo. */
import { migrar, fecharBanco } from './db/index.js';
import * as usuarios from './repositories/userRepository.js';
import * as tenants from './repositories/tenantRepository.js';
import * as empresa from './repositories/empresaRepository.js';

const CONTA_DEMO = {
  email: 'demo@jornada360.local',
  nome: 'Usuário de Demonstração',
  /* Credencial de demonstração, pública de propósito: este ambiente não tem dado real nenhum.
   * Uma conta de produção JAMAIS deve ser criada por seed com senha conhecida. */
  senha: 'demo-jornada-360',
};

/* Nomes 100% fictícios — nenhuma relação com operação real. */
const SETORES = ['Operacional', 'Trânsito', 'Garagem', 'Administrativo'];
const COLABORADORES = ['João da Silva', 'Carlos Oliveira', 'Marcos Santos', 'Ana Ferreira', 'Juliana Costa'];

function executar() {
  migrar();

  if (usuarios.buscarPorEmail(CONTA_DEMO.email)) {
    console.log('[seed] a conta de demonstração já existe — nada a fazer.');
    return;
  }

  const usuario = usuarios.criarUsuario(CONTA_DEMO);
  const tenant = tenants.criarTenant({
    nome: 'Jornada360 Demo',
    environment: 'demo',
    criadoPorUserId: usuario.id,
    papel: 'administrador',
  });

  const unidade = empresa.salvarUnidade(tenant.id, {
    nome: 'Base Central',
    codigo: 'BC01',
    localizacao: 'Cidade Fictícia/UF',
  });

  for (const nome of SETORES) {
    empresa.salvarSetor(tenant.id, { nome, unidadeId: unidade.id, responsavel: '' });
  }

  const escala = empresa.salvarEscala(tenant.id, {
    nome: 'Turno padrão',
    entrada: '08:00',
    saida: '18:00',
    diasTrabalhados: ['seg', 'ter', 'qua', 'qui', 'sex'],
    folgas: ['sab', 'dom'],
    heProgramadaMin: 60,
  });

  const setores = empresa.listarSetores(tenant.id);
  COLABORADORES.forEach((nome, i) => {
    empresa.salvarColaborador(tenant.id, {
      nome,
      matricula: `D${String(i + 1).padStart(3, '0')}`,
      cargo: 'Operador',
      setorId: setores[i % setores.length].id,
      unidadeId: unidade.id,
      status: 'ativo',
      escalaId: escala.id,
    });
  });

  /* Meta diária de EXEMPLO, só neste tenant de demonstração — empresas reais nascem com 0. */
  const regras = empresa.obterRegras(tenant.id);
  empresa.salvarRegras(tenant.id, {
    regras: { ...regras.regras, dailyGoalMin: 36 * 60 + 50 },
    causaOpts: ['Rastreador com defeito', 'Hábito de bater ponto errado', 'Escala desatualizada', 'Autorizado antecipadamente', 'Outro'],
  });

  console.log('[seed] ambiente de demonstração criado.');
  console.log(`[seed]   e-mail: ${CONTA_DEMO.email}`);
  console.log(`[seed]   senha:  ${CONTA_DEMO.senha}`);
  console.log(`[seed]   tenant: ${tenant.id} (environment=demo)`);
  console.log('[seed] os dias processados fictícios são gerados pelo frontend (src/demo/seedDemo.ts).');
}

try {
  executar();
} finally {
  fecharBanco();
}
