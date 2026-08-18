const keys = {
    transactions: "meu-bolso-transactions",
    budgets: "meu-bolso-budgets",
    plans: "meu-bolso-plans",
    theme: "meu-bolso-theme"
};

const form = document.querySelector("#transaction-form");
const modal = document.querySelector("#transaction-modal");
const transactionList = document.querySelector("#transactions");
const emptyState = document.querySelector("#empty-state");
const filter = document.querySelector("#transaction-filter");
const monthFilter = document.querySelector("#month-filter");
const category = document.querySelector("#category");
const typeInput = document.querySelector("#transaction-type");
const amountInput = document.querySelector("#amount");
const recurringInput = document.querySelector("#recurring");
const budgetForm = document.querySelector("#budget-form");
const planForm = document.querySelector("#plan-form");
const budgetCategory = document.querySelector("#budget-category");
const budgetAmount = document.querySelector("#budget-amount");
const planInputs = [document.querySelector("#plan-income"), document.querySelector("#plan-expense"), document.querySelector("#plan-savings")];

const categories = {
    expense: ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Assinaturas", "Outros"],
    income: ["Salário", "Freelance", "Investimento", "Venda", "Outros"]
};

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
let transactions = read(keys.transactions, []);
let budgets = read(keys.budgets, {});
let plans = read(keys.plans, {});
let selectedMonth = "all";
let editingId = null;

const currentMonth = () => new Date().toISOString().slice(0, 7);
const formatMoney = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const formatDate = (date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
const monthLabel = (month) => month === "all" ? "Todos os meses" : new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));
const saveAll = () => { localStorage.setItem(keys.transactions, JSON.stringify(transactions)); localStorage.setItem(keys.budgets, JSON.stringify(budgets)); localStorage.setItem(keys.plans, JSON.stringify(plans)); };
const activeMonth = () => selectedMonth === "all" ? currentMonth() : selectedMonth;
const monthRecords = (month) => transactions.filter((item) => item.date?.startsWith(month));
const visibleRecords = () => selectedMonth === "all" ? transactions : monthRecords(selectedMonth);
const totalByType = (items, type) => items.filter((item) => item.type === type).reduce((sum, item) => sum + Number(item.amount || 0), 0);

function formatAmount(value, finish = false) {
    const clean = String(value).replace(/[^\d,]/g, "");
    const [integer = "", ...rest] = clean.split(",");
    const decimals = rest.join("").slice(0, 2);
    const formatted = (integer || "0").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (!clean.includes(",")) return formatted === "0" && !integer ? "" : formatted;
    return `${formatted},${finish ? decimals.padEnd(2, "0") : decimals}`;
}
function parseAmount(value) { return Number(String(value).replace(/\./g, "").replace(",", ".")); }
function previousMonth(month) { const date = new Date(`${month}-01T12:00:00`); date.setMonth(date.getMonth() - 1); return date.toISOString().slice(0, 7); }

function syncRecurringTransactions() {
    const today = currentMonth();
    const templates = transactions.filter((item) => item.recurring && !item.recurringSourceId);
    templates.forEach((template) => {
        let month = template.date.slice(0, 7);
        while (month < today) {
            const date = new Date(`${month}-01T12:00:00`); date.setMonth(date.getMonth() + 1); month = date.toISOString().slice(0, 7);
            const sourceId = template.id;
            const exists = transactions.some((item) => (item.id === sourceId || item.recurringSourceId === sourceId) && item.date.startsWith(month));
            if (!exists) transactions.push({ ...template, id: crypto.randomUUID(), date: `${month}-${template.date.slice(8)}`, recurringSourceId: sourceId });
        }
    });
    saveAll();
}

function setCategories(type) { category.innerHTML = categories[type].map((name) => `<option value="${name}">${name}</option>`).join(""); }
function setType(type) { typeInput.value = type; document.querySelectorAll(".type-option").forEach((button) => button.classList.toggle("is-selected", button.dataset.type === type)); setCategories(type); }
function updateMonthFilter() {
    const months = [...new Set(transactions.map((item) => item.date?.slice(0, 7)).filter(Boolean).concat(selectedMonth === "all" ? [] : [selectedMonth]))].sort((a, b) => b.localeCompare(a));
    monthFilter.innerHTML = `<option value="all">Todos os meses</option>${months.map((month) => `<option value="${month}">${monthLabel(month)}</option>`).join("")}`;
    monthFilter.value = selectedMonth;
    document.querySelector("#current-month").textContent = monthLabel(selectedMonth);
}

