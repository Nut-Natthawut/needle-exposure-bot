# เข็มทิ่มตำ NKP

LINE OA bot: TypeScript + Cloudflare Workers, deterministic JSON routes.

## โครงสร้างโฟลเดอร์

โครงสร้างปลายทางตาม tickets ด้านล่าง: `[ทำแล้ว]` คือไฟล์ที่มีอยู่จริง
และ `[รอทำ]` คือส่วนที่ยังไม่ได้ implement ไม่ใช่ฟังก์ชันที่ใช้งานได้แล้ว

```text
เข็มทิ่มตำ/
├── src/                            โค้ดที่รันบน Cloudflare Worker
│   ├── index.ts                    [ทำแล้ว] POST /webhook และประสานระบบ
│   ├── domain/                     กฎการเลือกคำตอบและสถานะสนทนา
│   │   ├── router.ts               [ทำแล้ว] เลือก route / choices / fallback
│   │   ├── text-input.ts           [ทำแล้ว] ปรับรูปแบบคำพิมพ์ ไม่เปลี่ยนข้อมูลทางคลินิก
│   │   ├── topic-suggestions.ts    [ทำแล้ว] เสนอชื่อหัวข้อใกล้เคียง รอกดยืนยันก่อนตอบ
│   │   └── state.ts                [ทำแล้ว] บริบทล่าสุดและ event กันซ้ำผ่าน KV
│   └── line/                       ส่วนเชื่อมต่อ LINE โดยเฉพาะ
│       ├── signature.ts            [ทำแล้ว] ตรวจผู้ส่ง webhook ด้วย raw body
│       ├── reply.ts                [ทำแล้ว] ส่งข้อความผ่าน LINE Reply API
│       ├── events.ts               [ทำแล้ว] ตรวจชนิด event และแชท 1:1
│       └── render.ts               [ทำแล้ว] text/Flex/Quick Reply และปุ่มนำทาง
├── content/                        ข้อมูลตายตัวที่บอตใช้ตอบ
│   ├── routes.json                 [ทำแล้ว] ข้อความคลินิก/แหล่งอ้างอิง/ทางถัดไป
│   ├── aliases.json                [ทำแล้ว] คำค้นทั่วไปและคำถามต่อตามบริบท
│   ├── ui.json                     [ทำแล้ว] ทักทาย/fallback/ติดต่อ/ลิงก์ฟอร์ม
│   ├── metadata.json               [ทำแล้ว] เวอร์ชัน PDF และ route ที่ไม่ครบทุกกรณี
│   └── schema.json                 [ทำแล้ว] สัญญารูปแบบ clinical route
├── scripts/                        เครื่องมือพัฒนาและตั้งค่าครั้งเดียว
│   ├── validate-content.mjs        [ทำแล้ว] ตรวจข้อมูลก่อน deploy
│   ├── install-rich-menu.mjs       [ทำแล้ว] เครื่องมือติดตั้ง Rich Menu ด้วย token ในเครื่อง
│   └── install-rich-menu.d.mts     [ทำแล้ว] types ของเครื่องมือติดตั้ง
├── assets/
│   ├── branding/                   [ทำแล้ว] รูปโปรไฟล์และมาสคอต
│   ├── rich-menu.png               [ทำแล้ว] ภาพเมนูสำหรับพิกัด API แบบมีแถบหัว
│   └── rich-menu-oa-manager.png    [ทำแล้ว] ภาพเทมเพลต OA Manager 6 ช่องเท่ากัน
├── config/
│   └── rich-menu.json              [ทำแล้ว] พิกัดพื้นที่กดและ postback ของเมนู
├── tests/
│   ├── content-schema.test.ts      [ทำแล้ว] ข้อมูลครบและรูปแบบถูก
│   ├── content-corpus.test.ts      [ทำแล้ว] route/alias/ปลายทาง/เวอร์ชันถูก
│   ├── content-snapshot.test.ts    [ทำแล้ว] ข้อความตรง baseline ที่ตรวจแล้ว
│   ├── router.test.ts              [ทำแล้ว] ปุ่ม/ข้อความ/บริบท/คำกำกวม
│   ├── signature.test.ts           [ทำแล้ว] ลายเซ็น LINE และ body ถูกแก้
│   ├── reply.test.ts               [ทำแล้ว] HTTP ที่ส่งให้ LINE และความล้มเหลว
│   ├── reply-runtime.test.ts       [ทำแล้ว] native Workers fetch/redirect และ signed webhook
│   ├── webhook.test.ts             [ทำแล้ว] จำลอง event เข้า Worker ทั้งเส้นทาง
│   ├── state.test.ts               [ทำแล้ว] TTL/HMAC/ล้างบริบท/event กันซ้ำ
│   ├── kv-failure.test.ts          [ทำแล้ว] ถามต่อ/กันซ้ำ/KV ล้มเหลวผ่าน webhook
│   ├── render.test.ts              [ทำแล้ว] การ์ด/ข้อความครบ/คำเตือน/ข้อจำกัด LINE
│   ├── visual-style.test.ts        [ทำแล้ว] ความชัดหัวการ์ด/กล่องเตือน/ระยะบรรทัด/ปุ่มกลับ
│   ├── navigation.test.ts          [ทำแล้ว] เมนู/ถามต่อ/เปลี่ยนหัวข้อ/ทุกปุ่มไปถึงคำตอบ
│   ├── conversation.test.ts        [ทำแล้ว] ทักทาย/คำใกล้เคียง/ยืนยัน/รักษาหัวข้อเดิม
│   ├── topic-suggestions.test.ts   [ทำแล้ว] ขอบเขตคำใกล้เคียงและไม่เดากรณีทางการแพทย์
│   ├── text-coverage.test.ts       [ทำแล้ว] สำนวน/คำลงท้าย/ตัวพิมพ์/บริบท/ไม่ตัดเงื่อนไข
│   ├── rich-menu.test.ts           [ทำแล้ว] ภาพ/พิกัด/6 postbacks เข้า webhook จริง
│   ├── rich-menu-install.test.ts   [ทำแล้ว] create/upload/default/reuse/failure แบบจำลอง API
│   ├── support/memory-kv.ts        [ทำแล้ว] KV จำลองสำหรับ tests ไม่ใช่ฐานข้อมูลจริง
│   ├── support/rendered-content.ts [ทำแล้ว] อ่านข้อความจาก payload เพื่อเทียบต้นฉบับ
│   ├── __snapshots__/              [ทำแล้ว] baseline ของข้อความ
│   └── *.test.ts                   [รอทำเพิ่ม] release integration
├── docs/
│   ├── source-map.md               [ทำแล้ว] แต่ละกรณีอ้าง PDF หน้าไหน/เหตุผลที่ปิด
│   ├── implementation-progress.md  [ทำแล้ว] ผลตรวจและการตัดสินใจระหว่างพัฒนา
│   ├── line-response-style.md      [ทำแล้ว] รูปแบบคำตอบตามภาพ reference
│   ├── content-review.md           [ทำแล้ว] ผลตรวจคำตอบ/ข้อจำกัด/รายการลองบนมือถือ
│   ├── contact-details.md          [ทำแล้ว] เบอร์ติดต่อที่ผู้ใช้ให้/ข้อจำกัดวิธีโทร/การตั้งช่อง F
│   ├── rich-menu.md                [ทำแล้ว] วิธีติดตั้งเองโดยไม่บันทึก key ลงไฟล์
│   ├── rich-menu-image-prompt.md   [ทำแล้ว] prompt/reference และพิกัดภาพสุดท้าย
│   ├── release-checklist.md        [รอทำ] ตรวจ LINE จริง/deploy/rollback
│   └── superpowers/                [ทำแล้ว] specs/ และ plans/ ที่ใช้ดำเนินงาน
├── package.json                    [ทำแล้ว] dependencies และคำสั่งพัฒนา
├── package-lock.json               [ทำแล้ว] ล็อกเวอร์ชัน dependencies
├── tsconfig.json                   [ทำแล้ว] ตั้งค่า TypeScript
├── wrangler.jsonc                  [ทำแล้ว] ตั้งค่า Worker และ Namespace ID ของ KV
├── worker-configuration.d.ts        [ทำแล้ว] Env types ที่ Wrangler สร้างจาก config
├── .gitignore                      [ทำแล้ว] กัน secrets/เอกสารต้นทางเข้า Git
└── README.md                       เอกสารนี้
```

