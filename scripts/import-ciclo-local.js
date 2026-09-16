const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const filePath = path.join(process.cwd(), 'HE_ciclo_2026-08-28.xlsx');
if (!fs.existsSync(filePath)) {
  console.error('Planilha não encontrada:', filePath);
  process.exit(1);
}

const fileBuffer = fs.readFileSync(filePath);
const wb = xlsx.read(fileBuffer, { type: 'buffer' });

const dataDir = path.join(process.cwd(), '.data');
const storeFile = path.join(dataDir, 'justificativas.json');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let existingStore = {};
if (fs.existsSync(storeFile)) {
  try {
    existingStore = JSON.parse(fs.readFileSync(storeFile, 'utf-8') || '{}');
  } catch {
    existingStore = {};
  }
}

const wsDet = wb.Sheets['DETALHAMENTO'];
let count = 0;
if (wsDet) {
  const rows = xlsx.utils.sheet_to_json(wsDet);
  for (const r of rows) {
    const just = String(r['Justificativa'] || '').trim();
    if (!just) continue;

    const diaStr = String(r['Dia'] || '').trim();
    const colab = String(r['Colaborador'] || '').trim();
    const cleanDate = diaStr.replace(/\//g, '');
    const normColab = colab.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    const parts = diaStr.split('/');
    let dateISO = diaStr;
    if (parts.length === 3) {
      dateISO = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    const id1 = `he1_${cleanDate}_${normColab}`;
    const id2 = `he1_${dateISO}_${normColab}`;

    const record = {
      id: id1,
      justificativa: just,
      alteradoPor: 'Planilha Oficial Ciclo 28/08',
      alteradoEm: '15/09/2026 11:16',
      historico: [
        {
          justificativa: just,
          alteradoPor: 'Planilha Oficial Ciclo 28/08 a 27/09/2026',
          alteradoEm: '15/09/2026 11:16',
        },
      ],
    };

    existingStore[id1] = record;
    existingStore[id2] = { ...record, id: id2 };
    count++;
  }

  fs.writeFileSync(storeFile, JSON.stringify(existingStore, null, 2), 'utf-8');
  console.log(`Sucesso: ${count} justificativas salvas em ${storeFile}`);
} else {
  console.error('Aba DETALHAMENTO não encontrada na planilha.');
}
