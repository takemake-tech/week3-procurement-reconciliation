import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usage = [
  "Usage: node scripts/build-reconciliation.mjs [--input DIRECTORY] [--output DIRECTORY]",
  "",
  "Input directory must contain inbox.json, chat.json and manifest.json."
].join("\n");

const parseArgs = (argv) => {
  const options = { input: path.join(root, "data"), output: path.join(root, "output") };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      console.log(usage);
      process.exit(0);
    }
    if (value === "--input" || value === "--output") {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) throw new Error("Missing value after " + value);
      options[value.slice(2)] = path.resolve(next);
      index += 1;
      continue;
    }
    throw new Error("Unknown argument: " + value);
  }
  return options;
};

const options = parseArgs(process.argv.slice(2));
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const [emails, chats, manifest] = await Promise.all([
  readJson(path.join(options.input, "inbox.json")),
  readJson(path.join(options.input, "chat.json")),
  readJson(path.join(options.input, "manifest.json"))
]);

const requireField = (entry, field, kind) => {
  if (!entry || typeof entry[field] !== "string" || !entry[field].trim()) {
    throw new Error(kind + " entry has no " + field);
  }
};
const normalize = (entry, kind) => {
  requireField(entry, "id", kind);
  requireField(entry, "at", kind);
  if (Number.isNaN(Date.parse(entry.at))) throw new Error(kind + " " + entry.id + " has invalid at");
  if (kind === "email") {
    requireField(entry, "subject", kind);
    requireField(entry, "body", kind);
    return { ...entry, kind, text: entry.subject + "\n" + entry.body, author: entry.from || "Неизвестный отправитель" };
  }
  requireField(entry, "text", kind);
  return { ...entry, kind, author: entry.author || "Неизвестный автор" };
};
if (!Array.isArray(emails) || !Array.isArray(chats)) throw new Error("inbox.json and chat.json must be arrays");
if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.reference_day || "")) throw new Error("manifest.reference_day must use YYYY-MM-DD");
const sources = [...emails.map((entry) => normalize(entry, "email")), ...chats.map((entry) => normalize(entry, "chat"))]
  .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
const sourceIds = new Set(sources.map((entry) => entry.id));
if (sourceIds.size !== sources.length) throw new Error("Source IDs must be unique");

