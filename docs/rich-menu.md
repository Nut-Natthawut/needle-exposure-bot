# Rich Menu 6 ช่อง — Ticket 7

ไฟล์ภาพ `assets/rich-menu.png`: PNG 2500×1686, 975654 bytes (ต่ำกว่า 1,000,000)
พิกัดและ action อยู่ใน `config/rich-menu.json`; รูปมีหัวแบรนด์ด้านบนไม่ใช่ปุ่ม
พิกัดแนวคอลัมน์ 0/833/1667 และแนวแถว 450/1065 ตรงกับภาพสุดท้ายที่ตรวจแล้ว
Prompt และ reference ของภาพอยู่ใน [บันทึกภาพ](rich-menu-image-prompt.md)

| ตำแหน่ง | หัวข้อบนภาพ | postback |
| --- | --- | --- |
| ซ้ายบน | เกิดเหตุแล้วทำอย่างไร? | first_aid.root |
| กลางบน | การเจาะเลือด | lab.source.ic04 |
| ขวาบน | การรับยา oPEP | ui.opep |
| ซ้ายล่าง | รายงานอุบัติการณ์ | ui.report |
| กลางล่าง | ความรู้/แนวทางปฏิบัติ | knowledge.overview |
| ขวาล่าง | ติดต่อผู้เกี่ยวข้อง | ui.contact |

ข้อความบนภาพครบตามหัวข้อเดิม ส่วน action label ของช่อง 1/5 ใช้
“เกิดเหตุแล้ว”/“แนวทางปฏิบัติ” เพราะชื่อเต็มเกินข้อจำกัด 20 ตัวอักษรของ Rich Menu
ไม่ได้ตัดหรือแก้คำตอบทางคลินิก ไม่มี medical steps หรือ hospital logo บนภาพ
ปุ่มรายงานเป็น postback เพื่อรับคำเตือนก่อนเปิดฟอร์ม ไม่ใช่ URI ตรงจาก Rich Menu
ปุ่มติดต่อยังตอบข้อมูลรอจัดเตรียม ไม่เพิ่มบุคลากรหรือเบอร์โทรที่ไม่มีข้อมูลต้นทาง

## อัปโหลดเองผ่าน LINE OA Manager (วิธีที่เลือกใช้)

ใช้ภาพ `assets/rich-menu-oa-manager.png`: PNG 2500×1686, 928864 bytes
กับเทมเพลตใหญ่ 6 ช่องเท่ากัน (3 คอลัมน์ × 2 แถว) ไม่มีแถบหัวภาพ
ไม่ใช้ภาพนี้กับพิกัด API ใน `config/rich-menu.json` ซึ่งเป็นของภาพเดิม

เมื่อเลือกเทมเพลตแล้ว กลับหน้าตั้งค่า → รูป → เลือก → อัปโหลดภาพเวอร์ชันนี้
ยังไม่บันทึกเผยแพร่จนกว่าจะตั้ง action ครบทั้ง 6 ช่องและตรวจ preview
วิธีนี้ไม่ต้องใช้ Terminal หรือ Channel access token
การเตรียมไฟล์ในเครื่องยังไม่ใช่การอัปโหลดหรือเปิดใช้เมนูจริง

## ทางเลือก: ติดตั้งเองบนเครื่อง (ไม่ส่ง key ลงแชท)

1. เปิด Terminal ในโฟลเดอร์โปรเจกต์ ตรวจไฟล์ก่อน ยังไม่เรียก LINE:

   ```sh
   npm run rich-menu:check
   ```

2. ใน LINE Developers เลือก Messaging API channel **เข็มทิ่มตำ NKP**
   เปิดแท็บ Messaging API → Channel access token (long-lived) → Copy
   ใช้ token ที่ใช้งานอยู่ ไม่ใช่ Channel secret/HMAC_SECRET และไม่ต้อง Reissue
   หากยังไม่เคยออก token ให้ Issue; ถ้า Reissue token เดิมจะใช้ไม่ได้และต้อง
   เปลี่ยน Cloudflare secret ให้ตรงกันด้วย จึงไม่ควร Reissue โดยไม่จำเป็น

