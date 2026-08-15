# Evolução para SaaS

Este documento descreve **o que já está pronto** para uma operação multi-tenant real e **o que ainda depende de infraestrutura**. Ele existe para que a distância entre o estado atual e um SaaS de produção seja explícita, não estimada por otimismo.

> **Declaração honesta (atualizada na Fase 4):** o Jornada360 **ainda não é** um SaaS em produção — mas deixou de ser um aplicativo local. A interface consome o servidor de verdade: conta, sessão em cookie `HttpOnly`, empresas isoladas por `tenant_id`, papéis aplicados pelo backend, auditoria com autor da sessão. O que falta agora **não é arquitetura, é publicação**: HTTPS, backup com restauração testada, recuperação de senha, monitoramento e cobrança. Ver [DEPLOY.md](DEPLOY.md) e [SECURITY.md](SECURITY.md).

---

## 1. Estado atual

```
Interface (pages, components)          ← não mudou desde a Fase 2
        ↓
Serviços / Domínio (services)          ← não mudou (só deixaram de fazer I/O)
        ↓
ConjuntoRepositorios                   ← contrato único
   ├── local  → localStorage           (demonstração)
   └── remoto → API REST               (empresa real)
                    ↓
        Backend (sessão, autorização, validação)
                    ↓
        SQLite com tenant_id em toda tabela
```

**A promessa da camada de repositórios foi cumprida:** trocar `localStorage` por `fetch` não exigiu reescrever nenhuma das treze telas. O que mudou foi o CARREGAMENTO (virou assíncrono, num lugar só) e a GRAVAÇÃO (virou assíncrona, com feedback). A leitura continua síncrona para quem está dentro do sistema. Ver [FRONTEND_BACKEND.md](FRONTEND_BACKEND.md).

---

## 3. O que já está pronto

**Novo na Fase 3:** backend em camadas, SQLite com `tenant_id` em toda tabela, autenticação com scrypt e sessões, RBAC de 5 papéis aplicado nas rotas, auditoria server-side, e 54 testes de backend — 25 deles exercitando isolamento entre dois tenants por HTTP real.

| Item | Estado | Observação |
|---|---|---|
| **Backend em camadas** | **Pronto** | routes → services/repositories → db |
| **Banco com `tenant_id` em toda tabela** | **Pronto** | 13 tabelas, `ON DELETE CASCADE` a partir de tenants |
| **Autenticação real** | **Pronto** | scrypt, sessões com hash, expiração |
| **Isolamento server-side** | **Pronto** | Tenant vem da sessão; IDOR devolve 404 |
| **RBAC efetivo** | **Pronto** | Matriz de 11 permissões × 5 papéis, aplicada nas rotas |
| **Auditoria confiável** | **Pronto** | Autor vem da sessão, não do cliente |
| **Migração das telas para a API** | **Pronto (Fase 4)** | Contrato único; a demonstração continua local de propósito |
| **Sessão em cookie HttpOnly** | **Pronto (Fase 4)** | Token fora do alcance de JavaScript |
| **Proteção contra CSRF** | **Pronto (Fase 4)** | Cabeçalho exigido em toda escrita por cookie |
| **RBAC refletido na interface** | **Pronto (Fase 4)** | Mesma matriz do servidor; ele continua sendo a autoridade |
| **Concorrência otimista** | **Pronto (Fase 4)** | 409 em vez de sobrescrever em silêncio |
| **Gestão de acesso e convites** | **Pronto (Fase 4)** | Envio por e-mail **não** existe |
| **Limite de tentativas** | **Pronto (Fase 4)** | Por processo; distribuído exige Redis |
| **HTTPS, backup, monitoramento** | **Pendente** | Requisitos de deploy — ver [DEPLOY.md](DEPLOY.md) |
| **Recuperação de senha** | **Pendente** | Depende de provedor de e-mail |
| Separação Interface → Serviços → Repositórios | **Pronto** | Nenhuma tela toca armazenamento |
| Contrato de repositório por entidade | **Pronto** | 13 repositórios, cada um com interface própria |
| Namespace por empresa em todos os dados | **Pronto** | Config, motor, pendências, auditoria, relatórios |
| Ciclo de vida de empresa (criar/excluir completo) | **Pronto** | `workspaceService` limpa todos os namespaces |
| Regras de negócio por empresa | **Pronto** | 7 parâmetros, nenhum fixo no código |
| Cadastro de usuários e papéis | **Pronto como dado** | Base para autenticação e RBAC futuros |
| Trilha de auditoria por empresa | **Pronto** | Quem/quando/valor anterior/novo/motivo |
| Blindagem do ambiente de demonstração | **Pronto** | Seed só age em workspace de ambiente `demo` |
| Entrada explícita (criar / demonstração / login) | **Pronto** | Nenhuma empresa é atribuída em silêncio |

---

## 4. O que depende de backend