`node_modules/` เป็น dependencies ในเครื่อง ไม่ส่งเข้า Git ส่วน PDF/DOCX/JPG
ต้นฉบับอยู่ในเครื่องสำหรับตรวจเนื้อหา ไม่ใช่ไฟล์ที่ Worker เปิดอ่านตอนตอบแชท

## Architecture และลำดับการทำงานจริง

ระบบมี Cloudflare Worker ตัวเดียว โค้ดใน `domain/` และ `line/` เป็นโมดูลภายใน
Worker นั้น ไม่ใช่เซิร์ฟเวอร์หรือบริการที่ต้อง deploy แยกตัวละหนึ่งเครื่อง
`router.ts` เป็น pure function ที่ไม่เรียก LINE หรือ KV ส่วน `index.ts`
จะเป็นผู้ประสานการอ่านสถานะ เลือกคำตอบ ส่งข้อความ และบันทึกผล

เมื่อ implement ครบ ระบบจะทำงานตามลำดับนี้:

1. ผู้ใช้พิมพ์ข้อความหรือกด Rich Menu ในแชท 1:1 ของ LINE OA
   ปุ่มส่ง postback ที่เป็น routeId ส่วนคำถามพิมพ์ส่งข้อความตามที่ผู้ใช้กรอก
2. LINE ส่ง HTTPS POST ไปที่ `/webhook` ของ Worker; `src/index.ts` รับ request
   แล้วให้ `line/signature.ts` ตรวจ signature จาก raw body ก่อน JSON.parse
   ถ้าตรวจไม่ผ่าน ตอบ HTTP 401 และหยุดโดยไม่อ่าน KV หรือส่งคำตอบ
