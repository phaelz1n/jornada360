# Estado atual do projeto

Snapshot em 2026-08-15, ao final do **MVP Comercial / Programa Piloto** (depois da Fase 5 — Publicação e operação) (após a conclusão da Fase 2) (Bloco Analítico, Bloco de Consistência, Regras de Jornada, Portabilidade Multiempresa, Relatórios, Centro de Ações e Experiência). Este arquivo descreve **o que existe de verdade agora**, não um plano. Ver [ROADMAP.md](ROADMAP.md) para o que vem depois e [CHANGELOG.md](CHANGELOG.md) para o histórico.

**Primeiro acesso:** o sistema não cria mais nenhuma empresa sozinho. Um visitante novo vê o portão de entrada com três opções (criar empresa / ver demonstração / já tenho acesso) e só entra onde escolher. Ver [ONBOARDING.md](ONBOARDING.md).

**Ciclo operacional completo e funcional ponta a ponta:** dados → análise (motor) → classificação → pendência persistida → priorização → explicação → responsável → prazo → SLA → resolução → aprovação/reprovação → reabertura → auditoria → indicadores → relatório exportável. Tudo por empresa, sem código específico de empresa.

Legenda usada neste arquivo e em toda a documentação:

- **IMPLEMENTADO** — existe, tem consumidor real na interface, foi testado manualmente.
- **PREPARAÇÃO** — código existe, ainda sem uso real na UI, deliberadamente (documentado onde e por quê).
- **PENDENTE** — gap conhecido, sem código ainda, esperado para uma fase futura.
- **PLANEJADO** — direção mencionada, sem código nem decisão de design.

## MVP Comercial / Programa Piloto — o que passou a existir

**Classificação do produto: Jornada360 — MVP Comercial / Programa Piloto.** Pronto para as primeiras vendas, com cobrança e suporte manuais. Não é a versão definitiva e não se apresenta como tal. Manual de operação em [PILOTO.md](PILOTO.md).

| Item | Estado |
|---|---|
| Cadastro fechado por padrão em produção | **IMPLEMENTADO** — 403 `cadastro_fechado` em `/registrar` e em `/tenants` |
| `GET /api/auth/modo` | **IMPLEMENTADO** — a interface pergunta o que oferecer em vez de supor |
| Conta criada a partir de convite (`/convite`) | **IMPLEMENTADO** — a única porta de entrada com o cadastro fechado |
| Suspender empresa preservando os dados | **IMPLEMENTADO** — 403 `empresa_suspensa`, sessões encerradas, nada apagado |
| Reativar empresa | **IMPLEMENTADO** — acesso volta imediatamente, dados intactos |
| Empresa suspensa explicada na interface | **IMPLEMENTADO** — marcada no portão e com painel próprio, distinto de "acesso negado" |
| Feedback dentro do produto (5 categorias) | **IMPLEMENTADO** — botão fixo, tela atual anexada, isolado por empresa |
| CLI de operação (`npm run piloto`) | **IMPLEMENTADO** — panorama, liberar, convidar, suspender, reativar, nota, feedback |
| Painel comercial de super administrador | **PENDENTE por decisão** — exigiria rotas HTTP cruzando empresas, expostas para sempre |
| Cobrança, planos, checkout | **PENDENTE por decisão** — a cobrança do piloto é manual, fora do sistema |
| Central de tickets de suporte | **PENDENTE por decisão** — o suporte do piloto é direto |

## Fase 4 — o que passou a existir