const anchorFor = (value) => String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
const sourceRef = (entry) => ({
  id: entry.id,
  at: entry.at,
  link: "sources/" + (entry.kind === "email" ? "inbox.md#" : "chat.md#") + anchorFor(entry.id)
});
const markerPattern = /\[([A-Z_]+)]\s*([^\r\n]+)/g;
const parseAttributes = (text) => Object.fromEntries(
  text.trim().split(/\s+/).filter(Boolean).map((pair) => {
    const divider = pair.indexOf("=");
    return divider === -1 ? [pair, "true"] : [pair.slice(0, divider), pair.slice(divider + 1)];
  })
);
const dateInCurrentYear = (source, dayMonth) => {
  const match = String(dayMonth || "").match(/^(\d{2})\.(\d{2})$/);
  if (!match) return source.at.slice(0, 10);
  return source.at.slice(0, 4) + "-" + match[2] + "-" + match[1];
};
const poIn = (text) => {
  const match = String(text).match(/\b(PO-[A-Z0-9-]+)\b/iu);
  return match ? match[1] : undefined;
};
const naturalFactsFor = (source) => {
  const text = String(source.text).replace(/\u00a0/g, " ");
  const po = poIn(text);
  const extracted = [];
  const duplicateSignal = /(?:дубликат|повтор(?:но|яю|ная)?|тот\s+же|та\s+же|нового\s+списания\s+нет)/iu.test(text);
  const paymentDocs = [...text.matchAll(/\b(PAY-[A-Z0-9-]+)\b/giu)].map((match) => match[1]);
  for (const doc of paymentDocs) {
    if (duplicateSignal) {
      extracted.push({ marker_type: "PAYMENT", doc, po, status: "duplicate", source });
    }
  }
  const paymentPattern = /\b(PAY-[A-Z0-9-]+)\b[\s\S]{0,140}?(\d[\d\s]*(?:[.,]\d+)?)\s*CNY\b[\s\S]{0,100}?списан[аоы]?\s+(\d{2}\.\d{2})[\s\S]{0,80}?по\s+(?:курсу\s+)?(\d+(?:[.,]\d+)?)\s*(?:₽|руб(?:\.|лей|ля)?)/giu;
  for (const match of text.matchAll(paymentPattern)) {
    extracted.push({
      marker_type: "PAYMENT",
      doc: match[1],
      po,
      amount_cny: match[2],
      currency: "CNY",
      fx: match[4],
      rate_at: dateInCurrentYear(source, match[3]),
      status: "confirmed",
      source
    });
  }
  const freightDocs = [...text.matchAll(/\b(FR-[A-Z0-9-]+)\b/giu)].map((match) => match[1]);
  for (const doc of freightDocs) {
    if (duplicateSignal) {
      extracted.push({
        marker_type: "COST",
        doc,
        stage: "freight",
        allocation: "volume",
        status: "duplicate",
        source
      });
    }
  }
  const freightPattern = /\b(FR-[A-Z0-9-]+)\b[\s\S]{0,140}?\$\s*(\d[\d\s]*(?:[.,]\d+)?)[\s\S]{0,100}?списан[аоы]?\s+(\d{2}\.\d{2})[\s\S]{0,80}?по\s+(?:курсу\s+)?(\d+(?:[.,]\d+)?)\s*(?:₽|руб(?:\.|лей|ля)?)[\s\S]{0,40}?(?:за|\/)\s*USD/giu;
  for (const match of text.matchAll(freightPattern)) {
    extracted.push({
      marker_type: "COST",
      doc: match[1],
      stage: "freight",
      amount_usd: match[2],
      currency: "USD",
      fx: match[4],
      rate_at: dateInCurrentYear(source, match[3]),
      allocation: "volume",
      status: "confirmed",
      source
    });
  }
  return extracted;
};
const facts = sources.flatMap((source) => {
  const extracted = [];
  for (const match of source.text.matchAll(markerPattern)) {
    extracted.push({ marker_type: match[1], ...parseAttributes(match[2]), source });
  }
  return [...extracted, ...naturalFactsFor(source)];
});

const selected = (markerType) => facts.filter((fact) => fact.marker_type === markerType);
const confirmed = (factsForType) => factsForType.filter((fact) => fact.status === "confirmed" || fact.status === "observed");
const decimal = (value, field) => {
  const result = Number(String(value).replace(/\u00a0/g, "").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(result)) throw new Error("Expected numeric " + field);
  return result;
};
const integer = (value, field) => decimal(value, field);
const rubToKopecks = (value) => Math.round(decimal(value, "amount_rub") * 100);
const cnyToKopecks = (amountCny, fx) => Math.round(decimal(amountCny, "amount_cny") * decimal(fx, "fx") * 100);
const currencyFor = (fact) => {
  if (fact.currency) return String(fact.currency).toUpperCase();
  if (fact.amount_usd !== undefined) return "USD";
  if (fact.amount_cny !== undefined) return "CNY";
  return "RUB";
};
const amountFor = (fact, currency = currencyFor(fact)) => {
  const field = currency === "USD" ? "amount_usd" : currency === "CNY" ? "amount_cny" : "amount_rub";
  return decimal(fact[field], field);
};
const fxFor = (fact) => decimal(fact.fx_rub || fact.fx, "fx");
const monetaryEvent = (fact) => {
  const currency = currencyFor(fact);
  const amount = amountFor(fact, currency);
  const fx = currency === "RUB" ? null : fxFor(fact);
  return {
    document_id: fact.doc,
    currency,
    amount,
    fx_rub_per_unit: fx,
    rate_at: fact.rate_at || fact.source.at,
    rub_kopecks: currency === "RUB" ? rubToKopecks(amount) : Math.round(amount * fx * 100),
    source: sourceRef(fact.source)
  };
};
const uniqueBy = (items, key) => {
  const map = new Map();
  for (const item of items) {
    const value = typeof key === "function" ? key(item) : item[key];
    if (!map.has(value)) map.set(value, item);
  }
  return [...map.values()];
};
const sourceRefsFor = (items) => uniqueBy(items.map((item) => sourceRef(item.source)), "id");
const formatRub = (kopecks) => {
  const rubles = Math.trunc(kopecks / 100);
  const remainder = String(Math.abs(kopecks % 100)).padStart(2, "0");
  return new Intl.NumberFormat("ru-RU").format(rubles) + "," + remainder + " ₽";
};
const formatUnit = (kopecks, quantity) => (kopecks / quantity / 100).toFixed(2);
const referenceDay = manifest.reference_day;
const offset = manifest.utc_offset || "+03:00";
const datePart = (value) => String(value).slice(0, 10);
const compareDay = (left, right) => datePart(left).localeCompare(datePart(right));
const nextWeekFriday = (sourceAt) => {
  const [year, month, day] = sourceAt.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const mondayIndex = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() + (7 - mondayIndex) + 4);
  return date.toISOString().slice(0, 10) + "T18:00:00" + offset;
};
const dueFor = (fact) => fact.due === "next_week_friday" ? nextWeekFriday(fact.source.at) : fact.due;

