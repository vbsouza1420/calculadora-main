const keys = {
    transactions: "meu-bolso-transactions", budgets: "meu-bolso-budgets", plans: "meu-bolso-plans",
    accounts: "meu-bolso-accounts", goals: "meu-bolso-goals", categories: "meu-bolso-categories", theme: "meu-bolso-theme"
};
const cloudClient = window.supabase?.createClient(window.SUPABASE_CONFIG?.url, window.SUPABASE_CONFIG?.publishableKey);
let currentUser = null;
let cloudSaveTimer = null;
let applyingCloudData = false;

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
const accountSelect = document.querySelector("#account");
const installmentsInput = document.querySelector("#installments");
const installmentPreview = document.querySelector("#installment-preview");
const budgetForm = document.querySelector("#budget-form");
const planForm = document.querySelector("#plan-form");
const budgetCategory = document.querySelector("#budget-category");
const budgetAmount = document.querySelector("#budget-amount");
const planInputs = ["#plan-income", "#plan-expense", "#plan-savings"].map((selector) => document.querySelector(selector));
const accountForm = document.querySelector("#account-form");
const accountName = document.querySelector("#account-name");
const accountType = document.querySelector("#account-type");
const accountList = document.querySelector("#account-list");
const goalForm = document.querySelector("#goal-form");
const goalName = document.querySelector("#goal-name");
const goalTarget = document.querySelector("#goal-target");
const goalCurrent = document.querySelector("#goal-current");
const goalList = document.querySelector("#goal-list");
const recurringList = document.querySelector("#recurring-list");
const cardSettingsForm = document.querySelector("#card-settings-form");
const invoiceCard = document.querySelector("#invoice-card");
const cardLimit = document.querySelector("#card-limit");
const cardClosingDay = document.querySelector("#card-closing-day");
const cardDueDay = document.querySelector("#card-due-day");
const authModal = document.querySelector("#auth-modal");
const authForm = document.querySelector("#auth-form");
const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const authFeedback = document.querySelector("#auth-feedback");

const defaultCategories = {
    expense: ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Assinaturas", "Outros"],
    income: ["Salário", "Freelance", "Investimento", "Venda", "Outros"]
};
let categories = readCategories();
const defaultAccounts = [
    { id: "bank", name: "Conta principal", type: "bank" },
    { id: "cash", name: "Carteira", type: "cash" },
    { id: "card", name: "Cartão de crédito", type: "card", limit: 0, closingDay: 25, dueDay: 5 }
];
const accountTypes = { bank: "Conta", cash: "Carteira", card: "Cartão" };
const accountIcons = { bank: "⌁", cash: "¤", card: "▣" };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
let transactions = read(keys.transactions, []);
let budgets = read(keys.budgets, {});
let plans = read(keys.plans, {});
let accounts = read(keys.accounts, defaultAccounts);
let goals = read(keys.goals, []);
function readCategories() { try { const saved = JSON.parse(localStorage.getItem(keys.categories)); return saved?.expense?.length && saved?.income?.length ? saved : structuredClone(defaultCategories); } catch { return structuredClone(defaultCategories); } }
let selectedMonth = "all";
let editingId = null;
let selectedInvoiceCard = null;

const currentMonth = () => new Date().toISOString().slice(0, 7);
const formatMoney = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
const formatDate = (date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
const monthLabel = (month) => month === "all" ? "Todos os meses" : new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));
const saveAll = () => {
    localStorage.setItem(keys.transactions, JSON.stringify(transactions)); localStorage.setItem(keys.budgets, JSON.stringify(budgets));
    localStorage.setItem(keys.plans, JSON.stringify(plans)); localStorage.setItem(keys.accounts, JSON.stringify(accounts)); localStorage.setItem(keys.goals, JSON.stringify(goals));
    localStorage.setItem(keys.categories, JSON.stringify(categories));
    if (!applyingCloudData) queueCloudSave();
};
const activeMonth = () => selectedMonth === "all" ? currentMonth() : selectedMonth;
const monthRecords = (month) => transactions.filter((item) => item.date?.startsWith(month));
const visibleRecords = () => selectedMonth === "all" ? transactions : monthRecords(selectedMonth);
const totalByType = (items, type) => items.filter((item) => item.type === type && !item.isTransfer).reduce((sum, item) => sum + Number(item.amount || 0), 0);
const accountTotalByType = (items, type) => items.filter((item) => item.type === type).reduce((sum, item) => sum + Number(item.amount || 0), 0);
const accountFor = (id) => accounts.find((item) => item.id === id) || accounts[0] || defaultAccounts[0];

function formatAmount(value, finish = false) {
    const clean = String(value ?? "").replace(/[^\d,]/g, "");
    const [integer = "", ...rest] = clean.split(",");
    const decimals = rest.join("").slice(0, 2);
    const formatted = (integer || "0").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (!clean.includes(",")) return formatted === "0" && !integer ? "" : formatted;
    return `${formatted},${finish ? decimals.padEnd(2, "0") : decimals}`;
}
function parseAmount(value) { return Number(String(value ?? "").replace(/\./g, "").replace(",", ".")); }
function previousMonth(month) { const date = new Date(`${month}-01T12:00:00`); date.setMonth(date.getMonth() - 1); return date.toISOString().slice(0, 7); }
function dateAfterMonths(dateValue, months) { const date = new Date(`${dateValue}T12:00:00`); date.setMonth(date.getMonth() + months); return date.toISOString().slice(0, 10); }
function invoiceMonthFor(item, card) { const month = item.date.slice(0, 7); return Number(item.date.slice(8, 10)) > Number(card.closingDay || 25) ? dateAfterMonths(`${month}-01`, 1).slice(0, 7) : month; }
function dueDateFor(month, card) { const dueMonth = Number(card.dueDay || 5) <= Number(card.closingDay || 25) ? dateAfterMonths(`${month}-01`, 1).slice(0, 7) : month; return `${dueMonth}-${String(card.dueDay || 5).padStart(2, "0")}`; }
function updateInstallmentPreview() {
    const total = parseAmount(amountInput.value), count = Math.max(1, Math.min(120, Number(installmentsInput.value) || 1));
    installmentPreview.textContent = count > 1 && total > 0 ? `${count} parcelas de ${formatMoney(total / count)} · total ${formatMoney(total)}` : "Pagamento à vista.";
}

