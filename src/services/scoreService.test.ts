/* Score multidimensional. A regra mais delicada aqui é a que protege o colaborador:
 * dimensão sem base de cálculo sai da média em vez de contar como zero.
 * Ver BUSINESS_RULES.md § Score multidimensional. */
import { describe, it, expect } from 'vitest';
import { calcularScores } from './scoreService';
import { itemComputed, diaComputed } from '../testing/fixtures';

function dias(items: ReturnType<typeof itemComputed>[][]) {
  return items.map((dia, i) => diaComputed(`2026-08-${String(i + 1).padStart(2, '0')}`, dia));
}

describe('scoreService.calcularScores', () => {
  it('calcula conformidade sobre os dias COM padrão cadastrado, não sobre o total', () => {
    // 2 dias dentro, 1 acima, 1 sem cadastro → conformidade = 2/3, não 2/4.
    // Contar o dia sem cadastro como falha puniria o colaborador por lacuna do cadastro.
    const d = dias([
      [itemComputed({ _key: 'A', _padraoStatus: 'dentro' })],
      [itemComputed({ _key: 'A', _padraoStatus: 'dentro' })],
      [itemComputed({ _key: 'A', _padraoStatus: 'acima' })],
      [itemComputed({ _key: 'A', _padraoStatus: 'sem_cadastro' })],
    ]);
    const conformidade = calcularScores(d)[0].dimensoes.find((x) => x.chave === 'conformidade');
    expect(conformidade?.valor).toBe(67);
  });

  it('mede registros completos sobre o total de dias', () => {
    const d = dias([
      [itemComputed({ _key: 'A', _padraoStatus: 'dentro' })],
      [itemComputed({ _key: 'A', _padraoStatus: 'sem_cadastro' })],
    ]);
    const completos = calcularScores(d)[0].dimensoes.find((x) => x.chave === 'registros_completos');
    expect(completos?.valor).toBe(50);
  });

  it('mede confirmação por rastreio só nos dias em que havia rastreio', () => {
    // 'sem_dado' = não havia rastreio para comparar, não falha do colaborador.
    const d = dias([
      [itemComputed({ _key: 'A', _status: 'ok' })],
      [itemComputed({ _key: 'A', _status: 'forte' })],
      [itemComputed({ _key: 'A', _status: 'sem_dado' })],
    ]);
    const rastreio = calcularScores(d)[0].dimensoes.find((x) => x.chave === 'confirmacao_rastreio');
    expect(rastreio?.valor).toBe(50);
  });

  it('marca dimensão como não avaliada (null) quando não há base de cálculo', () => {
    // Colaborador sem nenhuma ocorrência: "tratamento das ocorrências" seria 0 de 0.
    const d = dias([[itemComputed({ _key: 'A', _padraoStatus: 'dentro' })]]);
    const tratamento = calcularScores(d)[0].dimensoes.find((x) => x.chave === 'tratamento');
    expect(tratamento?.valor).toBeNull();
  });

  it('exclui da média a dimensão não avaliada, em vez de contá-la como zero', () => {
    // Este é o teste central do score: se 'tratamento' entrasse como 0, o score cairia
    // injustamente para quem nunca teve ocorrência nenhuma.
    const d = dias([[itemComputed({ _key: 'A', _padraoStatus: 'dentro', _status: 'ok' })]]);
    const s = calcularScores(d)[0];
    const avaliadas = s.dimensoes.filter((x) => x.valor !== null);
    const media = Math.round(avaliadas.reduce((acc, x) => acc + (x.valor as number), 0) / avaliadas.length);
    expect(s.scoreGeral).toBe(media);
    expect(s.scoreGeral).toBe(100);
  });

  it('conta a regularidade de jornada a partir dos alertas do motor', () => {
    const d = dias([
      [itemComputed({ _key: 'A', interjornada: 'Só 8h de descanso' })],
      [itemComputed({ _key: 'A', interjornada: '' })],
    ]);
    const reg = calcularScores(d)[0].dimensoes.find((x) => x.chave === 'regularidade_jornada');
    expect(reg?.valor).toBe(50);
  });

  it('sinaliza reincidência crítica pelo limite configurado', () => {
    const d = dias(Array.from({ length: 6 }, () => [itemComputed({ _key: 'A', _padraoStatus: 'acima' })]));
    expect(calcularScores(d, 5)[0].reincidenteCritico).toBe(true);
    expect(calcularScores(d, 10)[0].reincidenteCritico).toBe(false);
  });

  it('acompanha cada dimensão de uma base de cálculo legível', () => {
    // A tela mostra "4 de 12 dia(s)" — sem isso o número vira caixa-preta.
    const d = dias([[itemComputed({ _key: 'A' })]]);
    for (const dim of calcularScores(d)[0].dimensoes) {
      expect(dim.base).toBeTruthy();
      expect(dim.comoFoiCalculado).toBeTruthy();
    }
  });
});