const poLines = selected("PO_LINE").map((fact) => ({
  po_id: fact.po,
  sku: fact.sku,
  ordered_qty: integer(fact.qty, "qty"),
  unit_cny: integer(fact.unit_cny, "unit_cny"),
  volume_m3: integer(fact.volume_m3, "volume_m3"),
  sources: [fact]
}));
if (poLines.length === 0) throw new Error("No PO_LINE facts found");
const poId = poLines[0].po_id;
if (poLines.some((line) => line.po_id !== poId)) throw new Error("This compact fixture supports one PO at a time");
const poLineBySku = new Map(poLines.map((line) => [line.sku, line]));

const paymentFacts = selected("PAYMENT");
const paymentDocuments = uniqueBy(paymentFacts.filter((fact) => fact.status === "confirmed"), "doc");
const paymentEvents = paymentDocuments.map(monetaryEvent);
const chinaPaymentEvents = paymentEvents.filter((event) => event.currency === "CNY");
const paymentCny = chinaPaymentEvents.reduce((sum, event) => sum + event.amount, 0);
const paymentRubKopecks = chinaPaymentEvents.reduce((sum, event) => sum + event.rub_kopecks, 0);
const services = selected("SERVICE");
const confirmedServices = services.filter((fact) => fact.status === "confirmed");
const serviceCnyBySku = new Map(poLines.map((line) => [line.sku, 0]));
for (const service of confirmedServices) {
  if (!serviceCnyBySku.has(service.sku)) throw new Error("Service references unknown SKU " + service.sku);
  serviceCnyBySku.set(service.sku, serviceCnyBySku.get(service.sku) + integer(service.amount_cny, "amount_cny"));
}
const factoryGoodsCny = poLines.reduce((sum, line) => sum + line.ordered_qty * line.unit_cny, 0);
const serviceCny = [...serviceCnyBySku.values()].reduce((sum, value) => sum + value, 0);
const expectedChinaCny = factoryGoodsCny + serviceCny;

const shipmentFacts = confirmed(selected("SHIPMENT"));
const shipmentBySku = new Map();
for (const fact of shipmentFacts) shipmentBySku.set(fact.sku, fact);
const receiptFacts = confirmed(selected("RECEIPT"));
const receiptBySku = new Map();
for (const fact of receiptFacts) {
  const previous = receiptBySku.get(fact.sku);
  if (!previous || Date.parse(fact.source.at) > Date.parse(previous.source.at)) receiptBySku.set(fact.sku, fact);
}

