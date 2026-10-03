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
│   │   └── state.ts                [รอทำ] บริบทล่าสุดและ event กันซ้ำผ่าน KV
│   └── line/                       ส่วนเชื่อมต่อ LINE โดยเฉพาะ
│       ├── signature.ts            [ทำแล้ว] ตรวจผู้ส่ง webhook ด้วย raw body
│       ├── reply.ts                [ทำแล้ว] ส่งข้อความผ่าน LINE Reply API
│       ├── events.ts               [ทำแล้ว] ตรวจชนิด event และแชท 1:1
│       └── render.ts               [ทำแล้วบางส่วน] text/Quick Reply; รอ Flex ในขั้น 6
├── content/                        ข้อมูลตายตัวที่บอตใช้ตอบ
│   ├── routes.json                 [ทำแล้ว] ข้อความคลินิก/แหล่งอ้างอิง/ทางถัดไป
│   ├── aliases.json                [ทำแล้ว] คำค้นทั่วไปและคำถามต่อตามบริบท
│   ├── ui.json                     [ทำแล้ว] ทักทาย/fallback/ติดต่อ/ลิงก์ฟอร์ม
│   ├── metadata.json               [ทำแล้ว] เวอร์ชัน PDF และ route ที่ไม่ครบทุกกรณี
│   └── schema.json                 [ทำแล้ว] สัญญารูปแบบ clinical route
├── scripts/                        เครื่องมือพัฒนาและตั้งค่าครั้งเดียว
│   ├── validate-content.mjs        [ทำแล้ว] ตรวจข้อมูลก่อน deploy
│   └── install-rich-menu.mjs       [รอทำ] สร้าง/อัปโหลด/ตั้ง default Rich Menu
├── assets/
│   ├── branding/                   [ทำแล้ว] รูปโปรไฟล์และมาสคอต
│   └── rich-menu.png               [รอทำ] ภาพเมนู 6 ช่อง
├── config/
│   └── rich-menu.json              [รอทำ] พิกัดพื้นที่กดและ postback ของเมนู
├── tests/
│   ├── content-schema.test.ts      [ทำแล้ว] ข้อมูลครบและรูปแบบถูก
│   ├── content-corpus.test.ts      [ทำแล้ว] route/alias/ปลายทาง/เวอร์ชันถูก
│   ├── content-snapshot.test.ts    [ทำแล้ว] ข้อความตรง baseline ที่ตรวจแล้ว
│   ├── router.test.ts              [ทำแล้ว] ปุ่ม/ข้อความ/บริบท/คำกำกวม
│   ├── __snapshots__/              [ทำแล้ว] baseline ของข้อความ
│   └── *.test.ts                   [รอทำเพิ่ม] webhook/state/render/menu/integration
├── docs/
│   ├── source-map.md               [ทำแล้ว] แต่ละกรณีอ้าง PDF หน้าไหน/เหตุผลที่ปิด
│   ├── implementation-progress.md  [ทำแล้ว] ผลตรวจและการตัดสินใจระหว่างพัฒนา
│   ├── release-checklist.md        [รอทำ] ตรวจ LINE จริง/deploy/rollback
│   └── superpowers/                [ทำแล้ว] specs/ และ plans/ ที่ใช้ดำเนินงาน
├── package.json                    [ทำแล้ว] dependencies และคำสั่งพัฒนา
├── package-lock.json               [ทำแล้ว] ล็อกเวอร์ชัน dependencies
├── tsconfig.json                   [ทำแล้ว] ตั้งค่า TypeScript
├── wrangler.jsonc                  [ทำแล้ว] ตั้งค่า Worker; รอ KV binding จริง
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
   หรือรูป/เสียง/ไฟล์จะไม่ถูกนำไปสร้างคำตอบทางคลินิก
4. `domain/state.ts` อ่าน KV เพื่อตรวจ event ที่ตอบสำเร็จแล้วและหัวข้อล่าสุด
   ถ้าพบ event ซ้ำ หยุดโดยไม่ตอบซ้ำ; บริบทหมดอายุถือว่าไม่มีหัวข้อก่อนหน้า
5. `domain/router.ts` ใช้ `routes.json` และ `aliases.json` เลือกผลลัพธ์:
   route ที่ตรง, หลายกรณีให้เลือก, หรือ fallback เมื่อไม่พบ/ขาดบริบท/ข้อมูลปิดอยู่
   ข้อความต้องตรง alias ทั้งข้อความหลังปรับช่องว่าง ไม่มี fuzzy matching หรือ AI
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

ปุ่มรายงานความเสี่ยงเริ่มจาก postback เข้า Worker เพื่อส่งคำเตือนก่อน ผู้ใช้กด
ปุ่มเปิดฟอร์มในคำตอบแล้ว LINE เปิด Google Form โดยตรง ข้อมูลที่กรอกฟอร์มไม่ผ่าน
Worker ส่วน `install-rich-menu.mjs` ใช้ตั้งเมนูครั้งเดียวตอนติดตั้ง ไม่รันทุกข้อความ

## การตรวจข้อมูลก่อน deploy

รูปแบบการ์ดคำตอบและ Rich Menu ยึดภาพที่ผู้ใช้เลือก ตาม
[ข้อกำหนดหน้าตาคำตอบ](docs/line-response-style.md) สำหรับ Ticket 6–7

ผู้พัฒนาแก้ `content/*.json` จากเอกสารอ้างอิง แล้วรัน `content:check`, `typecheck`
และ `test` ให้ผ่านก่อน Wrangler deploy คำตอบ JSON ถูกบรรจุไปพร้อมโค้ด Worker
ไม่ต้องค้น PDF, อ่าน Google Drive หรือเรียก AI ระหว่างตอบแชท Secrets ของ LINE
และ HMAC จะเก็บใน Cloudflare secrets; KV binding จะเพิ่มเมื่อสร้าง namespace จริง

สถานะตอนนี้: Tickets 1–4 เสร็จแล้ว (schema, content, router และ webhook/reply)
ทดสอบการรับ POST /webhook ในเครื่องได้ด้วย secret จำลอง แต่ยังไม่มี KV state,
Flex styling หรือ Rich Menu และยังไม่ได้ deploy/test กับ LINE จริง

## Local development

Requires Node.js 22 or newer.

```sh
npm ci
npm test
npm run typecheck
npm run dev
```

Current stage: Ticket 4 webhook and Reply API. Only POST /webhook is accepted;
other paths return 404. PDF transcription, alias maps and UI
copy are under content/. See docs/source-map.md for source pages and disabled
ambiguous cases.

`src/domain/router.ts` resolves exact menu postbacks and registered text aliases
without I/O. Ambiguous matches return choices. Follow-ups require the correct
last route. It normalizes whitespace only; punctuation and spelling variants
need explicit aliases.

`npm run content:check` checks clinical schema, route IDs, versions, destination
links and aliases. Test fixtures are not clinical content. Deployment runs
content validation, type checks and tests first. Content snapshots record the
visually checked transcription; renderer checks will be added in Ticket 6.

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

ยังไม่ต้องเปลี่ยน Webhook URL ตอนนี้ เพราะระบบอยู่ระหว่างพัฒนา
