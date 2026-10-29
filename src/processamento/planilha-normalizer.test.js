import test from 'node:test';
import assert from 'node:assert/strict';
import { detectColumns, extractPointRows } from './planilha-normalizer.js';

test('reconhece cabeçalhos alternativos', () => assert.deepEqual(detectColumns(['Colaborador', 'Matrícula', 'HE 1', 'HE 2', 'HE 3']), { motorista: 0, matricula: 1, he1min: 2, he2min: 3, he3min: 4 }));
test('converte horas extras HH:MM para minutos', () => assert.deepEqual(extractPointRows([['Nome', 'HE1', 'HE2'], ['Ana', '01:30', '00:20']]), [{ motorista: 'Ana', matricula: '', he1min: 90, he2min: 20, he3min: 0 }]));