const costFacts = selected("COST");
const costDocuments = uniqueBy(costFacts.filter((fact) => fact.status === "confirmed"), "doc");
const costEvents = costDocuments.map(monetaryEvent);
const unapprovedCosts = costFacts.filter((fact) => fact.status === "unapproved");
const duplicateDocuments = facts
  .filter((fact) => fact.status === "duplicate" && fact.doc)
  .map((fact) => ({
    document_id: fact.doc,
    kind: fact.marker_type,
    sources: sourceRefsFor(facts.filter((candidate) => candidate.doc === fact.doc && (candidate.status === "confirmed" || candidate.status === "duplicate"))),
    reason: "Повторная ссылка на уже учтённый документ."
  }));
const allocationBase = (line, rule) => {
  if (rule === "volume") return line.volume_m3;
  if (rule === "goods_value") return line.ordered_qty * line.unit_cny;
  if (rule === "ordered_qty") return line.ordered_qty;
  return null;
};
const allocateByValues = (amount, values) => {
  const total = values.reduce((sum, entry) => sum + entry.value, 0);
  if (total <= 0) return null;
  let assigned = 0;
  const result = new Map();
  values.forEach((entry, index) => {
    const value = index === values.length - 1 ? amount - assigned : Math.round(amount * entry.value / total);
    assigned += value;
    result.set(entry.line.sku, value);
  });
  return result;
};
const allocate = (amount, rule) => {
  const bases = poLines.map((line) => ({ line, value: allocationBase(line, rule) }));
  if (bases.some((entry) => entry.value === null)) return null;
  return allocateByValues(amount, bases);
};
const stageCosts = new Map(poLines.map((line) => [line.sku, {
  china: 0,
  freight: 0,
  customs: 0,
  fulfillment: 0,
  sources: []
}]));
const lineFacts = new Map(poLines.map((line) => [line.sku, [...line.sources]]));
const chinaPaymentAllocation = allocateByValues(
  paymentRubKopecks,
  poLines.map((line) => ({
    line,
    value: line.ordered_qty * line.unit_cny + serviceCnyBySku.get(line.sku)
  }))
);
for (const line of poLines) {
  const chinaKopecks = chinaPaymentAllocation ? chinaPaymentAllocation.get(line.sku) : 0;
  stageCosts.get(line.sku).china += chinaKopecks;
  stageCosts.get(line.sku).sources.push(...paymentDocuments, ...confirmedServices.filter((fact) => fact.sku === line.sku));
  lineFacts.get(line.sku).push(...paymentDocuments, ...confirmedServices.filter((fact) => fact.sku === line.sku));
}
const allocationExceptions = [];
for (const cost of costDocuments) {
  const amount = monetaryEvent(cost).rub_kopecks;
  const split = allocate(amount, cost.allocation);
  if (!split) {
    allocationExceptions.push({
      type: "unallocated_cost",
      title: "Расход " + cost.doc + " не распределён: неизвестное правило " + cost.allocation,
      source: sourceRef(cost.source)
    });
    continue;
  }
  for (const [sku, amountForSku] of split.entries()) {
    if (!stageCosts.get(sku)[cost.stage]) stageCosts.get(sku)[cost.stage] = 0;
    stageCosts.get(sku)[cost.stage] += amountForSku;
    stageCosts.get(sku).sources.push(cost);
    lineFacts.get(sku).push(cost);
  }
}

