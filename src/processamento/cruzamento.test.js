import test from 'node:test';
import assert from 'node:assert/strict';
import { crossSources } from './cruzamento.js';

test('cruza ponto, escala e rastreador pelo nome normalizado', () => {
  const [row] = crossSources({ pointRows: [{ motorista: ' Ana   Silva ', he1min: 30 }], scaleRows: [{ nome: 'ANA SILVA', horario: '08:00' }], trackerRows: [{ colaborador: 'Ana Silva', sinais: 4 }] });
  assert.equal(row.statusCruzamento, 'completo');
  assert.equal(row.escala.horario, '08:00');
  assert.equal(row.rastreio.sinais, 4);
});

test('classifica fonte ausente sem descartar o ponto', () => assert.equal(crossSources({ pointRows: [{ motorista: 'Bia' }] })[0].statusCruzamento, 'sem correspondência'));
test('aponta motorista sem horário padrão mesmo sem hora extra', () => {
  const [row] = crossSources({ pointRows: [{ motorista: 'Bia', he1min: 0 }], scaleRows: [{ nome: 'Bia', horario: '08:00' }] });
  assert.equal(row.semHorarioPadrao, true);
  assert.equal(row.padraoStatus, 'sem_cadastro');
});
test('aceita nome abreviado quando há uma única correspondência segura', () => {
  const [row] = crossSources({ pointRows: [{ motorista: 'Cristiano Barreto' }], scaleRows: [{ nome: 'Cristiano Francisco Barreto', horario: '16:30' }] });
  assert.equal(row.statusCruzamento, 'sem rastreador');
  assert.equal(row.escala.horario, '16:30');
});

test('anexa a análise das paradas do rastreador ao cruzamento', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ana', batidas: ['16:32', '20:05'] }],
    scaleRows: [{ nome: 'Ana', inicio: '16:30', fim: '20:00', linha: 'Droga Raia' }],
    trackerRows: [{ colaborador: 'Ana', paradas: [{ horario: '16:34', duracaoMin: 8, local: 'Droga Raia' }] }]
  });
  assert.equal(row.paradasRastreador[0].status, 'confirmada');
  assert.equal(row.paradasRastreador[0].linha, 'Droga Raia');
});

test('usa a coluna EXTRA individual do horário padrão', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ana', he1min: 120, he2min: 60, he3min: 0 }],
    standardRows: [{ motorista: 'Ana', extraNormalPadrao: 120, horarios: ['08:00:00'] }]
  });
  assert.equal(row.padraoCadastradoMin, 120);
  assert.equal(row.metaDiaMin, 120);
  assert.deepEqual(row.padraoHorarios, ['08:00:00']);
});

test('separa extra dentro e fora do padrão e informa evidência do rastreador', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ademir Monteiro', totalHE: 30, he1min: 30, batidas: ['12:20', '12:30'] }],
    standardRows: [{ motorista: 'Ademir Monteiro', extraNormalPadrao: 10, horarios: ['08:00'] }],
    trackerRows: [{ colaborador: 'Ademir Monteiro', paradas: [{ horario: '12:20', duracaoMin: 20 }] }]
  });
  assert.equal(row.heDentroPadraoMin, 10);
  assert.equal(row.heAcimaPadraoMin, 20);
  assert.equal(row.evidenciaRastreador[0].status, 'confirmada');
  assert.equal(row.rastreadorStatus, 'confirmado');
});

test('marca possível padrão incorreto após cinco dias consistentes', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ademir Monteiro', totalHE: 30, he1min: 30 }],
    standardRows: [{ motorista: 'Ademir Monteiro', extraNormalPadrao: 10 }],
    trackerRows: [{ colaborador: 'Ademir Monteiro', paradas: [{ horario: '12:20', duracaoMin: 20 }] }],
    patternHistory: { 'ADEMIR MONTEIRO': [30, 30, 30, 30, 30] }
  });
  assert.equal(row.padraoSuspeito, true);
});
test('usa o dia seguinte do rastreador somente para jornada noturna', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ana', dateKey: '2026-10-28', batidas: ['22:00', '02:00'], he1min: 30 }],
    scaleRows: [{ motorista: 'Ana', horario: '22:00', linha: 'N1' }],
    trackerRows: [{ motorista: 'Ana', paradas: [{ horario: '23:00', dataKey: '2026-10-28' }, { horario: '01:00', dataKey: '2026-10-29' }, { horario: '10:00', dataKey: '2026-10-29' }] }]
  });
  assert.deepEqual(row.paradasRastreador.map(stop => stop.dataKey), ['2026-10-28', '2026-10-29']);
});

test('marca linha da escala e rastreador como possível extra quando ausente no padrão', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ana', dateKey: '2026-10-27', batidas: ['16:30', '20:00'], he1min: 30 }],
    scaleRows: [{ motorista: 'Ana', horario: '16:30', linha: 'Droga Raia' }],
    standardRows: [{ motorista: 'Ana', extraNormalPadrao: 0, horarios: ['08:00'] }],
    trackerRows: [{ motorista: 'Ana', paradas: [{ horario: '16:32', local: 'Droga Raia' }] }]
  });
  assert.equal(row.linhaExtraCandidata, true);
  assert.match(row.linhaExtraDetalhe, /Droga Raia/);
});

test('separa problema fora da escala de possível linha extra', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ana', dateKey: '2026-10-27', he1min: 30 }],
    scaleRows: [{ motorista: 'Ana', horario: '08:00', linha: 'Linha padrão' }, { motorista: 'Ana', horario: '16:30', linha: 'Droga Raia' }],
    standardRows: [{ motorista: 'Ana', extraNormalPadrao: 0, horarios: ['08:00'] }],
    trackerRows: [{ motorista: 'Ana', paradas: [{ horario: '19:25', local: 'Local não previsto' }] }]
  });
  assert.equal(row.linhaExtraCandidata, false);
  assert.equal(row.foraDaEscalaProblema, true);
  assert.match(row.foraDaEscalaDetalhe, /19:25/);
});

test('marca intervalo menor que uma hora em jornada de seis horas ou mais', () => {
  const [row] = crossSources({ pointRows: [{ motorista: 'Ana', batidas: ['08:00', '12:00', '12:30', '17:00'] }] });
  assert.equal(row.intervaloMenorUmaHora, true);
  assert.equal(row.intervaloObrigatorioAusente, true);
});

test('calcula interjornada do noturno usando o fim do dia anterior', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ademir Monteiro', batidas: ['21:37', '00:28', '03:42', '07:46'] }],
    previousPointRows: [{ motorista: 'Ademir Monteiro', batidas: ['08:00', '12:00', '13:00', '19:00'] }]
  });
  assert.equal(row.descansoInterjornadaMin, 157);
  assert.equal(row.interjornadaProblema, true);
});