3. `index.ts` เลือกเฉพาะ event ที่รองรับในแชท 1:1; event จาก group/room
   group/room ข้ามโดยไม่ตอบ; รูป/เสียง/ไฟล์ใน 1:1 ตอบข้อความไม่รองรับ
   พร้อมเมนู ไม่โหลดไฟล์หรือใช้สร้างคำแนะนำทางคลินิก
4. `domain/state.ts` อ่าน KV เพื่อตรวจ event ที่ตอบสำเร็จแล้วและหัวข้อล่าสุด
   ถ้าพบ event ซ้ำ หยุดโดยไม่ตอบซ้ำ; บริบทหมดอายุถือว่าไม่มีหัวข้อก่อนหน้า
5. `domain/router.ts` ใช้ `routes.json` และ `aliases.json` เลือกผลลัพธ์:
   route ที่ตรง, หลายกรณีให้เลือก, หรือ fallback เมื่อไม่พบ/ขาดบริบท/ข้อมูลปิดอยู่
   ข้อความต้องตรง alias ทั้งข้อความหลัง `text-input.ts` ปรับช่องว่าง ตัวพิมพ์อังกฤษ
   คำลงท้ายสุภาพ 1 ชุด และเครื่องหมายท้ายข้อความที่กำหนด (`? ! . 。 … ！ ？`)
   ไม่ตัดคำปฏิเสธ ตัวเลข เครื่องหมาย +/- หรือข้อความกลางประโยค ไม่มีการเดา route คลินิกหรือ AI
   คำทักทาย/ขอบคุณแยกเป็น UI; หากไม่พบคำตรง `topic-suggestions.ts` อาจเสนอ
   ชื่อหัวข้อเมนูภาษาไทยที่ต่างไม่เกิน 1 ตัวอักษรตามรายการใน `ui.json`
   ต้องกดปุ่มยืนยันก่อนเข้าหัวข้อนั้น ไม่เสนอกรณีย่อย ผลตรวจ ชื่อยา รหัส หรือตัวเลข
6. `line/render.ts` อ่านข้อความจาก route หรือ `ui.json` แล้วจัดเป็น text/Flex/
   Quick Reply โดยรักษาข้อความคลินิกเดิม รวมทั้งแสดงคำเตือนข้อมูลไม่ครบใน route
   ที่ระบุไว้ใน `metadata.partialRouteIds`
7. `line/reply.ts` ส่งคำตอบให้ LINE Reply API ด้วย replyToken ของ event
   LINE เป็นผู้แสดงข้อความในแชท; response HTTP ของ webhook เป็นเพียงสถานะรับงาน
   ไม่ใช่ข้อความคำตอบที่ส่งตรงให้ผู้ใช้
8. เมื่อตอบสำเร็จ จึงบันทึก event กันซ้ำ TTL 24 ชั่วโมง และ route ล่าสุดเมื่อ
   มีหัวข้อที่แน่นอน TTL 30 นาที; จากนั้น webhook คืนสถานะสำเร็จให้ LINE

