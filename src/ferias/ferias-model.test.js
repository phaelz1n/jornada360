import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCalendarDays,
  businessDaysBefore,
  normalizeVacationRecord,
  suggestVacation,
  validateVacationSuggestion
  , detectVacationConflicts, detectVacationImportConflicts, feristaCanCover
} from './ferias-model.js';

test('normaliza registro importado e preserva origem', () => {
  const record = normalizeVacationRecord({
    codigo: '42',
    trabalhador: ' Ana Maria  ',
    saldo: '30',
    limiteGozo: '15/12/2026',
    periodoAquisitivo: '01/01/2025 a 31/12/2025',
    origem: 'pdf-001'
  });

  assert.deepEqual(record, {
    employeeCode: '42',
    employeeName: 'Ana Maria',
    role: '',
    garageDistance: 'nao_classificado',
    vacationEligible: true,
    balanceDays: 30,
    gozoLimit: '2026-12-15',
    accrualPeriod: '01/01/2025 a 31/12/2025',
    sourceImportId: 'pdf-001'
  });
});

test('calcula dois dias úteis antes da folga ignorando fim de semana', () => {
  assert.equal(businessDaysBefore('2026-11-09', 2), '2026-11-05');
});

test('sugestão respeita 30 dias e encontra ferista compatível', () => {
  const suggestion = suggestVacation({
    today: '2026-11-03',
    employee: { employeeCode: '1', employeeName: 'João', balanceDays: 10, gozoLimit: '2026-12-31' },
    shift: { id: 'turno-a', name: 'Motorista manhã' },
    feristas: [{ id: 'f1', name: 'Carlos', shiftIds: ['turno-a'], availableFrom: '2026-11-01', availableTo: '2026-12-31' }]
  });

  assert.equal(suggestion.status, 'pronta');
  assert.equal(suggestion.startDate, '2026-12-03');
  assert.equal(suggestion.trainingStartDate, '2026-12-01');
  assert.equal(suggestion.feristaId, 'f1');
});

test('bloqueia sugestão sem turno ou sem ferista compatível', () => {
  const result = validateVacationSuggestion({
    today: '2026-11-03',
    startDate: addCalendarDays('2026-11-03', 30),
    employee: { balanceDays: 10, gozoLimit: '2026-12-31' },
    shift: null,
    ferista: null
  });

  assert.equal(result.status, 'com_pendencias');
  assert.deepEqual(result.errors, ['turno_ausente', 'ferista_ausente']);
});

test('bloqueia período que ultrapassa limite de gozo', () => {
  const result = validateVacationSuggestion({
    today: '2026-11-03',
    startDate: '2026-12-20',
    endDate: '2027-01-18',
    employee: { balanceDays: 30, gozoLimit: '2026-12-31' },
    shift: { id: 'a' },
    ferista: { id: 'f' }
  });

  assert.equal(result.status, 'com_pendencias');
  assert.ok(result.errors.includes('limite_gozo_excedido'));
});

test('detecta ferista ocupado em períodos sobrepostos', () => {
  const conflicts = detectVacationConflicts([
    { id: 'a', employeeName: 'Ana', feristaId: 'f1', trainingStartDate: '2026-12-01', startDate: '2026-12-03', endDate: '2026-12-12', status: 'pronta' },
    { id: 'b', employeeName: 'Bruno', feristaId: 'f1', trainingStartDate: '2026-12-10', startDate: '2026-12-12', endDate: '2026-12-20', status: 'pronta' }
  ]);
  assert.equal(conflicts[0].type, 'ferista_sobreposto');
});

test('aplica alcance especial do ferista para longe da garagem', () => {
  assert.equal(feristaCanCover({ coverageScope: 'longe_garagem' }, { garageDistance: 'longe' }), true);
  assert.equal(feristaCanCover({ coverageScope: 'longe_garagem' }, { garageDistance: 'proximo' }), false);
});

test('detecta alteração do período do mesmo funcionário em nova importação', () => {
  const conflicts = detectVacationImportConflicts(
    [{ employeeName: 'Ciclano', startDate: '2027-02-12', endDate: '2027-03-16', balanceDays: 30 }],
    [{ employeeName: 'CIclano', startDate: '2027-03-15', endDate: '2027-03-20', balanceDays: 30 }]
  );
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].previous.endDate, '2027-03-16');
});
