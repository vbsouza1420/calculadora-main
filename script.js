const storageKey = "meu-bolso-transactions";
const form = document.querySelector("#transaction-form");
const modal = document.querySelector("#transaction-modal");
const transactionList = document.querySelector("#transactions");
const emptyState = document.querySelector("#empty-state");
const filter = document.querySelector("#transaction-filter");
const monthFilter = document.querySelector("#month-filter");
const category = document.querySelector("#category");
const typeInput = document.querySelector("#transaction-type");
const amountInput = document.querySelector("#amount");

const categories = {
    expense: ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Assinaturas", "Outros"],
    income: ["Salário", "Freelance", "Investimento", "Venda", "Outros"]
};

let transactions = JSON.parse(localStorage.getItem(storageKey) || "[]");
let selectedMonth = "all";

const formatMoney = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const formatDate = (date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));

function formatAmountInput(value, finish = false) {
    const normalized = value.replace(/[^\d,]/g, "");
    const [integer = "", ...decimalParts] = normalized.split(",");
    const decimals = decimalParts.join("").slice(0, 2);
    const formattedInteger = (integer || "0").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (!normalized.includes(",")) return formattedInteger === "0" && !integer ? "" : formattedInteger;
    return `${formattedInteger},${finish ? decimals.padEnd(2, "0") : decimals}`;
}

function parseAmount(value) {
    return Number(value.replace(/\./g, "").replace(",", "."));
}

function saveTransactions() { localStorage.setItem(storageKey, JSON.stringify(transactions)); }

function monthLabel(month) {
    if (month === "all") return "Todos os meses";
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));
}

function updateMonthFilter() {
    const selected = selectedMonth === "all" ? [] : [selectedMonth];
    const months = [...new Set(transactions.map((item) => item.date.slice(0, 7)).concat(selected))]
        .sort((a, b) => b.localeCompare(a));
    monthFilter.innerHTML = `<option value="all">Todos os meses</option>${months.map((month) => `<option value="${month}">${monthLabel(month)}</option>`).join("")}`;
    monthFilter.value = selectedMonth;
    document.querySelector("#current-month").textContent = monthLabel(selectedMonth);
}

function transactionsForSelectedMonth() {
    return selectedMonth === "all" ? transactions : transactions.filter((item) => item.date.startsWith(selectedMonth));
}

function transactionsForMonth(month) {
    return transactions.filter((item) => item.date.startsWith(month));
}

function previousMonth(month) {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().slice(0, 7);
}

function totalByType(items, type) {
    return items.filter((item) => item.type === type).reduce((total, item) => total + item.amount, 0);
}

function polygonPoints(cx, cy, radius, sides) {
    return Array.from({ length: sides }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / sides;
        return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
    }).join(" ");
}

function renderTrendChart() {
    const chart = document.querySelector("#trend-chart");
    const endingMonth = selectedMonth === "all" ? new Date().toISOString().slice(0, 7) : selectedMonth;
    const endingDate = new Date(`${endingMonth}-01T12:00:00`);
    const series = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(endingDate);
        date.setMonth(date.getMonth() - (5 - index));
        const month = date.toISOString().slice(0, 7);
        const records = transactionsForMonth(month);
        return { month, income: totalByType(records, "income"), expense: totalByType(records, "expense") };
    });
    const max = Math.max(...series.flatMap((item) => [item.income, item.expense]), 1);
    const x = (index) => 44 + (index * 472) / (series.length - 1);
    const y = (value) => 182 - (value / max) * 136;
    const path = (key) => series.map((item, index) => `${index ? "L" : "M"}${x(index)} ${y(item[key])}`).join(" ");
    const labels = series.map((item, index) => `<text x="${x(index)}" y="211" text-anchor="middle" fill="#64748b" font-size="10">${new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${item.month}-01T12:00:00`)).replace(".", "")}</text>`).join("");
    const grid = [0, 1, 2, 3].map((index) => `<line x1="44" y1="${46 + index * 45}" x2="516" y2="${46 + index * 45}" stroke="#263247" stroke-dasharray="3 5"/>`).join("");
    const circles = (key, color) => series.map((item, index) => `<circle cx="${x(index)}" cy="${y(item[key])}" r="3.5" fill="${color}" stroke="#0f172a" stroke-width="2"/>`).join("");
    chart.innerHTML = `<defs><linearGradient id="incomeFill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#38bdf8" stop-opacity=".28"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/></linearGradient><linearGradient id="expenseFill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#818cf8" stop-opacity=".25"/><stop offset="1" stop-color="#818cf8" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${path("income")} L516 182 L44 182 Z" fill="url(#incomeFill)"/><path d="${path("expense")} L516 182 L44 182 Z" fill="url(#expenseFill)"/><path d="${path("income")}" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="${path("expense")}" fill="none" stroke="#818cf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${circles("income", "#38bdf8")}${circles("expense", "#818cf8")}${labels}`;
}

