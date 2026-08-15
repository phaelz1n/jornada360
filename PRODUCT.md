# Jornada360 — Visão de produto

Este documento descreve o Jornada360 como **produto**: para quem serve, o que entrega, como um cliente novo entra, e o que ele ainda não é. Para a visão técnica, ver [ARCHITECTURE.md](ARCHITECTURE.md) e [JORNADA360_HANDOFF.md](JORNADA360_HANDOFF.md).

---

## O que é

Uma plataforma de **controle, análise e auditoria de jornada de trabalho**. Cruza quatro fontes de dados de um dia — espelho de ponto, escala, rastreamento veicular e horário padrão — identifica jornadas fora do esperado e conduz cada ocorrência até a resolução auditada.

## Para quem

Analistas de RH/DP e gestores operacionais que hoje conferem jornada comparando planilhas linha por linha, e que precisam sustentar cada decisão em uma auditoria trabalhista.

## O que muda na prática

**Antes:** "aqui estão 200 registros do mês, procure os problemas."

**Depois:** "aqui estão os 12 casos que exigem sua decisão, ordenados por prioridade, cada um com o motivo explicado, um responsável, um prazo e o histórico do que já foi feito."

## Os três caminhos de entrada

Quem abre o Jornada360 encontra um portão com três opções explícitas — **nunca é colocado dentro de uma empresa sem escolher**:

| Caminho | O que acontece |
|---|---|
| **Criar minha empresa** | Ambiente novo, completamente vazio, com regras nos valores padrão. Nada é herdado de outra empresa nem da demonstração. Segue para o onboarding |
| **Ver demonstração** | Ambiente de apresentação com dados fictícios, claramente identificado em roxo. Serve para conhecer o sistema funcionando |
| **Já tenho acesso** | Login com e-mail e senha. Sessão validada pelo servidor |

## O ciclo do produto

```
DADOS → ANÁLISE → DETECÇÃO → PENDÊNCIAS → PRIORIZAÇÃO
      → EXPLICAÇÃO → RESPONSÁVEL → PRAZO → SLA
      → RESOLUÇÃO → APROVAÇÃO/REPROVAÇÃO → AUDITORIA
      → INDICADORES → RELATÓRIO
```

Cada etapa é uma tela e um conjunto de regras documentadas em [BUSINESS_RULES.md](BUSINESS_RULES.md).

## Módulos

| Módulo | Entrega |
|---|---|
| Dashboard Executivo | Indicadores de qualidade explicados, evolução, rankings, pontos de atenção |
| Controle de Ponto | Todos os registros com situação e alertas de jornada |
| Horas Extras | Acumulado e excedente por colaborador |
| Assistente HE Diário | Motor de cruzamento das quatro fontes |
| Ranking de Reincidência | Quem repete ocorrências acima do limite configurado |
| Score do Colaborador | Cinco dimensões medidas, com composição explicada |
| Pendências | Ficha completa com explicação, resolução e revisão |
| Centro de Ações | Fila priorizada com prazo, responsável e ação necessária |
| Análise por Setor | Origem estrutural das ocorrências |
| Relatórios | Sete relatórios com exportação em CSV |
| Auditoria | Quem alterou o quê, quando e por quê |
| Configurações | Empresas, estrutura, regras, integrações, usuários |
| Importar Dados | Entrada por arquivo, com camada de integração extensível |

## Princípios de produto

**Nunca inventar um número.** Quando um indicador não pode ser calculado, o sistema mostra "—" e explica o que falta. Um número estimado num sistema de auditoria é pior do que uma lacuna assumida.

**Explicar todo indicador.** Cada número relevante tem um botão "?" que abre como foi calculado e por que aparece ali.

**Recomendar não é decidir.** O sistema sugere prioridade e prazo, com o motivo escrito. Aplicar é sempre uma ação humana, e a escolha manual nunca é sobrescrita.

**Resolver não é aprovar.** São decisões diferentes, de momentos diferentes, possivelmente de pessoas diferentes.

**Isolamento é requisito, não recurso.** Cada empresa tem armazenamento próprio. Uma empresa nova nasce vazia. O ambiente fictício é blindado contra ser semeado num ambiente real.

## Estágio comercial: MVP Comercial / Programa Piloto

