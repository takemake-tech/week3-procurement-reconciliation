import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const email = (id, at, from, to, subject, body, type = "person") => ({ id, at, from, to, subject, body, type });
const message = (id, at, author, text, type = "person") => ({ id, at, author, text, type });

const emails = [
  email("E01", "2026-09-22T09:10:00+03:00", "factory-bottle@yunhe.test", "buyer@takemake.test", "PO-CN-2608: бутылки", "Подтверждаем условия по термобутылкам.\n[PO_LINE] po=PO-CN-2608 sku=TM-BTL-750-SAND qty=600 unit_cny=18 volume_m3=8"),
  email("E02", "2026-09-22T10:20:00+03:00", "factory-organizer@ningbo.test", "buyer@takemake.test", "PO-CN-2608: органайзеры", "Подтверждаем условия по органайзерам.\n[PO_LINE] po=PO-CN-2608 sku=TM-ORG-3-GREY qty=400 unit_cny=22 volume_m3=6"),
  email("E03", "2026-09-23T11:00:00+03:00", "buyer@takemake.test", "procurement@takemake.test", "Дополнительные услуги по PO-CN-2608", "Разбивка по услугам согласована с фабриками.\n[SERVICE] po=PO-CN-2608 sku=TM-BTL-750-SAND type=labels amount_cny=720 status=confirmed\n[SERVICE] po=PO-CN-2608 sku=TM-ORG-3-GREY type=labels amount_cny=360 status=confirmed"),
  email("E04", "2026-09-24T15:20:00+03:00", "finance@takemake.test", "procurement@takemake.test", "Статус PI-2608", "По проформе нет третьего платежа: фактические исполнения и курсы коллеги зафиксировали в рабочем чате."),
  email("E05", "2026-09-25T09:30:00+03:00", "buyer@takemake.test", "procurement@takemake.test", "Packing list PO-CN-2608", "Фабрики передали packing list.\n[SHIPMENT] shipment=SH-2608 sku=TM-BTL-750-SAND qty=600 status=confirmed\n[SHIPMENT] shipment=SH-2608 sku=TM-ORG-3-GREY qty=400 status=confirmed"),
  email("E06", "2026-09-25T12:00:00+03:00", "buyer@takemake.test", "procurement@takemake.test", "Упаковка и услуга байера", "Услуги по PO-CN-2608.\n[SERVICE] po=PO-CN-2608 sku=TM-BTL-750-SAND type=packing amount_cny=480 status=confirmed\n[SERVICE] po=PO-CN-2608 sku=TM-ORG-3-GREY type=packing amount_cny=200 status=confirmed\n[SERVICE] po=PO-CN-2608 sku=TM-BTL-750-SAND type=buyer amount_cny=600 status=confirmed\n[SERVICE] po=PO-CN-2608 sku=TM-ORG-3-GREY type=buyer amount_cny=400 status=confirmed"),
  email("E07", "2026-09-28T13:20:00+03:00", "forwarder@skybridge.test", "logistics@takemake.test", "Международная доставка PO-CN-2608", "SkyBridge направил расчёт в рабочий чат: там зафиксировано фактическое банковское списание по перевозке."),
  email("E08", "2026-10-01T10:30:00+03:00", "broker@customsline.test", "logistics@takemake.test", "CU-2608: таможня и брокер", "Счёт за таможенное оформление и брокера.\n[COST] doc=CU-2608 stage=customs amount_rub=49000 allocation=goods_value status=confirmed"),
  email("E09", "2026-10-08T16:10:00+03:00", "prep@prepport.test", "procurement@takemake.test", "PC-2608: услуги приёмки", "Счёт prep-center за приёмку, маркировку и размещение.\n[COST] doc=PC-2608 stage=fulfillment amount_rub=18000 allocation=ordered_qty status=confirmed"),
  email("E10", "2026-10-10T14:20:00+03:00", "prep@prepport.test", "procurement@takemake.test", "Акт приёмки RC-2608", "Подписанный акт фактической приёмки.\n[RECEIPT] receipt=RC-2608 sku=TM-BTL-750-SAND physical=600 saleable=594 quarantine=6 status=observed\n[RECEIPT] receipt=RC-2608 sku=TM-ORG-3-GREY physical=398 saleable=398 quarantine=0 status=observed"),
  email("E11", "2026-10-11T08:40:00+03:00", "prep@prepport.test", "procurement@takemake.test", "Смета на переэтикетировку", "Шесть бутылок можно переэтикетировать.\n[COST] doc=PC-RL-2608 stage=fulfillment amount_rub=2400 allocation=ordered_qty status=unapproved\n[ACTION] action=ACT-RELABEL category=today recipient=PrepPort due=2026-10-12T16:00:00+03:00 status=open title=approve_relabeling"),
  email("E12", "2026-10-11T09:10:00+03:00", "prep@prepport.test", "procurement@takemake.test", "Детальный акт и фото коробов", "Подписанный детальный акт должен был быть передан вчера, но его нет.\n[ACTION] action=ACT-RECEIPT-ACT category=overdue recipient=PrepPort due=2026-10-10T18:00:00+03:00 status=open title=request_signed_receipt_act"),
  email("E13", "2026-10-06T12:30:00+03:00", "buyer@takemake.test", "procurement@takemake.test", "Недостача органайзеров", "Байер должен вернуться с суммой и кредит-нотой."),
  email("E14", "2026-10-09T17:15:00+03:00", "broker@customsline.test", "procurement@takemake.test", "Таможенный счёт: требуется подтверждение", "Нужно срочно подтвердить счёт CU-2608.\n[ACTION] action=ACT-CUSTOMS category=today recipient=CustomsLine due=2026-10-12T12:00:00+03:00 status=open title=confirm_customs_invoice"),
  email("E15", "2026-10-07T09:00:00+03:00", "procurement@takemake.test", "team@takemake.test", "Сверка PO-CN-2608", "Сверка поставки назначена на 13.10 в 10:00.\n[MEETING] action=MEET-RECON recipient=Procurement due=2026-10-13T10:00:00+03:00 status=open title=reconcile_shipment"),
  email("E16", "2026-10-10T16:00:00+03:00", "procurement@takemake.test", "team@takemake.test", "Перенос сверки PO-CN-2608", "Подтверждаю перенос: новый слот сверки 15.10 в 15:00.\n[MEETING] action=MEET-RECON recipient=Procurement due=2026-10-15T15:00:00+03:00 status=open title=reconcile_shipment")
];

