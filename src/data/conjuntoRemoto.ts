/* Implementação REMOTA (Firebase Firestore) do ConjuntoRepositorios.
 *
 * Este é o único lugar do frontend que fala com o Firebase diretamente.
 * Trocar de banco (Firestore → outro) é reescrever este arquivo. Nada acima dele muda.
 *
 * Estrutura Firestore:
 *   tenants/{tenantId}                          → metadados do tenant
 *   tenants/{tenantId}/config/dados             → cadastro completo (empresa, unidades, etc.)
 *   tenants/{tenantId}/time_records/{dateKey}   → dias processados
 *   tenants/{tenantId}/pendings/{id}            → pendências
 *   tenants/{tenantId}/audit_log/{id}           → trilha de auditoria
 *   tenants/{tenantId}/invites/{id}             → convites emitidos
 *   tenants/{tenantId}/memberships/{userId}     → membros e seus papéis
 *
 * RBAC: as Firestore Security Rules garantem que o usuário só acessa tenants
 * dos quais é membro (ver firestore.rules na raiz do projeto). */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import type { ConjuntoRepositorios, Convite, ConviteCriado, DiaBruto, EstadoEmpresa } from './tipos';
import type {
  WorkspaceConfig,
  Company,
  Unit,
  Department,
  Employee,
  Schedule,
  Rules,
  IntegrationStatus,
  UserRole,
  Pendencia,
} from '../domain';
import { regrasPadrao, integracoesPadrao } from '../domain';
import type { AuditEntry } from '../repositories/AuditRepository';

// ---- helpers ----------------------------------------------------------------

function assertFirestore() {
  if (!db || !auth) throw new Error('Firebase não está configurado. Configure as variáveis VITE_FIREBASE_* no arquivo .env.');
  return { db, auth };
}

function tenantRef(tenantId: string) {
  const { db: firestoreDb } = assertFirestore();
  return doc(firestoreDb, 'tenants', tenantId);
}

function configRef(tenantId: string) {
  const { db: firestoreDb } = assertFirestore();
  return doc(firestoreDb, 'tenants', tenantId, 'config', 'dados');
}

function timeRecordsRef(tenantId: string) {
  const { db: firestoreDb } = assertFirestore();
  return collection(firestoreDb, 'tenants', tenantId, 'time_records');
}

function dayRef(tenantId: string, dateKey: string) {
  const { db: firestoreDb } = assertFirestore();
  return doc(firestoreDb, 'tenants', tenantId, 'time_records', dateKey);
}

function pendingsRef(tenantId: string) {
  const { db: firestoreDb } = assertFirestore();
  return collection(firestoreDb, 'tenants', tenantId, 'pendings');
}

function pendingRef(tenantId: string, id: string) {
  const { db: firestoreDb } = assertFirestore();
  return doc(firestoreDb, 'tenants', tenantId, 'pendings', id);
}

function auditRef(tenantId: string) {
  const { db: firestoreDb } = assertFirestore();
  return collection(firestoreDb, 'tenants', tenantId, 'audit_log');
}

function invitesRef(tenantId: string) {
  const { db: firestoreDb } = assertFirestore();
  return collection(firestoreDb, 'tenants', tenantId, 'invites');
}