function renderRadarChart() {
    const chart = document.querySelector("#radar-chart");
    const expenses = transactionsForSelectedMonth().filter((item) => item.type === "expense");
    const totals = expenses.reduce((result, item) => ({ ...result, [item.category]: (result[item.category] || 0) + item.amount }), {});
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (entries.length === 0) {
        chart.innerHTML = `<text x="210" y="145" text-anchor="middle" fill="#64748b" font-size="13">Adicione despesas para gerar o mapa.</text>`;
        return;
    }
    const cx = 210; const cy = 142; const radius = 85; const sides = entries.length;
    const max = entries[0][1];
    const point = (index, value) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / sides;
        const size = (value / max) * radius;
        return `${cx + Math.cos(angle) * size},${cy + Math.sin(angle) * size}`;
    };
    const axes = entries.map((_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / sides;
        const labelX = cx + Math.cos(angle) * (radius + 35);
        const labelY = cy + Math.sin(angle) * (radius + 35) + 4;
        const anchor = Math.cos(angle) > .25 ? "start" : Math.cos(angle) < -.25 ? "end" : "middle";
        return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(angle) * radius}" y2="${cy + Math.sin(angle) * radius}" stroke="#334155"/><text x="${labelX}" y="${labelY}" text-anchor="${anchor}" fill="#cbd5e1" font-size="10" font-weight="700">${entries[index][0].toUpperCase()}</text>`;
    }).join("");
    const rings = [1, .66, .33].map((scale) => `<polygon points="${polygonPoints(cx, cy, radius * scale, sides)}" fill="none" stroke="#263247"/>`).join("");
    chart.innerHTML = `${rings}${axes}<polygon points="${entries.map(([_, value], index) => point(index, value)).join(" ")}" fill="rgba(59, 130, 246, .22)" stroke="#60a5fa" stroke-width="3" stroke-linejoin="round"/>${entries.map(([_, value], index) => `<circle cx="${point(index, value).replace(",", '" cy="')}" r="3.5" fill="#93c5fd"/>`).join("")}`;
}

function setCategories(type) {
    category.innerHTML = categories[type].map((item) => `<option value="${item}">${item}</option>`).join("");
}

function setType(type) {
    typeInput.value = type;
    document.querySelectorAll(".type-option").forEach((button) => button.classList.toggle("is-selected", button.dataset.type === type));
    setCategories(type);
}

function renderSummary() {
    const visible = transactionsForSelectedMonth();
    const income = totalByType(visible, "income");
    const expense = totalByType(visible, "expense");
    const balance = income - expense;
    const availableBalance = Math.max(balance, 0);
    const debt = document.querySelector("#debt");
    document.querySelector("#income").textContent = formatMoney(income);
    document.querySelector("#expense").textContent = formatMoney(expense);
    document.querySelector("#balance").textContent = formatMoney(availableBalance);
    debt.hidden = balance >= 0;
    debt.textContent = balance < 0 ? `Em aberto: ${formatMoney(Math.abs(balance))}` : "";
    const comparison = document.querySelector("#month-comparison");
    document.querySelector("#dashboard-period").textContent = monthLabel(selectedMonth);
    document.querySelector("#dashboard-title").textContent = selectedMonth === "all" ? "Resumo de todo o histórico" : `Resumo de ${monthLabel(selectedMonth)}`;
    document.querySelector("#dashboard-description").textContent = selectedMonth === "all"
        ? "Acompanhe a saúde das suas finanças ao longo do tempo."
        : "Veja suas entradas, saídas e comparação com o mês anterior.";
    document.querySelector("#balance-label").textContent = selectedMonth === "all" ? "Saldo disponível" : `Saldo de ${monthLabel(selectedMonth)}`;
    comparison.className = "balance-card__comparison";
    if (selectedMonth === "all") {
        comparison.textContent = "Escolha um mês para comparar seus gastos.";
    } else {
        const priorMonth = previousMonth(selectedMonth);
        const priorExpense = totalByType(transactionsForMonth(priorMonth), "expense");
        const difference = expense - priorExpense;
        if (priorExpense === 0 && expense === 0) {
            comparison.textContent = `Sem despesas em ${monthLabel(selectedMonth)}.`;
        } else if (priorExpense === 0) {
            comparison.textContent = `Primeiro mês com despesas registradas.`;
        } else if (difference === 0) {
            comparison.textContent = `Mesmo gasto de ${monthLabel(priorMonth)}.`;
        } else {
            comparison.textContent = `${formatMoney(Math.abs(difference))} ${difference > 0 ? "a mais" : "a menos"} que em ${monthLabel(priorMonth)}.`;
            comparison.classList.add(difference > 0 ? "is-negative" : "is-positive");
        }
    }
    document.querySelector("#balance-message").textContent = visible.length
        ? balance >= 0 ? "Você está no caminho certo." : "Atenção: suas saídas superam as entradas."
        : "Adicione um lançamento para começar.";
}