const chats = [
  message("C01", "2026-09-24T15:45:00+03:00", "Иван, байер", "По PO-CN-2608 банк закрыл первый транш. PAY-2608-A — 14 000 CNY, списано 23.09 по курсу 12,40 ₽ за CNY. Деньги дошли до фабрик."),
  message("C02", "2026-09-24T15:50:00+03:00", "Финансы", "Вторая часть по PO-CN-2608: PAY-2608-B — 8 360 CNY, списано 24.09 по курсу 12,70 ₽ за CNY. В назначении указана PI-2608."),
  message("C03", "2026-09-26T10:05:00+03:00", "Иван, байер", "Повторно пересылаю PAY-2608-A: это тот же первый транш, нового списания нет."),
  message("C04", "2026-09-29T13:50:00+03:00", "Логист SkyBridge", "Груз PO-CN-2608 принят на магистраль, маршрут фабрика → Китайский склад → РФ."),
  message("C05", "2026-10-09T17:30:00+03:00", "Брокер CustomsLine", "По CU-2608 ждём подтверждения оплаты."),
  message("C06", "2026-10-10T11:20:00+03:00", "Брокер CustomsLine", "CU-2608 оплачен, декларация выпущена.\n[ACTION] action=ACT-CUSTOMS category=today recipient=CustomsLine due=2026-10-12T12:00:00+03:00 status=closed title=confirm_customs_invoice"),
  message("C07", "2026-10-10T12:10:00+03:00", "PrepPort", "Предварительно вижу 600 бутылок и 398 органайзеров, подписанный акт готовим."),
  message("C08", "2026-10-10T14:25:00+03:00", "PrepPort", "Финальная сверка совпадает с актом RC-2608: бутылки физически 600, органайзеры 398."),
  message("C09", "2026-10-10T14:35:00+03:00", "PrepPort", "Шесть бутылок не продаём: маркировка повреждена, оставили в карантине."),
  message("C10", "2026-10-10T15:10:00+03:00", "Иван, байер", "Фабрика вроде бы компенсирует два органайзера в следующем заказе, но кредит-ноты пока нет.\n[CLAIM] claim=CL-ORG-2608 sku=TM-ORG-3-GREY qty=2 status=self_reported"),
  message("C11", "2026-10-11T08:42:00+03:00", "PrepPort", "Переэтикетировка шести бутылок стоит 2 400 ₽; ждём решения до 16:00 12.10."),
  message("C12", "2026-10-11T09:15:00+03:00", "PrepPort", "Подписанный детальный акт и фото коробов ещё не отправили, проверяем архив."),
  message("C13", "2026-10-07T09:00:00+03:00", "Анна, закупки", "Сверка поставки назначена на 13.10 в 10:00; ждём подтверждение письмом."),
  message("C14", "2026-10-10T16:00:00+03:00", "Анна, закупки", "Перенос увидели, ориентируемся на подтверждение из почты."),
  message("C15", "2026-10-11T10:10:00+03:00", "Логист SkyBridge", "По PO-CN-2608 счёт FR-2608 за международный участок: $ 900, списано 29.09 по курсу 92,40 ₽ за USD. Делим по объёму; новой услуги нет."),
  message("C16", "2026-10-06T13:00:00+03:00", "Иван, байер", "Разберусь с недостачей к концу следующей недели.\n[ACTION] action=ACT-CLAIM category=waiting recipient=Buyer due=next_week_friday status=open title=request_credit_note"),
  message("C17", "2026-10-11T10:30:00+03:00", "Анна, закупки", "В плане оставить отдельно: физический приход, карантин и доступный остаток — это не одно и то же."),
  message("C18", "2026-10-11T11:00:00+03:00", "Бот SkyBridge", "Автоуведомление: маршрут SH-2608 обновлён.", "bot"),
  message("C19", "2026-10-11T11:30:00+03:00", "Финансы", "Себестоимость не уменьшаем на обещание без кредит-ноты."),
  message("C20", "2026-10-11T12:00:00+03:00", "Анна, закупки", "Нужна только подтверждённая стоимость по документам.")
];

