# Arquitetura

## Camadas

Desde a Fase 4 a interface **consome o backend de verdade** para empresas reais, e continua local para a demonstração. Ver [FRONTEND_BACKEND.md](FRONTEND_BACKEND.md) para a decisão e o que ela custou.

```
Tela
 ↓   lê SÍNCRONO do contexto · grava chamando `gravar`
Service                    ← regra de negócio, PURA, sem I/O
 ↓
ConjuntoRepositorios       ← contrato único
 ├── conjuntoLocal   → localStorage        (demonstração: sem conta, sem servidor)
 └── conjuntoRemoto  → src/api/client.ts   (empresa real)
                              ↓
                       API REST → services/repositories → SQLite (tenant_id em toda tabela)
```

**Como as treze telas sobreviveram à migração sem serem reescritas:** o carregamento virou assíncrono e acontece uma vez, no `WorkspaceProvider`; a leitura continua síncrona para quem está dentro do sistema. O roteador só monta o shell depois que o dado chegou.

```
Interface (src/pages/*, src/components/*)
        │  hooks: useHEEngineData(), useWorkspace(), useAppState()
        ▼
Serviços / Domínio (src/services/*)        ← regras de negócio, independentes de UI e de storage
        ▼
Repositórios (src/repositories/*)           ← contrato estável; único lugar que sabe "onde" os dados vivem
        ▼  (implementação atual)
localStorage, namespaced por workspace
```

A interface nunca fala com `localStorage` diretamente. Toda leitura/escrita passa por um repositório (ou por um hook que, por baixo, chama um repositório). Quando existir backend, **só a implementação de cada repositório muda** (troca `localStorage` por `fetch`/API); o contrato (a interface TypeScript de cada repositório) e tudo o que está acima dele — serviços, hooks, telas — não precisa mudar:

```
Interface → Serviços/Domínio → Repositórios → API → Backend → Banco de dados
```

Isso é a base pra portabilidade de infraestrutura: hoje sem servidor, amanhã com um, sem reescrever tela nenhuma.

## Estrutura de pastas

```
src/
├── domain/          Tipos de entidade puros (Company, Unit, Department, Employee, Schedule,
│                     Rules, IntegrationConfig, UserAccess, WorkspaceConfig, Pendencia). Sem lógica.
│
├── services/         Regras de negócio nomeadas, testáveis isoladas da UI:
│     toleranceService.ts        Padrão × Registro × Tolerância → Normal/Divergência
│     overtimeService.ts         HE programada × realizada × excedente (usado por Horas Extras
│                                 e pela ficha de pendência)
│     journeyService.ts          Intervalo/interjornada — funções prontas, AINDA NÃO chamadas por
│                                 nenhuma tela (ver "journeyService" em BUSINESS_RULES.md: preparação
│                                 explícita para Fase 2, não código esquecido)
│     recurrenceService.ts       Reincidência por colaborador
│     scoreService.ts            Score de conformidade
│     pendingClassificationService.ts   Quais casos viram pendência + status unificado (Fase 2/1)
│     pendenciaService.ts        Materializa/atualiza a entidade Pendencia a partir do motor;
│                                 responsável, prazo, resolução, revisão (Fase 2/2, 6, 8)
│     priorizacaoService.ts      Recomendação determinística de prioridade (Fase 2/5) — nunca
│                                 persistida, nunca sobrescreve decisão humana
│     slaService.ts              Estado de prazo de uma Pendencia (Fase 2/7) — 6 estados, puro
│     pendingExplanationService.ts  "Por que isso apareceu?" (Fase 2/4) — narra o que já foi
│                                 decidido, nunca recalcula nem inventa dado ausente
│     analyticsService.ts       Todos os indicadores do Dashboard Executivo — só agrega o que já
│                                 foi decidido; devolve null quando não há dado, nunca estimativa
│     reportService.ts          Os 7 relatórios + exportação CSV (tabela pronta, sem I/O)
│     workspaceService.ts       Ciclo de vida de empresa (criar/excluir em todos os namespaces)
│     onboardingService.ts      Progresso de configuração — DERIVADO do cadastro, nunca um flag
│
├── repositories/     Contrato + implementação localStorage, um arquivo por entidade — todos com
│     consumidor real na interface (Fase 1.1 religou os que tinham nascido sem uso):
│     WorkspaceRepository, CompanyRepository, UnitRepository, DepartmentRepository,
│     EmployeeRepository, ScheduleRepository — cada tela de Configurações usa o seu
│     TimeRecordRepository — usado por useHEEngineData/seedDemo (leitura/escrita geral do motor)
│     OvertimeRepository — usado por overtimeService (consulta pontual de HE por dia/colaborador)
│     PendingRepository — duas responsabilidades no mesmo arquivo, sobre storages diferentes:
│       (a) edição do caso bruto do motor (HECaseState), via useHEEngineData.marcarCampo — única
│           porta de entrada pra editar/resolver um caso;
│       (b) a entidade Pendencia persistida (jornada360:{workspaceId}:pendencias), usada só por
│           pendenciaService — CRUD + resolver + revisar
│     AuditRepository — trilha de auditoria persistida, usada por AppState
│     IntegrationRepository, ReportRepository, ScoreRepository — contratos para Fase 2/3, ainda
│     sem consumidor (rotulados como tal, não é esquecimento)
│     localStorageClient.ts — único lugar que chama localStorage.getItem/setItem de fato
│
├── integrations/     Camada de integração por adapter (ver INTEGRATIONS.md)
│
├── workspace/         WorkspaceContext — dono de "qual empresa/ambiente estou vendo agora"
│
├── demo/              Gerador do dataset fictício do ambiente Demonstração
│
├── engine/            Motor real de HE portado (ver seção própria abaixo)
│
├── state/             AppState — trilha de auditoria exposta à UI (usa AuditRepository)
│
├── portfolio/         Catálogo de projetos (dados puros) — a vitrine profissional. Não acessa
│                       repositório nenhum: não há caminho pelo qual dado de cliente chegue lá
│
├── pages/             Telas, uma por rota
│     BemVindo.tsx      Portão de entrada (criar empresa / demonstração / login futuro)
│     Portfolio.tsx     Vitrine de projetos            } rotas públicas, fora do shell
│     Apresentacao.tsx  Apresentação do produto        } (não exigem empresa ativa)
│     settings/         Sub-telas de Configurações (Empresas/Empresa/Unidades/Setores/Colaboradores/
│                        Escalas/Regras/Integrações/Usuários)
│
└── components/        UI reutilizável (layout, badges, modal, paginação) + componentes de domínio (src/components/he/)
```

