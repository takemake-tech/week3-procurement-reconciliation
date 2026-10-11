import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const [emails, chats, ledger, controls, builderSource] = await Promise.all([
  readJson(path.join(root, "data", "inbox.json")),
  readJson(path.join(root, "data", "chat.json")),
  readJson(path.join(root, "output", "procurement-ledger.json")),
  readJson(path.join(root, "tests", "procurement-controls.json")),
  readFile(path.join(root, "scripts", "build-reconciliation.mjs"), "utf8")
]);

const checks = [];
const check = (id, passed, detail) => checks.push({ id, passed, detail });
const lineFor = (sku) => ledger.lines.find((line) => line.sku === sku);
const planFor = (id) => ledger.plan.find((item) => item.id === id);
const conversions = ledger.currency_conversions || [];
const conversionMatches = (expected) => conversions.some((event) =>
  event.document_id === expected.document_id &&
  event.kind === expected.kind &&
  event.stage === expected.stage &&
  event.currency === expected.currency &&
  event.amount === expected.amount &&
  event.fx_rub_per_unit === expected.fx_rub_per_unit &&
  event.rate_at === expected.rate_at &&
  event.rub_kopecks === expected.rub_kopecks &&
  event.source && event.source.id === expected.source_id
);
const allSourceRefs = [
  ...ledger.lines.flatMap((line) => line.sources),
  ...ledger.plan.flatMap((item) => item.sources),
  ...ledger.claims.flatMap((claim) => claim.sources),
  ...conversions.map((event) => event.source),
  ...ledger.excluded.map((entry) => entry.source),
  ...ledger.unclassified.map((entry) => entry.source)
];
const sourceAnchor = async (link) => {
  const match = String(link).match(/^sources\/(inbox|chat)\.md#([^#]+)$/u);
  if (!match) return false;
  const content = await readFile(path.join(root, "output", "sources", match[1] + ".md"), "utf8");
  return content.includes("<a id=\"" + match[2] + "\"></a>");
};
const anchorResults = await Promise.all(allSourceRefs.map(async (source) => ({
  id: source.id,
  valid: await sourceAnchor(source.link)
})));
const allInputIds = new Set([...emails, ...chats].map((entry) => entry.id));

check(
  "source-counts",
  emails.length === 40 && chats.length === 80 && allInputIds.size === 120,
  "Входы содержат " + emails.length + " писем, " + chats.length + " сообщений и " + allInputIds.size + " уникальных ID."
);
check(
  "control-isolation",
  !builderSource.includes("procurement-controls") && !builderSource.includes("tests/"),
  "Построитель не открывает файл контрольных фактов."
);
check(
  "source-links",
  anchorResults.every((result) => result.valid),
  "Проверено ссылок: " + anchorResults.length + "; неразрешимых: " + anchorResults.filter((result) => !result.valid).length + "."
);
check(
  "plan-quality",
  ledger.plan.every((item) => item.recipient && item.sources.length > 0 && item.draft.split("\n").filter((line) => line.trim()).length >= 2),
  "У каждой строки плана есть адресат, источник и черновик минимум из двух строк."
);

for (const fact of controls.facts || []) {
  const assertion = fact.assert || {};
  if (assertion.kind === "quantities") {
    const line = lineFor(assertion.sku);
    check(fact.id, Boolean(line) &&
      line.ordered_qty === assertion.ordered &&
      line.paid_qty === assertion.paid &&
      line.shipped_qty === assertion.shipped &&
      line.physical_qty === assertion.physical &&
      line.saleable_qty === assertion.saleable &&
      line.shortage_qty === assertion.shortage, fact.expectation);
    continue;
  }
  if (assertion.kind === "payment") {
    check(fact.id,
      ledger.payment.confirmed_cny === assertion.cny &&
      ledger.payment.confirmed_rub_kopecks === assertion.rub_kopecks &&
      ledger.payment.documents.length === assertion.documents_count,
      fact.expectation);
    continue;
  }
  if (assertion.kind === "currency_conversions") {
    const cnyEvents = conversions.filter((event) => event.kind === "payment" && event.currency === "CNY");
    const eventRubKopecks = cnyEvents.reduce((sum, event) => sum + event.rub_kopecks, 0);
    const expectedEvents = assertion.events || [];
    check(fact.id,
      ledger.payment.confirmed_cny === assertion.payment_cny &&
      ledger.payment.confirmed_rub_kopecks === assertion.payment_rub_kopecks &&
      ledger.payment.documents.length === assertion.documents_count &&
      expectedEvents.length === cnyEvents.length &&
      expectedEvents.every(conversionMatches) &&
      eventRubKopecks === assertion.payment_rub_kopecks &&
      assertion.payment_rub_kopecks !== assertion.simple_average_rub_kopecks,
      fact.expectation);
    continue;
  }
  if (assertion.kind === "cost_total") {
    const expectedFreight = assertion.freight_conversion;
    check(fact.id,
      ledger.cost_totals_rub_kopecks.total === assertion.rub_kopecks &&
      ledger.cost_totals_rub_kopecks.freight === assertion.freight_rub_kopecks &&
      (!expectedFreight || conversionMatches(expectedFreight)),
      fact.expectation);
    continue;
  }
  if (assertion.kind === "quarantine_and_unapproved") {
    const line = lineFor(assertion.sku);
    const unapproved = (ledger.unapproved_costs || []).some((cost) => cost.amount_rub_kopecks === assertion.unapproved_rub_kopecks);
    check(fact.id, Boolean(line) &&
      line.physical_qty === assertion.physical &&
      line.quarantine_qty === assertion.quarantine &&
      line.saleable_qty === assertion.saleable &&
      unapproved &&
      !ledger.cost_totals_rub_kopecks.total.toString().includes(assertion.unapproved_rub_kopecks.toString()),
      fact.expectation);
    continue;
  }
  if (assertion.kind === "claim") {
    const match = ledger.claims.some((claim) => claim.status === assertion.status && claim.sku === assertion.sku && claim.quantity === assertion.quantity);
    check(fact.id, match, fact.expectation);
    continue;
  }
  if (assertion.kind === "landed_cost") {
    const pass = Object.entries(assertion.lines).every(([sku, expected]) => {
      const line = lineFor(sku);
      return line &&
        line.total_landed_rub_kopecks === expected.total_rub_kopecks &&
        line.saleable_qty === expected.saleable &&
        line.unit_landed_rub === expected.unit_display;
    });
    check(fact.id, pass, fact.expectation);
    continue;
  }
  if (assertion.kind === "plan") {
    const resolved = planFor(assertion.resolved_action);
    const meeting = planFor("MEET-RECON");
    const meetingSources = new Set((meeting && meeting.sources || []).map((source) => source.id));
    const sourcesMatch = (assertion.meeting_source_ids || []).every((id) => meetingSources.has(id));
    check(fact.id, resolved && resolved.bucket === "resolved" && meeting && meeting.due_at === assertion.meeting_due && sourcesMatch, fact.expectation);
    continue;
  }
  if (assertion.kind === "plan_quality") {
    const action = planFor(assertion.action_id);
    const sourceMatch = !assertion.source_id || (action && action.sources.some((source) => source.id === assertion.source_id));
    check(fact.id, action && action.due_at === assertion.due && sourceMatch && action.sources.length > 0 && action.draft.split("\n").filter((line) => line.trim()).length >= 2, fact.expectation);
    continue;
  }
  if (assertion.kind === "natural_currency_sources") {
    const rawById = new Map([...emails, ...chats].map((entry) => [entry.id, entry]));
    const sourceIds = assertion.source_ids || [];
    const onlyNaturalText = sourceIds.every((id) => {
      const entry = rawById.get(id);
      const text = entry && (entry.text || entry.body || "");
      return entry && !/\[(?:PAYMENT|COST)\]/u.test(text);
    });
    const conversionSourceIds = new Set(conversions.map((event) => event.source && event.source.id));
    check(fact.id,
      sourceIds.length === 3 && onlyNaturalText && sourceIds.every((id) => conversionSourceIds.has(id)),
      fact.expectation);
    continue;
  }
  check(fact.id, false, "Неизвестный тип проверки: " + assertion.kind);
}

const passed = checks.every((entry) => entry.passed);
const report = [
  "# Проверка синтетического закупочного кейса",
  "",
  "Построитель получает только письма, чат и манифест. Эталон открыт лишь этому проверочному скрипту.",
  "",
  "| Проверка | Результат | Деталь |",
  "| --- | --- | --- |",
  ...checks.map((entry) => "| " + entry.id + " | " + (entry.passed ? "PASS" : "FAIL") + " | " + entry.detail + " |"),
  ""
].join("\n");
await writeFile(path.join(root, "output", "verification.md"), report, "utf8");
console.log(JSON.stringify({ passed, checks }));
if (!passed) process.exitCode = 1;