function renderSummary() {
    const records = visibleRecords(); const income = totalByType(records, "income"); const expense = totalByType(records, "expense"); const balance = income - expense;
    document.querySelector("#income").textContent = formatMoney(income); document.querySelector("#expense").textContent = formatMoney(expense); document.querySelector("#balance").textContent = formatMoney(Math.max(balance, 0));
    const debt = document.querySelector("#debt"); debt.hidden = balance >= 0; debt.textContent = balance < 0 ? `Em aberto: ${formatMoney(Math.abs(balance))}` : "";
    document.querySelector("#balance-label").textContent = selectedMonth === "all" ? "Saldo disponível" : `Saldo de ${monthLabel(selectedMonth)}`;
    document.querySelector("#dashboard-period").textContent = monthLabel(selectedMonth);
    document.querySelector("#dashboard-title").textContent = selectedMonth === "all" ? "Resumo de todo o histórico" : `Resumo de ${monthLabel(selectedMonth)}`;
    document.querySelector("#dashboard-description").textContent = selectedMonth === "all" ? "Acompanhe a saúde das suas finanças ao longo do tempo." : "Veja suas entradas, saídas e comparação com o mês anterior.";
    const comparison = document.querySelector("#month-comparison"); comparison.className = "balance-card__comparison";
    if (selectedMonth === "all") comparison.textContent = "Escolha um mês para comparar seus gastos.";
    else { const prior = totalByType(monthRecords(previousMonth(selectedMonth)), "expense"); const difference = expense - prior; comparison.textContent = prior ? `${formatMoney(Math.abs(difference))} ${difference > 0 ? "a mais" : "a menos"} que no mês anterior.` : "Primeiro mês com despesas registradas."; if (prior) comparison.classList.add(difference > 0 ? "is-negative" : "is-positive"); }
    document.querySelector("#balance-message").textContent = records.length ? (balance >= 0 ? "Você está no caminho certo." : "Suas saídas superam as entradas.") : "Adicione um lançamento para começar.";
}

function renderTransactions() {
    const selected = filter.value; const records = visibleRecords().filter((item) => selected === "all" || item.type === selected).sort((a, b) => new Date(b.date) - new Date(a.date));
    transactionList.innerHTML = records.map((item) => `<li class="transaction"><span class="transaction__icon">${item.type === "income" ? "↗" : "↘"}</span><div class="transaction__content"><strong>${item.description}</strong><span>${item.category} · ${formatDate(item.date)}${item.recurring ? " · mensal" : ""}</span></div><span class="transaction__value transaction__value--${item.type}">${item.type === "income" ? "+" : "−"} ${formatMoney(item.amount)}</span><button class="edit-button" data-edit="${item.id}" type="button" aria-label="Editar">✎</button><button class="delete-button" data-delete="${item.id}" type="button" aria-label="Excluir">×</button></li>`).join("");
    const empty = records.length === 0; emptyState.hidden = !empty; emptyState.style.display = empty ? "grid" : "none"; transactionList.hidden = empty;
    if (empty) { document.querySelector("#empty-title").textContent = transactions.length ? "Nenhum lançamento encontrado" : "Nenhum lançamento ainda"; document.querySelector("#empty-message").textContent = transactions.length ? "Tente trocar o mês ou tipo no filtro." : "Registre sua primeira entrada ou despesa."; }
}

function renderCategoryChart() {
    const expenses = visibleRecords().filter((item) => item.type === "expense"); const totals = expenses.reduce((all, item) => ({ ...all, [item.category]: (all[item.category] || 0) + item.amount }), {}); const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5); const total = totalByType(expenses, "expense");
    document.querySelector("#chart-subtitle").textContent = selectedMonth === "all" ? "Visão de todo o histórico." : `Visão de ${monthLabel(selectedMonth)}.`;
    document.querySelector("#chart-empty").hidden = entries.length > 0; document.querySelector("#chart-highlight").hidden = entries.length === 0; document.querySelector("#chart-highlight").textContent = entries.length ? `Maior gasto: ${entries[0][0]} (${formatMoney(entries[0][1])})` : "";
    document.querySelector("#category-chart").innerHTML = entries.map(([name, value], index) => { const percent = Math.round((value / total) * 100); return `<div class="chart__item ${index === 0 ? "chart__item--top" : ""}"><span>${name}</span><strong>${formatMoney(value)} <small>${percent}%</small></strong><div class="chart__bar"><i style="width:${percent}%"></i></div></div>`; }).join("");
}

