# Migrar os dados que estão no navegador

Quem usou o Jornada360 antes da Fase 4 tem dias processados, pendências e justificativas guardados no `localStorage` — **trabalho real**. Este documento descreve como levá-los ao servidor sem perder nada e sem duplicar nada.

---

## A regra que governa tudo aqui

**Nada acontece em silêncio.**

Enviar automaticamente ao criar a conta seria pior do que não migrar: a pessoa não saberia o que subiu, para qual empresa, nem poderia conferir. E apagar o original antes de confirmar a cópia é a forma clássica de perder dado achando que se está organizando.

```
DETECTAR
   ↓
MOSTRAR o que existe (quantidade, período, origem)
   ↓
PESSOA CONFIRMA
   ↓
ENVIAR em lotes
   ↓
CONFERIR a contagem LIDA DO BANCO
   ↓
só então oferecer a LIMPEZA LOCAL — passo separado, opcional
```

---

## Onde fica

**Configurações → Migrar dados locais.**

Aparece apenas para quem está numa empresa real. Na demonstração a aba explica que não há para onde migrar — ela vive no navegador por definição.

---

## O que é procurado

Qualquer namespace local que **não** seja o da demonstração:

- `assistente_he_local_<id>_*` — dias processados pelo motor
- `jornada360:<id>:pendencias` — pendências materializadas

Isso cobre tanto quem usava a versão antiga (onde o ambiente se chamava `real` ou `ws-<timestamp>`) quanto quem processou algo offline na empresa atual. A busca é **por conteúdo, não por um identificador fixo** — é o que faz funcionar nos dois casos.

`demo` nunca entra. Dado fictício não vai para empresa real.

---

## O envio

- Em **lotes de 25 dias**. Um ano de histórico passa do limite de corpo do servidor numa requisição só; lotes também dão progresso visível em vez de uma espera muda.
- As **pendências vão por último**, depois que os dias que as originam já estão no servidor.
- Destino: a **empresa em uso naquele momento**. A tela avisa em destaque — dado enviado para a empresa errada precisa ser removido de lá manualmente.
- É **idempotente**: o dia é identificado pela data, então importar duas vezes não duplica.
- Fica registrado na **auditoria** do servidor. Dado entrando é evento tanto quanto dado saindo.

---

## A conferência

A resposta traz duas contagens diferentes, e a distinção importa:

| Campo | O que é |
|---|---|
| `diasGravados` / `pendenciasGravadas` | O que este envio processou |
| `diasNoServidor` / `pendenciasNoServidor` | **Lido do banco depois de gravar** |

A segunda é a que vale. Ela não é o que o cliente mandou — é o que **ficou lá**. É essa contagem que aparece na tela e que permite conferir antes de apagar qualquer coisa.

---

## A limpeza local

Só aparece **depois** que o servidor confirmou. Pede confirmação mostrando os dois números lado a lado. É **opcional**: manter a cópia local não atrapalha, só ocupa espaço.

O que a limpeza remove: dias processados e pendências dos namespaces reais. O que ela **nunca** toca: a demonstração.

---

## Isolamento

Importar exige a permissão `dados:escrever` **na empresa de destino**. Tentar importar para a empresa de outra pessoa devolve `404` — o mesmo tratamento de qualquer acesso cruzado, sem sequer confirmar que aquela empresa existe. Coberto por teste em `server/fluxoCompleto.test.js`.

---

## Limitações conhecidas

| Limitação | Situação |
|---|---|
| **Sem desfazer** | Uma vez importado, remover exige apagar no servidor manualmente. Por isso o aviso sobre a empresa de destino é destacado |
| **Não migra cadastro** | Unidades, setores, escalas e colaboradores locais **não** são enviados. Eles são poucos e rápidos de recadastrar, e o risco de duplicar cadastro (que outras entidades referenciam por id) é maior que o ganho |
| **Não migra auditoria local** | A trilha local não tem autor confiável — era o frontend que escolhia o nome. Levá-la ao servidor daria aparência de confiabilidade a registros que não a têm. A trilha local continua visível na demonstração |
| **Detecta um ambiente por vez** | Se houver vários namespaces locais, é oferecido o que tem mais dias. Migre um, limpe, repita |
| **Sem exportação para arquivo** | Não há "baixar meus dados locais". O caminho é o envio direto |

---

## Se algo der errado

- **Falha no meio do envio:** os lotes já enviados ficam gravados. Reexecutar continua de onde parou — a idempotência garante que não haja duplicata.
- **Enviou para a empresa errada:** os dias precisam ser removidos manualmente no servidor. Não há desfazer.
- **A contagem do servidor não bate:** **não limpe.** A diferença indica um dia rejeitado por formato inválido (o servidor ignora entradas sem `dateKey` ou sem `snapshot.items`). O dado local continua intacto.

---

## Onde está no código

| Arquivo | Papel |
|---|---|
| `src/pages/settings/MigracaoTab.tsx` | A tela inteira: detecção, envio, conferência, limpeza |
| `POST /api/tenants/:id/importar` | Rota de destino (`server/routes/tenant.js`) |
| `server/fluxoCompleto.test.js` | Testes: contagem, idempotência, auditoria, isolamento |