| Item | Estado |
|---|---|
| **Interface conectada ao servidor** | **IMPLEMENTADO** — empresas reais operam sobre a API; a demonstração continua local |
| Login, logout, criação de conta | **IMPLEMENTADO** — telas reais, sessão validada pelo servidor |
| Sessão em cookie `HttpOnly` | **IMPLEMENTADO** — token fora do alcance do JavaScript |
| Proteção contra CSRF | **IMPLEMENTADO** — cabeçalho exigido em toda escrita por cookie |
| Padrão assíncrono único | **IMPLEMENTADO** — `useRecurso`, `useGravacao`, componentes de estado |
| Fábrica de repositórios (local × remoto) | **IMPLEMENTADO** — nenhuma tela pergunta em qual modo está |
| Services sem I/O | **IMPLEMENTADO** — regras calculam e devolvem; a camada de dados grava |
| RBAC refletido na interface | **IMPLEMENTADO** — mesma matriz do servidor; ele continua sendo a autoridade |
| Concorrência otimista | **IMPLEMENTADO** — 409 em vez de sobrescrever em silêncio |
| Membros e convites | **IMPLEMENTADO** — envio por e-mail **não** existe |
| Limite de tentativas | **IMPLEMENTADO** — login e criação de conta |
| Migração dos dados locais | **IMPLEMENTADO** — explícita, com conferência antes da limpeza |
| Envio do motor HE ao servidor | **IMPLEMENTADO** — adaptador ao redor do motor, que segue intocado |
| Testes de interface e E2E | **IMPLEMENTADO** — 19 de interface + 35 de fluxo completo + 14 de segurança |
| **HTTPS automático** | **IMPLEMENTADO (Fase 5)** — Caddy + Let's Encrypt, sem passo manual |
| **Frontend servido pela API** | **IMPLEMENTADO (Fase 5)** — mesma origem, que é o que faz o cookie funcionar |
| **Banco persistente** | **IMPLEMENTADO (Fase 5)** — volume fora da imagem; deploy não apaga dados |
| **Backup automático e verificado** | **IMPLEMENTADO (Fase 5)** — a cada 6h; todo backup é aberto e conferido |
| **Restauração testada** | **IMPLEMENTADO (Fase 5)** — modo ensaio + teste automatizado a cada suíte |
| **Monitoramento** | **IMPLEMENTADO (Fase 5)** — `/api/saude` e `/api/prontidao`, log estruturado |
| **Reinício automático** | **IMPLEMENTADO (Fase 5)** — Docker `unless-stopped` + systemd; encerramento gracioso |
| **Recuperação de senha** | **IMPLEMENTADO (Fase 5)** — link por e-mail, 30 min, uso único |
| **Envio real de convite** | **IMPLEMENTADO (Fase 5)** — com o código na tela como alternativa |
| **Guarda de configuração** | **IMPLEMENTADO (Fase 5)** — o servidor recusa subir se a config for insegura |
| **Verificação pós-deploy** | **IMPLEMENTADO (Fase 5)** — 31 checagens contra a URL publicada |
| **Contratar servidor e domínio** | **PENDENTE** — exige cadastro e pagamento do dono do produto |
| **Verificação de e-mail** | **PENDENTE** |

## Build e ambiente

- `npm test` — **172 testes passando** (153 de regra de negócio + 19 de interface).
- `npm run test:server` — **133 testes passando** (isolamento, RBAC, segurança, fluxo completo, produção).
- `npm run smoke -- <url>` — **31 verificações** contra um ambiente publicado.
- `npx tsc -b` — **limpo, sem erros**.
- `npm run build` — **build de produção funcional**, com code splitting: bundle inicial 255 KB (82 KB gzip); Recharts isolado no chunk do Dashboard.
- `npm run dev` — servidor de desenvolvimento (Vite), porta 5173.
- `npm run lint` (`oxlint`) — configurado, não bloqueante.
- Vitest cobre regra de negócio, interface e backend. Os fluxos críticos de tela (login, guarda de rota, sessão expirada, acesso negado, demonstração) têm teste; a verificação VISUAL continua manual.

## Camadas — estado por camada