3. รันชุดนี้ใน Terminal เดิม (zsh บน Mac): เมื่อถามให้วาง token แล้ว Enter
   การพิมพ์/วางจะไม่แสดงบนจอ ค่าจริงไม่อยู่ในคำสั่งหรือ history

   ```sh
   (
     set +x
     read -rs 'LINE_CHANNEL_ACCESS_TOKEN?วาง Channel access token แล้ว Enter (ซ่อนค่า): '
     printf '\n'
     export LINE_CHANNEL_ACCESS_TOKEN
     npm run rich-menu:install
   )
   ```

   ตัวแปรอยู่เฉพาะ process ชุดนี้และหายเมื่อจบ ไม่เขียน .env, .dev.vars หรือ Git
   อย่ารันแบบเปิด shell tracing (`set -x`) หรือแชร์ภาพค่าลับ
   ตัวติดตั้งสร้าง/ใช้เมนูเวอร์ชันเดียวกัน → อัปโหลด PNG → ตั้งเมนูหลัก
   → อ่านกลับเพื่อยืนยัน default ถ้าเห็น `INSTALLED + DEFAULT VERIFIED` จึงถือว่า
   LINE API ยอมรับแล้ว; จากนั้นยังต้องตรวจการแสดงและกดปุ่มบนมือถือ

4. เปิดแชท OA ใน LINE มือถือ ปิดแล้วเปิดแชทอีกครั้งหากยังไม่ขึ้น และกดทั้ง 6 ช่อง
   oPEP ต้องให้เลือกใน/นอกเวลาราชการ; รายงานต้องแสดงคำเตือนก่อนเปิดฟอร์ม
   ติดต่อยังเป็น pending ตามข้อมูลเดิม ทดสอบกดเปลี่ยนหัวข้อได้ตามปกติ

## ขอบเขต / การแก้ปัญหา

- Push/deploy Worker **ไม่ใช่**การติดตั้ง Rich Menu ต้องบันทึกใน OA Manager
  หรือรันตัวติดตั้งแยกครั้งเดียวตามวิธีที่เลือก
  ห้าม import เครื่องมือนี้จาก Worker จึงไม่มีการสร้างเมนูทุกข้อความ
- ชื่อเมนูรวม hash ของ config+ภาพ รันซ้ำใช้เมนูเดิมและตรวจ image ก่อน activate
  ถ้าการอัปโหลดครั้งก่อนล้มเหลวจะลองอัปโหลดให้ menu เดิม ไม่ retry อัตโนมัติ
- ถ้า HTTP 401/403 ตรวจว่า token เป็นของ channel นี้; 429 รอแล้วค่อยรันใหม่
  เก็บเฉพาะ operation/status ที่แจ้ง อย่าส่งค่าลับหรือเปิด verbose HTTP logs
- ไม่ตาม redirect, จำกัดเวลาต่อ request 15 วินาที และไม่พิมพ์ response body/key
- การตั้ง default จะแทนเมนูหลักเดิม แต่ไม่ลบเมนูเก่า หากมีเมนูใช้งานอยู่แล้ว
  จด ID/การตั้งค่าเดิมก่อนรัน เพื่อกลับไปตั้ง default เดิมได้
- API list ดูเฉพาะเมนูที่สร้างด้วย Messaging API; เมนูใน OA Manager หรือเมนู
  ที่ผูกเฉพาะผู้ใช้อาจมี priority ต่างกัน ต้องตรวจหาก default ใหม่ยังไม่ปรากฏ
- ไฟล์/พิกัด/POST payload ถูกทดสอบในเครื่องโดยจำลอง external LINE API
  ยังไม่ใช่หลักฐานว่าติดตั้งจริงหรือแสดงถูกใน LINE โทรศัพท์

อ้างอิงข้อกำหนดขนาดภาพ, API create/upload/default และข้อจำกัด label:
[LINE Messaging API](https://developers.line.biz/en/reference/messaging-api/)
และ [Using rich menus](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/)
การใช้ token เดิมและผลของ Reissue: [Channel access tokens](https://developers.line.biz/en/docs/basics/channel-access-token/)