const claims = selected("CLAIM").map((fact) => ({
  claim_id: fact.claim,
  sku: fact.sku,
  quantity: integer(fact.qty, "qty"),
  status: fact.status,
  sources: [sourceRef(fact.source)],
  title: fact.status === "confirmed" ? "Подтверждённая компенсация" : "Обещание компенсации без кредит-ноты"
}));
const lines = poLines.map((line) => {
  const shipment = shipmentBySku.get(line.sku);
  const receipt = receiptBySku.get(line.sku);
  const physical = receipt ? integer(receipt.physical, "physical") : 0;
  const saleable = receipt ? integer(receipt.saleable, "saleable") : 0;
  const quarantine = receipt ? integer(receipt.quarantine, "quarantine") : 0;
  const shipped = shipment ? integer(shipment.qty, "qty") : 0;
  const paid = paymentCny >= expectedChinaCny ? line.ordered_qty : 0;
  const shortage = Math.max(0, line.ordered_qty - physical);
  const costs = stageCosts.get(line.sku);
  const total = costs.china + costs.freight + costs.customs + costs.fulfillment;
  const allFactsForLine = uniqueBy([...lineFacts.get(line.sku), ...(shipment ? [shipment] : []), ...(receipt ? [receipt] : [])], (fact) => fact.source.id + ":" + fact.type + ":" + (fact.doc || fact.sku || ""));
  return {
    sku: line.sku,
    ordered_qty: line.ordered_qty,
    paid_qty: paid,
    shipped_qty: shipped,
    physical_qty: physical,
    saleable_qty: saleable,
    quarantine_qty: quarantine,
    shortage_qty: shortage,
    stage_costs_rub_kopecks: {
      china: costs.china,
      freight: costs.freight,
      customs: costs.customs,
      fulfillment: costs.fulfillment
    },
    total_landed_rub_kopecks: total,
    unit_landed_rub: saleable > 0 ? formatUnit(total, saleable) : null,
    sources: sourceRefsFor(allFactsForLine)
  };
});

const actionFacts = [...selected("ACTION"), ...selected("MEETING")];
const actionsById = new Map();
for (const fact of actionFacts.sort((left, right) => Date.parse(left.source.at) - Date.parse(right.source.at))) {
  if (!actionsById.has(fact.action)) actionsById.set(fact.action, []);
  actionsById.get(fact.action).push(fact);
}
const titleForAction = (value) => ({
  approve_relabeling: "Согласовать переэтикетировку шести бутылок",
  request_signed_receipt_act: "Запросить подписанный детальный акт и фото коробов",
  request_credit_note: "Получить сумму и кредит-ноту по недостаче органайзеров",
  confirm_customs_invoice: "Подтвердить таможенный счёт",
  reconcile_shipment: "Провести сверку поставки"
})[value] || String(value).replaceAll("_", " ");
const recipientForAction = (value) => ({
  PrepPort: "PrepPort",
  Buyer: "Иван, байер",
  CustomsLine: "CustomsLine",
  Procurement: "Команда закупок"
})[value] || value || "Нужно уточнить адресата";
const bucketFor = (fact) => {
  if (fact.status === "closed") return "resolved";
  if (fact.category) return fact.category;
  const due = dueFor(fact);
  if (!due) return "waiting";
  const relation = compareDay(due, referenceDay);
  if (relation < 0) return "overdue";
  if (relation === 0) return "today";
  return "waiting";
};
const actionItems = [...actionsById.entries()].map(([actionId, actionEvents]) => {
  const latest = actionEvents.at(-1);
  const due = dueFor(latest);
  const bucket = bucketFor(latest);
  const title = titleForAction(latest.title);
  const recipient = recipientForAction(latest.recipient);
  const draft = bucket === "resolved"
    ? "Фиксируем, что «" + title + "» закрыт подтверждённым сообщением.\nВнешнее действие не требуется, если не появится новое расхождение."
    : "Здравствуйте! По теме «" + title + "» нужен следующий шаг до " + (due || "уточнения срока") + ".\nПожалуйста, подтвердите действие и пришлите документ или статус в ответ.";
  return {
    id: actionId,
    bucket,
    title,
    recipient,
    due_at: due,
    due: bucket === "resolved" ? "Решено без действия" : due || "Срок не указан",
    sources: sourceRefsFor(actionEvents),
    draft
  };
});
const priority = { today: 0, overdue: 1, waiting: 2, resolved: 3 };
actionItems.sort((left, right) => {
  const bucketDifference = priority[left.bucket] - priority[right.bucket];
  return bucketDifference || String(left.due_at || "9999").localeCompare(String(right.due_at || "9999"));
});