function financialPayload() { return { version: 2, transactions, budgets, plans, accounts, goals, categories }; }
function setCloudStatus(message, online = false) { const status = document.querySelector("#cloud-status"); status.innerHTML = `${message} <i></i>`; status.classList.toggle("is-online", online); }
function queueCloudSave() { if (!currentUser || !cloudClient) return; clearTimeout(cloudSaveTimer); cloudSaveTimer = setTimeout(pushCloudData, 650); }
async function pushCloudData() {
    if (!currentUser || !cloudClient) return;
    setCloudStatus("SINCRONIZANDO", true);
    const { error } = await cloudClient.from("finance_data").upsert({ user_id: currentUser.id, payload: financialPayload(), updated_at: new Date().toISOString() });
    setCloudStatus(error ? "ERRO NA NUVEM" : "SALVO NA NUVEM", !error);
}
function applyCloudPayload(payload) {
    applyingCloudData = true;
    transactions = Array.isArray(payload.transactions) ? payload.transactions : transactions; budgets = payload.budgets || budgets; plans = payload.plans || plans;
    accounts = Array.isArray(payload.accounts) && payload.accounts.length ? payload.accounts : accounts; goals = Array.isArray(payload.goals) ? payload.goals : goals;
    categories = payload.categories?.expense?.length && payload.categories?.income?.length ? payload.categories : categories;
    transactions = transactions.map((item) => ({ ...item, accountId: item.accountId || "bank" }));
    saveAll(); applyingCloudData = false; setAccounts(); render();
}
async function loadCloudData() {
    const { data, error } = await cloudClient.from("finance_data").select("payload").eq("user_id", currentUser.id).maybeSingle();
    if (error) { setCloudStatus("ERRO NA NUVEM"); return; }
    if (data?.payload && Object.keys(data.payload).length) applyCloudPayload(data.payload); else await pushCloudData();
}
function updateAuthUI() {
    const action = document.querySelector("#cloud-account-action"), button = document.querySelector("#auth-button"), userBox = document.querySelector("#cloud-user");
    if (currentUser) { button.textContent = "SAIR"; action.textContent = "Sair desta conta"; userBox.innerHTML = `<span>●</span><div><strong>${currentUser.email}</strong><small>Sincronização automática ativada.</small></div>`; setCloudStatus("SALVO NA NUVEM", true); }
    else { button.textContent = "ENTRAR"; action.textContent = "Entrar ou criar conta"; userBox.innerHTML = "<span>○</span><div><strong>Modo local</strong><small>Os dados estão somente neste navegador.</small></div>"; setCloudStatus("DADOS LOCAIS"); }
}
async function initializeCloud() {
    if (!cloudClient) { setCloudStatus("NUVEM INDISPONÍVEL"); return; }
    const { data } = await cloudClient.auth.getSession(); currentUser = data.session?.user || null; updateAuthUI(); if (currentUser) await loadCloudData();
    cloudClient.auth.onAuthStateChange((_event, session) => { setTimeout(async () => { currentUser = session?.user || null; updateAuthUI(); if (currentUser) await loadCloudData(); }, 0); });
}

function setupAdvancedFilters() {
    const header = document.querySelector(".transactions-panel .panel__header");
    const controls = document.createElement("div");
    controls.className = "transaction-filters";
    controls.innerHTML = `<input id="transaction-search" type="search" placeholder="Buscar"><select id="transaction-category-filter" aria-label="Filtrar por categoria"><option value="all">Categorias</option></select><input id="transaction-min" inputmode="decimal" placeholder="Min."><input id="transaction-max" inputmode="decimal" placeholder="Máx.">`;
    filter.replaceWith(controls);
    controls.append(filter);
    header.append(controls);
    ["#transaction-search", "#transaction-category-filter", "#transaction-min", "#transaction-max"].forEach((selector) => document.querySelector(selector).addEventListener("input", render));
}

function syncRecurringTransactions() {
    const today = currentMonth();
    transactions.filter((item) => item.recurring && !item.recurringSourceId).forEach((template) => {
        let month = template.date.slice(0, 7);
        while (month < today) {
            const date = new Date(`${month}-01T12:00:00`); date.setMonth(date.getMonth() + 1); month = date.toISOString().slice(0, 7);
            const exists = transactions.some((item) => (item.id === template.id || item.recurringSourceId === template.id) && item.date?.startsWith(month));
            if (!exists) transactions.push({ ...template, id: crypto.randomUUID(), date: `${month}-${template.date.slice(8)}`, recurringSourceId: template.id });
        }
    });
}

