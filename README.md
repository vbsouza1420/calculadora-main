# Gastos Financeiros

Um gerenciador financeiro pessoal simples, moderno e responsivo. Registre receitas e despesas, acompanhe seu saldo e descubra para onde seu dinheiro está indo — tudo direto no navegador.

## Recursos

- Contas, carteira e cartão de crédito com saldos separados
- Fatura inteligente com fechamento, vencimento, limite e projeção de parcelas
- Parcelamento automático distribuído pelos próximos meses
- Recorrências mensais para receitas e despesas fixas
- Metas financeiras com progresso e registro de aportes
- Busca por descrição, categoria e faixa de valor
- Backup JSON e exportação em CSV
- Login por e-mail com Supabase Auth
- Sincronização automática entre dispositivos
- Dados protegidos por Row Level Security (RLS)
- Cadastro de telefone e consentimento para alertas de fatura
- Função agendada para avisos de fechamento e vencimento por SMS

- Cadastro de receitas e despesas
- Saldo, total de entradas e saídas calculados automaticamente
- Categorias para organizar os lançamentos
- Gráfico de despesas por categoria
- Filtro por entradas, saídas ou todos os lançamentos
- Visão por mês ou por todo o histórico
- Comparação de gastos com o mês anterior
- Percentuais e destaque da maior categoria de despesa
- Exclusão de lançamentos
- Dados salvos localmente no navegador, sem cadastro ou conta
- Layout responsivo para celular e computador

## Como usar

1. Abra `index.html` no navegador.
2. Clique em **Novo lançamento**.
3. Escolha se é uma receita ou despesa, preencha os dados e salve.
4. Acompanhe o resumo e as categorias na tela inicial.

> Os dados ficam salvos apenas no navegador e dispositivo usados. Ao limpar os dados de navegação, os lançamentos também podem ser apagados.

## Tecnologias

- HTML5
- CSS3
- JavaScript
- LocalStorage do navegador
- Supabase Auth, Postgres, Edge Functions e Cron
- Twilio Programmable Messaging para SMS

## Alertas por SMS

A infraestrutura de alertas executa diariamente às 9h no horário de Brasília. Para liberar o envio real, configure estes segredos no projeto Supabase:

```text
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
```

As credenciais da Twilio devem ficar somente nos segredos das Edge Functions e nunca no código do navegador.

## Estrutura

```text
calculadora-main/
├── index.html
├── style.css
├── script.js
└── README.md
```

---

Desenvolvido por [vbsouza1420](https://github.com/vbsouza1420).