const excluded = sources.filter((source) => source.type === "bot" || source.type === "newsletter").map((source) => ({
  source: sourceRef(source),
  reason: "Автоматическое уведомление или рассылка без персонального действия."
}));
const factSourceIds = new Set(facts.map((fact) => fact.source.id));
const unclassified = sources.filter((source) => source.type !== "bot" && source.type !== "newsletter" && !factSourceIds.has(source.id)).map((source) => ({
  source: sourceRef(source),
  reason: "Нет явного операционного факта; сохранено для ручной проверки."
}));

const totalLanded = lines.reduce((sum, line) => sum + line.total_landed_rub_kopecks, 0);
const confirmedCostByStage = {
  china: lines.reduce((sum, line) => sum + line.stage_costs_rub_kopecks.china, 0),
  freight: lines.reduce((sum, line) => sum + line.stage_costs_rub_kopecks.freight, 0),
  customs: lines.reduce((sum, line) => sum + line.stage_costs_rub_kopecks.customs, 0),
  fulfillment: lines.reduce((sum, line) => sum + line.stage_costs_rub_kopecks.fulfillment, 0)
};
const exceptions = [
  ...claims.filter((claim) => claim.status !== "confirmed").map((claim) => ({
    type: "unconfirmed_claim",
    title: claim.title + ": " + claim.sku + ", " + claim.quantity + " шт.",
    sources: claim.sources
  })),
  ...unapprovedCosts.map((cost) => ({
    type: "unapproved_cost",
    title: "Неутверждённый расход " + cost.doc + ": " + formatRub(rubToKopecks(cost.amount_rub)),
    sources: [sourceRef(cost.source)]
  })),
  ...lines.filter((line) => line.shortage_qty > 0).map((line) => ({
    type: "shortage",
    title: "Недостача " + line.sku + ": " + line.shortage_qty + " шт.",
    sources: line.sources
  })),
  ...allocationExceptions
];
const unapprovedCostLedger = unapprovedCosts.map((cost) => ({
  document_id: cost.doc,
  stage: cost.stage,
  amount_rub_kopecks: monetaryEvent(cost).rub_kopecks,
  status: cost.status,
  sources: [sourceRef(cost.source)]
}));
const currencyConversions = [
  ...paymentEvents.filter((event) => event.currency !== "RUB").map((event) => ({
    ...event,
    kind: "payment",
    stage: "china"
  })),
  ...costDocuments.map((cost) => ({ cost, event: monetaryEvent(cost) }))
    .filter(({ event }) => event.currency !== "RUB")
    .map(({ cost, event }) => ({
      ...event,
      kind: "cost",
      stage: cost.stage
    }))
].sort((left, right) => Date.parse(left.rate_at) - Date.parse(right.rate_at));

const ledger = {
  case_id: manifest.case_id || "external-procurement",
  reference_day: referenceDay,
  input: {
    emails: emails.length,
    chat_messages: chats.length,
    time_zone: manifest.time_zone || "UTC",
    currency: "RUB",
    po_id: poId
  },
  payment: {
    confirmed_cny: paymentCny,
    confirmed_rub_kopecks: paymentRubKopecks,
    documents: chinaPaymentEvents.map((event) => ({
      id: event.document_id,
      currency: event.currency,
      amount: event.amount,
      fx_rub_per_unit: event.fx_rub_per_unit,
      rate_at: event.rate_at,
      rub_kopecks: event.rub_kopecks,
      source: event.source
    })),
    expected_china_cny: expectedChinaCny,
    status: paymentCny === expectedChinaCny ? "reconciled" : "mismatch"
  },
  currency_conversions: currencyConversions,
  cost_totals_rub_kopecks: {
    ...confirmedCostByStage,
    total: totalLanded
  },
  lines,
  claims,
  unapproved_costs: unapprovedCostLedger,
  duplicate_documents: duplicateDocuments,
  exceptions,
  plan: actionItems,
  excluded,
  unclassified
};