| Necessidade | Por que não dá para fazer sem servidor |
|---|---|
| ~~**Isolamento garantido entre clientes**~~ | **RESOLVIDO na Fase 3** — o backend valida o tenant contra a sessão e recusa acesso cruzado. Falta apenas a interface passar a usá-lo |
| **Dados acessíveis de qualquer lugar** | `localStorage` é por navegador e por máquina |
| **Backup e recuperação** | Não há cópia; limpar dados de navegação apaga tudo |
| **Trabalho simultâneo** | Duas pessoas não veem a mesma fila; não há resolução de conflito |
| **Auditoria confiável** | A trilha atual pode ser editada por quem tem acesso ao navegador. Auditoria de verdade exige registro no servidor, fora do alcance do usuário |
| **Integrações reais (Cobli, ponto)** | Exigem credenciais, que não podem viver no navegador |
| **Volume** | `localStorage` tem limite de poucos MB por origem |

### Ponto de mudança no código

Só `src/repositories/*.ts` (e `localStorageClient.ts`). Exemplo do que muda:

```ts
// hoje
listarPorWorkspace(workspaceId: string): Pendencia[] {
  return readJSON<Pendencia[]>(pendenciasKey(workspaceId), []);
}

// com backend — mesma assinatura, exceto por virar assíncrona
async listarPorWorkspace(workspaceId: string): Promise<Pendencia[]> {
  return api.get(`/tenants/${workspaceId}/pendencias`);
}
```

**Custo real não escondido:** tornar os repositórios assíncronos obriga services e telas a lidarem com `Promise` e estados de carregamento. O *contrato* e a *lógica de negócio* permanecem; a forma de chamada muda. É uma migração mecânica e ampla, não uma reescrita conceitual — mas também não é gratuita.

---

## 5. O que depende de autenticação

**Resolvido na Fase 4.** Login, sessão, logout e RBAC funcionam ponta a ponta. `usuarioAtual` vem da sessão; a auditoria do servidor registra o usuário correto, e o cliente não escolhe o autor.

O que permanece pendente é o que depende de **e-mail**: recuperação de senha, verificação de conta e envio de convite. Nada disso foi simulado — ver [AUTH.md](AUTH.md).

| Necessidade | Depende de |
|---|---|
| Saber quem realmente fez cada alteração | Login |
| Restringir o que cada papel vê e faz (RBAC) | Login + verificação no servidor |
| Convidar alguém para a empresa | Backend + e-mail |
| Recuperação de senha, sessão, logout | Backend |

**O que já existe:** `UserAccess` (id, nome, papel) com cinco papéis cadastráveis — Administrador, RH, Gestor, Auditor, Visualizador. É a estrutura que sustentará login e permissões; hoje é organizacional.

**Decisão explícita:** nenhum login falso foi criado. Uma tela de entrada que aceitasse qualquer senha daria a impressão de haver controle de acesso onde não há — em um sistema de auditoria, isso é pior do que assumir a ausência.

---

## 6. O que depende de banco de dados

Modelo alvo, com `tenant_id` em **toda** tabela:

```
tenants
  ├── companies, units, departments, employees, schedules
  ├── rules
  ├── users (+ roles)
  ├── time_records          (dias processados pelo motor)
  ├── pendencias            (+ histórico de status)
  ├── audit_log
  └── reports
```

Regras que o banco passa a garantir e que hoje dependem da aplicação:

- Índice e filtro obrigatório por `tenant_id` em toda consulta (Row Level Security no Postgres resolve isso na raiz).
- Chave estrangeira entre colaborador e registro de ponto — hoje o vínculo é *best-effort por nome normalizado*, e por isso pode falhar (documentado em BUSINESS_RULES.md).
- Unicidade real de nome de setor/unidade por empresa — hoje validada na interface.
- Histórico de status da pendência como tabela própria, em vez de campos sobrescritos.

---

## 7. Onde entrariam os limites de plano

Nada disso está implementado. O mapeamento existe para que a decisão futura não exija redesenho:

| Limite | Onde seria aplicado |
|---|---|
| Nº de colaboradores | `EmployeeRepository.upsert` — rejeita acima do limite do plano |
| Nº de usuários | `WorkspaceRepository.updateUsers` |
| Nº de empresas por conta | `workspaceService.criarWorkspace` |
| Integrações disponíveis | `IntegrationService` — filtra adapters por plano |
| Formatos de relatório | `reportService` — PDF/XLSX só em planos superiores |
| Retenção de histórico | Rotina no backend, sobre `time_records` e `audit_log` |
| Volume de armazenamento | Backend |
| Recursos de análise assistida | Camada nova de serviço, atrás de verificação de plano |

Cobrança, assinatura e pagamento **não foram implementados nem simulados**.

---

## 8. Ordem recomendada de evolução

1. ~~Testes automatizados~~ — **feito** (Fase 3): 275 testes hoje.
2. ~~Backend + banco com `tenant_id`~~ — **feito** (Fase 3).
3. ~~Autenticação~~ — **feito** (Fases 3 e 4).
4. ~~RBAC aplicado de verdade~~ — **feito** (Fases 3 e 4).
5. **Publicação**: HTTPS, backup testado, monitoramento, supervisão de processo. É o próximo passo real.
6. **E-mail**: recuperação de senha, verificação de conta, envio de convite. Um provedor destrava os três.
7. **Integrações reais**, agora que credenciais podem viver no servidor.
8. **Billing e limites de plano**, por último — só faz sentido com o resto funcionando.

---

## 9. Resumo em uma frase

Aplicação multiempresa conectada, autenticada e testada, rodando localmente; **faltam os requisitos de publicação — HTTPS, backup, recuperação de senha e monitoramento — para operar com clientes reais.**