## O motor real de HE (`src/engine/` + `public/motor-he/`)

O Jornada360 nasceu incorporando, sem reescrever, um assistente de HE diário já em produção (`public/motor-he/index.html`) — ele faz todo o parsing de planilhas (espelho de ponto, escala, rastreio Cobli, horário padrão), correspondência difusa de nomes, e a primeira classificação de divergência. Roda dentro de um iframe (`src/pages/MotorHE.tsx`).

`src/engine/heEngineCore.ts` porta em TypeScript só as funções **puras** de pós-processamento desse motor (`normName`, `heEfetivo`, `reclassificar`, `resolvedSetor`...) — não duplica o parsing de xlsx, que continua rodando exclusivamente dentro do iframe. `src/engine/heEngineBridge.ts` lê/escreve o mesmo `localStorage` que o iframe usa (mesma origem = mesmo storage). `src/repositories/TimeRecordRepository.ts` envelopa esse bridge com um contrato de repositório; `src/engine/useHEEngineData.ts` é o hook que a UI consome, e por baixo já chama o repositório, nunca o bridge diretamente.

**Alterações deliberadas** em `public/motor-he/index.html` desde que ele foi incorporado (documentadas também no cabeçalho do arquivo e conferíveis por `diff` contra o original). Todas seguem o mesmo princípio: **tirar do arquivo o que pertencia a uma empresa específica e passar a receber isso de fora**.

1. O prefixo de armazenamento local passou a incluir o workspace ativo (`?ws=`), pra isolar as empresas entre si.
2. O mapa fixo de setor por nome de motorista (`SETOR_MAP`, ~26 nomes reais hardcoded) foi esvaziado — travava o arquivo numa operação específica. A atribuição de setor continua funcionando pela interface.
3. `SETOR_OPTS`/`CAUSA_OPTS` deixaram de ser listas fixas e passaram a ler `?setores=`/`?causas=`, montadas por `MotorHE.tsx` a partir de `DepartmentRepository`/`workspace.causaOpts` — mesma fonte que a tela de Pendências usa.
4. **Regras de jornada parametrizadas** (`numeroDaQuerystring`): `TOLERANCIA_PADRAO_MIN` (`?tol=`), `META_MIN` (`?meta=`), `LIMITE_REINCIDENCIA` (`?reinc=`), `INTERJORNADA_MIN_H` (`?interj=`) e `INTERVALO_MIN_MIN` (`?intervalo=`). Antes eram constantes fixas — em especial `META_MIN = 36*60+50` (36:50), a meta diária de uma operação real, que agora nasce em 0 = "não configurada" e faz os painéis de meta mostrarem "—" em vez de comparar com um alvo inventado.
5. **Cálculo de intervalo intrajornada** (novo): com 4+ batidas, o maior intervalo entre batidas consecutivas é comparado com o mínimo configurado; exibido na ficha ao lado do alerta de interjornada, que já existia. Ver BUSINESS_RULES.md para a regra e sua limitação.

Sem os parâmetros (arquivo aberto direto, fora do Jornada360), cada um cai num fallback genérico — o motor continua funcionando sozinho.

**Nada da lógica de cruzamento/classificação de planilha foi alterada.** O parsing de xlsx, a correspondência difusa de nomes e a comparação ponto×rastreio continuam exatamente como estavam.