const escape = (value) => String(value).replaceAll("|", "\\|");
const renderEmailSources = (items) => "# Входящие письма\n\n" + items.map((item) => [
    "<a id=\"" + anchorFor(item.id) + "\"></a>",
    "### " + item.id + " · " + item.at,
    "**От:** " + escape(item.from || "") + "<br>",
    "**Кому:** " + escape(item.to || "") + "<br>",
    "**Тема:** " + escape(item.subject),
    "",
    item.body
  ].join("\n"))
  .join("\n\n");
const renderChatSources = (items) => "# Рабочий чат\n\n" + items.map((item) => [
    "<a id=\"" + anchorFor(item.id) + "\"></a>",
    "### " + item.id + " · " + item.at + " · " + escape(item.author),
    item.text
  ].join("\n"))
  .join("\n\n");
const sourceLinks = (refs) => refs.map((ref) => "[" + ref.id + "](" + ref.link + ")").join(", ");
const planLabels = {
  today: "Срочно / сегодня",
  overdue: "Просрочено",
  waiting: "Ожидает / запланировано",
  resolved: "Решено без вас"
};
const planMarkdown = [
  "# План первого дня после отпуска",
  "",
  "Синтетический кейс " + ledger.case_id + ". Дата возвращения: " + referenceDay + ".",
  "",
  ...Object.keys(planLabels).flatMap((bucket) => {
    const group = actionItems.filter((item) => item.bucket === bucket);
    return group.length === 0 ? [] : [
      "## " + planLabels[bucket],
      "",
      ...group.map((item) => [
        "### " + item.id + " · " + item.title,
        "",
        "- Срок: " + item.due,
        "- Кому написать: " + item.recipient,
        "- Источники: " + sourceLinks(item.sources),
        "- Черновик:",
        "",
        "> " + item.draft.replaceAll("\n", "\n> "),
        ""
      ].join("\n"))
    ];
  }),
  "## Исключено и требует ручной проверки",
  "",
  "Автоматических источников: " + excluded.length + ". Неразобранных сообщений: " + unclassified.length + ".",
  ""
].join("\n");
const lineRows = lines.map((line) => [
  "| " + line.sku,
  line.ordered_qty,
  line.paid_qty,
  line.shipped_qty,
  line.physical_qty,
  line.quarantine_qty,
  line.saleable_qty,
  line.shortage_qty,
  formatRub(line.total_landed_rub_kopecks),
  line.unit_landed_rub + " ₽",
  sourceLinks(line.sources) + " |"
].join(" | "));
const stageRows = lines.map((line) => [
  "| " + line.sku,
  formatRub(line.stage_costs_rub_kopecks.china),
  formatRub(line.stage_costs_rub_kopecks.freight),
  formatRub(line.stage_costs_rub_kopecks.customs),
  formatRub(line.stage_costs_rub_kopecks.fulfillment),
  "**" + formatRub(line.total_landed_rub_kopecks) + "**",
  sourceLinks(line.sources) + " |"
].join(" | "));
const duplicateRows = duplicateDocuments.length > 0
  ? duplicateDocuments.map((document) => "| " + document.document_id + " | " + document.kind + " | " + sourceLinks(document.sources) + " | " + document.reason + " |")
  : ["| Нет дублей | — | — | — |"];
const formatNative = (currency, amount) => {
  const label = currency === "USD" ? "USD" : currency;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(amount) + " " + label;
};
const currencyRows = currencyConversions.length > 0
  ? currencyConversions.map((event) => [
    "| " + event.document_id,
    event.kind === "payment" ? "Оплата Китай" : "Расход: " + event.stage,
    formatNative(event.currency, event.amount),
    new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(event.fx_rub_per_unit) + " ₽/" + event.currency,
    event.rate_at,
    formatRub(event.rub_kopecks),
    sourceLinks([event.source]) + " |"
  ].join(" | "))
  : ["| — | — | — | — | — | — | — |"];
