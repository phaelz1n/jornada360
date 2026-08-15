# Operação — o que fazer quando

Manual de plantão. Cada seção começa pelo sintoma, não pela causa: quem consulta isto está com um problema na frente, não estudando o sistema.

Para publicar pela primeira vez, ver [DEPLOY.md](DEPLOY.md).

---

## Verificação de rotina

**Semanal** — leva um minuto:

```bash
curl -s https://SEU-DOMINIO/api/prontidao | jq
```

Os três componentes devem estar `ok: true`. Se `backup.ultimoHaHoras` passar de 12, algo travou o agendamento.

**Mensal** — o ensaio de restauração:

```bash
docker compose exec app node scripts/restaurar.js --testar
```

Restaura numa cópia isolada e confere. Não toca no banco em uso. **Um backup nunca restaurado é uma suposição** — este comando é o que transforma suposição em garantia.

---

## "O sistema está fora do ar"

```bash
docker compose ps
```

**O container está de pé mas responde erro** → veja o log:

```bash
docker compose logs --tail=100 app
```

**O container está reiniciando em laço** → quase sempre é configuração. O servidor recusa subir com config insegura e diz exatamente o quê:

```bash
docker compose logs app | grep -A 10 "NÃO subiu"
```

**O container não existe** → a máquina reiniciou e algo impediu a volta:

```bash
docker compose up -d
```

**Nada disso resolve** → confirme que a máquina responde (`ssh`), que há espaço em disco (`df -h`) e que o Docker está rodando (`systemctl status docker`). Disco cheio é a causa mais comum de sintomas estranhos, e derruba o banco junto.

---

## "Não consigo entrar / o site não abre com HTTPS"

**Certificado não emitido** — quase sempre o DNS não estava apontando quando o Caddy tentou:

```bash
dig +short SEU-DOMINIO          # precisa devolver o IP do servidor
docker compose logs proxy | grep -i certificate
docker compose restart proxy    # tenta de novo
```

**"Sua sessão expirou" o tempo todo** — o cookie não está sendo aceito. Confira que `JORNADA_COOKIE_SEGURO=1` e que o acesso é por HTTPS: um cookie `Secure` não é gravado em `http://`.

**Muitas tentativas** — o limite bloqueou o IP: 10 tentativas de senha por 15 minutos. É esperado e passa sozinho. Se foi engano, `docker compose restart app` zera os contadores (eles vivem em memória).

---

## "Não recebi o e-mail de recuperação de senha"

```bash
curl -s https://SEU-DOMINIO/api/prontidao | jq .componentes.email
```

**`ok: false`** → a credencial de SMTP está errada ou o provedor recusou. O erro exato está no log:

```bash
docker compose logs app | grep "falha ao enviar"
```

**`ok: true` mas não chega** → em ordem de probabilidade:

1. caixa de spam;
2. remetente não verificado no provedor (o mais comum) — verifique o domínio no painel do provedor de e-mail;
3. e-mail digitado errado — a tela responde igual exista ou não a conta, de propósito, então quem erra o endereço não recebe nada.

**Enquanto isso, para destravar alguém:** não há como um administrador trocar a senha de outra pessoa — e isso é deliberado. O caminho é corrigir o SMTP.

---

## "Perdi dados" / "restaurei sem querer"

**Não faça nada antes de ler isto.** Toda restauração guarda o banco anterior:

```bash
ls -la /var/lib/docker/volumes/jornada360_jornada_dados/_data/
```

Os arquivos `.pre-restauracao-*` são o estado imediatamente anterior. Para voltar:

```bash
docker compose stop app
docker compose run --rm app node scripts/restaurar.js /dados/jornada360.db.pre-restauracao-AAAA-MM-DDTHH-MM-SS
docker compose start app
```

**Para voltar a um ponto no tempo:**

```bash
docker compose exec app node scripts/backup.js --listar
```

Escolha o backup pela data e restaure passando o caminho. Confira antes com `--testar`.

---