| Camada | Estado |
|---|---|
| `domain/` (tipos puros) | **IMPLEMENTADO** — 10 entidades, sem lógica |
| `repositories/` (13 arquivos) | **IMPLEMENTADO** — 12 com consumidor real; só `ScoreRepository` em **PREPARAÇÃO** |
| `services/` (12 arquivos) | **IMPLEMENTADO** — todos com consumidor real |
| `integrations/` (contrato + 4 adapters) | **IMPLEMENTADO** o contrato e 1 adapter real (`FileImportIntegration`); 3 adapters em **PREPARAÇÃO** (stubs, `disponivel: false`) |
| `workspace/` (Context multiempresa) | **IMPLEMENTADO** — criação/exclusão pela UI, isolamento testado ao vivo |
| `demo/` (seed determinístico) | **IMPLEMENTADO** |
| `engine/` (ponte do motor real) | **IMPLEMENTADO** — namespaced por workspace |
| `public/motor-he/index.html` (motor legado) | **IMPLEMENTADO**, lógica de cruzamento intocada; 5 alterações deliberadas e documentadas |
| `pages/` (13 telas + Configurações) | **IMPLEMENTADO** — todas funcionais com dado real e de demonstração |
| `pages/` públicas (BemVindo, Portfolio, Apresentacao) | **IMPLEMENTADO** — fora do shell, não exigem empresa ativa |
| `portfolio/` (catálogo de projetos) | **IMPLEMENTADO** — dados puros, sem acesso a repositório |
| `components/onboarding/` | **IMPLEMENTADO** — painel de progresso derivado |

## Repositórios

| Repositório | Estado | Consumidor(es) |
|---|---|---|
| `WorkspaceRepository` | IMPLEMENTADO | `WorkspaceContext`, `workspaceService`, `RegrasTab`, `seedDemo`, todos os sub-repositórios |
| `CompanyRepository` | IMPLEMENTADO | `EmpresaTab.tsx` |
| `UnitRepository` | IMPLEMENTADO | `UnidadesTab.tsx`, `Dashboard.tsx` (indicadores por unidade) |
| `DepartmentRepository` | IMPLEMENTADO | `SetoresTab.tsx`, `MotorHE.tsx`, `RealPendenciasSection.tsx`, `seedDemo.ts` |
| `EmployeeRepository` | IMPLEMENTADO | `ColaboradoresTab.tsx`, `pendenciaService`, `Dashboard.tsx` |
| `ScheduleRepository` | IMPLEMENTADO | `EscalasTab.tsx` |
| `TimeRecordRepository` | IMPLEMENTADO | `useHEEngineData.ts`, `seedDemo.ts`, `workspaceService`, `EmpresasTab.tsx` |
| `OvertimeRepository` | IMPLEMENTADO | `overtimeService.ts` |
| `PendingRepository` | IMPLEMENTADO | `useHEEngineData.marcarCampo` (caso do motor) + `pendenciaService` (entidade) |
| `AuditRepository` | IMPLEMENTADO | `AppState.tsx`, `workspaceService` |
| `IntegrationRepository` | **PREPARAÇÃO** | nenhum — `IntegracoesTab.tsx` usa `atualizarWorkspace` genérico |
| `ReportRepository` | IMPLEMENTADO | `Relatorios.tsx` (registra cada exportação) |
| `ScoreRepository` | **PREPARAÇÃO** | nenhum — score é sempre calculado ao vivo, não há motivo para persistir |

## Services

