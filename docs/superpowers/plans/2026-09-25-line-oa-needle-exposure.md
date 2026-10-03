# LINE OA เข็มทิ่มตำ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** ส่งมอบ LINE OA แบบ 1:1 ที่ตอบจากข้อความซึ่งถอดจากแนวทางและตรึงไว้เท่านั้น มี Rich Menu 6 ช่อง ถามต่อได้หนึ่งหัวข้อ และเปิดฟอร์มรายงานความเสี่ยง

**Architecture:** Cloudflare Worker ตัวเดียวรับ LINE webhook, ตรวจ signature, เลือก route แบบ deterministic จาก postback หรือ alias แล้วตอบด้วย LINE Reply API ข้อความทางคลินิกอยู่ใน JSON ที่ตรวจ schema ตอน build; Workers KV เก็บเฉพาะ lastRouteId และ webhookEventId แบบชั่วคราว

**Tech Stack:** TypeScript, Cloudflare Workers Free, Workers KV Free, Wrangler, Vitest, JSON Schema + Ajv, LINE Messaging API; ไม่ใช้ AI, LIFF, R2 หรือฐานข้อมูลเนื้อหา

**Spec:** docs/superpowers/specs/2026-09-23-line-oa-needle-exposure-design.md

## Global Constraints

- โครงการใหม่ ไม่คัดลอกข้อมูลยา/เนื้อหาคลินิก/สถานะผู้ใช้จาก medical-line-bot เดิม
- ตอบเฉพาะแชท LINE 1:1; ไม่ตอบ group/room
- เนื้อหาทางคลินิกต้องมาจาก PDF ฉบับปรับปรุงครั้งที่ 3 วันที่ 3 กันยายน 2569; หาก PDF เองกำกวม ให้ปิด route ที่เกี่ยวข้อง ไม่เติมข้อความเอง
- ผู้พัฒนาแก้ข้อมูลผ่าน JSON และ tests; ไม่มี CMS หรือ AI ที่สร้างคำตอบ
- Rich Menu 6 ช่องตามสเปก; ช่องรายงานส่งคำเตือนก่อนปุ่ม URI ไป Google Form ที่ระบุในสเปก
- ไม่เผยแพร่ PDF ฉบับเต็มหรือปุ่มดาวน์โหลดเอกสารจากบอต; ผู้ใช้ทั่วไปเข้าถึงเฉพาะ route ที่เปิดใช้งาน
- lastRouteId มี TTL 30 นาที; webhookEventId กันซ้ำแบบ best effort มี TTL 24 ชั่วโมง
- ไม่เก็บข้อความดิบ ชื่อ HN หรือประวัติแชทใน KV/application logs; LINE secrets อยู่ใน Cloudflare secrets
- ใช้ Reply API เท่านั้น ไม่ใช้ push/broadcast; route ที่ไม่ต้องพึ่ง KV ต้องยังตอบได้เมื่อ KV อ่าน/เขียนล้มเหลว
- ทำงานบน Free tier; ต้องทดสอบ CPU 10 ms/request และติดตาม KV 1,000 writes/วันตามการวิเคราะห์ในสเปก
- ยังไม่มี Git repository ในโฟลเดอร์นี้; ระหว่าง implementation ให้สร้าง repo ใหม่ของโครงการนี้ ไม่ผูกกับ repo อ้างอิงเดิม และไม่ commit PDF/DOCX/JPG ต้นทางโดยปริยาย

## Review Focus

1. Webhook signature ผิดหรือ body ถูกแก้หลังเซ็น: HTTP 401 และไม่เรียก Reply API — ทดสอบใน Ticket 4
2. ข้อความไทยที่ alias ซ้ำหรือไม่รู้จัก: ถามให้เลือกหรือ fallback ไม่เดา route — ทดสอบใน Ticket 3
3. ผู้ใช้ส่งรูป/ไฟล์/เสียง หรือส่งจาก group: ไม่สร้างคำตอบทางคลินิก — ทดสอบใน Ticket 4
4. KV quota หมด, KV เขียน key เดิมถี่เกิน หรือข้อมูลบริบทหาย: route ตรงยังตอบได้; คำถามต่อขอให้เลือกหัวข้อใหม่ — ทดสอบใน Ticket 5
5. LINE Reply API สำเร็จแต่ webhook ถูกส่งซ้ำ: ไม่ตอบซ้ำเมื่อ KV ยังอ่านได้; หาก KV ไม่พร้อมยอมรับ best effort — ทดสอบใน Ticket 5 และ 8