## Atualizar para uma versão nova

```bash
cd /opt/jornada360
docker compose exec app node scripts/backup.js
git pull
docker compose up -d --build
npm run smoke -- https://SEU-DOMINIO
```

O backup no passo 1 não é formalidade: é o que permite voltar se a versão nova alterar dados de forma indesejada.

**Voltar atrás:**

```bash
git checkout <commit-anterior>
docker compose up -d --build
```

Se a versão nova rodou uma migration que alterou dados, volte também o banco pelo backup.

---

## Dar acesso a uma pessoa nova

Pela interface, em **Configurações → Usuários**:

- **Já tem conta** → informe o e-mail e escolha o papel. O acesso vale imediatamente.
- **Não tem conta** → gere um convite. O sistema envia por e-mail e **também mostra o código na tela**: se o e-mail não chegar, você entrega o código por outro canal.

O código aparece **uma vez**. O banco guarda só o hash.

### Papéis

| Papel | Pode |
|---|---|
| Administrador | Tudo, inclusive gerir acessos e excluir a empresa |
| RH | Configurar, tratar e revisar pendências, ler auditoria, exportar |
| Gestor | Ler cadastro, tratar pendências, exportar — **não revisa** |
| Auditor | Lê tudo e exporta, **nunca escreve** |
| Colaborador | Só as próprias pendências |

O último administrador não pode ser removido nem rebaixado — a empresa ficaria sem ninguém capaz de gerir acesso.

---

## Espaço em disco

```bash
df -h
docker system df
```

O que cresce: backups (retenção de 14 dias, ~200 KB cada no começo) e logs (limitados a 10 MB × 5 arquivos por container).

Limpar imagens antigas depois de vários deploys:

```bash
docker image prune -a
```

---

## Monitoramento externo

O sistema expõe o necessário; falta apontar um monitor para ele. Qualquer serviço com plano gratuito serve — UptimeRobot, Better Stack, Healthchecks.io.

| Endereço | Intervalo | Alertar quando |
|---|---|---|
| `https://SEU-DOMINIO/api/saude` | 1 min | falhar 2 vezes seguidas |
| `https://SEU-DOMINIO/api/prontidao` | 15 min | status ≠ 200 |

O primeiro pega "o site caiu". O segundo pega o que é pior porque é silencioso: **backup parado**, SMTP quebrado, banco inacessível — coisas que não impedem o sistema de responder, e que só apareceriam no dia em que fizessem falta.

---

## Contas de teste do smoke

`npm run smoke` cria duas contas por execução (`smoke-a-*@teste.local`). Elas não interferem em nada — não têm dados e não aparecem para nenhum cliente. Se incomodarem, removem-se pelo banco:

```bash
docker compose exec app node -e "
import('./server/db/index.js').then(({abrirBanco}) => {
  const db = abrirBanco();
  const n = db.prepare(\"DELETE FROM users WHERE email LIKE 'smoke-%@teste.local'\").run();
  console.log('removidas:', n.changes);
});"
```

O `ON DELETE CASCADE` remove as empresas de teste junto.

---

## O que NÃO fazer

- **Editar o banco à mão.** Toda alteração de schema passa por migration. Um banco editado direto fica diferente do que as migrations esperam, e o próximo deploy quebra de um jeito difícil de entender.
- **Apagar o volume `jornada_dados`.** É o banco de todos os clientes.
- **Copiar o `.db` com o servidor rodando.** Use `scripts/backup.js`, que usa `VACUUM INTO` — copiar durante uma escrita produz arquivo inconsistente.
- **Colocar segredo em variável `VITE_`.** Ela entra no bundle e é pública.
- **Usar `*` em `JORNADA_CORS_ORIGENS`.** Com sessão em cookie, é entregar o cookie ao site errado. O servidor recusa subir assim.
- **Deixar o backup só no mesmo servidor.** Se a máquina se perder, o backup se perde junto. Ver a seção de cópia externa em [DEPLOY.md](DEPLOY.md).