/** Converte Timestamps do Firestore para ISO string onde necessário. */
function normalizeTimestamp(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function patchConfig(workspaceId: string, updater: (raw: Record<string, any>) => Record<string, any>): Promise<void> {
  const cRef = configRef(workspaceId);
  const snap = await getDoc(cRef);
  const data = snap.exists() ? snap.data() : {};
  const updated = updater(data);
  await setDoc(cRef, updated, { merge: true });
  await updateDoc(tenantRef(workspaceId), { configVersao: serverTimestamp() }).catch(() => {
    // Se o doc de tenant não existir ainda, ignora
  });
}

// ---- implementação ----------------------------------------------------------

export function criarConjuntoRemoto(): ConjuntoRepositorios {
  return {
    modo: 'remoto',

    async carregarTudo(workspaceId: string): Promise<EstadoEmpresa> {
      const { auth: firebaseAuth, db: firestoreDb } = assertFirestore();
      const user = firebaseAuth.currentUser;
      if (!user) throw new Error('Usuário não autenticado.');

      // 1. Metadados do tenant (papel do usuário)
      const tenantSnap = await getDoc(tenantRef(workspaceId));
      if (!tenantSnap.exists()) {
        throw new Error(`Empresa "${workspaceId}" não encontrada.`);
      }
      const tenantData = tenantSnap.data();

      // Papel do usuário neste tenant (salvo na subcoleção memberships)
      const memberRef = doc(firestoreDb, 'tenants', workspaceId, 'memberships', user.uid);
      const memberSnap = await getDoc(memberRef);
      const papel = memberSnap.exists() ? (memberSnap.data().papel as string) : 'colaborador';

      // Permissões derivadas do papel
      const permissoes = permissoesDoPapel(papel);

      // 2. Cadastro completo (empresa, unidades, setores, colaboradores, escalas, regras)
      const configSnap = await getDoc(configRef(workspaceId));
      let config: WorkspaceConfig;

      if (configSnap.exists()) {
        const raw = configSnap.data();
        config = {
          id: workspaceId,
          environment: (tenantData.environment as 'real' | 'demo') ?? 'real',
          company: raw.company ?? { nome: tenantData.nome ?? '', cnpj: '', identificacao: '', logoUrl: '', status: 'ativo' },
          units: raw.units ?? [],
          departments: raw.departments ?? [],
          employees: raw.employees ?? [],
          schedules: raw.schedules ?? [],
          causaOpts: raw.causaOpts ?? ['Autorizado antecipadamente', 'Escala desatualizada', 'Erro de registro', 'Outro'],
          rules: { ...regrasPadrao(), ...(raw.rules ?? {}) },
          integrations: raw.integrations ?? integracoesPadrao(),
          users: raw.users ?? [],
          criadoEm: normalizeTimestamp(tenantData.criadoEm) ?? new Date().toISOString(),
        };
      } else {
        // Tenant existe mas ainda não tem config — empresa recém-criada
        config = {
          id: workspaceId,
          environment: (tenantData.environment as 'real' | 'demo') ?? 'real',
          company: { nome: tenantData.nome ?? '', cnpj: '', identificacao: '', logoUrl: '', status: 'ativo' },
          units: [],
          departments: [],
          employees: [],
          schedules: [],
          causaOpts: ['Autorizado antecipadamente', 'Escala desatualizada', 'Erro de registro', 'Outro'],
          rules: regrasPadrao(),
          integrations: integracoesPadrao(),
          users: [],
          criadoEm: normalizeTimestamp(tenantData.criadoEm) ?? new Date().toISOString(),
        };
      }

      // 3. Dias processados
      let dias: DiaBruto[] = [];
      try {
        const diasSnap = await getDocs(timeRecordsRef(workspaceId));
        dias = diasSnap.docs.map((d) => ({
          dateKey: d.id,
          snapshot: d.data().snapshot ?? null,
          caseState: (d.data().caseState as Record<string, unknown>) ?? {},
        }));
      } catch (err) {
        console.warn('[conjuntoRemoto] Aviso ao carregar dias:', err);
      }

      // 4. Pendências
      let pendencias: Pendencia[] = [];
      try {
        const pendenciasSnap = await getDocs(pendingsRef(workspaceId));
        pendencias = pendenciasSnap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            workspaceId,
            colaboradorId: raw.colaboradorId ?? null,
            data: raw.data ?? '',
            tipo: raw.tipo ?? '',
            categoria: raw.categoria ?? '',
            status: raw.status ?? 'pendente',
            prioridade: raw.prioridade ?? 'media',
            origem: raw.origem ?? 'motor_he',
            descricao: raw.descricao ?? '',
            evidencias: raw.evidencias ?? [],
            recomendacao: raw.recomendacao ?? null,
            responsavelId: raw.responsavelId ?? null,
            prazo: raw.prazo ?? null,
            criadaEm: normalizeTimestamp(raw.criadaEm) ?? new Date().toISOString(),
            atualizadaEm: normalizeTimestamp(raw.atualizadaEm) ?? new Date().toISOString(),
            resolvidaEm: normalizeTimestamp(raw.resolvidaEm),
            resolucao: raw.resolucao ?? null,
            revisadoPor: raw.revisadoPor ?? null,
            revisadoEm: normalizeTimestamp(raw.revisadoEm),
            observacaoRevisao: raw.observacaoRevisao ?? null,
          } satisfies Pendencia;
        });
      } catch (err) {
        console.warn('[conjuntoRemoto] Aviso ao carregar pendências:', err);
      }

      // 5. Auditoria (últimas 500 entradas, mais recentes primeiro)
      let auditoria: AuditEntry[] = [];
      try {
        let auditSnap;
        try {
          const auditQuery = query(auditRef(workspaceId), orderBy('timestamp', 'desc'), limit(500));
          auditSnap = await getDocs(auditQuery);
        } catch {
          auditSnap = await getDocs(query(auditRef(workspaceId), limit(500)));
        }
        auditoria = auditSnap.docs.map((d) => ({
          id: d.id,
          timestamp: normalizeTimestamp(d.data().timestamp) ?? new Date().toISOString(),
          usuario: d.data().usuario ?? '',
          entidade: d.data().entidade ?? '',
          acao: d.data().acao ?? '',
          valorAnterior: d.data().valorAnterior ?? '',
          valorNovo: d.data().valorNovo ?? '',
          motivo: d.data().motivo ?? '',
        }));
      } catch (err) {
        console.warn('[conjuntoRemoto] Aviso ao carregar auditoria:', err);
      }

      // Versão do cadastro
      const versao = normalizeTimestamp(tenantSnap.data()?.configVersao) ?? '';

      return { config, dias, pendencias, auditoria, versao, papel, permissoes };
    },

    async atualizarCadastro(
      workspaceId: string,
      patch: Partial<Omit<WorkspaceConfig, 'id' | 'environment' | 'criadoEm'>>,
    ): Promise<void> {
      await setDoc(configRef(workspaceId), patch, { merge: true });
      await updateDoc(tenantRef(workspaceId), {
        configVersao: serverTimestamp(),
      });
    },

    async salvarEmpresa(workspaceId: string, company: Partial<Company>): Promise<void> {
      await patchConfig(workspaceId, (d) => ({
        ...d,
        company: { ...(d.company ?? {}), ...company },
      }));
    },

    async salvarUnidade(workspaceId: string, unit: Unit): Promise<void> {
      await patchConfig(workspaceId, (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const units = (d.units ?? []).filter((u: any) => u.id !== unit.id);
        return { ...d, units: [...units, unit] };
      });
    },

    async excluirUnidade(workspaceId: string, id: string): Promise<void> {
      await patchConfig(workspaceId, (d) => ({
        ...d,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        units: (d.units ?? []).filter((u: any) => u.id !== id),
      }));
    },

    async salvarSetor(workspaceId: string, sector: Department): Promise<void> {
      await patchConfig(workspaceId, (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const departments = (d.departments ?? []).filter((s: any) => s.id !== sector.id);
        return { ...d, departments: [...departments, sector] };
      });
    },

    async excluirSetor(workspaceId: string, id: string): Promise<void> {
      await patchConfig(workspaceId, (d) => ({
        ...d,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        departments: (d.departments ?? []).filter((s: any) => s.id !== id),
      }));
    },

    async salvarColaborador(workspaceId: string, employee: Employee): Promise<void> {
      await patchConfig(workspaceId, (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const employees = (d.employees ?? []).filter((e: any) => e.id !== employee.id);
        return { ...d, employees: [...employees, employee] };
      });
    },

    async excluirColaborador(workspaceId: string, id: string): Promise<void> {
      await patchConfig(workspaceId, (d) => ({
        ...d,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        employees: (d.employees ?? []).filter((e: any) => e.id !== id),
      }));
    },

    async salvarEscala(workspaceId: string, schedule: Schedule): Promise<void> {
      await patchConfig(workspaceId, (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const schedules = (d.schedules ?? []).filter((s: any) => s.id !== schedule.id);
        return { ...d, schedules: [...schedules, schedule] };
      });
    },

    async excluirEscala(workspaceId: string, id: string): Promise<void> {
      await patchConfig(workspaceId, (d) => ({
        ...d,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schedules: (d.schedules ?? []).filter((s: any) => s.id !== id),
      }));
    },

    async salvarRegras(workspaceId: string, rules: Rules, causaOpts: string[]): Promise<void> {
      await patchConfig(workspaceId, (d) => ({
        ...d,
        rules,
        causaOpts,
      }));
    },

    async salvarIntegracao(workspaceId: string, id: string, status: IntegrationStatus): Promise<void> {
      await patchConfig(workspaceId, (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const integrations = (d.integrations ?? integracoesPadrao()).map((i: any) => (i.id === id ? { ...i, status } : i));
        return { ...d, integrations };
      });
    },

    async listarConvites(workspaceId: string): Promise<Convite[]> {
      const snap = await getDocs(invitesRef(workspaceId));
      return snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          email: raw.email ?? '',
          papel: raw.papel ?? 'gestor',
          expiraEm: normalizeTimestamp(raw.expiraEm) ?? '',
          aceitoEm: normalizeTimestamp(raw.aceitoEm),
        };
      });
    },

    async criarConvite(workspaceId: string, email: string, papel: UserRole): Promise<ConviteCriado> {
      const codigo = Math.random().toString(36).substring(2, 10).toUpperCase();
      const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await addDoc(invitesRef(workspaceId), {
        email,
        papel,
        codigo,
        expiraEm,
        criadoEm: serverTimestamp(),
        aceitoEm: null,
      });
      return { email, codigo };
    },

    async adicionarMembro(workspaceId: string, email: string, papel: UserRole): Promise<void> {
      const { db: firestoreDb } = assertFirestore();
      const memberId = email.replace(/[^a-zA-Z0-9_-]/g, '_');
      await setDoc(doc(firestoreDb, 'tenants', workspaceId, 'memberships', memberId), {
        email,
        papel,
        adicionadoEm: serverTimestamp(),
      });
    },

    async alterarPapel(workspaceId: string, userId: string, papel: string): Promise<void> {
      const { db: firestoreDb } = assertFirestore();
      await updateDoc(doc(firestoreDb, 'tenants', workspaceId, 'memberships', userId), {
        papel,
        atualizadoEm: serverTimestamp(),
      });
    },

    async removerMembro(workspaceId: string, userId: string): Promise<void> {
      const { db: firestoreDb } = assertFirestore();
      await deleteDoc(doc(firestoreDb, 'tenants', workspaceId, 'memberships', userId));
    },

    async revogarConvite(workspaceId: string, conviteId: string): Promise<void> {
      const { db: firestoreDb } = assertFirestore();
      await deleteDoc(doc(firestoreDb, 'tenants', workspaceId, 'invites', conviteId));
    },

    async salvarDia(
      workspaceId: string,
      diaOuDateKey: string | DiaBruto,
      snapshot?: unknown,
      caseState?: Record<string, unknown>,
    ): Promise<void> {
      if (typeof diaOuDateKey === 'object') {
        await setDoc(
          dayRef(workspaceId, diaOuDateKey.dateKey),
          {
            snapshot: diaOuDateKey.snapshot,
            caseState: diaOuDateKey.caseState ?? {},
            atualizadoEm: serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        await setDoc(
          dayRef(workspaceId, diaOuDateKey),
          {
            snapshot,
            caseState: caseState ?? {},
            atualizadoEm: serverTimestamp(),
          },
          { merge: true },
        );
      }
    },

    async atualizarCaso(
      workspaceId: string,
      dateKey: string,
      chaveColaborador: string,
      patch: Record<string, unknown>,
    ): Promise<void> {
      // Atualiza só os campos do caso específico dentro de caseState
      const patchPath: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        patchPath[`caseState.${chaveColaborador}.${k}`] = v;
      }
      await updateDoc(dayRef(workspaceId, dateKey), patchPath);
    },

    async limparDias(workspaceId: string): Promise<void> {
      const snap = await getDocs(timeRecordsRef(workspaceId));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    },

    async salvarPendencia(workspaceId: string, pendencia: Pendencia): Promise<void> {
      const { id, workspaceId: _wsId, ...rest } = pendencia;
      await setDoc(pendingRef(workspaceId, id), {
        ...rest,
        atualizadaEm: serverTimestamp(),
      }, { merge: true });
    },

    async revisarPendencia(
      workspaceId: string,
      id: string,
      decisao: 'aprovado' | 'reprovado',
      observacao?: string | null,
    ): Promise<void> {
      const { auth: firebaseAuth } = assertFirestore();
      const user = firebaseAuth.currentUser;
      await updateDoc(pendingRef(workspaceId, id), {
        status: decisao,
        revisadoPor: user?.displayName ?? user?.email ?? 'Usuário',
        revisadoEm: serverTimestamp(),
        observacaoRevisao: observacao ?? null,
        atualizadaEm: serverTimestamp(),
      });
    },

    async registrarAuditoria(
      workspaceId: string,
      entry: Omit<AuditEntry, 'id' | 'timestamp'>,
    ): Promise<void> {
      await addDoc(auditRef(workspaceId), {
        ...entry,
        timestamp: serverTimestamp(),
      });
    },

    async registrarExportacao(workspaceId: string, tipo: string, descricao: string): Promise<void> {
      const { auth: firebaseAuth } = assertFirestore();
      const user = firebaseAuth.currentUser;
      await addDoc(auditRef(workspaceId), {
        usuario: user?.displayName ?? user?.email ?? 'Usuário',
        entidade: `Relatório: ${tipo}`,
        acao: 'Exportação realizada',
        valorAnterior: '—',
        valorNovo: descricao,
        motivo: 'Exportação de dados',
        timestamp: serverTimestamp(),
      });
    },
  };
}

// ---- RBAC (espelha server/lib/permissoes.js) ---------------------------------

type Papel = 'administrador' | 'rh' | 'gestor' | 'auditor' | 'colaborador';

const PERMISSOES: Record<Papel, string[]> = {
  administrador: [
    'config:ler', 'config:escrever',
    'usuarios:gerir',
    'dados:ler', 'dados:escrever',
    'pendencia:ler', 'pendencia:tratar', 'pendencia:revisar',
    'auditoria:ler', 'relatorio:exportar',
    'tenant:excluir',
  ],
  rh: [
    'config:ler', 'config:escrever',
    'dados:ler', 'dados:escrever',
    'pendencia:ler', 'pendencia:tratar', 'pendencia:revisar',
    'auditoria:ler', 'relatorio:exportar',
  ],
  gestor: [
    'config:ler',
    'dados:ler',
    'pendencia:ler', 'pendencia:tratar',
    'relatorio:exportar',
  ],
  auditor: [
    'config:ler',
    'dados:ler',
    'pendencia:ler',
    'auditoria:ler', 'relatorio:exportar',
  ],
  colaborador: [
    'pendencia:ler',
  ],
};

function permissoesDoPapel(papel: string): string[] {
  return PERMISSOES[papel as Papel] ?? [];
}