KV เป็นที่เก็บสถานะชั่วคราว ไม่ใช่ฐานข้อมูลคำตอบหรือประวัติแชท: คีย์ผู้ใช้เป็น
HMAC และไม่มีข้อความดิบ/HN/ชื่อผู้ป่วย การกันซ้ำเป็น best effort เพราะ KV มี
eventual consistency หาก KV อ่านหรือเขียนไม่ได้ route ตรงยังตอบได้ แต่การถามต่อ
และการกันซ้ำอาจใช้ไม่ได้; หาก Reply API ล้มเหลว ไม่บันทึก event ว่าสำเร็จ และ
webhook คืนสถานะล้มเหลวให้ LINE (ต้องเปิด redelivery และไม่รับประกันการตอบซ้ำสำเร็จ)

พิมพ์ “เริ่มใหม่” หรือ postback `ui.reset` เพื่อล้างบริบท; เมื่อได้หลายกรณีให้เลือก
หรือ fallback ที่ขาดบริบท/ข้อมูลไม่พร้อม จะล้างหัวข้อเดิมหลังตอบสำเร็จเช่นกัน
คำทักทาย ขอบคุณ ข้อความที่จับคู่ไม่ได้ และคำถามยืนยันหัวข้อใกล้เคียงจะไม่ล้าง
หรือยืดอายุหัวข้อเดิม กด “เลือกหัวข้ออื่น” จะเข้า `ui.home` และล้างบริบท
TTL ตรวจจาก `expiresAt` ในค่า
ด้วย จึงไม่ใช้ค่าที่หมดอายุแม้ KV ยังส่งค่าค้างมา หากเขียนหัวข้อใหม่ไม่ได้จะพยายาม
ลบหัวข้อเดิม แต่ KV อาจยังอ่านค่าเก่าที่ยังไม่หมดอายุได้ระหว่างแพร่ข้อมูล และ
event ที่เข้าพร้อมกันอาจตอบซ้ำได้ ไม่รับประกัน latest-context หรือ exactly-once
ข้าม requests; หากต้องการรับประกันระดับนั้นต้องเปลี่ยนการเก็บสถานะเป็นแบบ strong consistency

ปุ่มรายงานความเสี่ยงเริ่มจาก postback เข้า Worker เพื่อส่งคำเตือนก่อน ผู้ใช้กด
ปุ่มเปิดฟอร์มในคำตอบแล้ว LINE เปิด Google Form โดยตรง ข้อมูลที่กรอกฟอร์มไม่ผ่าน
Worker ส่วน `install-rich-menu.mjs` ใช้ตั้งเมนูครั้งเดียวตอนติดตั้ง ไม่รันทุกข้อความ

## การตรวจข้อมูลก่อน deploy

รูปแบบการ์ดคำตอบและ Rich Menu ยึดภาพที่ผู้ใช้เลือก ตาม
[ข้อกำหนดหน้าตาคำตอบ](docs/line-response-style.md) สำหรับ Ticket 6–7

ผู้พัฒนาแก้ `content/*.json` จากเอกสารอ้างอิง แล้วรัน `content:check`, `typecheck`
และ `test` ให้ผ่านก่อน Wrangler deploy คำตอบ JSON ถูกบรรจุไปพร้อมโค้ด Worker
ไม่ต้องค้น PDF, อ่าน Google Drive หรือเรียก AI ระหว่างตอบแชท Secrets ของ LINE
และ HMAC จะเก็บใน Cloudflare secrets; config มี binding `STATE_KV` และ Namespace ID
ที่ผู้ใช้สร้างแล้ว แต่ยังต้องตรวจ Account และตั้ง secrets ก่อน deploy

สถานะตอนนี้: Tickets 1–7 มีโค้ดแล้ว (รวม Flex และไฟล์ Rich Menu)
ผู้ใช้เลือกตั้ง Rich Menu ด้วย OA Manager และมีภาพสำหรับเทมเพลต 6 ช่องแล้ว
ตัวติดตั้งผ่าน API เป็นทางเลือกเท่านั้น ห้ามรันไปทับค่าที่ตั้งเองโดยไม่ตั้งใจ
ชุดปรับหน้าตา 16 ต.ค. 2569 เปลี่ยนเฉพาะ layout/สี/ระยะบรรทัด ไม่เปลี่ยนข้อมูล
การตรวจการ์ดใหม่บน LINE มือถือหลัง deployment ยังรอยืนยัน
ดูวิธี OA Manager และทางเลือก API ใน [ขั้นตอนติดตั้ง](docs/rich-menu.md)

