# Como a interface conversa com o servidor

O que mudou na Fase 4, por que foi feito assim, e o que a decisão custou.

---

## O problema

Ao fim da Fase 3 havia um backend completo e testado, e uma interface que não o usava. Ligar os dois tinha um obstáculo concreto: **`localStorage` é síncrono e a rede não é**. Converter as treze telas para lidar com carregamento, erro e recarga significaria mudar centenas de linhas de código que já funcionava e já era testado — a maneira mais fácil de introduzir regressões em algo estável.

## A decisão: carregar assíncrono, ler síncrono

```
┌─ WorkspaceProvider ─────────────────────────────────────────┐
│  carrega UMA VEZ, de forma assíncrona                       │
│  (cadastro + dias + pendências + auditoria)                 │
│                                                              │
│  expõe pronto e SÍNCRONO:                                    │
│     workspace · dias · pendencias · auditoria                │
│     carregando · erroCarregamento · recarregar               │
│     gravar(...)                                              │
└──────────────────────────────────────────────────────────────┘
                            ↓
        as treze telas leem exatamente como liam antes
```

O roteador só monta o sistema **depois** que o carregamento terminou. É essa garantia que permite `useWorkspace()` devolver dado não-nulo e as telas continuarem síncronas.

**O que isso evitou:** treze estados de carregamento, treze tratamentos de erro, treze formas diferentes de recarregar.

**O que isso custou, e vale dizer:** a empresa inteira é carregada de uma vez. Para o volume de uma operação (um dia processado tem dezenas de registros, não milhares) isso é adequado, e o Dashboard precisa mesmo da série inteira para calcular indicadores, ranking e score. Com anos de histórico será preciso recortar por período — está em "O que falta", abaixo.

---

## Dois caminhos, um contrato

```
                    ConjuntoRepositorios (src/data/tipos.ts)
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
       conjuntoLocal                            conjuntoRemoto
    (demonstração)                            (empresa real)
    localStorage                              API → banco → tenant
    sem servidor, sem conta                   sessão, papel, isolamento
```

A escolha acontece **uma vez**, em `WorkspaceProvider`. Nenhuma tela, nenhum service e nenhum componente pergunta "estou no demo?" — é justamente esse `if` espalhado que a fábrica existe para impedir.

Tudo é assíncrono, **inclusive no modo local** (onde as promessas já vêm resolvidas). Um contrato síncrono no local e assíncrono no remoto obrigaria cada chamador a tratar os dois casos, que é o vazamento que se quer evitar.

### Por que a demonstração continua local

Ela precisa abrir com o servidor desligado, instantânea, sem conta e sem rede — é o que uma apresentação exige. Exigir backend para mostrar o produto transformaria a demo num ponto de falha no pior momento possível.

---

## Camadas, hoje

```
Tela
 ↓  (lê síncrono do contexto; grava chamando `gravar`)
Service            ← regra de negócio, PURA, sem I/O
 ↓
ConjuntoRepositorios  ← local ou remoto, mesmo contrato
 ↓
api/client.ts      ← único lugar do frontend que chama `fetch`
 ↓
API REST → services/repositories → SQLite (tenant_id em toda tabela)
```

**Nenhuma tela chama `fetch`. Nenhuma tela chama `localStorage`.** As duas regras valem pelo mesmo motivo: trocar o transporte deve ser reescrever um arquivo, não trinta.

### Services deixaram de fazer I/O

`pendenciaService` escrevia direto no repositório local. Agora ele **calcula** qual deve ser o estado de cada pendência e devolve; quem grava é a camada de dados.

Uma regra de negócio que escreve sozinha só funciona onde conhece o armazenamento. Sem I/O, as mesmas regras valem nos dois caminhos — e continuam testáveis como funções puras, sem simular storage nenhum.

`sincronizarPendencias` devolve **somente o que mudou**. Sem esse filtro, abrir a tela reenviaria ao servidor centenas de pendências idênticas às que já estão lá: custo de rede e trilha de auditoria poluída com eventos sem informação.

---

## Padrão assíncrono

| Peça | O que resolve |
|---|---|
| `useRecurso` | Carregar: `dados`, `estado`, `erro`, `primeiraCarga`, `recarregar`, `definir` |
| `useGravacao` | Gravar: `salvando` / `salvo` / `erro`, com trava contra duplo clique |
| `EstadosAsync.tsx` | `Carregando`, `ErroAoCarregar`, `SessaoExpirada`, `AcessoNegado`, `ApiIndisponivel`, `FeedbackGravacao` |

Duas garantias do `useRecurso` que parecem detalhe e não são:

1. **Resposta atrasada de um pedido antigo nunca sobrescreve um pedido mais novo.** Trocar de empresa rápido dispara duas buscas; se a primeira demorasse mais, a tela mostraria dados da empresa errada. Um contador de geração descarta o que chega fora de hora.
2. **Nada é escrito depois que o componente saiu da tela.**

### Nada de interface otimista

A tela só mostra o valor novo depois que o servidor confirmou. Antecipar o sucesso exigiria saber desfazer, e um desfazer silencioso num sistema de auditoria é pior do que meio segundo de espera.

---

## Estados que a interface distingue

"Não deu certo" não é uma coisa só. Cada situação pede uma ação diferente, então cada uma é dita de forma diferente:

