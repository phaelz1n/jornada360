# Migração localStorage → API

Onde cada repositório está, e por quê. Escrito para que a decisão de mexer em algum deles seja informada.

> **Estado atual em uma frase:** a interface consome o servidor para empresas reais e o `localStorage` para a demonstração, através de um contrato único — nenhuma tela sabe qual dos dois está em uso.

---

## O que mudou na Fase 4

A Fase 3 deixou o backend pronto e a interface ainda em `localStorage`. A Fase 4 ligou os dois — mas **não** convertendo cada repositório num a um. Em vez disso, foi criado um **contrato único de persistência** (`src/data/tipos.ts`) com duas implementações, e o provedor de empresa escolhe qual usar.

```
                    ConjuntoRepositorios
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       conjuntoLocal                    conjuntoRemoto
   (demonstração)                     (empresa real)
   reaproveita os repositórios        chama a API
   da Fase 1, sem alterá-los
```

Isso preservou os repositórios locais **intactos e úteis** — eles continuam sendo a implementação da demonstração, e continuam cobertos pelos mesmos testes.

---

## Situação de cada repositório

| Repositório | Onde é usado hoje |
|---|---|
| `WorkspaceRepository` | **Demonstração** — e o bootstrap do ambiente `demo`. Empresa real: `/api/tenants` |
| `CompanyRepository` | **Demonstração**. Empresa real: `PUT /empresa` |
| `UnitRepository` | **Demonstração**. Empresa real: `/unidades` |
| `DepartmentRepository` | **Demonstração**. Empresa real: `/setores` |
| `ScheduleRepository` | **Demonstração**. Empresa real: `/escalas` |
| `EmployeeRepository` | **Demonstração**. Empresa real: `/colaboradores` |
| `TimeRecordRepository` | **Demonstração** — e a leitura do que o motor gravou, antes do envio ao servidor. Empresa real: `/dias` |
| `PendingRepository` | **Demonstração**. Empresa real: `/pendencias` |
| `AuditRepository` | **Demonstração**. Empresa real: `/auditoria`, e a trilha de lá é **mais confiável** (autor vem da sessão) |
| `OvertimeRepository` | Envelope sobre `TimeRecordRepository`; segue o mesmo caminho |
| `ReportRepository` | **Não usado.** O histórico de exportação virou auditoria no servidor (`POST /exportacoes`) |
| `IntegrationRepository` | **Não usado.** As integrações vêm no cadastro; o status é alterado por `PUT /integracoes/:id` |
| `ScoreRepository` | **Não usado.** O score é sempre calculado ao vivo — não há motivo para persistir |

Os três últimos permanecem no repositório como contratos escritos, não como código morto disfarçado: se um dia houver motivo para persistir score ou guardar o arquivo de um relatório, o formato já está definido. Se em seis meses continuarem sem uso, o certo é removê-los.

---

## O que NÃO deve ser feito

- **Chamar `fetch` de dentro de uma tela.** Sempre por `src/api/client.ts`.
- **Chamar `localStorage` de dentro de uma tela.** Sempre por um repositório.
- **Mandar `tenantId` no corpo da requisição.** Ele vai na URL e é validado contra a sessão. No corpo, seria pedir ao servidor para confiar no cliente.
- **Espalhar `if (demo)` pela interface.** É exatamente o que a fábrica existe para impedir.
- **Fazer service escrever em armazenamento.** Uma regra que grava sozinha só funciona onde conhece o storage — e deixa de valer nos dois caminhos.
- **Alterar o motor HE para falar com a API.** Adaptadores ao redor, nunca dentro.

---

Detalhes da decisão e do que ela custou: [FRONTEND_BACKEND.md](FRONTEND_BACKEND.md).
Levar ao servidor dados que ficaram no navegador: [MIGRACAO_LOCALSTORAGE.md](MIGRACAO_LOCALSTORAGE.md).
