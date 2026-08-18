import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const addMonths = (month: string, amount: number) => { const date = new Date(`${month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + amount); return date.toISOString().slice(0, 7); };
const invoiceMonthFor = (item: any, card: any) => Number(item.date?.slice(8, 10)) > Number(card.closingDay || 25) ? addMonths(item.date.slice(0, 7), 1) : item.date.slice(0, 7);
const localToday = () => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
};
const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000);
const dueDateFor = (cycleMonth: string, card: any) => { const month = Number(card.dueDay || 5) <= Number(card.closingDay || 25) ? addMonths(cycleMonth, 1) : cycleMonth; return `${month}-${String(card.dueDay || 5).padStart(2, "0")}`; };

Deno.serve(async (request) => {
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) return json({ error: "unauthorized" }, 401);
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID"), authToken = Deno.env.get("TWILIO_AUTH_TOKEN"), fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
    if (!accountSid || !authToken || !fromNumber) return json({ error: "Twilio ainda não configurada" }, 503);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profiles, error } = await supabase.from("profiles").select("id,phone").eq("sms_enabled", true).not("phone", "is", null);
    if (error) return json({ error: error.message }, 500);
    const today = localToday(), currentMonth = today.slice(0, 7); let sent = 0;
    for (const profile of profiles || []) {
        const { data } = await supabase.from("finance_data").select("payload").eq("user_id", profile.id).maybeSingle();
        const payload = data?.payload || {}, cards = (payload.accounts || []).filter((account: any) => account.type === "card"), transactions = payload.transactions || [];
        for (const card of cards) {
            const candidates = [addMonths(currentMonth, -1), currentMonth, addMonths(currentMonth, 1)];
            const cycleItems = (cycle: string) => transactions.filter((item: any) => item.type === "expense" && item.accountId === card.id && item.date && invoiceMonthFor(item, card) === cycle);
            const events: Array<{ type: string; message: string }> = [];
            if (Number(today.slice(8, 10)) === Number(card.closingDay || 25)) {
                const total = cycleItems(currentMonth).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
                events.push({ type: `closing-${currentMonth}`, message: `Gastos Financeiros: a fatura do cartão ${card.name} fechou em ${money(total)}. Vencimento em ${new Intl.DateTimeFormat("pt-BR").format(new Date(`${dueDateFor(currentMonth, card)}T12:00:00Z`))}.` });
            }
            for (const cycle of candidates) {
                const dueDate = dueDateFor(cycle, card), remaining = daysBetween(today, dueDate); if (![3, 1, 0].includes(remaining)) continue;
                const total = cycleItems(cycle).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
                events.push({ type: `due-${remaining}-${cycle}`, message: `Gastos Financeiros: sua fatura ${card.name} de ${money(total)} ${remaining === 0 ? "vence hoje" : `vence em ${remaining} dia(s)`}.` });
            }
            for (const event of events) {
                const { data: prior } = await supabase.from("sms_logs").select("id").eq("user_id", profile.id).eq("card_id", card.id).eq("event_type", event.type).eq("event_date", today).maybeSingle();
                if (prior) continue;
                const form = new URLSearchParams({ To: profile.phone, From: fromNumber, Body: event.message });
                const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, { method: "POST", headers: { authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`, "content-type": "application/x-www-form-urlencoded" }, body: form });
                const result = await response.json(); if (!response.ok) continue;
                await supabase.from("sms_logs").insert({ user_id: profile.id, card_id: card.id, event_type: event.type, event_date: today, message_sid: result.sid }); sent++;
            }
        }
    }
    return json({ ok: true, sent });
});
