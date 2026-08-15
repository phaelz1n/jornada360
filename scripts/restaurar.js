#!/usr/bin/env node
/* Restauração do banco a partir de um backup.
 *
 *   npm run restaurar                          restaura o backup MAIS RECENTE
 *   npm run restaurar -- <caminho.db>          restaura um arquivo específico
 *   npm run restaurar -- --testar              ENSAIO: restaura numa cópia, confere e não toca no banco real
 *
 * O modo `--testar` existe para a única pergunta que importa sobre um backup: **ele funciona?**
 * Um backup nunca restaurado é uma suposição. Este modo permite responder isso a qualquer momento,
 * inclusive num agendamento, sem risco nenhum para o banco em uso.
 *
 * PARE O SERVIDOR antes de uma restauração real. Substituir o arquivo embaixo de um processo que
 * está escrevendo é como trocar o pneu com o carro andando. O script avisa, mas não tem como
 * impedir — quem opera decide. */
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { carregarConfig } from '../server/config.js';
import { listarBackups, restaurarBackup, verificarBackup } from '../server/lib/backup.js';
import { fecharBanco, caminhoBanco } from '../server/db/index.js';

const config = carregarConfig();
const args = process.argv.slice(2);
const modoTeste = args.includes('--testar');
const semPergunta = args.includes('--sim');
const alvoExplicito = args.find((a) => !a.startsWith('--'));

function escolherBackup() {
  if (alvoExplicito) return alvoExplicito;
  const lista = listarBackups(config);
  if (lista.length === 0) return null;
  return lista[0].caminho;
}

const backup = escolherBackup();

if (!backup) {
  console.error(`\n✗ Nenhum backup encontrado em ${config.backup.diretorio || '(JORNADA_BACKUP_DIR não definida)'}.\n`);
  process.exit(1);
}

if (!existsSync(backup)) {
  console.error(`\n✗ Arquivo não encontrado: ${backup}\n`);
  process.exit(1);
}

console.log(`\nBackup escolhido: ${backup}`);

/* ---------------------------------------------------------------- ensaio */

if (modoTeste) {
  console.log('\nMODO ENSAIO — o banco em uso NÃO será tocado.\n');

  const temporario = mkdtempSync(join(tmpdir(), 'jornada360-ensaio-'));
  const destino = join(temporario, 'restaurado.db');

  try {
    const r = restaurarBackup(backup, { destino });
    if (!r.ok) {
      console.error(`✗ ENSAIO FALHOU: ${r.erro}\n`);
      console.error('  Este backup NÃO serviria numa restauração real. Investigue antes de precisar dele.\n');
      process.exit(1);
    }

    console.log('✓ O backup restaurou e abriu corretamente numa cópia isolada.\n');
    console.log('  Conteúdo lido do banco restaurado:');
    for (const [tabela, n] of Object.entries(r.contagens)) {
      console.log(`    ${tabela.padEnd(14)} ${String(n).padStart(6)}`);
    }
    console.log('\n  Nada foi alterado no banco em uso.\n');
  } finally {
    rmSync(temporario, { recursive: true, force: true });
  }

  fecharBanco();
  process.exit(0);
}

/* ---------------------------------------------------------------- restauração real */

const verificacao = verificarBackup(backup);
if (!verificacao.ok) {
  console.error(`\n✗ Este backup é INVÁLIDO: ${verificacao.erro}`);
  console.error('  A restauração foi cancelada. O banco atual não foi tocado.\n');
  process.exit(1);
}

console.log('\nConteúdo do backup:');
for (const [tabela, n] of Object.entries(verificacao.contagens)) {
  console.log(`  ${tabela.padEnd(14)} ${String(n).padStart(6)}`);
}
console.log(`\nDestino: ${caminhoBanco()}`);
console.log('\n⚠  Isto SUBSTITUI o banco em uso. Uma cópia do banco atual será guardada ao lado,');
console.log('   com o sufixo .pre-restauracao — mas o servidor deve estar PARADO agora.\n');

if (!semPergunta) {
  const leitor = createInterface({ input: process.stdin, output: process.stdout });
  const resposta = await leitor.question('Digite RESTAURAR para confirmar: ');
  leitor.close();
  if (resposta.trim() !== 'RESTAURAR') {
    console.log('\nCancelado. Nada foi alterado.\n');
    process.exit(0);
  }
}

/* O banco precisa estar fechado neste processo antes de sobrescrever o arquivo. */
fecharBanco();

const r = restaurarBackup(backup);

if (!r.ok) {
  console.error(`\n✗ RESTAURAÇÃO FALHOU: ${r.erro}`);
  if (r.copiaDeSeguranca) console.error(`  O banco anterior está em: ${r.copiaDeSeguranca}`);
  console.error('');
  process.exit(1);
}

console.log('\n✓ Restauração concluída e conferida.');
if (r.copiaDeSeguranca) console.log(`  Banco anterior guardado em: ${r.copiaDeSeguranca}`);
console.log('\n  Conteúdo do banco restaurado:');
for (const [tabela, n] of Object.entries(r.contagens)) {
  console.log(`    ${tabela.padEnd(14)} ${String(n).padStart(6)}`);
}
console.log('\n  Suba o servidor de novo.\n');