| Situação | O que a pessoa vê | Próximo passo oferecido |
|---|---|---|
| Carregando | "Carregando os dados da empresa…" | esperar |
| Servidor fora do ar | "Não foi possível conectar ao servidor. Nada foi salvo neste navegador." | tentar de novo |
| Sessão expirada | "Sua sessão expirou." | entrar novamente |
| Sem permissão | "Seu perfil não permite…" | pedir a um administrador |
| Conflito de edição | "Alguém alterou este registro enquanto você editava." | **recarregar**, não tentar de novo |
| Erro ao salvar | mensagem do servidor | tentar de novo |

Tratar conflito como erro comum levaria alguém a insistir no botão e sobrescrever o trabalho do colega.

---

## Conflito de escrita

Antes da Fase 4 cada pessoa trabalhava no próprio navegador — colisão não existia. Com servidor, duas pessoas podem abrir a mesma tela, e a segunda a salvar apagaria a alteração da primeira sem ninguém perceber. **Perder trabalho em silêncio é inaceitável num sistema de auditoria.**

Quem lê recebe um carimbo de versão e o devolve ao gravar, no cabeçalho `x-versao`. Se o carimbo mudou, a resposta é `409` e a interface pede recarga.

| Agregado | Carimbo |
|---|---|
| Cadastro da empresa (empresa, unidades, setores, escalas, colaboradores, regras, causas) | `tenants.config_versao` |
| Pendência | `pendings.atualizada_em` |

O cadastro é **um agregado só** de propósito: essas coleções são editadas juntas, na mesma tela, e um carimbo por coleção geraria conflitos falsos entre abas que não se atrapalham.

O cabeçalho é **opcional**: um cliente que não participa do controle (script de migração, integração) continua funcionando. A interface web sempre envia.

**Limitação conhecida:** dias processados não têm controle de versão. Reprocessar o mesmo dia sobrescreve — o que é o comportamento desejado (é uma planilha corrigida), mas significa que duas pessoas processando o mesmo dia ao mesmo tempo terminam com o resultado de quem gravou por último. `caseState` é preservado no servidor quando só o snapshot é reenviado, então justificativas já escritas não se perdem.

---

## Motor HE: adaptador ao redor, nunca dentro

O motor **não foi alterado**. Ele continua processando as planilhas e gravando no `localStorage` da própria origem. Ensiná-lo a falar com a API significaria mexer na parte do sistema validada contra dados reais, pelo motivo errado.

O envio é um adaptador na tela `/motor-he`:

```
Planilhas → Motor (iframe, intocado) → localStorage
                                            ↓
                        painel "Enviar ao servidor"  ← explícito
                                            ↓
                                 salvarDia → API → banco
```

O painel mostra quantos dias estão pendentes e a pessoa clica. **Enviar sozinho, em silêncio, esconderia justamente o momento em que o dado sai do navegador.** Na demonstração o painel não aparece — lá o "servidor" é o próprio navegador.

---

## Importação de arquivo

Continua processada no navegador: o arquivo é lido, o motor cruza, e **só o resultado normalizado** vai ao servidor. Guardar planilhas em SQLite não foi feito, e não por esquecimento — arquivo binário em banco relacional é uma decisão que exige object storage para ser bem feita, e nada no fluxo atual precisa do arquivo original depois do processamento.

Se um dia a auditoria exigir guardar o arquivo-fonte, o destino é object storage (S3 ou equivalente), com o banco guardando apenas a referência. Está anotado como evolução, não como pendência disfarçada.

---

## Analytics

Continuam calculados no **frontend**, sobre os dados carregados. Não foi criado nenhum agregado no servidor.

O motivo é evitar duas fontes de verdade: as fórmulas vivem em `analyticsService` e `scoreService`, cobertos por testes. Reimplementá-las em SQL significaria manter as duas em sincronia para sempre, e a primeira divergência seria descoberta por alguém percebendo que a tela e o relatório discordam.

Quando o volume justificar, o caminho é o servidor devolver a série **já recortada por período** — não recalcular indicadores.

---

## O que falta

| Item | Situação |
|---|---|
| Recorte por período no carregamento | A empresa inteira é carregada de uma vez. Adequado hoje; necessário com anos de histórico |
| Controle de versão nos dias processados | Reprocessar sobrescreve. `caseState` é preservado |
| Atualização em tempo real entre pessoas | Não existe. A recarga é manual (botão na barra superior) |
| Modo offline | Não existe, e é deliberado: melhor dizer "sem conexão" do que salvar local e fingir que sincronizou |
| Paginação nas telas de lista | Tudo em memória |

---

## Onde está cada coisa

| Arquivo | Papel |
|---|---|
| `src/data/tipos.ts` | O contrato único de persistência |
| `src/data/conjuntoLocal.ts` | Implementação local (demonstração) |
| `src/data/conjuntoRemoto.ts` | Implementação remota (empresa real) |
| `src/data/useRecurso.ts` | `useRecurso` + `useGravacao` |
| `src/workspace/WorkspaceContext.tsx` | Escolhe o conjunto, carrega, expõe síncrono |
| `src/api/client.ts` | Único `fetch` do frontend |
| `src/components/ui/EstadosAsync.tsx` | Os estados de rede em forma de componente |
| `src/pages/MotorHE.tsx` | Adaptador de envio ao redor do motor |
| `src/pages/settings/MigracaoTab.tsx` | Migração dos dados locais (ver [MIGRACAO_LOCALSTORAGE.md](MIGRACAO_LOCALSTORAGE.md)) |
