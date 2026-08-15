# Portfólio

Área de vitrine profissional, acessível em `/portfolio`, **separada do sistema operacional**.

---

## O que é

Uma apresentação dos projetos desenvolvidos, com o problema que cada um resolve, a arquitetura por trás e as decisões de engenharia que valem ser explicadas numa conversa técnica.

Duas telas públicas, fora do shell da aplicação:

| Rota | Conteúdo |
|---|---|
| `/portfolio` | Catálogo de projetos: resumo, problemas, fluxo, módulos, arquitetura, decisões |
| `/apresentacao` | Apresentação comercial do Jornada360: hero, problemas, como funciona, módulos, limitações |

Ambas são alcançáveis pelo portão de entrada e pelo rodapé da barra lateral.

---

## Regra de conteúdo — não negociável

O portfólio **nunca** exibe dado de operação. Ele lê exclusivamente o catálogo estático em `src/portfolio/projetos.ts`, e não tem acesso a nenhum repositório, workspace ou armazenamento.

Proibido no portfólio:

- nomes reais de pessoas
- dados reais de qualquer empresa
- registros de ponto reais
- trilhas de auditoria reais
- qualquer informação confidencial

Permitido:

- descrição de capacidades e módulos
- arquitetura e decisões técnicas
- demonstração ao vivo, que usa **exclusivamente** o ambiente fictício

Isso é estrutural, não uma convenção: as telas do portfólio não importam nenhum repositório. Não há caminho pelo qual dado de cliente chegue lá.

---

## Como adicionar um projeto novo

`src/portfolio/projetos.ts` é um arquivo de **dados**, não um CMS. Adicionar um projeto é acrescentar um objeto ao array `PROJETOS` — nenhuma tela precisa ser alterada, porque `Portfolio.tsx` itera sobre a lista.

```ts
export const PROJETOS: Projeto[] = [
  { /* Jornada360 */ },
  {
    id: 'meu-projeto',
    nome: 'Nome do Projeto',
    subtitulo: 'Uma linha do que ele é',
    estado: 'concluido',            // 'em_evolucao' | 'concluido' | 'conceito'
    resumo: 'Parágrafo curto.',
    problemas: ['Problema 1', 'Problema 2'],
    fluxo: [{ titulo: 'Etapa', descricao: 'O que acontece' }],
    modulos: [{ nome: 'Módulo', descricao: 'O que entrega' }],
    arquitetura: [{ camada: 'Interface', itens: ['React', 'TypeScript'] }],
    decisoes: [{ titulo: 'Decisão', texto: 'Por que foi assim.' }],
    stack: ['React', 'TypeScript'],
    acoes: [{ label: 'Ver demonstração', destino: '/algum-lugar', principal: true }],
  },
];
```

O campo `acoes` é opcional e só faz sentido para projetos que rodam dentro desta aplicação. Projetos externos podem simplesmente omiti-lo.

---

## Estrutura de um projeto

| Campo | Papel |
|---|---|
| `estado` | Em evolução / Concluído / Conceito — honesto sobre a maturidade |
| `problemas` | O "por que existe". Concretos, não genéricos |
| `fluxo` | O caminho que o dado percorre. É o que explica o produto em 30 segundos |
| `modulos` | O que está incluído |
| `arquitetura` | Camadas e tecnologias, para leitura técnica |
| `decisoes` | **O mais importante numa entrevista.** Trade-offs e o raciocínio por trás deles |
| `stack` | Leitura rápida |

O campo `decisoes` é o que diferencia um portfólio de uma lista de funcionalidades: qualquer pessoa lista o que fez; poucas explicam por que fizeram daquele jeito e o que descartaram no caminho.

---

## Preparado para crescer

O catálogo aceita qualquer quantidade de projetos, produtos, ferramentas ou automações. A tela se adapta sozinha. Quando o volume justificar, o próximo passo natural é uma listagem em cartões com página de detalhe por projeto (`/portfolio/:id`) — a estrutura de dados já suporta isso sem alteração, já que cada projeto tem `id` e `buscarProjeto()` existe.