## เข้าใจสถานะและการทดสอบในตอนนี้

ตอนนี้ทำตัวบอตจริงไปพร้อมกับ tests แล้ว ไม่ได้เขียนแต่ tests:
มีคลังคำตอบจาก PDF, ตัวเลือก route, ตัวรับ webhook, ตัวตรวจ signature และ
ตัวส่ง Reply API ระบบจำบริบท/กันซ้ำ การ์ด Flex และไฟล์ Rich Menu แล้ว
เหลือติดตั้ง Rich Menu และทดสอบการ์ด/ปุ่มจริงบน LINE มือถือ

การทดสอบในเครื่องส่ง event จำลองเข้าโค้ดจริง เช่นคำถาม “เลือดเข้าตา”
พร้อมลายเซ็นที่สร้างด้วย secret ทดสอบ แล้วตรวจว่าโค้ดสร้าง HTTP request ไปยัง
Reply API ด้วยข้อความที่ตรง routes.json หรือไม่ จุดส่ง HTTP ถูกแทนด้วยตัวรับ
จำลองที่เก็บ payload ให้ตรวจ; ไม่มีการเรียก LINE จริงหรือส่งข้อความถึงผู้ใช้

| ตรวจอะไร | ตัวอย่าง | ยืนยันอะไรได้ |
| --- | --- | --- |
| Schema/คลังข้อมูล | route ขาด source หรือชี้ปลายทางที่ไม่มี | ตัวตรวจปฏิเสธข้อมูลไม่ครบ |
| Snapshot | ข้อความจาก routes.json เปลี่ยนไปจาก baseline | ตรวจจับการเปลี่ยนข้อความที่ตรึงไว้ ไม่รับรองแพทย์ |
| Router | “PEP” ตรงสองกรณี | ให้เลือกแทนการเลือกกรณีเอง |
| Signature | เปลี่ยน body หลังเซ็น | ปฏิเสธ request โดยไม่ตอบ LINE |
| Webhook/Reply | event จริงรูปแบบ LINE และจำลอง API 500 | ส่ง payload ถูกและจัดการความล้มเหลว |
| KV state | ถาม “ผลบวก” ต่อหลัง “การเจาะเลือด”, event เดิมส่งซ้ำ | ใช้หัวข้อล่าสุด/หมดอายุ/ไม่ตอบ event ที่บันทึกแล้ว ใน KV จำลอง |
| Flex/Navigation | ข้อความครบ 27 หัวข้อและปุ่มจริงใน payload | ไม่แก้ข้อความคลินิกและไปถึงทุกหัวข้อที่เปิดใช้ |
| Typecheck | เรียกฟังก์ชันด้วยชนิดข้อมูลผิด | TypeScript ตรวจความเข้ากันได้ของโค้ด |
| Build dry-run | รวมโค้ดเป็น Worker bundle | ประกอบไฟล์ได้ โดยยังไม่อัปโหลด Cloudflare |

ผล Ticket 6 คือ 177 test cases ใน 12 test files ผ่านทั้งหมด ไม่ใช่การทดลองแชทใน LINE
177 ครั้ง และไม่รับประกันระบบ production ครบทุกด้าน ยังต้องทดสอบบน Cloudflare
จริงและ LINE มือถือ เช่นการแสดงการ์ด/ปุ่ม, KV, ความเร็ว/CPU, การหมดอายุบริบท
และ Google Form ใน Ticket 8

ขั้นถัดไปสำหรับตรวจหน้าตาคือ deploy Ticket 6 แล้วทดสอบบน LINE มือถือ
Rich Menu มีไฟล์แล้ว ผู้ใช้เลือกอัปโหลดและตั้ง action เองใน OA Manager
`npm run rich-menu:check` ตรวจทางเลือก API ในเครื่อง ไม่ตรวจค่าที่ตั้งใน OA Manager
การ push/deploy Worker ไม่ได้อัปโหลดภาพหรือเปลี่ยน Rich Menu ให้โดยอัตโนมัติ
ดู [ผลตรวจคำตอบและข้อจำกัด](docs/content-review.md) ก่อนถือว่ารองรับครบทุกคำถาม