function renderChart() {
    const expenses = transactionsForSelectedMonth().filter((item) => item.type === "expense");
    const totals = expenses.reduce((result, item) => ({ ...result, [item.category]: (result[item.category] || 0) + item.amount }), {});
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const chart = document.querySelector("#category-chart");
    const highlight = document.querySelector("#chart-highlight");
    const total = expenses.reduce((sum, item) => sum + item.amount, 0);
    document.querySelector("#chart-empty").hidden = entries.length > 0;
    document.querySelector("#chart-subtitle").textContent = selectedMonth === "all" ? "Visão de todo o histórico." : `Visão de ${monthLabel(selectedMonth)}.`;
    highlight.hidden = entries.length === 0;
    highlight.textContent = entries.length ? `Maior gasto: ${entries[0][0]} (${formatMoney(entries[0][1])})` : "";
    chart.innerHTML = entries.map(([name, value], index) => {
        const percentage = Math.round((value / total) * 100);
        return `<div class="chart__item ${index === 0 ? "chart__item--top" : ""}"><span>${name}</span><strong>${formatMoney(value)} <small>${percentage}%</small></strong><div class="chart__bar"><i style="width:${percentage}%"></i></div></div>`;
    }).join("");
}

function renderTransactions() {
    const selected = filter.value;
    const filtered = transactionsForSelectedMonth().filter((item) => selected === "all" || item.type === selected).sort((a, b) => new Date(b.date) - new Date(a.date));
    transactionList.innerHTML = filtered.map((item) => `
        <li class="transaction">
            <span class="transaction__icon">${item.type === "income" ? "↗" : "↘"}</span>
            <div class="transaction__content"><strong>${item.description}</strong><span>${item.category} · ${formatDate(item.date)}</span></div>
            <span class="transaction__value transaction__value--${item.type}">${item.type === "income" ? "+" : "−"} ${formatMoney(item.amount)}</span>
            <button class="delete-button" type="button" data-delete="${item.id}" aria-label="Excluir ${item.description}">×</button>
        </li>`).join("");
    emptyState.hidden = filtered.length > 0;
    emptyState.classList.toggle("is-hidden", filtered.length > 0);
    emptyState.style.display = filtered.length > 0 ? "none" : "grid";
    transactionList.hidden = filtered.length === 0;
    if (filtered.length === 0) {
        const hasTransactions = transactions.length > 0;
        document.querySelector("#empty-title").textContent = hasTransactions ? "Nenhum lançamento encontrado" : "Nenhum lançamento ainda";
        document.querySelector("#empty-message").textContent = hasTransactions
            ? "Tente trocar o mês ou o tipo de lançamento no filtro."
            : "Registre sua primeira entrada ou despesa.";
    }
}

function render() { updateMonthFilter(); renderSummary(); renderTrendChart(); renderRadarChart(); renderTransactions(); renderChart(); }

function openModal() {
    form.reset();
    document.querySelector("#date").valueAsDate = new Date();
    setType("expense");
    modal.showModal();
    document.querySelector("#description").focus();
}

document.querySelector("#new-transaction").addEventListener("click", openModal);
document.querySelector("[data-open-form]").addEventListener("click", openModal);
document.querySelector("#close-modal").addEventListener("click", () => modal.close());
document.querySelectorAll(".type-option").forEach((button) => button.addEventListener("click", () => setType(button.dataset.type)));
filter.addEventListener("change", renderTransactions);
monthFilter.addEventListener("change", () => { selectedMonth = monthFilter.value; render(); });
amountInput.addEventListener("input", () => { amountInput.value = formatAmountInput(amountInput.value); });
amountInput.addEventListener("blur", () => { amountInput.value = formatAmountInput(amountInput.value, true); });

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const amount = parseAmount(data.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) return;
    transactions.push({ id: crypto.randomUUID(), type: data.get("type"), description: data.get("description").trim(), category: data.get("category"), amount, date: data.get("date") });
    saveTransactions();
    modal.close();
    render();
});

transactionList.addEventListener("click", (event) => {
    const id = event.target.dataset.delete;
    if (!id) return;
    transactions = transactions.filter((item) => item.id !== id);
    saveTransactions();
    render();
});

setCategories("expense");
render();