| Service | Estado | Consumidor(es) |
|---|---|---|
| `toleranceService` | IMPLEMENTADO | `useHEEngineData.ts` |
| `overtimeService` | IMPLEMENTADO | `HorasExtras.tsx`, `RealPendenciasSection.tsx`, `pendingExplanationService` |
| `recurrenceService` | IMPLEMENTADO | `RankingReincidencia.tsx`, `Relatorios.tsx` |
| `scoreService` | IMPLEMENTADO | `ScoreColaborador.tsx`, `reportService` |
| `journeyService` | IMPLEMENTADO | `ControlePonto.tsx`, `analyticsService`, `scoreService`, `reportService` |
| `pendingClassificationService` | IMPLEMENTADO | `RealPendenciasSection.tsx`, `analyticsService`, `AnaliseSetor.tsx` |
| `pendenciaService` | IMPLEMENTADO | `RealPendenciasSection.tsx`, `CentroAcoes.tsx`, `Dashboard.tsx`, `Relatorios.tsx` |
| `pendingExplanationService` | IMPLEMENTADO | `RealPendenciasSection.tsx` |
| `priorizacaoService` | IMPLEMENTADO | `RealPendenciasSection.tsx`, `CentroAcoes.tsx` |
| `slaService` | IMPLEMENTADO | `RealPendenciasSection.tsx`, `CentroAcoes.tsx`, `analyticsService`, `reportService`, `pendingExplanationService` |
| `analyticsService` | IMPLEMENTADO | `Dashboard.tsx`, `ControlePonto.tsx`, `AnaliseSetor.tsx`, `reportService` |
| `reportService` | IMPLEMENTADO | `Relatorios.tsx` |
| `workspaceService` | IMPLEMENTADO | `WorkspaceContext.tsx`, `EmpresasTab.tsx` |
| `onboardingService` | IMPLEMENTADO | `Dashboard.tsx` (painel de configuração) |

## Telas

| Tela | Rota | Estado |
|---|---|---|
| Dashboard Executivo | `/` | IMPLEMENTADO — via `analyticsService`; pontos de atenção, 6 indicadores explicados, evolução, pendências/SLA/revisão, 4 rankings, causas, por unidade |
| Controle de Ponto | `/ponto` | IMPLEMENTADO — via `analyticsService` + `journeyService`; taxonomia unificada, coluna de alerta de jornada |
| Horas Extras HE1 | `/he1` | IMPLEMENTADO — via `overtimeService` |
| Assistente HE Diário | `/motor-he` | IMPLEMENTADO — iframe do motor, recebe todas as regras por querystring |
| Ranking de Reincidência | `/reincidencia` | IMPLEMENTADO — via `recurrenceService` |
| Score do Colaborador | `/score` | IMPLEMENTADO — via `scoreService`, 5 dimensões com composição explicada |
| Pendências | `/pendencias` | IMPLEMENTADO — ficha completa: prioridade, responsável, prazo, SLA, explicação, resolução, revisão, reabertura |
| Centro de Ações | `/centro-de-acoes` | IMPLEMENTADO — 6 cards, 6 filtros, fila com situação/prazo/responsável/motivo/ação necessária |
| Análise por Setor | `/setores` | IMPLEMENTADO — via `analyticsService`, taxonomia unificada |
| Relatórios | `/relatorios` | IMPLEMENTADO — 7 relatórios, período por mês/ciclo/tudo, exportação CSV |
| Auditoria | `/auditoria` | IMPLEMENTADO — persistida por empresa |
| Importar Dados | `/importar` | IMPLEMENTADO — via `FileImportIntegration` |
| Configurações (9 sub-abas) | `/configuracoes` | IMPLEMENTADO — Empresas/Empresa/Unidades/Setores/Colaboradores/Escalas/Regras/Integrações/Usuários |

## Regras configuráveis (`domain/Rules.ts`)

Todas **aplicadas de verdade**, tanto no lado TypeScript quanto dentro do motor:

```ts
{
  toleranceMin: 10,           // toleranceService + motor (?tol=)
  dailyGoalMin: 0,            // não assume meta de nenhuma empresa; motor (?meta=)
  recurrenceLimit: 5,         // recurrenceService + priorizacaoService + motor (?reinc=)
  intervalMinMin: 60,         // motor (?intervalo=) → journeyService
  interjourneyMinHours: 11,   // motor (?interj=) → journeyService
  prazoPadraoDias: 3,         // pendenciaService.sugerirPrazo (só sugere)
  alertaAntecedenciaDias: 1,  // slaService
}
```

Nenhum é constante fixa. Workspaces salvos antes de um campo existir recebem o default na leitura (`WorkspaceRepository.listAll`), sem sobrescrever o que já foi configurado.

## Empresas (workspaces)

