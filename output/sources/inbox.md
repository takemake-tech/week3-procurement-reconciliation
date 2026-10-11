# Входящие письма

<a id="e01"></a>
### E01 · 2026-09-22T09:10:00+03:00
**От:** factory-bottle@yunhe.test<br>
**Кому:** buyer@takemake.test<br>
**Тема:** PO-CN-2608: бутылки

Подтверждаем условия по термобутылкам.
[PO_LINE] po=PO-CN-2608 sku=TM-BTL-750-SAND qty=600 unit_cny=18 volume_m3=8

<a id="e02"></a>
### E02 · 2026-09-22T10:20:00+03:00
**От:** factory-organizer@ningbo.test<br>
**Кому:** buyer@takemake.test<br>
**Тема:** PO-CN-2608: органайзеры

Подтверждаем условия по органайзерам.
[PO_LINE] po=PO-CN-2608 sku=TM-ORG-3-GREY qty=400 unit_cny=22 volume_m3=6

<a id="e03"></a>
### E03 · 2026-09-23T11:00:00+03:00
**От:** buyer@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Дополнительные услуги по PO-CN-2608

Разбивка по услугам согласована с фабриками.
[SERVICE] po=PO-CN-2608 sku=TM-BTL-750-SAND type=labels amount_cny=720 status=confirmed
[SERVICE] po=PO-CN-2608 sku=TM-ORG-3-GREY type=labels amount_cny=360 status=confirmed

<a id="e04"></a>
### E04 · 2026-09-24T15:20:00+03:00
**От:** finance@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Статус PI-2608

По проформе нет третьего платежа: фактические исполнения и курсы коллеги зафиксировали в рабочем чате.

<a id="e05"></a>
### E05 · 2026-09-25T09:30:00+03:00
**От:** buyer@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Packing list PO-CN-2608

Фабрики передали packing list.
[SHIPMENT] shipment=SH-2608 sku=TM-BTL-750-SAND qty=600 status=confirmed
[SHIPMENT] shipment=SH-2608 sku=TM-ORG-3-GREY qty=400 status=confirmed

<a id="e06"></a>
### E06 · 2026-09-25T12:00:00+03:00
**От:** buyer@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Упаковка и услуга байера

Услуги по PO-CN-2608.
[SERVICE] po=PO-CN-2608 sku=TM-BTL-750-SAND type=packing amount_cny=480 status=confirmed
[SERVICE] po=PO-CN-2608 sku=TM-ORG-3-GREY type=packing amount_cny=200 status=confirmed
[SERVICE] po=PO-CN-2608 sku=TM-BTL-750-SAND type=buyer amount_cny=600 status=confirmed
[SERVICE] po=PO-CN-2608 sku=TM-ORG-3-GREY type=buyer amount_cny=400 status=confirmed

<a id="e07"></a>
### E07 · 2026-09-28T13:20:00+03:00
**От:** forwarder@skybridge.test<br>
**Кому:** logistics@takemake.test<br>
**Тема:** Международная доставка PO-CN-2608

SkyBridge направил расчёт в рабочий чат: там зафиксировано фактическое банковское списание по перевозке.

<a id="e08"></a>
### E08 · 2026-10-01T10:30:00+03:00
**От:** broker@customsline.test<br>
**Кому:** logistics@takemake.test<br>
**Тема:** CU-2608: таможня и брокер

Счёт за таможенное оформление и брокера.
[COST] doc=CU-2608 stage=customs amount_rub=49000 allocation=goods_value status=confirmed

<a id="e09"></a>
### E09 · 2026-10-08T16:10:00+03:00
**От:** prep@prepport.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** PC-2608: услуги приёмки

Счёт prep-center за приёмку, маркировку и размещение.
[COST] doc=PC-2608 stage=fulfillment amount_rub=18000 allocation=ordered_qty status=confirmed

<a id="e10"></a>
### E10 · 2026-10-10T14:20:00+03:00
**От:** prep@prepport.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Акт приёмки RC-2608

Подписанный акт фактической приёмки.
[RECEIPT] receipt=RC-2608 sku=TM-BTL-750-SAND physical=600 saleable=594 quarantine=6 status=observed
[RECEIPT] receipt=RC-2608 sku=TM-ORG-3-GREY physical=398 saleable=398 quarantine=0 status=observed

<a id="e11"></a>
### E11 · 2026-10-11T08:40:00+03:00
**От:** prep@prepport.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Смета на переэтикетировку