## Isolamento por workspace — estratégia de storage

Existem **dois padrões de chave diferentes** no projeto, cada um com um motivo:

| Dado | Chave | Padrão |
|---|---|---|
| Configuração do workspace (empresa, unidades, setores, colaboradores, escalas, regras, causaOpts, integrações, usuários) | `jornada360:workspaces` — **uma chave só**, contendo um array com a config de TODOS os workspaces | Um objeto por workspace dentro do array |
| Ativo no momento | `jornada360:activeWorkspaceId` | Uma chave global (não faz sentido por workspace) |
| Auditoria | `jornada360:{workspaceId}:auditLog` | Uma chave por workspace |
| Pendências persistidas | `jornada360:{workspaceId}:pendencias` | Uma chave por workspace |
| Histórico de relatórios exportados | `jornada360:{workspaceId}:reports` | Uma chave por workspace |
| Dados do motor de HE (snapshot do dia + progresso) | `assistente_he_local_{workspaceId}_...` | Uma chave por dia, por workspace |

Excluir uma empresa (`workspaceService.excluirWorkspace`) remove **todas** as chaves acima que pertencem a ela — as chaves são apagadas, não zeradas, para não sobrar registro vazio de empresa inexistente.

Por que a config não segue o mesmo padrão "uma chave por workspace" que auditoria/motor usam: o volume de dado é pequeno (poucos KB mesmo com dezenas de colaboradores), a lista inteira já precisa ser lida de qualquer forma pra popular o seletor Real/Demo no topo, e não há ganho de performance real em fatiar isso em várias chaves. **Isolamento continua garantido** — cada workspace só lê/escreve o próprio objeto dentro do array (`WorkspaceRepository.getById`/`upsert`), nunca o de outro; testado ao vivo na Fase 1 e de novo na consolidação da Fase 1.1.

Avaliado migrar para uma chave por workspace (`jornada360:{workspaceId}:config`) nesta consolidação — decisão foi **não migrar agora**: o ganho é só arquitetural/estético, o risco é real (dado de config já existente em `real`/`demo` no navegador de quem já usa o app seria perdido sem um passo de migração), e mexer nisso não estava resolvendo nenhum bug. Fica documentado como possível ajuste de Fase 2 caso surja um motivo concreto (ex.: exportar/apagar um workspace inteiro com uma operação de storage só).

Trocar de workspace no seletor do topo troca o `workspaceId` ativo em `WorkspaceContext`, que se propaga para todos os hooks/repositórios — cada tela relê automaticamente do namespace/registro certo, sem misturar dado de um workspace com outro.

## Dois níveis de acesso ao contexto: sessão e empresa

`WorkspaceContext` expõe dois hooks sobre o mesmo contexto, e a diferença importa:

| Hook | Empresa ativa | Quem usa |
|---|---|---|
| `useSessao()` | pode ser **null** | `App.tsx`, `AppState`, tela de boas-vindas |
| `useWorkspace()` | **garantida** (lança erro se não houver) | as 13 telas operacionais |

Por que separar: no primeiro acesso não existe empresa ativa (ver `ensureBootstrap` acima). Se `useWorkspace()` pudesse devolver null, **todas** as telas precisariam tratar esse caso — e uma que esquecesse quebraria em runtime. Em vez disso, `App.tsx` decide antes: sem empresa ativa, renderiza as rotas públicas; com empresa, renderiza o shell. Quem chega dentro do shell já passou pelo portão, e a garantia de tipo reflete isso.

```
App
 ├── sem empresa ativa → RotasPublicas   (BemVindo, Portfolio, Apresentacao)
 └── com empresa ativa → RotasDaAplicacao (AppLayout + as 13 telas)
```

## Blindagem do ambiente de demonstração

Três camadas impedem que dado fictício chegue a uma empresa real:

1. `seedDemoWorkspaceIfEmpty()` verifica `workspace.environment === 'demo'` e recusa qualquer outro — não basta o id ser `demo`.
2. `WorkspaceRepository.criar()` sempre cria com ambiente `real`; nenhuma empresa criada pela interface passa pela verificação acima.
3. O seed nunca copia de outro workspace: gera dados a partir de uma semente determinística própria.

Na direção inversa, a mesma separação de namespace que isola empresas entre si isola a demonstração — ela é apenas mais um workspace.

## Sincronização entre componentes

Como vários componentes na mesma página podem chamar `useHEEngineData()` de forma independente, uma escrita feita por um (ex.: resolver uma pendência) precisa avisar os outros (ex.: o contador da Sidebar). O evento nativo `storage` do navegador só dispara em *outras* abas/documentos — nunca na aba que fez a escrita. Por isso existe um `CustomEvent` próprio (`jornada360:he-sync`, ver `useHEEngineData.ts`) que todas as instâncias do hook escutam e disparam a cada escrita, garantindo que a página inteira fique consistente sem precisar recarregar.
