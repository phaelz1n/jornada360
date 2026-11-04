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
test('dispensa rastreador para ADM em sábado reduzido', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Adriano Eduardo dos Santos', dateKey: '2026-10-31', batidas: ['07:59', '12:02'] }],
    standardRows: [{ motorista: 'Adriano Eduardo dos Santos', extraNormalPadrao: 0, horarios: ['08:00', '12:00', '13:00', '17:00'] }],
    cadastro: { 'ADRIANO EDUARDO DOS SANTOS': { setor: 'ADM' } }
  });
  assert.equal(row.rastreadorStatus, 'nao-aplicavel');
  assert.equal(row.rastreioDispensado, true);
  assert.equal(row.evidenciaRastreador.length, 0);
  assert.notEqual(row.statusCruzamento, 'sem rastreador');
});
test('calcula extra do ADM pela base de quatro horas no sábado sem padrão', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Adriano Eduardo dos Santos', dateKey: '2026-10-31', batidas: ['07:59', '12:02'] }],
    cadastro: { 'ADRIANO EDUARDO DOS SANTOS': { setor: 'ADM' } }
  });
  assert.equal(row.totalHE, 3);
  assert.equal(row.semHorarioPadrao, false);
  assert.equal(row.padraoStatus, 'dispensado_adm');
  assert.equal(row.jornadaBaseMin, 240);
});
test('calcula extra do ADM acima de oito horas em dia útil', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Adriano Eduardo dos Santos', dateKey: '2026-11-03', batidas: ['08:00', '12:00', '13:00', '18:00'] }],
    cadastro: { 'ADRIANO EDUARDO DOS SANTOS': { setor: 'ADM' } }
  });
  assert.equal(row.totalHE, 60);
  assert.equal(row.jornadaBaseMin, 480);
  assert.equal(row.extraAuditoriaStatus, 'adm-extra-problema');
  assert.match(row.extraAuditoriaDetalhe, /ADM/);
  assert.match(row.justificativaSugerida, /ADM/);
});
test('calcula extra da Reserva pela base de sete horas e vinte sem rastreador', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Bruno Reserva', dateKey: '2026-11-03', batidas: ['08:00', '12:00', '13:00', '16:20'] }],
    cadastro: { 'BRUNO RESERVA': { setor: 'Reserva' } }
  });
  assert.equal(row.totalHE, 0);
  assert.equal(row.jornadaBaseMin, 440);
  assert.equal(row.rastreadorStatus, 'nao-aplicavel');
  assert.equal(row.padraoStatus, 'dispensado_reserva');
});
test('encontra política do cadastro mesmo com acentos no nome', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'José Weber', dateKey: '2026-11-03', batidas: ['08:00', '16:00'] }],
    cadastro: { 'JOSE WEBER': { setor: 'ADM' } }
  });
  assert.equal(row.rastreadorStatus, 'nao-aplicavel');
});
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

test('sugere justificativa com o cliente da linha extra confirmada', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ana', dateKey: '2026-10-27', batidas: ['08:00', '17:00'], totalHE: 30 }],
    scaleRows: [{ motorista: 'Ana', horario: '16:30', linha: 'Transporte Gedore' }],
    standardRows: [{ motorista: 'Ana', horarios: ['08:00', '17:00'], extraNormalPadrao: 0 }],
    trackerRows: [{ motorista: 'Ana', paradas: [{ horario: '16:30', local: 'Gedore' }] }]
  });
  assert.match(row.justificativaSugerida, /Transporte Gedore/);
  assert.match(row.justificativaSugerida, /diverge do padrão/);
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

test('não marca intervalo curto quando já existe intervalo qualificado no dia', () => {
  const [row] = crossSources({ pointRows: [{ motorista: 'Carlos', batidas: ['12:29', '15:48', '17:25', '18:31', '19:30', '21:45'] }] });
  assert.equal(row.intervaloMenorUmaHora, false);
  assert.equal(row.intervaloObrigatorioAusente, false);
});

test('calcula interjornada do noturno usando o fim do dia anterior', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ademir Monteiro', batidas: ['21:37', '00:28', '03:42', '07:46'] }],
    previousPointRows: [{ motorista: 'Ademir Monteiro', batidas: ['08:00', '12:00', '13:00', '19:00'] }]
  });
  assert.equal(row.descansoInterjornadaMin, 157);
  assert.equal(row.interjornadaProblema, true);
});
test('calcula extra efetiva comparando duração das batidas com padrão normalizado em zero', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ademar Monteiro', he1min: 25, batidas: ['21:37', '00:28', '03:42', '07:46'] }],
    standardRows: [{ motorista: 'Ademar Monteiro', extraNormalPadrao: -25, horarios: ['21:25', '00:30', '04:10', '08:00'] }]
  });
  assert.equal(row.extraCalculadaPelasBatidas, true);
  assert.equal(row.batidasExtraMin, 0);
  assert.equal(row.he1min, 25);
  assert.equal(row.totalHE, 25);
  assert.equal(row.heAcimaPadraoMin, 0);
});

test('prioriza HE informada pelo espelho quando as batidas geram diferença maior', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Marcos Viegas da Cruz', batidas: ['17:00', '20:04', '20:51', '22:23', '00:30', '02:25', '03:00', '04:00'], he1min: 11, he2min: 0, he3min: 0, heBucketsExplicit: true }],
    standardRows: [{ motorista: 'Marcos Viegas da Cruz', extraNormalPadrao: 0, horarios: ['17:10', '20:00', '23:20', '00:45', '00:50', '02:30'] }]
  });
  assert.equal(row.totalHE, 11);
  assert.equal(row.heAcimaPadraoMin, 11);
});