- **Jornada360 Demo** (`demo`) — único workspace criado no bootstrap. Enriquecido por `seedDemo.ts` (5 colaboradores fictícios, 12 dias, 4 setores). Protegido contra exclusão.
- **Empresas do cliente** — criadas pelo portão de entrada ou por Configurações → Empresas. Sempre ambiente `real`, cadastro vazio, defaults neutros, **sem herdar nada** de outra empresa nem da demonstração. Excluíveis, com limpeza de todos os namespaces.
- **`Minha Empresa` (`real`)** — **não é mais criada automaticamente**. Continua funcionando para quem já a tinha (compatibilidade preservada em `ensureBootstrap`), mas uma instalação nova não a recebe.

**Sem empresa ativa** é um estado válido: leva ao portão de entrada, não a um workspace qualquer.

## Fase 2 — progresso completo

| Etapa / Bloco | Estado |
|---|---|
| Etapa 1 — Taxonomia de status unificada | **IMPLEMENTADO** — aplicada em Pendências, Centro de Ações, Controle de Ponto e Análise por Setor |
| Etapa 2 — Pendência como entidade real | **IMPLEMENTADO** |
| Etapa 3 — Centro de Ações | **IMPLEMENTADO** |
| Etapa 4 — Explicabilidade | **IMPLEMENTADO** |
| Etapa 5 — Priorização operacional | **IMPLEMENTADO** |
| Etapa 6 — Responsável + prazo | **IMPLEMENTADO** |
| Etapa 7 — SLA / acompanhamento | **IMPLEMENTADO** |
| Etapa 8 — Aprovação / reprovação | **IMPLEMENTADO** |
| Bloco Analítico — Dashboard Executivo + score multidimensional | **IMPLEMENTADO** |
| Bloco de Consistência — telas via services, taxonomia unificada | **IMPLEMENTADO** |
| Regras de jornada parametrizadas | **IMPLEMENTADO** |
| Portabilidade multiempresa | **IMPLEMENTADO** |
| Relatórios e exportação | **IMPLEMENTADO** |
| Experiência profissional | **IMPLEMENTADO** |

## O que continua PENDENTE ou PREPARAÇÃO (nada disso é esquecimento)

| Item | Estado | Por quê |
|---|---|---|
| Pontualidade no score | PENDENTE | Motor não expõe atraso em minutos de forma estruturada |
| Magnitude da HE na priorização/score | PENDENTE | Não há limiar configurado que diga o que é "muito" |
| `Pendencia.recomendacao` | PENDENTE | Sempre `null` — não existe motor de recomendação textual |
| Snapshot do nome do colaborador na Pendencia | PENDENTE | Só existe `colaboradorId` best-effort; pendência órfã perde a referência legível |
| Notificações externas de SLA (e-mail/push) | PLANEJADO | O SLA é calculado e visível; disparo externo é etapa futura |
| Workflow de revisão em múltiplas etapas | PENDENTE | Modelo atual não suporta sem inventar regra |
| RBAC efetivo por papel | **IMPLEMENTADO (Fase 4)** | Servidor autoriza em cada requisição; a interface esconde o que seria negado |
| Exportação PDF/XLSX | PENDENTE | Exigiria dependência nova; CSV cobre o caso de uso |
| `ScoreRepository`, `IntegrationRepository`, `ReportRepository` | PREPARAÇÃO | Contratos escritos, sem uso desde a Fase 4. Se continuarem assim, o certo é removê-los |
| Adapters Cobli / TimeClock / API | PENDENTE DE CREDENCIAL | Contratos prontos; o servidor já é o lugar da credencial |
| Recuperação de senha / verificação de e-mail / envio de convite | PENDENTE | Dependem de provedor de e-mail. Nada foi simulado |
| Publicação (HTTPS, backup, monitoramento) | PENDENTE | Requisitos de deploy — ver DEPLOY.md |
| Atualização em tempo real entre pessoas | PENDENTE | A recarga é manual; o sistema recusa sobrescrever alteração alheia |
| Recorte por período no carregamento | PENDENTE | A empresa inteira é carregada de uma vez. Adequado hoje |
| Fuzzy match e ciclo 28–27 configuráveis | PENDENTE | Deliberado — ver BUSINESS_RULES.md |

