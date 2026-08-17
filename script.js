const storageKey = "meu-bolso-transactions";
const form = document.querySelector("#transaction-form");
const modal = document.querySelector("#transaction-modal");
const transactionList = document.querySelector("#transactions");
const emptyState = document.querySelector("#empty-state");
const filter = document.querySelector("#transaction-filter");
const category = document.querySelector("#category");
const typeInput = document.querySelector("#transaction-type");

const categories = {
    expense: ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Assinaturas", "Outros"],
    income: ["Salário", "Freelance", "Investimento", "Venda", "Outros"]
};

let transactions = JSON.parse(localStorage.getItem(storageKey) || "[]");

const formatMoney = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const formatDate = (date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));

function saveTransactions() { localStorage.setItem(storageKey, JSON.stringify(transactions)); }

function setCategories(type) {
    category.innerHTML = categories[type].map((item) => `<option value="${item}">${item}</option>`).join("");
}

function setType(type) {
    typeInput.value = type;
    document.querySelectorAll(".type-option").forEach((button) => button.classList.toggle("is-selected", button.dataset.type === type));
    setCategories(type);
}

function renderSummary() {
    const income = transactions.filter((item) => item.type === "income").reduce((total, item) => total + item.amount, 0);
    const expense = transactions.filter((item) => item.type === "expense").reduce((total, item) => total + item.amount, 0);
    const balance = income - expense;
    document.querySelector("#income").textContent = formatMoney(income);
    document.querySelector("#expense").textContent = formatMoney(expense);
    document.querySelector("#balance").textContent = formatMoney(balance);
    document.querySelector("#balance-message").textContent = transactions.length
        ? balance >= 0 ? "Você está no caminho certo." : "Atenção: suas saídas superam as entradas."
        : "Adicione um lançamento para começar.";
}

function renderChart() {
    const expenses = transactions.filter((item) => item.type === "expense");
    const totals = expenses.reduce((result, item) => ({ ...result, [item.category]: (result[item.category] || 0) + item.amount }), {});
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const chart = document.querySelector("#category-chart");
    document.querySelector("#chart-empty").hidden = entries.length > 0;
    chart.innerHTML = entries.map(([name, value]) => {
        const total = expenses.reduce((sum, item) => sum + item.amount, 0);
        return `<div class="chart__item"><span>${name}</span><strong>${formatMoney(value)}</strong><div class="chart__bar"><i style="width:${(value / total) * 100}%"></i></div></div>`;
    }).join("");
}

function renderTransactions() {
    const selected = filter.value;
    const filtered = transactions.filter((item) => selected === "all" || item.type === selected).sort((a, b) => new Date(b.date) - new Date(a.date));
    transactionList.innerHTML = filtered.map((item) => `
        <li class="transaction">
            <span class="transaction__icon">${item.type === "income" ? "↗" : "↘"}</span>
            <div class="transaction__content"><strong>${item.description}</strong><span>${item.category} · ${formatDate(item.date)}</span></div>
            <span class="transaction__value transaction__value--${item.type}">${item.type === "income" ? "+" : "−"} ${formatMoney(item.amount)}</span>
            <button class="delete-button" type="button" data-delete="${item.id}" aria-label="Excluir ${item.description}">×</button>
        </li>`).join("");
    emptyState.hidden = filtered.length > 0;
    transactionList.hidden = filtered.length === 0;
}

function render() { renderSummary(); renderTransactions(); renderChart(); }

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

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    transactions.push({ id: crypto.randomUUID(), type: data.get("type"), description: data.get("description").trim(), category: data.get("category"), amount: Number(data.get("amount")), date: data.get("date") });
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

document.querySelector("#current-month").textContent = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date());
setCategories("expense");
render();