## File Map

| พื้นที่ | ความรับผิดชอบ |
| --- | --- |
| package.json, tsconfig.json, wrangler.jsonc, .gitignore | โปรเจกต์ TypeScript, คำสั่งทดสอบ/deploy, ไม่ commit secrets/เอกสารต้นทาง; เพิ่ม KV binding เมื่อเตรียม namespace ใน Ticket 8 |
| content/schema.json, content/routes.json, content/aliases.json, content/ui.json, content/metadata.json | สัญญาข้อมูลและคำตอบที่ตรึงไว้; แยกข้อความคลินิกจาก UX |
| docs/source-map.md | รายชื่อ route ทุกกรณีและหน้าใน PDF ที่ใช้ตรวจ |
| scripts/validate-content.mjs | ตรวจ schema, ID ซ้ำ, next route, alias และ source ก่อน build |
| src/domain/router.ts | เลือก route จาก postback/text/context โดยไม่เดา |
| src/domain/state.ts | KV context 30 นาที, event dedup 24 ชั่วโมง, HMAC user key, fallback เมื่อ KV ใช้ไม่ได้ |
| src/line/signature.ts, src/line/reply.ts, src/line/render.ts | ตรวจ LINE signature, ส่ง Reply API, จัดรูปข้อความ/Flex/Quick Reply |
| src/index.ts | ประกอบ webhook handler และจัดการ event 1:1 เท่านั้น |
| assets/rich-menu.png, config/rich-menu.json, scripts/install-rich-menu.mjs | ภาพเมนู, 6 hit areas, งานติดตั้ง default Rich Menu ครั้งเดียว |
| tests/*.test.ts, docs/release-checklist.md | ทดสอบ schema/route/content/webhook/state/render/menu และการตรวจบน LINE จริง |

## Tickets และลำดับพึ่งพา

ทำ Ticket 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 ตามลำดับเพื่อให้ทุกใบมีผลลัพธ์ที่ตรวจได้ Ticket 2 เป็นงานที่ใช้เวลามากสุดเพราะต้องถอดและเทียบข้อความจาก PDF; ห้ามใช้ข้อความตัวอย่างใน tests เป็นคำตอบที่ deploy จริง

### Ticket 1: ตั้งโปรเจกต์และสัญญาข้อมูล (0.5–1 วัน)

**Depends on:** สเปกที่ผู้ใช้ให้เดินต่อแล้ว

**Files:** Create package.json, tsconfig.json, wrangler.jsonc, .gitignore, src/index.ts, content/schema.json, scripts/validate-content.mjs, tests/content-schema.test.ts

**Interfaces:** Produces Route { routeId, category, presentation, text, source, next }, aliases แบบ global/byLastRoute และ UI copy แยกไฟล์; ค่า source ของ clinical route ต้องมี version และ pages

- [x] เขียน schema test ด้วย fixture ที่ระบุ routeId=first_aid.root, presentation=text, text เป็นข้อความทดสอบ, source.pages=[1], next=[]; เพิ่มกรณีปฏิเสธ routeId ว่าง, source หาย และ next ที่ไม่เป็น array
- [x] รัน npm test -- tests/content-schema.test.ts ให้เห็นว่าล้มเพราะ schema/validator ยังไม่มี
- [x] สร้าง package scripts: test, typecheck, content:check, deploy และ dependencies เฉพาะ TypeScript, Wrangler, Vitest, Ajv; กำหนด Worker entry เป็น src/index.ts ที่คืน HTTP 404 ชั่วคราว; เตรียมชื่อ binding STATE_KV ในแบบ TypeScript แต่ยังไม่ใส่ namespace ID ที่ไม่มีจริง
- [x] เขียน schema ให้ clinical route บังคับ routeId/category/presentation/text/source/next; source บังคับ version และ pages ที่เป็นเลขหน้าอย่างน้อยหนึ่งหน้า; UI copy ไม่ใช้ schema นี้
- [x] เขียน validate-content.mjs ให้พิมพ์ข้อผิดพลาดพร้อมชื่อไฟล์/routeId และ exit code 1 เมื่อข้อมูลไม่ผ่าน
- [x] รัน npm test -- tests/content-schema.test.ts และ npm run typecheck ให้ผ่าน; คำสั่ง npm run content:check จะตรวจ corpus จริงตั้งแต่ Ticket 2
- [x] เริ่ม Git repository ใหม่ในโฟลเดอร์นี้ถ้ายังไม่มี และ commit เฉพาะไฟล์โครงการ/สเปก/แผนที่ตั้งใจเผยแพร่; ไม่ add เอกสารต้นทางหรือ secrets

**Done when:** schema test ผ่าน, คำสั่งตรวจเนื้อหาล้มเมื่อ fixture ผิด และ config ไม่ใส่ secret จริง

### Ticket 2: ถอด PDF เป็น route corpus และ source map (2–3 วัน)

สถานะ: เสร็จ 3 ตุลาคม 2569 — 29 routes, 2 routes ปิดเพราะต้นฉบับกำกวม; ผลตรวจและข้อวินิจฉัยอยู่ใน docs/implementation-progress.md การตรวจ snapshot ของ renderer จะทำใน Ticket 6

**Depends on:** Ticket 1

**Files:** Create content/routes.json, content/aliases.json, content/ui.json, content/metadata.json, docs/source-map.md, tests/content-corpus.test.ts, tests/content-snapshot.test.ts; Modify scripts/validate-content.mjs

**Interfaces:** Produces routes keyed by routeId, aliases.global และ aliases.byLastRoute; ทุก next.routeId ต้องชี้ไป route ที่มีจริง

- [ ] เขียน route inventory ใน docs/source-map.md โดยมีคอลัมน์ routeId, ชื่อกรณี, หน้า PDF, เงื่อนไขก่อนเข้า route, next routes, สถานะเปิด/ปิด; ครอบคลุมอย่างน้อย first_aid.root, first_aid.sharp_skin, first_aid.eye, first_aid.mouth, notify, lab.source.ic04, lab.source.negative, lab.source.positive, lab.staff.ic05, lab.staff.ic06, opep.office, opep.after_hours, followup.hiv, followup.hcv, hepb.notes, cr.notes และ knowledge.overview แล้วแตก route ย่อยเพิ่มเมื่อ flowchart ต้องแยก
- [ ] เขียน failing test ว่าทุก routeId ใน inventory ปรากฏใน routes.json, next.routeId ทุกตัวมีปลายทาง, clinical route ทุกตัวมี source.pages และ source.version ตรง metadata
- [ ] รัน npm test -- tests/content-corpus.test.ts ให้ล้มเพราะ routes.json ยังไม่ครบ
- [ ] ถอดข้อความจาก PDF ทีละกรณีลง routes.json โดยรักษาคำศัพท์ ตัวเลข หน่วย เวลา และเงื่อนไขเดิม; ใช้ DOCX ช่วยอ่าน แต่เมื่อขัดกันให้ยึด PDF; หาก PDF กำกวมให้ route นั้น disabled และบันทึกเหตุผลใน source map
- [ ] ใส่ aliases.global สำหรับคำถามที่ไม่ต้องใช้บริบท (รวมตัวอย่าง เข็มทิ่มตำ → first_aid.root) และ aliases.byLastRoute สำหรับคำถามต่อ; alias ทุกตัวชี้ route ที่เปิดใช้งานเท่านั้น และ alias ที่กำกวมชี้หลาย route เพื่อให้ router ขอเลือก ไม่เลือกเอง
- [ ] ใส่ข้อความต้อนรับ, fallback, คำเตือนก่อน Google Form, ข้อความขอเลือกหัวข้อใหม่, ช่องติดต่อที่ยังไม่มีข้อมูลจริงใน ui.json; ใส่ชื่อเอกสาร/เวอร์ชัน/วันที่ใน metadata.json
- [ ] เขียน content snapshot จากข้อความจริงหลังเทียบ PDF แล้ว; ทดสอบว่า text ใน JSON และข้อความที่ renderer จะใช้ตรงกันทุกตัวอักษร ห้ามกดอัปเดต snapshot เพื่อให้ผ่านโดยไม่ตรวจต้นฉบับ
- [ ] รัน npm run content:check และ npm test -- tests/content-corpus.test.ts tests/content-snapshot.test.ts ให้ผ่าน; commit corpus และ source map

**Done when:** ทุกทางใน PDF มี route ที่เปิดหรือบันทึกเหตุผลว่าปิด, ไม่มีข้อความทางคลินิกที่แต่งเพิ่ม และ source map ตรวจย้อนถึงหน้า PDF ได้

### Ticket 3: Router สำหรับปุ่มและคำถามพิมพ์ (0.5–1 วัน)

**Depends on:** Ticket 2

**Files:** Create src/domain/router.ts, tests/router.test.ts

**Interfaces:** Produces resolveAction(input, routes, aliases) → route | choices | fallback; input เป็น { kind: postback|text, value, lastRouteId? }; ไม่เรียก LINE API หรือ KV

- [ ] เขียน failing tests: postback ที่เป็น routeId จริงเข้า route ตรง; postback ปลอมหรือ route ที่ disabled เข้า fallback; alias ภาษาไทยที่รองรับเข้า route; alias ซ้ำได้ choices; ถามต่อโดย lastRouteId เดิมเข้า route บริบท; ไม่มี lastRouteId เข้า fallback
- [ ] รัน npm test -- tests/router.test.ts ให้ล้มเพราะ resolveAction ยังไม่มี
- [ ] เขียน normalize เฉพาะ trim, ช่องว่างซ้ำ และเครื่องหมายที่สเปกระบุว่าไม่สำคัญ; ห้าม fuzzy/semantic match และห้ามแก้คำทางคลินิก
- [ ] เขียน resolveAction ให้ตรวจ postback จาก ID ก่อน, จากนั้น alias เฉพาะบริบทเมื่อมี lastRouteId, แล้ว alias ทั่วไป; เมื่อได้หลาย ID ส่ง choices โดยไม่เลือกแทนผู้ใช้
- [ ] ทดสอบข้อความที่มี HN/ชื่อ/คำถามรักษาเฉพาะบุคคลว่าไม่ถูก route เป็นคำตอบคลินิกโดยบังเอิญ; เพิ่ม alias เฉพาะที่ตรวจแล้วว่าปลอดภัย
- [ ] รัน npm test -- tests/router.test.ts และ npm run typecheck ให้ผ่าน; commit router

**Done when:** การเลือก route เป็นฟังก์ชัน pure ที่ทดสอบครบทั้งตรง, กำกวม, ไม่พบ, บริบท และ postback ปลอม

### Ticket 4: LINE webhook และการตรวจ signature (1 วัน)

**Depends on:** Ticket 3

**Files:** Create src/line/signature.ts, src/line/reply.ts, tests/signature.test.ts, tests/webhook.test.ts; Modify src/index.ts

**Interfaces:** verifyLineSignature(rawBody, header, secret) → boolean; reply(replyToken, messages, accessToken) → Result; Worker รับ POST /webhook เท่านั้น

- [ ] เขียน failing tests ด้วย raw body ที่เซ็น HMAC-SHA256 ถูกต้อง, body ที่แก้หนึ่ง byte, header ที่ไม่มี signature, event จาก group/room, image/file/audio และ follow event ในแชท 1:1
- [ ] รัน npm test -- tests/signature.test.ts tests/webhook.test.ts ให้ล้มเพราะ handler ยังไม่มี
- [ ] เขียน signature verification จาก raw request body ก่อน JSON.parse; signature ผิดคืน HTTP 401 โดยไม่อ่าน KV/ส่ง Reply API
- [ ] เขียน event dispatcher ให้รับเฉพาะ 1:1 message/postback/follow; group/room และชนิดที่ไม่รองรับคืน 2xx โดยไม่สร้างคำตอบทางคลินิก
- [ ] เขียน LINE Reply API client ที่ส่ง POST /v2/bot/message/reply และคืนผลสำเร็จ/ล้มเหลวโดยไม่ log raw message, raw webhook หรือ token
- [ ] ทดสอบ LINE Reply API ที่คืน non-2xx แล้ว webhook คืน non-2xx เพื่อให้ redelivery ทำงานได้เมื่อเปิดไว้; ไม่ใช้ Push API เป็นทางแก้
- [ ] รัน npm test -- tests/signature.test.ts tests/webhook.test.ts และ npm run typecheck ให้ผ่าน; commit webhook

**Done when:** signature ป้องกัน webhook ปลอม, 1:1 เท่านั้นที่เข้า router และไม่มีข้อมูลแชทดิบใน log

### Ticket 5: บริบทล่าสุด, event dedup และ KV fail-open (0.5–1 วัน)

**Depends on:** Ticket 4

**Files:** Create src/domain/state.ts, tests/state.test.ts, tests/kv-failure.test.ts; Modify src/index.ts

**Interfaces:** getLastRouteId(userId) → routeId|null; putLastRouteId(userId, routeId) → void; hasReplied(eventId) → boolean; markReplied(eventId) → void; คีย์ userId ต้องเป็น HMAC ไม่ใช่ LINE user ID ตรง

- [ ] เขียน failing tests ว่า context TTL=1800 วินาที, event TTL=86400 วินาที, คีย์ไม่เผย LINE user ID, event ซ้ำหลังตอบสำเร็จไม่ reply อีก, กดหัวข้อใหม่แล้ว context เปลี่ยน และคำสั่งเริ่มใหม่ล้าง context
- [ ] รัน npm test -- tests/state.test.ts tests/kv-failure.test.ts ให้ล้มเพราะ state ยังไม่มี
- [ ] เขียน KV adapter และ HMAC key โดยใช้ secret แยกจาก LINE channel secret; hash webhookEventId ก่อนทำ KV key; ตรวจ event ID ก่อนตอบ และ markReplied หลัง Reply API ตอบรับเท่านั้น
- [ ] จัดการ KV get/put/delete ที่ error หรือเกินโควตา: ถ้า route มาจาก postback/alias ที่ชัดเจนให้ตอบต่อ, ถ้าคำถามต่อจำเป็นต้องใช้ lastRouteId ให้ส่งข้อความขอเลือกหัวข้อใหม่
- [ ] ทดสอบการกดเร็วที่ทำให้ context key เขียนเกิน 1 ครั้ง/วินาที, การอ่าน stale/null และ Reply API สำเร็จแต่ markReplied ล้มเหลว; ห้ามทิ้งข้อความตอบที่สำเร็จแล้วเพราะ KV error
- [ ] รัน npm test -- tests/state.test.ts tests/kv-failure.test.ts tests/webhook.test.ts ให้ผ่าน; commit state handling

**Done when:** การตอบหลักไม่พึ่งความสำเร็จของ KV, ถามต่อไม่ใช้บริบทเก่าหรือคาดเดา และ dedup เป็น best effort ตามสเปก

### Ticket 6: รูปแบบคำตอบและการนำทาง (1 วัน)

**Depends on:** Ticket 5

**Files:** Create src/line/render.ts, tests/render.test.ts; Modify src/index.ts

**Interfaces:** renderRoute(route, uiCopy) → LINE message array; renderChoices(ids, routes) → LINE message array; renderer ห้ามแต่งข้อความคลินิกใหม่

- [ ] เขียน failing tests ว่า route แบบ text ใช้ text จาก JSON ตรงตัว, route แบบ steps ใช้ Flex ที่อ่านข้อความเดิม, next routes กลายเป็น Quick Reply/postback, route กำกวมมีตัวเลือก และ report action แสดงคำเตือนก่อนปุ่ม URI ที่ชี้ Google Form จริงพร้อม URL ที่คัดลอกได้
- [ ] รัน npm test -- tests/render.test.ts ให้ล้มเพราะ renderer ยังไม่มี
- [ ] เขียน renderer ที่อ่านเฉพาะ routes.json/ui.json; Flex เปลี่ยนรูปแบบการแสดงได้แต่ไม่ย่อหรือแปลความ clinical text; ข้อความยาวแยกตาม route ที่ผู้ใช้เลือก ไม่รวมทุก branch
- [ ] เขียน fallback สำหรับ unknown text, unsupported message, missing context และ contact pending จาก ui.json เท่านั้น
- [ ] รัน npm test -- tests/render.test.ts tests/content-snapshot.test.ts และ npm run typecheck ให้ผ่าน; commit renderer

**Done when:** กดทางเลือกแล้วได้ postback routeId จริง, คำตอบคลินิกตรง JSON ทุกตัวอักษร และปุ่มรายงานเตือนก่อนเปิดฟอร์ม

### Ticket 7: Rich Menu 6 ช่องและตัวติดตั้ง (1–1.5 วัน)

**Depends on:** Ticket 6

**Files:** Create assets/rich-menu.png, config/rich-menu.json, scripts/install-rich-menu.mjs, tests/rich-menu.test.ts

**Interfaces:** config มีพื้นที่กด 6 ช่องแบบ 3 คอลัมน์ × 2 แถว; ทุกช่องเป็น postback action ที่ส่ง ID ไม่ใช่ข้อความ label

- [ ] เขียน failing test ว่า config มี 6 actions ตามลำดับ เกิดเหตุแล้วทำอย่างไร?, การเจาะเลือด, การรับยา oPEP, รายงานอุบัติการณ์, ความรู้/แนวทางปฏิบัติ, ติดต่อผู้เกี่ยวข้อง; แต่ละ bounds อยู่ในภาพและไม่ทับกัน
- [ ] รัน npm test -- tests/rich-menu.test.ts ให้ล้มเพราะ config/asset ยังไม่มี
- [ ] ทำภาพ PNG ตามภาพอ้างอิงของผู้ใช้ โดยใช้ 2500×1686 px และไม่เกิน 1 MB; ตรวจความชัดบนมือถือจริง; ไม่ใส่ข้อความทางคลินิกใหม่ใน artwork
- [ ] เขียน config ให้ช่องรายงานส่ง postback ไปคำเตือน ไม่เปิด URL โดยตรง; ช่องความรู้ส่ง route knowledge.overview
- [ ] เขียน installer ที่เรียก LINE API ตามลำดับ create rich menu → upload image → set default; อ่าน token จาก environment เท่านั้น และไม่สร้างเมนูซ้ำทุก webhook
- [ ] รัน npm test -- tests/rich-menu.test.ts และตรวจไฟล์ PNG ด้วย file และ wc -c ให้ผ่าน; commit asset/config/installer โดยไม่ commit token

**Done when:** ภาพและพื้นที่กดตรงกัน 6 ช่อง, ขนาดไฟล์ผ่านข้อกำหนด LINE, installer ใช้ API ครั้งเดียวตอนตั้งค่า

### Ticket 8: รวมระบบ, ทดสอบ LINE OA จริง และ release gate (1.5–2 วัน)

**Depends on:** Tickets 1–7

**Files:** Create docs/release-checklist.md, tests/integration.test.ts; Modify package.json/wrangler.jsonc ตามผลทดสอบจริง

**Interfaces:** ติดตั้ง Worker บน workers.dev พร้อม STATE_KV และ Cloudflare secrets; LINE webhook URL เป็น /webhook; เปิด webhook redelivery

- [ ] เขียน failing integration tests สำหรับ flow หลัก: first aid → เลือกชนิดสัมผัส, lab source → negative/positive, oPEP office/after-hours, knowledge overview → รายละเอียด, report warning → URI, unknown text, stale context, duplicate event, KV failure
- [ ] รัน npm test -- tests/integration.test.ts ให้ล้มเมื่อการประกอบ Worker ยังไม่ครบ แล้วแก้เฉพาะส่วนเชื่อมต่อจนผ่าน
- [ ] รัน npm run content:check, npm run typecheck และ npm test ทั้งชุด; ตรวจว่าทุก clinical route เปิดใช้มี source map และไม่มี snapshot ที่รับโดยไม่เทียบ PDF
- [ ] ตรวจสิทธิ์เผยแพร่ข้อความจากแนวทางกับผู้ว่าจ้างและตรวจ Google Form ว่าเปิดจากบัญชีผู้ใช้จริงได้; หากยังไม่ยืนยัน ห้ามแชร์ QR สู่สาธารณะ
- [ ] ตรวจว่า LINE OA/Cloudflare อยู่ในบัญชีที่ผู้ใช้เป็นเจ้าของและ Cloudflare ใช้แผน Free; สร้าง KV namespace, ใส่ STATE_KV binding แล้วตั้ง LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN และ HMAC secret ใน Cloudflare secrets; deploy Worker; ตั้ง webhook URL/เปิด redelivery; ติดตั้ง default Rich Menu โดยไม่พิมพ์ secret ลง terminal output
- [ ] ทดสอบผ่าน LINE OA จริงบนโทรศัพท์กับบัญชีผู้พัฒนา: ทุกเมนู, alias ไทย, ถามต่อภายใน/หลัง 30 นาที, กรณีตอบไม่ได้และฟอร์ม; ทดสอบ group webhook ด้วย payload จำลองเท่านั้น และใช้ข้อมูลส่วนบุคคลสมมติที่ไม่ใช่ข้อมูลผู้ป่วยจริง
- [ ] วัด Worker CPU ต่อ request และ KV reads/writes ใน Cloudflare dashboard; บันทึกตัวเลข pilot และทบทวนแผนเมื่อ writes ใกล้ 700/วัน; หาก CPU เกิน 10 ms หรือ route ใดผิดต้นฉบับ ให้แก้ก่อนแชร์ QR
- [ ] บันทึกขั้นตอน rollback ด้วย deployment history, วิธีปิด bot ชั่วคราว และผลทดสอบจริงใน release-checklist.md; commit checklist; ส่งต่อไปขั้น /code-review หลัง /implement เสร็จ

**Done when:** tests ทุกชั้นผ่าน, บัญชีพัฒนาทดสอบบน LINE จริงผ่าน, การเผยแพร่เนื้อหาได้รับการยืนยัน, และมีบันทึกค่าใช้ทรัพยากรจริงก่อนแชร์ QR

## Gate ก่อนเริ่ม /implement

แผนนี้เป็น tickets เท่านั้น ยังไม่มีการสร้างโค้ด, Git repository, LINE OA หรือ Cloudflare deployment ในรอบนี้ ผู้ใช้ตรวจลำดับ/ขอบเขตของ tickets ก่อน เมื่อยืนยันแล้วจึงเลือกวิธีลงมือทำและเริ่ม Ticket 1

## แหล่งอ้างอิงแพลตฟอร์ม

- LINE Rich Menu setup: https://developers.line.biz/en/docs/messaging-api/using-rich-menus/
- LINE webhook/redelivery: https://developers.line.biz/en/docs/messaging-api/receiving-messages/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare KV pricing/limits: https://developers.cloudflare.com/kv/platform/pricing/ และ https://developers.cloudflare.com/kv/platform/limits/
