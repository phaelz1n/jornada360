# Controle de duplicidades no cadastro de motoristas

## Intenção

Evitar que o mesmo motorista apareça mais de uma vez no cadastro e que registros duplicados alterem setor, horários padrão ou cálculos de HE.

## Escopo

- Normalizar nomes ignorando maiúsculas, acentos e espaços repetidos.
- Agrupar automaticamente somente registros cujo nome normalizado seja exatamente igual.
- Preservar o registro mais completo: horários válidos, setor preenchido e padrão cadastrado.
- Exibir grupos de nomes apenas parecidos como “revisão necessária”, sem fusão automática.
- Bloquear o salvamento de novo cadastro quando já existir o mesmo nome normalizado.
- Usar o cadastro consolidado nos relatórios e cálculos.

## Fora do escopo

- Não juntar pessoas com nomes apenas semelhantes.
- Não apagar registros históricos ou snapshots já processados.
- Não alterar nomes sem uma confirmação explícita do usuário.

## Abordagens consideradas

1. Fusão automática de todos os nomes parecidos: rejeitada porque pode misturar pessoas diferentes.
2. Revisão manual de toda duplicidade: segura, mas não impede novas duplicidades exatas.
3. Fusão automática de nomes exatamente iguais após normalização e revisão manual dos parecidos: escolhida por equilibrar segurança e praticidade.

## Desenho

O cadastro será consolidado por uma função única de agrupamento. Cada grupo exato terá um registro principal, selecionado pela completude, e seus dados serão combinados sem sobrescrever horários válidos por campos vazios. A interface mostrará a quantidade de grupos consolidados e os nomes parecidos que precisam de conferência. O salvamento consultará os registros atuais usando a mesma normalização antes de gravar.

## Validação

Serão adicionados testes para acentos, caixa, espaços, registros idênticos, nomes parecidos, escolha do cadastro mais completo e bloqueio de novo duplicado.