อัปเดตการทดลอง deploy (10 ต.ค. 2569): ผู้ใช้เริ่ม Ticket 8 ก่อนงานหน้าตา
และพบ webhook 502 ตอนส่ง Reply ขณะนี้มี diagnostic ชั่วคราวเฉพาะ error code/status
เปิดด้วย `REPLY_DIAGNOSTICS=enabled`; ไม่เก็บข้อความ/ค่าลับ และยังคงปิด persistent logs
รายละเอียดและวิธีตรวจอยู่ใน [บันทึก diagnosis](docs/reply-failure-diagnosis.md)
พบ runtime defect แล้ว: native Workers fetch ปฏิเสธ `redirect:error` จึงเปลี่ยนเป็น
`manual` และเพิ่ม runtime regression tests; ผู้ใช้ยืนยันว่าตอบ LINE ได้แล้ว
diagnostic ชั่วคราวยังอยู่ การเอาออกไม่รวมในงานหน้าตารอบนี้

## Local development

Requires Node.js 22 or newer.

```sh
npm ci
npm test
npm run typecheck
npm run dev
```

Current stage: source-preserving Flex replies, friendly conversation copy and confirmed topic suggestions; owner-configured OA Manager Rich Menu, mobile acceptance pending. Only POST /webhook is accepted;
other paths return 404. PDF transcription, alias maps and UI
copy are under content/. See docs/source-map.md for source pages and disabled
ambiguous cases.

`src/domain/router.ts` resolves exact menu postbacks and registered text aliases
without I/O. Ambiguous matches return choices. Follow-ups require the correct
last route. `text-input.ts` tolerates whitespace, ASCII case, one allowlisted
Thai polite ending and terminal question/exclamation marks, periods or ellipses.
It preserves negation, numbers, +/- signs and internal punctuation; it never
normalizes postback IDs. Other wording/spelling variants need explicit aliases.

`src/domain/topic-suggestions.ts` handles only the allowlisted Thai menu topic
names in `ui.json`, after exact routing fails. It accepts at most one character
edit and a unique topic, rejects numbers/codes/non-formatting punctuation and inputs over 64
characters, and returns a confirmation prompt only. The confirmation postback
uses the existing router/UI flow; it does not create a clinical answer. Small
talk and unrecognized text preserve the existing context without renewing TTL.
Humanizer is a development-time copy-editing skill, not a runtime AI service.

`npm run content:check` checks clinical schema, route IDs, versions, destination
links and aliases. Test fixtures are not clinical content. Deployment runs
content validation, type checks and tests first. Content snapshots record the
visually checked transcription; renderer tests also read complete clinical text from Flex payloads.

Keep LINE credentials out of Git. Original PDF/DOCX/JPG files remain local and
are ignored. Add the actual KV namespace and generate binding types with
`wrangler types` when provisioning in Ticket 8.

Required secret names are declared in wrangler.jsonc, not secret values.
`npm run types:generate` regenerates Env declarations. Tests use dummy secrets
and replace only the outbound HTTP transport; they do not contact LINE.

## สิ่งที่เจ้าของบัญชีจะทำเองตอนติดตั้งจริง

เมื่อโค้ดและเมนูพร้อมใน Ticket 8 จะพาตั้งค่าทีละขั้น:

1. เลือก Cloudflare Account ของโปรเจกต์และสร้าง KV namespace จริง
2. ดู Channel secret/ออก Channel access token ใน LINE Developers แล้วใส่ลง
   Cloudflare secrets โดยตรง; ไม่ส่งค่าลับลงแชทหรือเก็บใน Git
3. ตั้ง HMAC secret สำหรับคีย์สถานะและ deploy Worker ไป Account ที่ถูกต้อง
4. ใส่ Webhook URL /webhook, กด Verify, เปิด Use webhook และ redelivery
5. ปิดข้อความตอบอัตโนมัติ/ทักทายเดิมเมื่อบอตพร้อมรับหน้าที่ เพื่อไม่ให้ตอบซ้อน
6. ติดตั้ง Rich Menu แล้วทดสอบบน LINE มือถือกับบัญชีผู้พัฒนา

Webhook URL /webhook เดิมใช้ต่อได้ ไม่ต้องสร้าง Worker หรือ KV ใหม่สำหรับ Ticket 6
