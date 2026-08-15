# Integrações

## Por que uma camada própria

O Jornada360 não deve depender de um único fornecedor de rastreamento ou de ponto. Cada empresa-cliente pode usar sistemas diferentes — a camada de integração existe pra isolar essa variação atrás de um contrato único.

## Contrato

`src/integrations/IntegrationService.ts` define `IntegrationAdapter`:

```ts
interface IntegrationAdapter {
  tipo: 'cobli' | 'ponto' | 'excel_csv' | 'api';
  nome: string;
  disponivel: boolean;       // true = funciona hoje, sem credencial pendente
  importar(input: unknown): Promise<ImportResultado>;
}
```

`ImportResultado` traz `registrosEncontrados`, `registrosValidos`, `registrosComErro` e a lista de `erros` — o mesmo formato que a tela de Importar Dados exibe.

## Adapters desta fase

| Adapter | Status | O que faz hoje |
|---|---|---|
| `FileImportIntegration` | **IMPLEMENTADO** | Importação universal de planilha (CSV) — parsing e validação de linhas. Único com corpo funcional. |
| `CobliIntegration` | **PENDENTE DE CREDENCIAL** | `disponivel: false`. O contrato está pronto; falta a chave de API da conta Cobli da empresa-cliente. Nenhuma credencial foi pedida nem simulada só para "fechar visualmente". |
| `TimeClockIntegration` | **PENDENTE DE CREDENCIAL** | `disponivel: false`. Varia por fornecedor. Hoje o cruzamento usa o espelho de ponto exportado em planilha (via Assistente HE Diário), o que já cobre o caso sem depender de API. |
| `ApiIntegration` | **PREPARADO** | `disponivel: false`. Ponto de extensão genérico. |

### Onde a credencial vai morar

Desde a Fase 3 existe backend, e é lá que credencial de integração deve ficar — **nunca no navegador**. O banco tem a tabela `integration_configs` com `tenant_id`, e o servidor lê segredos de variável de ambiente (`.env`, ignorado pelo git; ver `.env.example`). O frontend nunca recebe nem exibe uma credencial.

## Adicionar uma integração nova

1. Criar um novo arquivo em `src/integrations/adapters/`, implementando `IntegrationAdapter`.
2. Registrar em `src/integrations/index.ts`.
3. Adicionar o tipo em `src/domain/IntegrationConfig.ts` (`IntegrationType`) se for uma fonte nova.
4. A tela Configurações → Integrações já lista qualquer entrada de `workspace.integrations` automaticamente — não precisa mexer na UI pra um novo tipo aparecer.

## Segurança

Nenhuma credencial, token, senha ou chave de API é digitada ou armazenada em nenhuma tela do Jornada360, nem em código. Quando uma integração real for implementada, ela deve:

- Usar o método oficial de autenticação da API do fornecedor (nunca capturar login/senha do usuário final).
- Ler a credencial no **servidor**, de variável de ambiente (`.env`, nunca commitado) ou de um cofre de configuração administrativa — nunca hardcoded, nunca no bundle do frontend.
- Nunca logar a credencial em console, auditoria ou qualquer relatório.