const emailFiller = Array.from({ length: 40 - emails.length }, (_, index) => {
  const number = index + emails.length + 1;
  const type = index % 5 === 0 ? "newsletter" : "person";
  return email(
    "E" + String(number).padStart(2, "0"),
    "2026-10-" + String(1 + (index % 11)).padStart(2, "0") + "T" + String(8 + (index % 8)).padStart(2, "0") + ":00:00+03:00",
    type === "newsletter" ? "digest@takemake.test" : "colleague@takemake.test",
    "procurement@takemake.test",
    type === "newsletter" ? "Автоматическая рассылка" : "Рабочее уточнение",
    type === "newsletter" ? "Дайджест без персонального действия." : "Короткое обсуждение без нового обязательства.",
    type
  );
});

const chatFiller = Array.from({ length: 80 - chats.length }, (_, index) => {
  const number = index + chats.length + 1;
  const type = index % 7 === 0 ? "bot" : "person";
  return message(
    "C" + String(number).padStart(2, "0"),
    "2026-10-" + String(1 + (index % 11)).padStart(2, "0") + "T" + String(9 + (index % 8)).padStart(2, "0") + ":15:00+03:00",
    type === "bot" ? "Служебный бот" : "Команда закупок",
    type === "bot" ? "Автоуведомление без действия." : "Контекстное сообщение без отдельного решения.",
    type
  );
});

const manifest = {
  case_id: "PO-CN-2608-synthetic",
  reference_day: "2026-10-12",
  time_zone: "Europe/Moscow",
  utc_offset: "+03:00",
  relative_due_rule: "Фраза «к концу следующей недели» означает пятницу следующей рабочей недели в 18:00 по МСК."
};

await mkdir(dataDir, { recursive: true });
await Promise.all([
  writeFile(path.join(dataDir, "inbox.json"), JSON.stringify([...emails, ...emailFiller], null, 2) + "\n", "utf8"),
  writeFile(path.join(dataDir, "chat.json"), JSON.stringify([...chats, ...chatFiller], null, 2) + "\n", "utf8"),
  writeFile(path.join(dataDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")
]);

console.log(JSON.stringify({ generated: true, emails: emails.length + emailFiller.length, chat_messages: chats.length + chatFiller.length }));