## Verificado ao vivo na Fase 4

- **Fluxo completo no navegador:** criar conta → empresa nasce vazia (onboarding em 33%) → cadastrar setor → gravado no banco → **auditoria do servidor registra "Ana Analista"**, o usuário da sessão → sair → entrar de novo → o setor continua lá.
- **Cookie de sessão:** `document.cookie` vazio no navegador (é `HttpOnly`), e o `localStorage` não contém token nenhum — só o namespace da demonstração.
- **Demonstração:** 12 dias, sem nenhuma requisição a `/api/tenants/`, com o seletor mostrando a empresa real e a demo lado a lado sem misturar dado.
- **Onboarding derivado:** subiu de 33% para 44% ao cadastrar o setor, sem nenhum flag salvo.
- **13 rotas** renderizam; console limpo em aba nova.
- **Isolamento por HTTP:** A→A 200, A→B **404**, B→B 200, B→A **404**, sem sessão 401 — e nada é gravado na tentativa cruzada.

## Verificado ao vivo na Fase 2 (histórico)

- **Empresa nova ponta a ponta:** criada pela UI → nasceu vazia com regras padrão → cadastrada unidade, setor (vinculado à unidade), escala e colaborador → tolerância alterada para 25 e persistida → **as outras empresas continuaram em 10** → excluída, com todas as chaves removidas.
- **Proteção de Real/Demo:** nenhuma das duas oferece botão de exclusão; tentativa programática é recusada pelo service.
- **Isolamento:** na empresa nova, nenhum dado do Demo apareceu — nem registros, nem a lista de usuários cadastrada no Demo.
- **Ciclo completo no Demo:** deep-link do Centro de Ações → atribuir responsável → sugerir prazo padrão (3d, correto) → justificar → resolver → reabrir a ficha já resolvida → aprovar com observação. Tudo persistido e auditado.
- **Motor com regras do workspace:** confirmado por inspeção interna do iframe que `TOLERANCIA_PADRAO_MIN`, `META_MIN`, `LIMITE_REINCIDENCIA`, `INTERJORNADA_MIN_H` e `INTERVALO_MIN_MIN` vêm da querystring, e `SETOR_MAP` está vazio.
- **Meta não configurada:** com `dailyGoalMin = 0`, o painel de meta do motor mostra "—" e "não configurada" em vez de comparar com um alvo inventado.
- **Relatórios:** os 7 geram; CSV exportado e inspecionado (cabeçalho com empresa/escopo/data, separador `;`, escape correto de texto com vírgula e acento).
- **Regressão:** as 12 rotas renderizam sem erro de console em sessão limpa.
- **Responsividade:** em 375px não há rolagem horizontal na página; a barra lateral vira faixa e as tabelas rolam dentro do próprio contêiner.

## Correções encontradas durante os testes desta fase

1. **Dashboard mostrava zero pendências** para quem entrava direto nele — faltava a sincronização que as outras duas telas já faziam. O badge da barra lateral mostrava dezenas ao mesmo tempo.
2. **"Dentro do padrão" liderava o ranking de setores com mais divergência** — o agrupamento sintético recebia a parcela dentro do padrão de casos acima do padrão, e essas divergências eram contadas nele.
3. **Deep-link não reabria o mesmo caso duas vezes** — a URL não mudava, então o efeito não voltava a rodar. O parâmetro agora é consumido após abrir.
4. **Cadastro aceitava setores/unidades com nome duplicado** — o que fica gravado num caso é o nome, não o id, então dois homônimos seriam indistinguíveis.
5. **Chaves órfãs após excluir empresa** — `pendencias` e `auditLog` ficavam como listas vazias em vez de serem removidas.