function renderTrendChart() {
    const end = selectedMonth === "all" ? currentMonth() : selectedMonth; const date = new Date(`${end}-01T12:00:00`); const series = Array.from({ length: 6 }, (_, index) => { const item = new Date(date); item.setMonth(item.getMonth() - (5 - index)); const month = item.toISOString().slice(0, 7); const records = monthRecords(month); return { month, income: totalByType(records, "income"), expense: totalByType(records, "expense") }; }); const max = Math.max(...series.flatMap((item) => [item.income, item.expense]), 1); const x = (i) => 44 + i * 94.4; const y = (v) => 182 - (v / max) * 136; const line = (key) => series.map((item, i) => `${i ? "L" : "M"}${x(i)} ${y(item[key])}`).join(" ");
    const grid = [46, 91, 136, 181].map((value) => `<line x1="44" y1="${value}" x2="516" y2="${value}" stroke="#263247" stroke-dasharray="3 5"/>`).join(""); const labels = series.map((item, i) => `<text x="${x(i)}" y="211" text-anchor="middle" fill="#64748b" font-size="10">${new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${item.month}-01T12:00:00`)).replace(".", "")}</text>`).join("");
    document.querySelector("#trend-chart").innerHTML = `${grid}<path d="${line("income")}" fill="none" stroke="#38bdf8" stroke-width="3"/><path d="${line("expense")}" fill="none" stroke="#818cf8" stroke-width="3"/>${series.map((item, i) => `<circle cx="${x(i)}" cy="${y(item.income)}" r="3" fill="#38bdf8"/><circle cx="${x(i)}" cy="${y(item.expense)}" r="3" fill="#818cf8"/>`).join("")}${labels}`;
}

function renderRadarChart() {
    const entries = Object.entries(visibleRecords().filter((item) => item.type === "expense").reduce((all, item) => ({ ...all, [item.category]: (all[item.category] || 0) + item.amount }), {})).sort((a, b) => b[1] - a[1]).slice(0, 6); const chart = document.querySelector("#radar-chart"); if (!entries.length) { chart.innerHTML = `<text x="210" y="145" text-anchor="middle" fill="#64748b" font-size="13">Adicione despesas para gerar o mapa.</text>`; return; }
    const cx = 210, cy = 142, radius = 85, sides = entries.length, max = entries[0][1]; const point = (index, value, scale = 1) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / sides; const size = value === undefined ? radius * scale : radius * value / max; return `${cx + Math.cos(angle) * size},${cy + Math.sin(angle) * size}`; }; const polygon = (scale) => entries.map((_, i) => point(i, undefined, scale)).join(" ");
    const axes = entries.map(([name], i) => { const angle = -Math.PI / 2 + i * Math.PI * 2 / sides; const lx = cx + Math.cos(angle) * (radius + 35), ly = cy + Math.sin(angle) * (radius + 35) + 4; return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(angle) * radius}" y2="${cy + Math.sin(angle) * radius}" stroke="#334155"/><text x="${lx}" y="${ly}" text-anchor="middle" fill="#cbd5e1" font-size="10">${name.toUpperCase()}</text>`; }).join(""); chart.innerHTML = `${[1,.66,.33].map((scale) => `<polygon points="${polygon(scale)}" fill="none" stroke="#263247"/>`).join("")}${axes}<polygon points="${entries.map(([_, value], i) => point(i, value)).join(" ")}" fill="rgba(59,130,246,.22)" stroke="#60a5fa" stroke-width="3"/>`;
}

function renderBudget() {
    budgetCategory.innerHTML = categories.expense.map((name) => `<option>${name}</option>`).join(""); const month = activeMonth(); const records = monthRecords(month); const monthBudgets = budgets[month] || {}; const list = Object.entries(monthBudgets); document.querySelector("#budget-list").innerHTML = list.length ? list.map(([name, limit]) => { const spent = records.filter((item) => item.type === "expense" && item.category === name).reduce((sum, item) => sum + item.amount, 0); const percent = Math.min(100, Math.round((spent / limit) * 100)); return `<div class="budget-item"><div><strong>${name}</strong><span>${formatMoney(spent)} de ${formatMoney(limit)}</span></div><div class="budget-track"><i style="width:${percent}%"></i></div><b class="${spent > limit ? "over" : ""}">${percent}%</b></div>`; }).join("") : "<p class=workspace-empty>Defina um limite para acompanhar seus gastos.</p>";
}
function renderPlan() { const month = activeMonth(); const plan = plans[month]; const records = monthRecords(month); if (!plan) { document.querySelector("#plan-summary").innerHTML = "<p class=workspace-empty>Sem plano para este mês.</p>"; return; } const income = totalByType(records, "income"), expense = totalByType(records, "expense"), saved = Math.max(0, income - expense); document.querySelector("#plan-summary").innerHTML = `<div><span>Recebido</span><strong>${formatMoney(income)} / ${formatMoney(plan.income || 0)}</strong></div><div><span>Gasto</span><strong>${formatMoney(expense)} / ${formatMoney(plan.expense || 0)}</strong></div><div><span>Guardado</span><strong>${formatMoney(saved)} / ${formatMoney(plan.savings || 0)}</strong></div>`; }
function renderInsights() { const records = visibleRecords(), expense = totalByType(records, "expense"), income = totalByType(records, "income"); const target = plans[activeMonth()]?.savings || 0; const message = !records.length ? "Adicione lançamentos para receber leituras do seu mês." : target && income - expense >= target ? "Meta de reserva atingida: seu mês está no azul." : expense > income ? "Atenção: as saídas estão maiores que as entradas neste período." : "Ritmo saudável: continue registrando para manter a visão completa."; document.querySelector(".tip").innerHTML = `<span>✦</span><p>${message}</p>`; }

