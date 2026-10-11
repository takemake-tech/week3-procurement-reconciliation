import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureInput = path.join(root, "tests", "external-fixture");
const builder = path.join(root, "scripts", "build-reconciliation.mjs");
const execFile = promisify(execFileCallback);
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const digest = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");
const checks = [];
const check = (id, passed, detail) => checks.push({ id, passed, detail });
const primaryArtifacts = [
  "data/inbox.json",
  "data/chat.json",
  "data/manifest.json",
  "output/procurement-ledger.json",
  "output/procurement-reconciliation.md",
  "output/day1-plan.md"
];
const primaryBefore = new Map(await Promise.all(primaryArtifacts.map(async (relative) => [
  relative,
  await digest(path.join(root, relative))
])));
const temporaryOutput = await mkdtemp(path.join(tmpdir(), "week3-procurement-external-"));

try {
  await execFile(process.execPath, [builder, "--input", fixtureInput, "--output", temporaryOutput], {
    cwd: root
  });
  const ledger = await readJson(path.join(temporaryOutput, "procurement-ledger.json"));
  const reconciliation = await readFile(path.join(temporaryOutput, "procurement-reconciliation.md"), "utf8");
  const lineFor = (sku) => ledger.lines.find((line) => line.sku === sku);
  const allRefs = [
    ...ledger.lines.flatMap((line) => line.sources),
    ...ledger.plan.flatMap((item) => item.sources),
    ...ledger.claims.flatMap((claim) => claim.sources),
    ...ledger.excluded.map((entry) => entry.source),
    ...ledger.unclassified.map((entry) => entry.source)
  ];
  const kettle = lineFor("KETTLE-TRAVEL-ORANGE");
  const storage = lineFor("STORAGE-CUBE-LILAC");
  const reopenedCreditNote = ledger.plan.find((item) => item.id === "ACT-CREDIT-2711");
  const relativePromise = ledger.plan.find((item) => item.id === "ACT-CLAIM-2711");
  const duplicatePayment = ledger.duplicate_documents.find((item) => item.document_id === "PAY-QD-2711-A");
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

  check(
    "independent-identifiers",
    ledger.case_id === "PO-QD-2711-independent-fixture" &&
      ledger.input.po_id === "PO-QD-2711" &&
      ledger.lines.length === 2 &&
      ledger.lines.every((line) => ["KETTLE-TRAVEL-ORANGE", "STORAGE-CUBE-LILAC"].includes(line.sku)) &&
      !JSON.stringify(ledger).includes("PO-CN-2608"),
    "Построитель прочитал PO-QD-2711 и два новых SKU; идентификаторы основного сценария не попали в результат."
  );
  check(
    "different-numbers-and-allocation",
      ledger.payment.confirmed_cny === 4055 &&
      ledger.payment.confirmed_rub_kopecks === 4806550 &&
      ledger.cost_totals_rub_kopecks.total === 9505550 &&
      kettle &&
      kettle.total_landed_rub_kopecks === 5791041 &&
      kettle.unit_landed_rub === "782.57" &&
      storage &&
      storage.total_landed_rub_kopecks === 3714509 &&
      storage.unit_landed_rub === "290.20",
    "Другие CNY-курсы по датам, USD-фрахт, объём и правила распределения дают независимые итоги 95 055,50 ₽."
  );
  check(
    "per-event-currency-rates",
    conversions.length === 3 &&
      conversionMatches({ document_id: "PAY-QD-2711-A", kind: "payment", stage: "china", currency: "CNY", amount: 2000, fx_rub_per_unit: 11.6, rate_at: "2027-10-20", rub_kopecks: 2320000, source_id: "EXT-C01" }) &&
      conversionMatches({ document_id: "PAY-QD-2711-B", kind: "payment", stage: "china", currency: "CNY", amount: 2055, fx_rub_per_unit: 12.1, rate_at: "2027-10-21", rub_kopecks: 2486550, source_id: "EXT-C06" }) &&
      conversionMatches({ document_id: "FR-QD-2711", kind: "cost", stage: "freight", currency: "USD", amount: 300, fx_rub_per_unit: 79.3, rate_at: "2027-10-29", rub_kopecks: 2379000, source_id: "EXT-C08" }) &&
      ledger.payment.confirmed_rub_kopecks !== 4805175,
    "Внешний набор требует считать каждую CNY-строку и USD-фрахт по собственному курсу; простой средний курс CNY дал бы неверные 48 051,75 ₽."
  );
  check(
    "quantities-and-unapproved-cost",
    kettle &&
      kettle.ordered_qty === 75 &&
      kettle.physical_qty === 75 &&
      kettle.quarantine_qty === 1 &&
      kettle.saleable_qty === 74 &&
      kettle.shortage_qty === 0 &&
      storage &&
      storage.ordered_qty === 130 &&
      storage.physical_qty === 128 &&
      storage.shortage_qty === 2 &&
      ledger.unapproved_costs.some((cost) => cost.document_id === "QC-QD-2711" && cost.amount_rub_kopecks === 95000) &&
      ledger.cost_totals_rub_kopecks.total !== 9600550,
    "Карантин не превращён в недостачу, а неутверждённые 950,00 ₽ не вошли в себестоимость."
  );
  check(
    "document-deduplication",
      ledger.payment.documents.length === 2 &&
      duplicatePayment &&
      new Set(duplicatePayment.sources.map((source) => source.id)).size === 2 &&
      duplicatePayment.sources.some((source) => source.id === "EXT-C01") &&
      duplicatePayment.sources.some((source) => source.id === "EXT-C07"),
    "Повторное сообщение о первом транше не создаёт третьего платежа: учтены только два банковских документа."
  );
  check(
    "latest-event-and-relative-deadline",
    reopenedCreditNote &&
      reopenedCreditNote.bucket === "overdue" &&
      reopenedCreditNote.due_at === "2027-11-03T18:00:00+03:00" &&
      reopenedCreditNote.sources.some((source) => source.id === "EXT-E10") &&
      reopenedCreditNote.sources.some((source) => source.id === "EXT-C03") &&
      relativePromise &&
      relativePromise.bucket === "waiting" &&
      relativePromise.due_at === "2027-11-12T18:00:00+03:00",
    "Более позднее сообщение снова открывает кредит-ноту; относительный срок рассчитан от новой даты, а не взят из основного кейса."
  );
  check(
    "source-bound-output",
    allRefs.length > 0 &&
      allRefs.every((source) => source.id.startsWith("EXT-") && /^sources\/(inbox|chat)\.md#ext-[ec]\d+$/u.test(source.link)) &&
      reconciliation.includes("PO-QD-2711"),
    "В выходе используются только источники независимого набора и его локальные ссылки."
  );

  const primaryAfter = new Map(await Promise.all(primaryArtifacts.map(async (relative) => [
    relative,
    await digest(path.join(root, relative))
  ])));
  check(
    "primary-artifacts-unchanged",
    primaryArtifacts.every((relative) => primaryBefore.get(relative) === primaryAfter.get(relative)),
    "Внешний прогон использовал временную папку и не изменил основные data/ или output/."
  );

  const passed = checks.every((entry) => entry.passed);
  console.log(JSON.stringify({
    passed,
    fixture: "PO-QD-2711-independent-fixture",
    demonstrates: "Построитель принимает отдельный корпус источников и рассчитывает новый PO/SKU/суммы/даты без изменения основного результата.",
    does_not_demonstrate: "Это не универсальный NLP-разбор произвольного Telegram: операционные факты заданы синтетическими маркерами, а валютные — контролируемыми естественными фразами.",
    checks
  }));
  if (!passed) process.exitCode = 1;
} finally {
  await rm(temporaryOutput, { recursive: true, force: true });
}