const reconciliationMarkdown = [
  "# Сверка поставки " + poId,
  "",
  "Все суммы ниже учитывают только подтверждённые документы. Расчёты ведутся в копейках; отображение округлено до двух знаков.",
  "",
  "## Сквозная сверка по SKU",
  "",
  "| SKU | Заказано | Оплачено | Отгружено | Физически принято | Карантин | Доступно | Недостача | Накопленная себестоимость | Себестоимость доступной единицы | Доказательства |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ...lineRows,
  "",
  "## Стоимость по стадиям",
  "",
  "| Стадия | Подтверждённые расходы |",
  "| --- | ---: |",
  "| Китай: товар и услуги | " + formatRub(confirmedCostByStage.china) + " |",
  "| Международная доставка | " + formatRub(confirmedCostByStage.freight) + " |",
  "| Таможня и брокер | " + formatRub(confirmedCostByStage.customs) + " |",
  "| Prep-center | " + formatRub(confirmedCostByStage.fulfillment) + " |",
  "| **Итого** | **" + formatRub(totalLanded) + "** |",
  "",
  "## Себестоимость по стадиям и SKU",
  "",
  "| SKU | Китай: товар и услуги | Доставка | Таможня | Prep-center | Итого | Доказательства |",
  "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ...stageRows,
  "",
  "## Валютная сверка по подтверждённым документам",
  "",
  "Курсы применяются к каждому документу на дату его списания; средний курс не используется.",
  "",
  "| Документ | Тип | Исходная сумма | Курс | Дата списания | В рублях | Источник |",
  "| --- | --- | ---: | ---: | --- | ---: | --- |",
  ...currencyRows,
  "",
  "## Дубликаты, учтённые один раз",
  "",
  "| Документ | Тип | Источники | Решение |",
  "| --- | --- | --- | --- |",
  ...duplicateRows,
  "",
  "Подтверждённая китайская оплата: " + paymentCny + " CNY = " + formatRub(paymentRubKopecks) + ". Документы: " + sourceLinks(ledger.payment.documents.map((document) => document.source)) + ".",
  "",
  "## Правила",
  "",
  "- Фрахт распределён по объёму; таможня — по стоимости товара; prep-center — по заказанному количеству.",
  "- Физический приход, карантин и доступный остаток показаны отдельно.",
  "- Обещание компенсации и неутверждённая смета не уменьшают себестоимость.",
  ""
].join("\n");
const exceptionRows = exceptions.length > 0
  ? exceptions.map((entry) => "- **" + entry.type + "** — " + entry.title + " Источники: " + sourceLinks(entry.sources || [entry.source]))
  : ["Нет спорных пунктов."];
const exceptionsMarkdown = [
  "# Спорное и исключения",
  "",
  ...exceptionRows,
  ""
].join("\n");

await Promise.all([
  mkdir(options.output, { recursive: true }),
  mkdir(path.join(options.output, "sources"), { recursive: true })
]);
await Promise.all([
  writeFile(path.join(options.output, "procurement-ledger.json"), JSON.stringify(ledger, null, 2) + "\n", "utf8"),
  writeFile(path.join(options.output, "procurement-reconciliation.md"), reconciliationMarkdown, "utf8"),
  writeFile(path.join(options.output, "procurement-exceptions.md"), exceptionsMarkdown, "utf8"),
  writeFile(path.join(options.output, "day1-plan.md"), planMarkdown, "utf8"),
  writeFile(path.join(options.output, "sources", "inbox.md"), renderEmailSources(emails) + "\n", "utf8"),
  writeFile(path.join(options.output, "sources", "chat.md"), renderChatSources(chats) + "\n", "utf8")
]);

console.log(JSON.stringify({
  built: true,
  emails: emails.length,
  chat_messages: chats.length,
  po: poId,
  lines: lines.length,
  total_landed_rub_kopecks: totalLanded,
  plan_items: actionItems.length,
  exceptions: exceptions.length
}));