function render() { updateMonthFilter(); renderSummary(); renderTrendChart(); renderRadarChart(); renderTransactions(); renderCategoryChart(); renderBudget(); renderPlan(); renderInsights(); }
function openModal(item = null) { editingId = item?.id || null; form.reset(); setType(item?.type || "expense"); if (item) { document.querySelector("#description").value = item.description; category.value = item.category; amountInput.value = formatAmount(item.amount.toFixed(2).replace(".", ","), true); document.querySelector("#date").value = item.date; recurringInput.checked = Boolean(item.recurring); document.querySelector("#modal-title").textContent = "Editar lançamento"; } else { document.querySelector("#date").valueAsDate = new Date(); document.querySelector("#modal-title").textContent = "Organize seu dinheiro"; } document.querySelector("#cancel-edit").hidden = !item; modal.showModal(); document.querySelector("#description").focus(); }
function download(filename, content, type) { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }

document.querySelector("#new-transaction").addEventListener("click", () => openModal()); document.querySelector("[data-open-form]").addEventListener("click", () => openModal()); document.querySelector("#close-modal").addEventListener("click", () => modal.close()); document.querySelector("#cancel-edit").addEventListener("click", () => { editingId = null; modal.close(); }); document.querySelectorAll(".type-option").forEach((button) => button.addEventListener("click", () => setType(button.dataset.type)));
filter.addEventListener("change", render); monthFilter.addEventListener("change", () => { selectedMonth = monthFilter.value; render(); }); [amountInput, budgetAmount, ...planInputs].forEach((input) => { input.addEventListener("input", () => { input.value = formatAmount(input.value); }); input.addEventListener("blur", () => { input.value = formatAmount(input.value, true); }); });
form.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(form); const amount = parseAmount(data.get("amount")); if (!Number.isFinite(amount) || amount <= 0) return; const record = { id: editingId || crypto.randomUUID(), type: data.get("type"), description: data.get("description").trim(), category: data.get("category"), amount, date: data.get("date"), recurring: data.get("recurring") === "on" }; if (editingId) transactions = transactions.map((item) => item.id === editingId ? { ...item, ...record } : item); else transactions.push(record); saveAll(); modal.close(); render(); });
transactionList.addEventListener("click", (event) => { const edit = event.target.dataset.edit, remove = event.target.dataset.delete; if (edit) openModal(transactions.find((item) => item.id === edit)); if (remove) { transactions = transactions.filter((item) => item.id !== remove); saveAll(); render(); } });
budgetForm.addEventListener("submit", (event) => { event.preventDefault(); const amount = parseAmount(budgetAmount.value); if (!amount) return; const month = activeMonth(); budgets[month] = { ...(budgets[month] || {}), [budgetCategory.value]: amount }; budgetAmount.value = ""; saveAll(); render(); });
planForm.addEventListener("submit", (event) => { event.preventDefault(); const [income, expense, savings] = planInputs.map((input) => parseAmount(input.value) || 0); plans[activeMonth()] = { income, expense, savings }; saveAll(); render(); });
document.querySelector("#export-data").addEventListener("click", () => download(`meu-bolso-backup-${currentMonth()}.json`, JSON.stringify({ transactions, budgets, plans }, null, 2), "application/json")); document.querySelector("#import-data").addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; try { const backup = JSON.parse(await file.text()); transactions = Array.isArray(backup.transactions) ? backup.transactions : transactions; budgets = backup.budgets || budgets; plans = backup.plans || plans; saveAll(); render(); } catch { alert("Não foi possível importar este arquivo."); } event.target.value = ""; });
document.querySelector("#export-csv").addEventListener("click", () => { const header = "tipo,descricao,categoria,valor,data,recorrente"; const rows = transactions.map((item) => [item.type, item.description, item.category, item.amount.toFixed(2).replace(".", ","), item.date, item.recurring ? "sim" : "não"].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")); download(`meu-bolso-${currentMonth()}.csv`, `\uFEFF${header}\n${rows.join("\n")}`, "text/csv;charset=utf-8"); });
document.querySelector("#theme-toggle").addEventListener("click", () => { document.body.classList.toggle("light"); localStorage.setItem(keys.theme, document.body.classList.contains("light") ? "light" : "dark"); });
if (localStorage.getItem(keys.theme) === "light") document.body.classList.add("light");
syncRecurringTransactions(); setCategories("expense"); render();