test('usa a quantidade de extra do ponto dentro do padrão mesmo com horários diferentes', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ana', totalHE: 25, he1min: 25, batidas: ['08:00', '17:10'] }],
    standardRows: [{ motorista: 'Ana', extraNormalPadrao: 25, horarios: ['08:00', '17:00'] }]
  });
  assert.equal(row.totalHE, 25);
  assert.equal(row.heDentroPadraoMin, 25);
  assert.equal(row.heAcimaPadraoMin, 0);
});

test('aceita extra de padrão negativo somente quando escala e rastreador comprovam', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Ademar', dateKey: '2026-10-29', totalHE: 25, he1min: 25, batidas: ['21:37', '00:28', '03:42', '07:46'] }],
    standardRows: [{ motorista: 'Ademar', extraNormalPadrao: -25, horarios: ['21:25', '00:30', '04:10', '08:00'] }],
    scaleRows: [{ motorista: 'Ademar', horario: '08:30', linha: 'Linha extra' }],
    trackerRows: [{ motorista: 'Ademar', paradas: [{ horario: '08:30', local: 'Linha extra' }] }]
  });
  assert.equal(row.totalHE, 25);
  assert.equal(row.heDentroPadraoMin, 0);
  assert.equal(row.heAcimaPadraoMin, 25);
  assert.equal(row.linhaExtraCandidata, true);
});

test('não transforma diferença bruta em HE quando padrão negativo não foi comprovado', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Marcos Viegas', he1min: 0, he2min: 0, he3min: 0, heBucketsExplicit: true, batidas: ['17:00', '20:04', '20:51', '22:23', '00:30', '02:25', '03:00', '04:00'] }],
    standardRows: [{ motorista: 'Marcos Viegas', extraNormalPadrao: -85, horarios: ['17:10', '20:00', '23:20', '00:45', '00:50', '02:30'] }],
    scaleRows: [{ motorista: 'Marcos Viegas', horario: '20:51', linha: 'UTILIZADO' }],
    trackerRows: [{ motorista: 'Marcos Viegas', paradas: [{ horario: '17:00', local: 'garagem' }] }]
  });
  assert.equal(row.totalHE, 0);
  assert.equal(row.he1min, 0);
});

test('identifica linha extra pela proximidade da batida mesmo sem HE informada no ponto', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Anderson Altair Furquim Moitoso', dateKey: '2026-11-03', batidas: ['05:38', '08:41', '12:38', '18:20'] }],
    scaleRows: [
      { motorista: 'Anderson Altair Furquim Moitoso', horario: '05:35', linha: 'Linha padrão' },
      { motorista: 'Anderson Altair Furquim Moitoso', horario: '08:30', linha: 'Linha extra Anderson' }
    ],
    standardRows: [{ motorista: 'Anderson Altair Furquim Moitoso', extraNormalPadrao: 45, horarios: ['05:35', '07:50', '12:40', '18:30'] }]
  });
  assert.equal(row.linhaExtraCandidata, true);
  assert.equal(row.extraAuditoriaStatus, 'possivel-linha-extra');
  assert.match(row.linhaExtraDetalhe, /Linha extra Anderson/);
  assert.match(row.justificativaSugerida, /08:30/);
});

test('não chama linha normal de extra quando não existe horário padrão comparável', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Bia', batidas: ['08:00', '17:00'] }],
    scaleRows: [{ motorista: 'Bia', horario: '08:00', linha: 'Linha normal' }]
  });
  assert.equal(row.linhaExtraCandidata, false);
});

test('calcula proximidade da linha extra atravessando a meia-noite', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Neto', batidas: ['23:50', '01:00'] }],
    scaleRows: [{ motorista: 'Neto', horario: '00:10', linha: 'Linha noturna extra' }],
    standardRows: [{ motorista: 'Neto', extraNormalPadrao: 0, horarios: ['22:00', '23:00'] }]
  });
  assert.equal(row.linhaExtraCandidata, true);
  assert.match(row.linhaExtraDetalhe, /Linha noturna extra/);
});

test('inclui a rota da escala na justificativa quando falta confirmação do rastreador', () => {
  const [row] = crossSources({
    pointRows: [{ motorista: 'Cassio Francisco dos Santos', totalHE: 67, batidas: ['12:34', '17:00', '17:30', '20:11'] }],
    scaleRows: [
      { motorista: 'Cassio Francisco dos Santos', horario: '12:50', linha: 'Rota padrão' },
      { motorista: 'Cassio Francisco dos Santos', horario: '19:00', linha: 'Rota extra Cassio' }
    ],
    standardRows: [{ motorista: 'Cassio Francisco dos Santos', extraNormalPadrao: 0, horarios: ['12:50', '16:20', '17:30', '20:00'] }],
    trackerRows: [{ motorista: 'Cassio Francisco dos Santos', paradas: [{ horario: '17:00' }, { horario: '17:30' }] }]
  });
  assert.equal(row.extraAuditoriaStatus, 'possivel-linha-extra');
  assert.match(row.extraAuditoriaDetalhe, /Rota extra Cassio/);
  assert.match(row.justificativaSugerida, /Rota extra Cassio/);
  assert.match(row.justificativaSugerida, /19:00/);
});
