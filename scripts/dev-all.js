/* Sobe a pilha completa com um comando: API + frontend.
 *
 * Escrito à mão, sem `concurrently` nem equivalente, porque o trabalho é pequeno demais para
 * justificar uma dependência: são dois processos filhos e um encerramento em conjunto. Toda
 * dependência nova é uma coisa a mais para auditar, atualizar e explicar a quem abre o projeto.
 *
 * Uso: npm run dev:all */
import { spawn } from 'node:child_process';

const CORES = { api: '\x1b[36m', web: '\x1b[32m', reset: '\x1b[0m' };

/* No Windows o `npm` é um `.cmd`, e o Node recusa executá-lo sem shell (`EINVAL`). Daí `shell:
 * true`. O comando vai como UMA string, sem lista de argumentos: passar argumentos separados junto
 * com `shell: true` é o que o Node deprecia, porque eles seriam concatenados sem escape — um vetor
 * de injeção quando vêm de fora. Aqui não vêm: são duas constantes escritas neste arquivo. */
function iniciar(nome, comando) {
  const filho = spawn(comando, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

  const prefixar = (fluxo) => (dados) => {
    for (const linha of String(dados).split('\n')) {
      if (linha.trim()) fluxo.write(`${CORES[nome]}[${nome}]${CORES.reset} ${linha}\n`);
    }
  };

  filho.stdout.on('data', prefixar(process.stdout));
  filho.stderr.on('data', prefixar(process.stderr));

  filho.on('exit', (codigo) => {
    console.log(`${CORES[nome]}[${nome}]${CORES.reset} encerrado (código ${codigo}).`);
    /* Se um dos dois cai, o outro sozinho não serve para nada — melhor encerrar tudo do que
     * deixar a pessoa achando que a pilha está no ar. */
    encerrar(codigo ?? 1);
  });

  return filho;
}

const filhos = [];
let encerrando = false;

function encerrar(codigo) {
  if (encerrando) return;
  encerrando = true;
  for (const f of filhos) {
    if (!f.killed) f.kill();
  }
  process.exit(codigo);
}

process.on('SIGINT', () => encerrar(0));
process.on('SIGTERM', () => encerrar(0));

console.log('Subindo API (http://localhost:3333) e frontend (http://localhost:5173).');
console.log('O frontend faz proxy de /api para a API — abra apenas http://localhost:5173.\n');

filhos.push(iniciar('api', 'npm run server'));
filhos.push(iniciar('web', 'npm run dev'));