function setCategories(type) { category.innerHTML = categories[type].map((name) => `<option value="${name}">${name}</option>`).join(""); }
function setType(type) { typeInput.value = type; document.querySelectorAll(".type-option").forEach((button) => button.classList.toggle("is-selected", button.dataset.type === type)); setCategories(type); }
function setAccounts(selectedId) { accountSelect.innerHTML = accounts.map((item) => `<option value="${item.id}">${accountIcons[item.type]} ${item.name}</option>`).join(""); accountSelect.value = selectedId || accounts[0]?.id || ""; }
function updateMonthFilter() {
    const months = [...new Set(transactions.map((item) => item.date?.slice(0, 7)).filter(Boolean).concat(selectedMonth === "all" ? [] : [selectedMonth]))].sort((a, b) => b.localeCompare(a));
    monthFilter.innerHTML = `<option value="all">Todos os meses</option>${months.map((month) => `<option value="${month}">${monthLabel(month)}</option>`).join("")}`;
    monthFilter.value = selectedMonth;
    document.querySelector("#current-month").textContent = monthLabel(selectedMonth);
}
function updateCategoryFilter() {
    const categoryFilter = document.querySelector("#transaction-category-filter");
    const value = categoryFilter.value;
    const names = [...new Set(transactions.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    categoryFilter.innerHTML = `<option value="all">Categorias</option>${names.map((name) => `<option value="${name}">${name}</option>`).join("")}`;
    categoryFilter.value = names.includes(value) ? value : "all";
}

function renderSummary() {
    const records = visibleRecords(), income = totalByType(records, "income"), expense = totalByType(records, "expense"), balance = income - expense;
    document.querySelector("#income").textContent = formatMoney(income); document.querySelector("#expense").textContent = formatMoney(expense); document.querySelector("#balance").textContent = formatMoney(Math.max(balance, 0));
    const savings = Math.max(balance, 0), savingsRate = income ? Math.round((savings / income) * 100) : 0;
    document.querySelector("#savings").textContent = formatMoney(savings);
    document.querySelector("#savings-rate").textContent = income ? `${savingsRate}% das entradas preservadas` : "Registre seus movimentos";
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
    const selected = filter.value, search = document.querySelector("#transaction-search").value.trim().toLocaleLowerCase("pt-BR");
    const selectedCategory = document.querySelector("#transaction-category-filter").value;
    const minValue = document.querySelector("#transaction-min").value.trim(), maxValue = document.querySelector("#transaction-max").value.trim();
    const min = minValue ? parseAmount(minValue) : null, max = maxValue ? parseAmount(maxValue) : null;
    const records = visibleRecords().filter((item) => {
        const haystack = `${item.description} ${item.category} ${accountFor(item.accountId).name}`.toLocaleLowerCase("pt-BR");
        return (selected === "all" || item.type === selected) && (selectedCategory === "all" || item.category === selectedCategory) && (!search || haystack.includes(search)) && (!Number.isFinite(min) || item.amount >= min) && (!Number.isFinite(max) || item.amount <= max);
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
    transactionList.innerHTML = records.map((item) => { const account = accountFor(item.accountId), kind = item.isTransfer ? "Transferência" : item.type === "income" ? "Receita" : "Despesa"; return `<li class="transaction transaction--${item.type}"><span class="transaction__icon">${item.isTransfer ? "⇄" : item.type === "income" ? "↗" : "↘"}</span><div class="transaction__content"><div class="transaction__title"><strong>${item.description}</strong><span class="transaction__kind">${kind}</span></div><span class="transaction__details">${item.category} <i>·</i> ${formatDate(item.date)} <i>·</i> ${account.name}${item.installments > 1 ? ` <i>·</i> ${item.installmentNumber}/${item.installments}` : ""}${item.recurring ? " <i>·</i> mensal" : ""}</span></div><div class="transaction__actions"><span class="transaction__value transaction__value--${item.type}">${item.type === "income" ? "+" : "−"} ${formatMoney(item.amount)}</span>${item.isTransfer ? "" : `<button class="edit-button" data-edit="${item.id}" type="button" aria-label="Editar">✎</button>`}<button class="delete-button" data-delete="${item.id}" type="button" aria-label="Excluir">×</button></div></li>`; }).join("");
    const empty = records.length === 0; emptyState.hidden = !empty; emptyState.style.display = empty ? "grid" : "none"; transactionList.hidden = empty;
    if (empty) { document.querySelector("#empty-title").textContent = transactions.length ? "Nenhum lançamento encontrado" : "Nenhum lançamento ainda"; document.querySelector("#empty-message").textContent = transactions.length ? "Tente alterar sua busca ou os filtros." : "Registre sua primeira entrada ou despesa."; }
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
    const axes = entries.map(([name], i) => { const angle = -Math.PI / 2 + i * Math.PI * 2 / sides; const lx = cx + Math.cos(angle) * (radius + 35), ly = cy + Math.sin(angle) * (radius + 35) + 4; return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(angle) * radius}" y2="${cy + Math.sin(angle) * radius}" stroke="#334155"/><text x="${lx}" y="${ly}" text-anchor="middle" fill="#cbd5e1" font-size="10">${name.toUpperCase()}</text>`; }).join(""); chart.innerHTML = `${[1, .66, .33].map((scale) => `<polygon points="${polygon(scale)}" fill="none" stroke="#263247"/>`).join("")}${axes}<polygon points="${entries.map(([, value], i) => point(i, value)).join(" ")}" fill="rgba(59,130,246,.22)" stroke="#60a5fa" stroke-width="3"/>`;
}

function renderAgenda() {
    const month = activeMonth(), records = monthRecords(month).sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstDay = new Date(`${month}-01T12:00:00`), daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
    const leadingDays = (firstDay.getDay() + 6) % 7;
    const byDay = records.reduce((all, item) => { const day = Number(item.date.slice(8, 10)); (all[day] ||= []).push(item); return all; }, {});
    const today = new Date().toISOString().slice(0, 10);
    const cells = Array.from({ length: leadingDays + daysInMonth }, (_, index) => {
        if (index < leadingDays) return '<div class="calendar-day calendar-day--empty" aria-hidden="true"></div>';
        const day = index - leadingDays + 1, date = `${month}-${String(day).padStart(2, "0")}`, items = byDay[day] || [];
        const net = totalByType(items, "income") - totalByType(items, "expense"), dots = items.slice(0, 3).map((item) => `<i class="calendar-dot calendar-dot--${item.type}"></i>`).join("");
        return `<div class="calendar-day ${date === today ? "calendar-day--today" : ""} ${items.length ? "calendar-day--active" : ""}" title="${items.length ? `${items.length} movimento(s)` : "Sem movimentos"}"><span>${day}</span><div class="calendar-dots">${dots}${items.length > 3 ? `<b>+${items.length - 3}</b>` : ""}</div>${items.length ? `<small class="${net >= 0 ? "is-positive" : "is-negative"}">${net >= 0 ? "+" : "−"}${formatMoney(Math.abs(net)).replace("R$", "")}</small>` : ""}</div>`;
    });
    document.querySelector("#calendar-grid").innerHTML = cells.join("");
    document.querySelector("#agenda-count").textContent = records.length;
    const net = totalByType(records, "income") - totalByType(records, "expense");
    const netElement = document.querySelector("#agenda-net"); netElement.textContent = formatMoney(net); netElement.className = net < 0 ? "is-negative" : "is-positive";
    document.querySelector("#agenda-month").textContent = monthLabel(month);
    document.querySelector("#agenda-list").innerHTML = records.length ? records.slice(0, 6).map((item) => `<div class="agenda-item"><time>${formatDate(item.date)}</time><span class="agenda-item__dot agenda-item__dot--${item.type}"></span><div><strong>${item.description}</strong><small>${item.category} · ${accountFor(item.accountId).name}</small></div><b class="${item.type === "income" ? "is-positive" : "is-negative"}">${item.type === "income" ? "+" : "−"}${formatMoney(item.amount)}</b></div>`).join("") : "<p class=workspace-empty>Nenhum movimento neste mês. Adicione um lançamento para preencher a agenda.</p>";
}

function renderBudget() {
    budgetCategory.innerHTML = categories.expense.map((name) => `<option>${name}</option>`).join(""); const month = activeMonth(), records = monthRecords(month), monthBudgets = budgets[month] || {}, list = Object.entries(monthBudgets);
    const totalLimit = list.reduce((sum, [, limit]) => sum + Number(limit), 0), totalSpent = records.filter((item) => item.type === "expense" && monthBudgets[item.category]).reduce((sum, item) => sum + item.amount, 0);
    document.querySelector("#budget-overview").innerHTML = list.length ? `<span>Orçamento usado</span><strong>${formatMoney(totalSpent)} de ${formatMoney(totalLimit)}</strong><small>${Math.max(totalLimit - totalSpent, 0) ? `${formatMoney(Math.max(totalLimit - totalSpent, 0))} disponíveis` : `${formatMoney(Math.abs(totalLimit - totalSpent))} acima do limite`}</small>` : "";
    document.querySelector("#budget-list").innerHTML = list.length ? list.map(([name, limit]) => { const spent = records.filter((item) => item.type === "expense" && item.category === name).reduce((sum, item) => sum + item.amount, 0); const rawPercent = Math.round((spent / limit) * 100), percent = Math.min(100, rawPercent), level = rawPercent >= 100 ? "danger" : rawPercent >= 80 ? "warning" : "safe"; return `<div class="budget-item budget-item--${level}"><div><strong>${name}</strong><span>${formatMoney(spent)} de ${formatMoney(limit)}</span></div><div class="budget-track"><i style="width:${percent}%"></i></div><b class="${spent > limit ? "over" : ""}">${rawPercent}%</b><div class="budget-actions"><button data-budget-edit="${name}" type="button">Editar</button><button data-budget-delete="${name}" type="button">Excluir</button></div></div>`; }).join("") : "<p class=workspace-empty>Defina um limite para acompanhar seus gastos.</p>";
}
function renderPlan() { const month = activeMonth(), plan = plans[month], records = monthRecords(month); if (!plan) { document.querySelector("#plan-summary").innerHTML = "<p class=workspace-empty>Sem plano para este mês.</p>"; return; } const income = totalByType(records, "income"), expense = totalByType(records, "expense"), saved = Math.max(0, income - expense); document.querySelector("#plan-summary").innerHTML = `<div><span>Recebido</span><strong>${formatMoney(income)} / ${formatMoney(plan.income || 0)}</strong></div><div><span>Gasto</span><strong>${formatMoney(expense)} / ${formatMoney(plan.expense || 0)}</strong></div><div><span>Guardado</span><strong>${formatMoney(saved)} / ${formatMoney(plan.savings || 0)}</strong></div>`; }
function renderAccounts() {
    accountList.innerHTML = accounts.map((account) => { const records = transactions.filter((item) => item.accountId === account.id); const income = accountTotalByType(records, "income"), expense = accountTotalByType(records, "expense"); const value = account.type === "card" ? totalByType(records, "expense") : income - expense; const label = account.type === "card" ? "Fatura acumulada" : "Saldo"; const removable = !["bank", "cash", "card"].includes(account.id); return `<div class="account-item"><span class="account-icon">${accountIcons[account.type]}</span><div><strong>${account.name}</strong><small>${accountTypes[account.type]} · ${label}</small></div><b class="${account.type === "card" ? "is-card" : ""}">${formatMoney(value)}</b>${removable ? `<button class="delete-button" data-account-delete="${account.id}" aria-label="Remover conta">×</button>` : ""}</div>`; }).join("");
}
function renderInvoice() {
    const cards = accounts.filter((account) => account.type === "card");
    if (!cards.length) { invoiceCard.innerHTML = '<option value="">Crie um cartão</option>'; cardSettingsForm.hidden = true; document.querySelector("#invoice-future-list").innerHTML = '<p class="workspace-empty">Adicione um cartão para ativar a fatura inteligente.</p>'; return; }
    cardSettingsForm.hidden = false;
    if (!cards.some((card) => card.id === selectedInvoiceCard)) selectedInvoiceCard = cards[0].id;
    invoiceCard.innerHTML = cards.map((card) => `<option value="${card.id}">${card.name}</option>`).join(""); invoiceCard.value = selectedInvoiceCard;
    const card = cards.find((item) => item.id === selectedInvoiceCard), month = activeMonth(), paid = Boolean(card.paidInvoices?.[month]);
    cardLimit.value = card.limit ? formatAmount(Number(card.limit).toFixed(2).replace(".", ","), true) : ""; cardClosingDay.value = card.closingDay || 25; cardDueDay.value = card.dueDay || 5;
    const cardExpenses = transactions.filter((item) => item.type === "expense" && item.accountId === card.id);
    const cycleItems = cardExpenses.filter((item) => invoiceMonthFor(item, card) === month), total = totalByType(cycleItems, "expense"), limit = Number(card.limit || 0), available = Math.max(limit - total, 0), usage = limit ? Math.min(100, Math.round((total / limit) * 100)) : 0;
    document.querySelector("#invoice-total").textContent = formatMoney(total); document.querySelector("#invoice-available").textContent = formatMoney(available); document.querySelector("#invoice-progress").style.width = `${usage}%`;
    const dueDate = dueDateFor(month, card), due = new Date(`${dueDate}T12:00:00`), today = new Date(); today.setHours(12, 0, 0, 0); const days = Math.ceil((due - today) / 86400000);
    document.querySelector("#invoice-due-date").textContent = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(due);
    document.querySelector("#invoice-status").textContent = paid ? "Fatura paga" : days < 0 ? `Venceu há ${Math.abs(days)} dia(s)` : days === 0 ? "Vence hoje" : `Vence em ${days} dia(s) · ${usage}% do limite`;
    const paidButton = document.querySelector("#invoice-paid"); paidButton.textContent = paid ? "✓ Fatura paga" : "Marcar como paga"; paidButton.classList.toggle("is-paid", paid); paidButton.disabled = total === 0;
    const future = Array.from({ length: 4 }, (_, index) => { const target = dateAfterMonths(`${month}-01`, index + 1).slice(0, 7); return { month: target, total: totalByType(cardExpenses.filter((item) => invoiceMonthFor(item, card) === target), "expense") }; });
    document.querySelector("#invoice-future-list").innerHTML = future.map((item) => `<div class="invoice-future__item"><span>${monthLabel(item.month)}</span><strong>${formatMoney(item.total)}</strong></div>`).join("");
    document.querySelector("#invoice-items").innerHTML = cycleItems.length ? `<h4>Compras desta fatura</h4>${cycleItems.sort((a, b) => a.date.localeCompare(b.date)).map((item) => `<div><span>${item.description}${item.installments > 1 ? ` · ${item.installmentNumber}/${item.installments}` : ""}</span><strong>${formatMoney(item.amount)}</strong></div>`).join("")}` : "";
}
function renderGoals() {
    goalList.innerHTML = goals.length ? goals.map((goal) => { const percent = Math.min(100, Math.round((goal.current / goal.target) * 100)); return `<div class="goal-item"><div class="goal-item__header"><strong>${goal.name}</strong><span>${formatMoney(goal.current)} de ${formatMoney(goal.target)}</span></div><div class="goal-track"><i style="width:${percent}%"></i></div><div class="goal-item__actions"><small>${percent}% concluída</small><button data-goal-add="${goal.id}" type="button">+ aporte</button><button class="delete-button" data-goal-delete="${goal.id}" type="button" aria-label="Excluir meta">×</button></div></div>`; }).join("") : "<p class=workspace-empty>Crie uma meta para acompanhar sua evolução.</p>";
}
function renderRecurrences() {
    const templates = transactions.filter((item) => item.recurring && !item.recurringSourceId);
    recurringList.innerHTML = templates.length ? templates.map((item) => `<div class="recurring-item"><span>${item.type === "income" ? "↗" : "↘"}</span><div><strong>${item.description}</strong><small>${accountFor(item.accountId).name} · todo mês</small></div><b>${formatMoney(item.amount)}</b><button class="delete-button" data-recurring-stop="${item.id}" type="button" title="Parar recorrência">×</button></div>`).join("") : "<p class=workspace-empty>Marque um lançamento como mensal para ele aparecer aqui.</p>";
}
function renderInsights() { const records = visibleRecords(), expense = totalByType(records, "expense"), income = totalByType(records, "income"), target = plans[activeMonth()]?.savings || 0; const message = !records.length ? "Adicione lançamentos para receber leituras do seu mês." : target && income - expense >= target ? "Meta de reserva atingida: seu mês está no azul." : expense > income ? "Atenção: as saídas estão maiores que as entradas neste período." : "Ritmo saudável: continue registrando para manter a visão completa."; document.querySelector(".tip").innerHTML = `<span>✦</span><p>${message}</p>`; }
function reportRecords(items = transactions) { return items.filter((item) => !item.isTransfer); }
function renderAnnual() {
    const years = [...new Set(transactions.map((item) => item.date?.slice(0, 4)).filter(Boolean).concat([String(new Date().getFullYear())]))].sort((a, b) => b.localeCompare(a)), select = document.querySelector("#annual-year"), chosen = years.includes(select.value) ? select.value : years[0];
    select.innerHTML = years.map((year) => `<option>${year}</option>`).join(""); select.value = chosen;
    const series = Array.from({ length: 12 }, (_, index) => { const month = `${chosen}-${String(index + 1).padStart(2, "0")}`, records = reportRecords(monthRecords(month)); return { month, income: totalByType(records, "income"), expense: totalByType(records, "expense") }; }), income = series.reduce((sum, item) => sum + item.income, 0), expense = series.reduce((sum, item) => sum + item.expense, 0), active = series.filter((item) => item.income || item.expense).length || 1;
    document.querySelector("#annual-summary").innerHTML = `<div><span>Receitas</span><strong>${formatMoney(income)}</strong></div><div><span>Despesas</span><strong>${formatMoney(expense)}</strong></div><div><span>Resultado</span><strong class="${income - expense < 0 ? "is-negative" : "is-positive"}">${formatMoney(income - expense)}</strong></div><div><span>Média mensal</span><strong>${formatMoney(expense / active)}</strong></div>`;
    const max = Math.max(...series.flatMap((item) => [item.income, item.expense]), 1); document.querySelector("#annual-chart").innerHTML = series.map((item) => `<div class="annual-column"><div><i class="income" style="height:${Math.round(item.income / max * 100)}%"></i><i class="expense" style="height:${Math.round(item.expense / max * 100)}%"></i></div><span>${monthLabel(item.month).slice(0, 3)}</span></div>`).join("");
}
function getAlerts() {
    const today = new Date(); today.setHours(12, 0, 0, 0); const month = currentMonth(), alerts = [];
    accounts.filter((item) => item.type === "card").forEach((card) => { const total = totalByType(transactions.filter((item) => item.type === "expense" && item.accountId === card.id && invoiceMonthFor(item, card) === month), "expense"), due = new Date(`${dueDateFor(month, card)}T12:00:00`), days = Math.ceil((due - today) / 86400000); if (total && !card.paidInvoices?.[month] && days <= 7) alerts.push({ level: days < 0 ? "danger" : "warning", title: `${card.name}: ${formatMoney(total)}`, text: days < 0 ? `Fatura vencida há ${Math.abs(days)} dia(s).` : days === 0 ? "A fatura vence hoje." : `Vence em ${days} dia(s).` }); });
    Object.entries(budgets[month] || {}).forEach(([name, limit]) => { const spent = transactions.filter((item) => item.type === "expense" && !item.isTransfer && item.category === name && item.date.startsWith(month)).reduce((sum, item) => sum + item.amount, 0), percent = Math.round(spent / limit * 100); if (percent >= 80) alerts.push({ level: percent >= 100 ? "danger" : "warning", title: `${name}: ${percent}% do orçamento`, text: `${formatMoney(spent)} gastos de ${formatMoney(limit)}.` }); });
    return alerts;
}
function renderAlerts() { const alerts = getAlerts(); document.querySelector("#notification-list").innerHTML = alerts.length ? alerts.map((item) => `<div class="notification notification--${item.level}"><strong>${item.title}</strong><span>${item.text}</span></div>`).join("") : '<p class="workspace-empty">Tudo certo por aqui. Nenhum alerta importante.</p>'; }
function populateToolAccounts() { const options = accounts.filter((item) => item.type !== "card").map((item) => `<option value="${item.id}">${item.name}</option>`).join(""); ["#transfer-from", "#transfer-to", "#import-account"].forEach((selector) => document.querySelector(selector).innerHTML = options); const from = document.querySelector("#transfer-from"), to = document.querySelector("#transfer-to"); if (to.options.length > 1) to.selectedIndex = 1; }
function renderCategoryManager() { document.querySelector("#category-manager").innerHTML = ["expense", "income"].map((type) => `<div><strong>${type === "expense" ? "Despesas" : "Receitas"}</strong>${categories[type].map((name) => `<span>${name}${defaultCategories[type].includes(name) ? "" : `<button data-category-delete="${type}|${name}" type="button">×</button>`}</span>`).join("")}</div>`).join(""); }
function renderTools() { renderAnnual(); renderAlerts(); populateToolAccounts(); renderCategoryManager(); }
function render() { updateMonthFilter(); updateCategoryFilter(); renderSummary(); renderTrendChart(); renderRadarChart(); renderAgenda(); renderTransactions(); renderCategoryChart(); renderBudget(); renderPlan(); renderAccounts(); renderInvoice(); renderGoals(); renderRecurrences(); renderInsights(); renderTools(); }

function openModal(item = null) {
    editingId = item?.id || null; form.reset(); setType(item?.type || "expense"); setAccounts(item?.accountId);
    if (item) { document.querySelector("#description").value = item.description; category.value = item.category; amountInput.value = formatAmount(item.amount.toFixed(2).replace(".", ","), true); document.querySelector("#date").value = item.date; recurringInput.checked = Boolean(item.recurring); installmentsInput.value = 1; installmentsInput.disabled = true; document.querySelector("#modal-title").textContent = item.installments > 1 ? `Editar parcela ${item.installmentNumber}/${item.installments}` : "Editar lançamento"; }
    else { document.querySelector("#date").valueAsDate = new Date(); installmentsInput.value = 1; document.querySelector("#modal-title").textContent = "Organize seu dinheiro"; }
    if (!item) installmentsInput.disabled = false; updateInstallmentPreview();
    document.querySelector("#cancel-edit").hidden = !item; modal.showModal(); document.querySelector("#description").focus();
}
function download(filename, content, type) { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }

document.querySelector("#new-transaction").addEventListener("click", () => openModal()); document.querySelector("[data-open-form]").addEventListener("click", () => openModal()); document.querySelector("#close-modal").addEventListener("click", () => modal.close()); document.querySelector("#cancel-edit").addEventListener("click", () => { editingId = null; modal.close(); }); document.querySelectorAll(".type-option").forEach((button) => button.addEventListener("click", () => setType(button.dataset.type)));
filter.addEventListener("change", render); monthFilter.addEventListener("change", () => { selectedMonth = monthFilter.value; render(); }); [amountInput, budgetAmount, goalTarget, goalCurrent, cardLimit, ...planInputs].forEach((input) => { input.addEventListener("input", () => { input.value = formatAmount(input.value); }); input.addEventListener("blur", () => { input.value = formatAmount(input.value, true); }); });
amountInput.addEventListener("input", updateInstallmentPreview); installmentsInput.addEventListener("input", updateInstallmentPreview);
form.addEventListener("submit", (event) => {
    event.preventDefault(); const data = new FormData(form); const amount = parseAmount(data.get("amount")); if (!Number.isFinite(amount) || amount <= 0) return;
    const base = { type: data.get("type"), description: data.get("description").trim(), category: data.get("category"), amount, date: data.get("date"), accountId: data.get("account"), recurring: data.get("recurring") === "on" };
    if (editingId) transactions = transactions.map((item) => item.id === editingId ? { ...item, ...base, installments: item.installments || 1 } : item);
    else { const count = Math.max(1, Math.min(120, Number(data.get("installments")) || 1)), groupId = count > 1 ? crypto.randomUUID() : null, totalCents = Math.round(amount * 100), baseCents = Math.floor(totalCents / count), extraCents = totalCents % count; transactions.push(...Array.from({ length: count }, (_, index) => ({ ...base, amount: (baseCents + (index < extraCents ? 1 : 0)) / 100, totalAmount: amount, id: crypto.randomUUID(), date: dateAfterMonths(base.date, index), installments: count, installmentNumber: index + 1, installmentGroup: groupId }))); }
    saveAll(); modal.close(); render();
});
transactionList.addEventListener("click", (event) => { const edit = event.target.dataset.edit, remove = event.target.dataset.delete; if (edit) openModal(transactions.find((item) => item.id === edit)); if (remove) { const item = transactions.find((entry) => entry.id === remove), removeGroup = item?.installmentGroup && confirm("Excluir todas as parcelas desta compra? Clique em Cancelar para excluir somente esta parcela."); transactions = transactions.filter((entry) => item?.transferGroup ? entry.transferGroup !== item.transferGroup : removeGroup ? entry.installmentGroup !== item.installmentGroup : entry.id !== remove); saveAll(); render(); } });
budgetForm.addEventListener("submit", (event) => { event.preventDefault(); const amount = parseAmount(budgetAmount.value); if (!amount) return; const month = activeMonth(); budgets[month] = { ...(budgets[month] || {}), [budgetCategory.value]: amount }; budgetAmount.value = ""; saveAll(); render(); });
document.querySelector("#budget-list").addEventListener("click", (event) => { const edit = event.target.dataset.budgetEdit, remove = event.target.dataset.budgetDelete, month = activeMonth(); if (edit) { budgetCategory.value = edit; budgetAmount.value = formatAmount(String(budgets[month][edit]).replace(".", ","), true); budgetAmount.focus(); } if (remove) { delete budgets[month][remove]; if (!Object.keys(budgets[month]).length) delete budgets[month]; saveAll(); render(); } });
planForm.addEventListener("submit", (event) => { event.preventDefault(); const [income, expense, savings] = planInputs.map((input) => parseAmount(input.value) || 0); plans[activeMonth()] = { income, expense, savings }; saveAll(); render(); });
accountForm.addEventListener("submit", (event) => { event.preventDefault(); const name = accountName.value.trim(); if (!name) return; accounts.push({ id: crypto.randomUUID(), name, type: accountType.value }); accountForm.reset(); saveAll(); render(); });
invoiceCard.addEventListener("change", () => { selectedInvoiceCard = invoiceCard.value; renderInvoice(); });
document.querySelector("#invoice-paid").addEventListener("click", () => { const month = activeMonth(); accounts = accounts.map((account) => account.id === selectedInvoiceCard ? { ...account, paidInvoices: { ...(account.paidInvoices || {}), [month]: !account.paidInvoices?.[month] } } : account); saveAll(); render(); });
cardSettingsForm.addEventListener("submit", (event) => { event.preventDefault(); const limit = parseAmount(cardLimit.value), closingDay = Number(cardClosingDay.value), dueDay = Number(cardDueDay.value); if (!selectedInvoiceCard || !Number.isFinite(limit) || limit <= 0 || closingDay < 1 || closingDay > 28 || dueDay < 1 || dueDay > 28) return; accounts = accounts.map((account) => account.id === selectedInvoiceCard ? { ...account, limit, closingDay, dueDay } : account); saveAll(); render(); });
accountList.addEventListener("click", (event) => { const id = event.target.dataset.accountDelete; if (!id) return; transactions = transactions.map((item) => item.accountId === id ? { ...item, accountId: "bank" } : item); accounts = accounts.filter((item) => item.id !== id); saveAll(); render(); });
goalForm.addEventListener("submit", (event) => { event.preventDefault(); const target = parseAmount(goalTarget.value), current = parseAmount(goalCurrent.value) || 0; if (!goalName.value.trim() || !target) return; goals.push({ id: crypto.randomUUID(), name: goalName.value.trim(), target, current }); goalForm.reset(); saveAll(); render(); });
goalList.addEventListener("click", (event) => { const add = event.target.dataset.goalAdd, remove = event.target.dataset.goalDelete; if (add) { const value = parseAmount(prompt("Qual valor você quer adicionar a esta meta?", "") || ""); if (Number.isFinite(value) && value > 0) goals = goals.map((goal) => goal.id === add ? { ...goal, current: goal.current + value } : goal); } if (remove) goals = goals.filter((goal) => goal.id !== remove); saveAll(); render(); });
recurringList.addEventListener("click", (event) => { const id = event.target.dataset.recurringStop; if (!id) return; transactions = transactions.map((item) => item.id === id ? { ...item, recurring: false } : item); saveAll(); render(); });
document.querySelector("#export-data").addEventListener("click", () => download(`gastos-financeiros-backup-${currentMonth()}.json`, JSON.stringify({ transactions, budgets, plans, accounts, goals }, null, 2), "application/json"));
document.querySelector("#import-data").addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; try { const backup = JSON.parse(await file.text()); transactions = Array.isArray(backup.transactions) ? backup.transactions : transactions; budgets = backup.budgets || budgets; plans = backup.plans || plans; accounts = Array.isArray(backup.accounts) && backup.accounts.length ? backup.accounts : accounts; goals = Array.isArray(backup.goals) ? backup.goals : goals; transactions = transactions.map((item) => ({ ...item, accountId: item.accountId || "bank" })); saveAll(); render(); } catch { alert("Não foi possível importar este arquivo."); } event.target.value = ""; });
document.querySelector("#export-csv").addEventListener("click", () => { const header = "tipo,descricao,categoria,conta,valor,data,recorrente,parcela"; const rows = transactions.map((item) => [item.type, item.description, item.category, accountFor(item.accountId).name, item.amount.toFixed(2).replace(".", ","), item.date, item.recurring ? "sim" : "não", item.installments > 1 ? `${item.installmentNumber}/${item.installments}` : ""].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")); download(`gastos-financeiros-${currentMonth()}.csv`, `\uFEFF${header}\n${rows.join("\n")}`, "text/csv;charset=utf-8"); });
document.querySelector("#annual-year").addEventListener("change", renderAnnual);
document.querySelector("#transfer-amount").addEventListener("input", (event) => event.target.value = formatAmount(event.target.value));
document.querySelector("#transfer-form").addEventListener("submit", (event) => { event.preventDefault(); const from = document.querySelector("#transfer-from").value, to = document.querySelector("#transfer-to").value, amount = parseAmount(document.querySelector("#transfer-amount").value), date = document.querySelector("#transfer-date").value; if (!from || !to || from === to || !amount || !date) { alert("Escolha contas diferentes e informe valor e data."); return; } const group = crypto.randomUUID(), source = accountFor(from).name, destination = accountFor(to).name, common = { category: "Transferência", amount, date, isTransfer: true, transferGroup: group, installments: 1, recurring: false }; transactions.push({ ...common, id: crypto.randomUUID(), type: "expense", accountId: from, description: `Transferência para ${destination}` }, { ...common, id: crypto.randomUUID(), type: "income", accountId: to, description: `Transferência de ${source}` }); event.target.reset(); document.querySelector("#transfer-date").valueAsDate = new Date(); saveAll(); render(); });
function guessCategory(description, type) { const text = description.toLocaleLowerCase("pt-BR"); const rules = [["Alimentação", /mercado|restaurante|ifood|padaria/], ["Transporte", /uber|posto|combust|ônibus/], ["Moradia", /aluguel|energia|água|internet/], ["Saúde", /farmácia|hospital|médic/], ["Salário", /sal[aá]rio|pagamento/]]; return rules.find(([, rule]) => rule.test(text))?.[0] || (type === "income" ? "Outros" : "Outros"); }
function parseStatement(text, filename) { if (filename.toLowerCase().endsWith(".ofx") || /<OFX>/i.test(text)) return [...text.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>)/gi)].map((match) => { const block = match[1], value = Number((block.match(/<TRNAMT>([^<\r\n]+)/i)?.[1] || 0).replace(",", ".")), rawDate = block.match(/<DTPOSTED>(\d{8})/i)?.[1], description = (block.match(/<(?:MEMO|NAME)>([^<\r\n]+)/i)?.[1] || "Movimento importado").trim(); return { description, amount: Math.abs(value), type: value >= 0 ? "income" : "expense", date: rawDate ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : new Date().toISOString().slice(0, 10) }; }); const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean), delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",", headers = lines.shift().split(delimiter).map((item) => item.replaceAll('"', "").trim().toLowerCase()); return lines.map((line) => { const values = line.split(delimiter).map((item) => item.replace(/^"|"$/g, "").trim()), find = (...names) => values[headers.findIndex((header) => names.some((name) => header.includes(name)))] || ""; const description = find("descr", "hist", "memo", "name") || "Movimento importado", rawAmount = find("valor", "amount", "trnamt"), normalized = rawAmount.replace(/[^\d,.-]/g, ""), amount = Number(normalized.includes(",") ? normalized.replace(/\./g, "").replace(",", ".") : normalized), rawDate = find("data", "date", "dtposted"), parts = rawDate.split(/[\/\-.]/), date = parts[0]?.length === 4 ? parts.slice(0, 3).join("-") : parts.length >= 3 ? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}` : new Date().toISOString().slice(0, 10); return { description, amount: Math.abs(amount), type: amount >= 0 ? "income" : "expense", date }; }).filter((item) => item.amount > 0); }
document.querySelector("#statement-import").addEventListener("change", async (event) => { const file = event.target.files[0], feedback = document.querySelector("#import-feedback"); if (!file) return; try { const records = parseStatement(await file.text(), file.name), accountId = document.querySelector("#import-account").value, fresh = records.filter((item) => !transactions.some((saved) => saved.accountId === accountId && saved.date === item.date && saved.description === item.description && Math.abs(saved.amount - item.amount) < .001)); transactions.push(...fresh.map((item) => ({ ...item, id: crypto.randomUUID(), accountId, category: guessCategory(item.description, item.type), imported: true, installments: 1, recurring: false }))); feedback.textContent = `${fresh.length} lançamentos importados${fresh.length !== records.length ? ` · ${records.length - fresh.length} duplicados ignorados` : ""}.`; saveAll(); render(); } catch { feedback.textContent = "Não foi possível ler o extrato. Confira o formato do arquivo."; } event.target.value = ""; });
document.querySelector("#category-form").addEventListener("submit", (event) => { event.preventDefault(); const type = document.querySelector("#custom-category-type").value, input = document.querySelector("#custom-category-name"), name = input.value.trim(); if (name && !categories[type].some((item) => item.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) categories[type].push(name); input.value = ""; saveAll(); setCategories(typeInput.value); render(); });
document.querySelector("#category-manager").addEventListener("click", (event) => { const value = event.target.dataset.categoryDelete; if (!value) return; const [type, name] = value.split("|"); if (transactions.some((item) => item.category === name)) { alert("Esta categoria possui lançamentos e não pode ser excluída."); return; } categories[type] = categories[type].filter((item) => item !== name); saveAll(); setCategories(typeInput.value); render(); });
document.querySelector("#notification-permission").addEventListener("click", async () => { if (!("Notification" in window)) return; const permission = await Notification.requestPermission(); if (permission === "granted") { const alerts = getAlerts(); new Notification("Gastos Financeiros", { body: alerts[0]?.text || "Notificações ativadas com sucesso.", icon: "icon.svg" }); } });
async function handleAccountAction() { if (currentUser) await cloudClient.auth.signOut(); else { authFeedback.textContent = ""; authModal.showModal(); authEmail.focus(); } }
document.querySelector("#auth-button").addEventListener("click", handleAccountAction); document.querySelector("#cloud-account-action").addEventListener("click", handleAccountAction); document.querySelector("#close-auth").addEventListener("click", () => authModal.close());
authForm.addEventListener("submit", async (event) => { event.preventDefault(); authFeedback.textContent = "Entrando..."; const { error } = await cloudClient.auth.signInWithPassword({ email: authEmail.value.trim(), password: authPassword.value }); if (error) { authFeedback.textContent = error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message; return; } authFeedback.textContent = "Conta conectada."; authModal.close(); authForm.reset(); });
document.querySelector("#auth-signup").addEventListener("click", async () => { if (!authForm.reportValidity()) return; authFeedback.textContent = "Criando conta..."; const { data, error } = await cloudClient.auth.signUp({ email: authEmail.value.trim(), password: authPassword.value, options: { emailRedirectTo: "https://vbsouza1420.github.io/calculadora-main/" } }); if (error) { authFeedback.textContent = error.message; return; } authFeedback.textContent = data.session ? "Conta criada e conectada." : "Conta criada. Confirme o link enviado ao seu e-mail."; if (data.session) authModal.close(); });
const securityFeedback = document.querySelector("#security-feedback");
document.querySelector("#reset-password").addEventListener("click", async () => { const email = currentUser?.email || prompt("Digite o e-mail da sua conta:", ""); if (!email) return; const { error } = await cloudClient.auth.resetPasswordForEmail(email, { redirectTo: "https://vbsouza1420.github.io/calculadora-main/" }); securityFeedback.textContent = error ? error.message : "Link de recuperação enviado para o seu e-mail."; });
document.querySelector("#change-password").addEventListener("click", async () => { if (!currentUser) { securityFeedback.textContent = "Entre na sua conta primeiro."; return; } const password = prompt("Digite a nova senha (mínimo de 6 caracteres):", ""); if (!password || password.length < 6) return; const { error } = await cloudClient.auth.updateUser({ password }); securityFeedback.textContent = error ? error.message : "Senha alterada com sucesso."; });
document.querySelector("#delete-account").addEventListener("click", async () => { if (!currentUser) { securityFeedback.textContent = "Entre na sua conta primeiro."; return; } if (!confirm("Excluir permanentemente sua conta e todos os dados? Esta ação não pode ser desfeita.")) return; securityFeedback.textContent = "Excluindo conta..."; const { error } = await cloudClient.functions.invoke("delete-account", { method: "POST" }); if (error) { securityFeedback.textContent = "Não foi possível excluir a conta agora."; return; } localStorage.clear(); await cloudClient.auth.signOut(); location.reload(); });
let installPrompt = null; const installButton = document.querySelector("#install-app"); window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event; installButton.hidden = false; }); installButton.addEventListener("click", async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; installButton.hidden = true; }); window.addEventListener("appinstalled", () => { installButton.hidden = true; securityFeedback.textContent = "Aplicativo instalado com sucesso."; });
document.querySelector("#theme-toggle").addEventListener("click", () => { document.body.classList.toggle("light"); localStorage.setItem(keys.theme, document.body.classList.contains("light") ? "light" : "dark"); });
if (localStorage.getItem(keys.theme) === "light") document.body.classList.add("light");
transactions = transactions.map((item) => ({ ...item, accountId: item.accountId || "bank" }));
accounts = accounts.map((account) => account.type === "card" ? { ...account, limit: Number(account.limit || 0), closingDay: Number(account.closingDay || 25), dueDay: Number(account.dueDay || 5) } : account);
setupAdvancedFilters(); syncRecurringTransactions(); setCategories("expense"); setAccounts(); saveAll(); render(); initializeCloud();
document.querySelector("#transfer-date").valueAsDate = new Date();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