A primeira versão comercial é uma **venda piloto**: poucas empresas, escolhidas uma a uma, com cobrança e suporte manuais. Isso não é uma limitação temporária a ser escondida — é o desenho da fase. Ver [PILOTO.md](PILOTO.md).

O que isso significa na prática:

- **Não há autoatendimento.** Em produção o cadastro nasce fechado; ninguém cria empresa sozinho. O acesso é liberado pela equipe do Jornada360, e quem é convidado por um cliente entra por `/convite`.
- **A cobrança acontece fora do sistema.** Nenhum checkout, plano ou fatura foi implementado. O que o sistema garante é o que importa comercialmente: **controlar com segurança quais empresas têm acesso**.
- **O acesso pode ser suspenso e devolvido.** Suspender bloqueia leitura e escrita e encerra as sessões abertas, mas **não apaga nada** — a empresa continua no banco, nos backups, e volta intacta ao ser reativada. É essa promessa que torna uma venda piloto negociável.
- **O feedback do cliente é parte do produto.** Um botão "Relatar" em qualquer tela, com cinco categorias, e a tela atual enviada junto. Nem toda sugestão vira funcionalidade — e o texto que o cliente lê diz exatamente isso.

Não se apresenta como produto definitivo nem como versão final.

## O que o produto ainda não é

**O que já funciona de verdade (Fase 4):** conta com senha, sessão em cookie `HttpOnly`, empresas isoladas por `tenant_id` no banco, papéis aplicados pelo servidor em cada requisição, auditoria com autor vindo da sessão, e trabalho de equipe sobre a mesma fila. Você entra de outra máquina e encontra tudo onde deixou. São 318 testes automatizados, incluindo isolamento entre empresas exercitado por HTTP real.

**O que a Fase 5 acrescentou:** o sistema está pronto para ser publicado. HTTPS automático (certificado obtido e renovado sozinho), banco em volume persistente, backup a cada 6 horas com verificação — todo backup é aberto e conferido logo após ser gerado —, restauração testada, recuperação de senha por e-mail, reinício automático, e uma verificação de configuração que **impede o servidor de subir** se algo estiver inseguro.

**O que ainda falta:**

- **Publicar de fato.** Exige contratar um servidor, registrar um domínio e criar a conta de envio de e-mail — cadastros que só o dono do produto pode fazer. O custo é de R$ 30 a 65 por mês, sem custo adicional por cliente.
- **Sem verificação de e-mail.** Nada impede criar conta com o e-mail de outra pessoa.
- **Sem cobrança, sem planos, sem limites.** Nada disso foi implementado nem simulado — no piloto, a cobrança é manual e por fora, de propósito.
- **Sem atualização em tempo real.** Se outra pessoa alterou algo, é preciso recarregar — mas o sistema recusa sobrescrever a alteração dela em silêncio.
- **Backup no mesmo servidor.** Se a máquina se perder, o backup se perde junto; a cópia externa é um passo de configuração descrito em [DEPLOY.md](DEPLOY.md).

Descrever isso como "SaaS em operação" seria falso: não há autoatendimento nem cobrança automática, e isso é decisão, não pendência. A descrição correta é: **MVP Comercial pronto para um programa piloto — infraestrutura de operação construída e testada, acesso controlado empresa por empresa; falta contratar a hospedagem e apontar o domínio.** Ver [DEPLOY.md](DEPLOY.md) e [SECURITY.md](SECURITY.md).

## Planos comerciais — conceito, não implementação

Nada de cobrança, assinatura ou limite foi implementado. O que existe é o mapeamento de **onde** limites entrariam quando houver backend e billing:

| | Free | Pro | Enterprise |
|---|---|---|---|
| Colaboradores | limite baixo | limite maior | ilimitado |
| Usuários do sistema | 1 | equipe | ilimitado + SSO |
| Integrações | importação por arquivo | + sistemas de ponto e rastreamento | + API dedicada |
| Relatórios | CSV | + PDF/XLSX e agendamento | + BI externo |
| Retenção de histórico | curta | média | longa/definida em contrato |
| Auditoria | básica | completa | completa + exportação |
| Recursos de análise assistida | — | sugestões | sugestões + modelos próprios |
| Suporte | comunidade | e-mail | dedicado |

Onde cada limite se aplicaria no código está indicado em [SAAS_ARCHITECTURE.md](SAAS_ARCHITECTURE.md). **Nenhum desses limites existe hoje** e nenhuma tela de pagamento foi criada.
