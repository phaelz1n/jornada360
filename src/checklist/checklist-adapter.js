function slug(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatMinutes(value) {
  const minutes = Number(value) || 0;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function toMinutes(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d+):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number(text) || 0;
}

export function snapshotItemsToChecklist(items = []) {
  return items.filter(item => String(item?.motorista || item?.nome || '').trim()).map(item => {
    const motorista = String(item.motorista || item.nome).trim();
    const categoria = String(item.categoria || item.tipo || '').trim();
    const setor = categoria || String(item.setor || item.setorResponsavel || 'Sem setor').trim();
    const he1 = toMinutes(item.he1min ?? item.he1Min ?? item.he1 ?? item.he1str ?? item.horaExtra1);
    const he2 = toMinutes(item.he2min ?? item.he2Min ?? item.he2 ?? item.he2str ?? item.horaExtra2);
    const he3 = toMinutes(item.he3min ?? item.he3Min ?? item.he3 ?? item.he3str ?? item.horaExtra3);
    const totalHE = toMinutes(item.totalHE ?? item.totalHEstr ?? item.excedenteMin) || he1 + he2 + he3;
    const semPadrao = item.padraoStatus === 'sem_cadastro' || item.padraoStatus === 'invalido' || item.semHorarioPadrao === true || (item.padraoMin == null && item.padraoCadastradoMin == null && item.extraNormalPadrao == null);
    return {
      id: slug(motorista),
      motorista,
      setor,
      status: semPadrao ? 'Sem horário padrão' : (item.status === 'ok' || totalHE === 0 ? 'Confirmado' : 'Pendente'),
      semPadrao,
      resumo: semPadrao ? `${totalHE > 0 ? `HE total ${formatMinutes(totalHE)} · ` : ''}horário padrão não encontrado` : (totalHE > 0 ? `HE total ${formatMinutes(totalHE)}` : 'Sem excesso registrado'),
      padraoCadastradoMin: item.padraoCadastradoMin ?? item.padraoMin ?? item.extraNormalPadrao ?? null,
      heDentroPadraoMin: item.heDentroPadraoMin ?? null,
      heAcimaPadraoMin: item.heAcimaPadraoMin ?? null,
      rastreadorStatus: item.rastreadorStatus || null,
      evidenciaRastreador: Array.isArray(item.evidenciaRastreador) ? item.evidenciaRastreador : [],
      padraoSuspeito: Boolean(item.padraoSuspeito),
      escalaEncontrada: Boolean(item.escalaEncontrada),
      escala: item.escala || null,
      linhaExtraCandidata: Boolean(item.linhaExtraCandidata),
      linhaExtraDetalhe: item.linhaExtraDetalhe || '',
      batidas: Array.isArray(item.batidas) ? item.batidas : [],
      padraoHorarios: Array.isArray(item.padraoHorarios) ? item.padraoHorarios : [],
      detalhe: item.detalhe || '',
      padraoStatus: item.padraoStatus || ''
    };
  });
}