Шесть бутылок можно переэтикетировать.
[COST] doc=PC-RL-2608 stage=fulfillment amount_rub=2400 allocation=ordered_qty status=unapproved
[ACTION] action=ACT-RELABEL category=today recipient=PrepPort due=2026-10-12T16:00:00+03:00 status=open title=approve_relabeling

<a id="e12"></a>
### E12 · 2026-10-11T09:10:00+03:00
**От:** prep@prepport.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Детальный акт и фото коробов

Подписанный детальный акт должен был быть передан вчера, но его нет.
[ACTION] action=ACT-RECEIPT-ACT category=overdue recipient=PrepPort due=2026-10-10T18:00:00+03:00 status=open title=request_signed_receipt_act

<a id="e13"></a>
### E13 · 2026-10-06T12:30:00+03:00
**От:** buyer@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Недостача органайзеров

Байер должен вернуться с суммой и кредит-нотой.

<a id="e14"></a>
### E14 · 2026-10-09T17:15:00+03:00
**От:** broker@customsline.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Таможенный счёт: требуется подтверждение

Нужно срочно подтвердить счёт CU-2608.
[ACTION] action=ACT-CUSTOMS category=today recipient=CustomsLine due=2026-10-12T12:00:00+03:00 status=open title=confirm_customs_invoice

<a id="e15"></a>
### E15 · 2026-10-07T09:00:00+03:00
**От:** procurement@takemake.test<br>
**Кому:** team@takemake.test<br>
**Тема:** Сверка PO-CN-2608

Сверка поставки назначена на 13.10 в 10:00.
[MEETING] action=MEET-RECON recipient=Procurement due=2026-10-13T10:00:00+03:00 status=open title=reconcile_shipment

<a id="e16"></a>
### E16 · 2026-10-10T16:00:00+03:00
**От:** procurement@takemake.test<br>
**Кому:** team@takemake.test<br>
**Тема:** Перенос сверки PO-CN-2608

Подтверждаю перенос: новый слот сверки 15.10 в 15:00.
[MEETING] action=MEET-RECON recipient=Procurement due=2026-10-15T15:00:00+03:00 status=open title=reconcile_shipment

<a id="e17"></a>
### E17 · 2026-10-01T08:00:00+03:00
**От:** digest@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Автоматическая рассылка

Дайджест без персонального действия.

<a id="e18"></a>
### E18 · 2026-10-02T09:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e19"></a>
### E19 · 2026-10-03T10:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e20"></a>
### E20 · 2026-10-04T11:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e21"></a>
### E21 · 2026-10-05T12:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e22"></a>
### E22 · 2026-10-06T13:00:00+03:00
**От:** digest@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Автоматическая рассылка

Дайджест без персонального действия.

<a id="e23"></a>
### E23 · 2026-10-07T14:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e24"></a>
### E24 · 2026-10-08T15:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e25"></a>
### E25 · 2026-10-09T08:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e26"></a>
### E26 · 2026-10-10T09:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e27"></a>
### E27 · 2026-10-11T10:00:00+03:00
**От:** digest@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Автоматическая рассылка

Дайджест без персонального действия.

<a id="e28"></a>
### E28 · 2026-10-01T11:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e29"></a>
### E29 · 2026-10-02T12:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e30"></a>
### E30 · 2026-10-03T13:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e31"></a>
### E31 · 2026-10-04T14:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e32"></a>
### E32 · 2026-10-05T15:00:00+03:00
**От:** digest@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Автоматическая рассылка

Дайджест без персонального действия.

<a id="e33"></a>
### E33 · 2026-10-06T08:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e34"></a>
### E34 · 2026-10-07T09:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e35"></a>
### E35 · 2026-10-08T10:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e36"></a>
### E36 · 2026-10-09T11:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e37"></a>
### E37 · 2026-10-10T12:00:00+03:00
**От:** digest@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Автоматическая рассылка

Дайджест без персонального действия.

<a id="e38"></a>
### E38 · 2026-10-11T13:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e39"></a>
### E39 · 2026-10-01T14:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.

<a id="e40"></a>
### E40 · 2026-10-02T15:00:00+03:00
**От:** colleague@takemake.test<br>
**Кому:** procurement@takemake.test<br>
**Тема:** Рабочее уточнение

Короткое обсуждение без нового обязательства.
