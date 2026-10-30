function slug(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatMinutes(value) {
  const minutes = Number(value) || 0;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function snapshotItemsToChecklist(items = []) {
  return items.filter(item => String(item?.motorista || item?.nome || '').trim()).map(item => {
    const motorista = String(item.motorista || item.nome).trim();
    const categoria = String(item.categoria || item.tipo || '').trim();
    const setor = categoria || String(item.setor || item.setorResponsavel || 'Sem setor').trim();
    const totalHE = Number(item.totalHE ?? item.he1Min ?? item.excedenteMin ?? 0) || 0;
    const semPadrao = item.padraoStatus === 'sem_cadastro' || item.padraoStatus === 'invalido' || item.semHorarioPadrao === true || (item.padraoMin == null && item.padraoCadastradoMin == null && item.extraNormalPadrao == null);
    return {
      id: slug(motorista),
      motorista,
      setor,
      status: semPadrao ? 'Sem horário padrão' : (item.status === 'ok' || totalHE === 0 ? 'Confirmado' : 'Pendente'),
      semPadrao,
      resumo: semPadrao ? `${totalHE > 0 ? `HE.1 ${formatMinutes(totalHE)} · ` : ''}horário padrão não encontrado` : (totalHE > 0 ? `HE.1 ${formatMinutes(totalHE)}` : 'Sem excesso registrado')
    };
  });
}
