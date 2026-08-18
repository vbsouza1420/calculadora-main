# Gastos Financeiros

Um gerenciador financeiro pessoal simples, moderno e responsivo. Registre receitas e despesas, acompanhe seu saldo e descubra para onde seu dinheiro está indo — tudo direto no navegador.

## Recursos

- Contas, carteira e cartão de crédito com saldos separados
- Compras parceladas com divisão automática do valor total entre os meses
- Faturas por ciclo, vencimento, limite, compras detalhadas e status de pagamento
- Orçamentos mensais por categoria com alertas em 80% e 100% do limite
- Recorrências mensais para receitas e despesas fixas
- Metas financeiras com progresso e registro de aportes
- Busca por descrição, categoria e faixa de valor
- Backup JSON e exportação em CSV
- Login por e-mail com Supabase Auth
- Sincronização automática entre dispositivos
- Dados protegidos por Row Level Security (RLS)

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
- Supabase Auth e Postgres
- Alertas locais de vencimento e orçamento
- Dashboard anual com médias e resultado acumulado
- Transferências entre contas sem distorcer receitas e despesas
- Importação de extratos CSV e OFX
- Categorias personalizadas
- Aplicativo instalável (PWA) com funcionamento offline
- Recuperação, alteração de senha e exclusão segura da conta

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
