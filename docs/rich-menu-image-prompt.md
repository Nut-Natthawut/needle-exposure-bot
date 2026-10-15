# Rich Menu artwork provenance

Created with the built-in imagegen tool, not a runtime AI integration.
References: assets/branding/line-chat-visual-reference.png (style),
assets/branding/male-nurse-line-avatar.png (character).
Selected output normalized as PNG 2500×1686 using palette compression;
no labels were added or modified programmatically.
Final asset: assets/rich-menu.png, 975654 bytes.
The generator's final banner was taller than requested. Actual hit bounds were
adjusted after visual inspection: banner 0–449; rows 450–1064 and 1065–1685;
columns 0–832, 833–1666, 1667–2499. Config and independent expected-bound tests
use these final coordinates, not the original prompt coordinates.

## OA Manager equal-template variant (2026-10-11)

The owner selected the large six-equal-cell template (3 columns × 2 rows)
in LINE OA Manager. A separate sibling artwork was edited with the built-in
imagegen tool: `assets/rich-menu-oa-manager.png`. The branding banner was
removed so the six tiles occupy the full canvas. Icons, palette and all six
labels retain the original topics; no clinical content or runtime was changed.
The original API asset/config remains unchanged and must not be paired with
this new image. This variant uses equal row split y=843 and column splits
x=833/1667 at 2500×1686. Normalized opaque PNG: 928864 bytes.
Thai labels and cell placement were visually inspected; no live upload or
phone interaction has been verified yet.

### OA Manager edit prompt

Use case: precise-object-edit. Edit the supplied LINE rich menu artwork into a second final image for LINE OA Manager's standard large SIX EQUAL TILE template. This is flat upload-ready artwork, not a phone screenshot or poster.
CHANGE ONLY THE LAYOUT: remove the entire separate branding banner, including the title, subtitle and nurse mascot. Reflow and expand the existing six tiles across the ENTIRE rectangular canvas, with exactly THREE equally wide columns and TWO equally tall rows. Preserve the six familiar icon designs, mint/white palette, friendly polished 2D illustration style, original Thai labels and reading order. No header, footer, branding strip, character or extra text.
Target aspect ratio 2500:1686. Critical geometric constraint: vertical tile boundaries at 33.333% and 66.667% canvas width; horizontal boundary at EXACTLY 50% canvas height. All six cards same size. Rounded cards inset within each cell, subtle mint gutters, top-left card pale coral and others white with pastel icon circles. Entire layout full canvas. Keep labels/icons strictly within each tile. Center a large icon in the upper half and large bold readable deep-teal text below. Comfortable breathing room, no label collisions. Text around 110px at final 2500px width.
Top-left bandage icon, exact text TWO lines: "เกิดเหตุแล้ว" then "ทำอย่างไร?"
Top-middle blood specimen tube icon, exact text: "การเจาะเลือด"
Top-right violet/red capsules, exact text: "การรับยา oPEP" (lowercase o and uppercase PEP).
Bottom-left clipboard icon, exact text TWO lines: "รายงาน" then "อุบัติการณ์"
Bottom-middle open book icon, exact text TWO lines: "ความรู้/" then "แนวทางปฏิบัติ"
Bottom-right red phone icon, exact text TWO lines: "ติดต่อ" then "ผู้เกี่ยวข้อง"
Maintain accurate Thai characters and combining marks, no changes to labels. No medical instructions, hospital marks, logos, QR code or watermark. Opaque full bleed PNG. Match the current pleasing artwork, but rigorously fit the equal 3x2 full-canvas template.

## Final generation prompt

Use case: ui-mockup. Asset type: final flat PNG artwork for a real LINE Official Account rich menu, NOT a phone mockup or poster.
Input 1 is a STYLE reference only: use the mint/white six-tile rich menu shown inside the left phone, not other phone contents or medical text. Input 2 is CHARACTER reference: preserve this cute male nurse's recognizable face, green surgical cap/mask and wai pose.
Produce ONE polished, professional, friendly 2D illustrated menu in landscape ratio 2500:1686. It will be resized to exactly 2500x1686 pixels, so use these precise normalized coordinates:
Top branding banner x0..2500 y0..350 (20.759% height). Soft pale mint background, dark deep teal bold Thai brand text on left exactly "เข็มทิ่มตำ NKP", smaller subtitle exactly "เลือกหัวข้อที่ต้องการ". Male nurse mascot on far right INSIDE banner, with breathing space. No hospital logo.
Below banner: SIX equal hit-area tiles, THREE columns and TWO rows. Columns x0..833,833..1667,1667..2500. Rows y350..1018 and1018..1686. All visible tile borders and content must remain strictly within these cells. Rounded white cards inset 25px per cell, delicate mint borders and airy spacing. First tile pale coral to emphasize urgent topic. Others white/light mint with subtle pastel accent. Grid no footer and no extra row.
Each tile: one LARGE consistent illustration icon above a LARGE crisp dark-teal Thai label, centered, font about110px on target canvas for phone readability, with Thai combining marks correct. Icons about220–260px. No tiny labels.
Tile1 top-left: coral bandage icon. EXACT TEXT two lines "เกิดเหตุแล้ว" then "ทำอย่างไร?"
Tile2 top-middle: blood specimen tube icon. EXACT TEXT "การเจาะเลือด"
Tile3 top-right: violet/red capsules icon. EXACT TEXT "การรับยา oPEP" (oPEP exact mixed case).
Tile4 bottom-left: teal clipboard icon. EXACT TEXT two lines "รายงาน" then "อุบัติการณ์"
Tile5 bottom-middle: teal open book icon. EXACT TEXT two lines "ความรู้/" then "แนวทางปฏิบัติ"
Tile6 bottom-right: coral telephone handset icon. EXACT TEXT two lines "ติดต่อ" then "ผู้เกี่ยวข้อง"
Use clean cohesive illustrated icons, restrained shadows, premium organized composition, not clipart or emojis. Maintain consistent icon scale and typography. No phone frames, no LINE logo, no watermark, no QR code, no medical instructions, no hospital claims, no new words beyond exact labels and banner. Full bleed rectangle, opaque background. High fidelity Thai spelling is essential.
