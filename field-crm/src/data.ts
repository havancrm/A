// โครงสร้างอ้างอิงจากชีท A: customers / bills / visits / tasks / activities / products
type Src = { src?: 'demo' | 'sheet' | 'import' }
export type Customer = Src & {
  id: string; name: string; type: string; address: string; phone: string; contactName: string
  paymentTerm: string; lat?: number; lng?: number; lineId?: string; specialConditions?: string
  storeHours?: string; visitCycleDays: number; note?: string; area: string; labels: string[]
}
export type Visit = Src & { id: string; customerId: string; at: string; outcome: string; note: string; lat?: number; lng?: number; accuracy?: number; distM?: number; photoIds?: string[] }
export type Task = Src & { id: string; customerId: string; type: string; title: string; dueAt: string; status: 'open' | 'done'; note: string }
export type Activity = Src & { id: string; customerId: string; type: string; at: string; note: string }
export type BillItem = { code: string; name: string; qty: number; price: number }
export type Bill = Src & { no: string; date: string; customerId: string; customerName?: string; items: BillItem[]; vatMode?: 'NONE' | 'VAT_OUT' | 'VAT_IN'; salesperson?: string; paymentTerm?: string; lat?: number; lng?: number }
export type Product = Src & { code: string; name: string; price: number }
export type DB = {
  customers: Customer[]; visits: Visit[]; tasks: Task[]; activities: Activity[]; bills: Bill[]; products: Product[]
  patches?: Record<string, Partial<Customer>>; syncedAt?: string
}

export const OUTCOMES = ['สั่งสินค้า', 'ยังไม่สั่ง สินค้ายังเหลือ', 'ร้านปิด / ไม่พบเจ้าของ', 'ขอใบเสนอราคา', 'เก็บเงิน', 'นัดมาใหม่']
export const TASK_TYPES = ['ติดตาม', 'ส่งของ', 'เก็บเงิน', 'เสนอสินค้าใหม่']

export const PRODUCTS: Product[] = [
  { code: '4025', name: 'แชมพู อโวคาโด้', price: 115 },
  { code: '5029', name: 'ครีมนวด อโวคาโด้', price: 140 },
  { code: '9617', name: 'โลชั่น 3,200 ml. กลิ่นน้ำนมข้าว', price: 220 },
  { code: '7110', name: 'น้ำมันนวด ลาเวนเดอร์ 1 ลิตร', price: 185 },
  { code: '7120', name: 'ครีมนวดตัว ตะไคร้', price: 160 },
  { code: '3301', name: 'สครับเกลือ มะขาม', price: 130 },
  { code: '6205', name: 'แชมพูสุนัข สูตรอ่อนโยน', price: 125 },
  { code: '8801', name: 'น้ำยาเคลือบเงา ภายในรถ', price: 210 },
]

const dayISO = (offset: number, hour = 10) => {
  const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(hour, 0, 0, 0); return d.toISOString()
}
const dateOnly = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// ชื่อร้านสมมติทั้งหมด — ไม่ใช่ข้อมูลลูกค้าจริง
const SEED: [string, string, string, string, string][] = [
  ['บ้านนวดใบเตย (พระราม 2)', 'นวด/สปา', 'พระราม 2', 'คุณ ใบเตย', 'เงินสด'],
  ['สปาเรือนไทย (บางขุนเทียน)', 'นวด/สปา', 'พระราม 2', 'คุณ นิด', 'เครดิต 30 วัน'],
  ['ร้านเสริมสวย ออร์คิด', 'เสริมสวย/ซาลอน', 'สุขสวัสดิ์', 'คุณ ออย', 'เงินสด'],
  ['Hair Studio มินท์', 'เสริมสวย/ซาลอน', 'ลาดพร้าว', 'คุณ มินท์', 'โอน'],
  ['ตัดขนสุนัข ป๋อมแป๋ม', 'เพ็ทช็อป/กรูมมิ่ง', 'ลาดพร้าว', 'คุณ ป๋อง', 'เงินสด'],
  ['คาร์แคร์ สายฟ้า', 'คาร์แคร์/ติดฟิล์ม', 'พัฒนาการ', 'คุณ ฟ้า', 'เงินสด'],
  ['นวดแผนไทย สบายใจ', 'นวด/สปา', 'บางแค', 'คุณ จ๋า', 'เงินสด'],
  ['ร้านขายส่ง ศรีสมบูรณ์', 'ค้าปลีก/ค้าส่ง', 'บางแค', 'คุณ สมบูรณ์', 'เครดิต 15 วัน'],
  ['สปาปลายฟ้า (ท่าข้าม)', 'นวด/สปา', 'พระราม 2', 'คุณ ฟ้า', 'โอน'],
  ['ซาลอน ลูกพีช', 'เสริมสวย/ซาลอน', 'บางนา', 'คุณ พีช', 'เงินสด'],
  ['เพ็ทกรูมมิ่ง ข้าวโพด', 'เพ็ทช็อป/กรูมมิ่ง', 'บางนา', 'คุณ โพด', 'เงินสด'],
  ['นวดเท้า ฟุตแคร์ 24', 'นวด/สปา', 'พัฒนาการ', 'คุณ แคร์', 'เงินสด'],
  ['โรงแรม บ้านสวนริมคลอง', 'โรงแรม/ที่พัก', 'พระราม 2', 'คุณ ปรีชา', 'เครดิต 30 วัน'],
  ['ร้านขายยา เภสัชวิถี', 'ร้านขายยา', 'ลาดพร้าว', 'ภก. วิถี', 'โอน'],
  ['สปา ลานตะวัน', 'นวด/สปา', 'บางแค', 'คุณ ตะวัน', 'เงินสด'],
  ['เสริมสวย แพรวา', 'เสริมสวย/ซาลอน', 'สุขสวัสดิ์', 'คุณ แพรว', 'เงินสด'],
  ['ซักรีด ขาวสะอาด', 'ซักรีด', 'บางนา', 'คุณ ขาว', 'เงินสด'],
  ['คาร์ฟิล์ม ออโต้พลัส', 'คาร์แคร์/ติดฟิล์ม', 'พัฒนาการ', 'คุณ พลัส', 'โอน'],
  ['บ้านนวด อโรมา เฮ้าส์', 'นวด/สปา', 'ลาดพร้าว', 'คุณ อโรมา', 'เงินสด'],
  ['ร้านเสริมสวย ดาวเรือง', 'เสริมสวย/ซาลอน', 'พระราม 2', 'คุณ ดาว', 'เงินสด'],
  ['สปาสมุนไพร เรือนรักษ์', 'นวด/สปา', 'สุขสวัสดิ์', 'คุณ รักษ์', 'เครดิต 15 วัน'],
  ['มินิมาร์ท สุขใจ', 'ค้าปลีก/ค้าส่ง', 'บางแค', 'คุณ ใจ', 'เงินสด'],
]

function rnd(seed: number) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 } }

export function buildDemo(): DB {
  const r = rnd(7)
  const customers: Customer[] = SEED.map((s, i) => ({
    id: String(60001 + i), name: s[0], type: s[1], area: s[2], contactName: s[3], paymentTerm: s[4],
    address: `ซอย ${Math.floor(r() * 40) + 1} แขวง/ตำบลตัวอย่าง (ข้อมูลสมมติ)`,
    phone: `08${Math.floor(r() * 9)}-${String(Math.floor(r() * 900) + 100)}-${String(Math.floor(r() * 9000) + 1000)}`,
    lat: 13.55 + r() * 0.35, lng: 100.35 + r() * 0.25,
    storeHours: i % 3 === 0 ? '10:00–21:00' : i % 3 === 1 ? '11:00–22:00 (ปิดวันอังคาร)' : '09:30–19:00',
    visitCycleDays: [7, 14, 14, 21, 30][i % 5],
    specialConditions: i % 4 === 0 ? 'ต้องส่งก่อน 14:00 / ขอใบกำกับภาษีทุกครั้ง' : i % 7 === 0 ? 'เจ้าของไม่อยู่ช่วงเช้า' : '',
    note: i % 5 === 0 ? 'ชอบกลิ่นลาเวนเดอร์ สนใจโปรโมชั่นแพ็กใหญ่' : '',
    lineId: i % 2 ? `shop${60001 + i}` : '', labels: [s[2], s[1].split('/')[0]],
  }))
  const visits: Visit[] = []; const activities: Activity[] = []; const bills: Bill[] = []
  customers.forEach((c, i) => {
    const last = -((i * 5) % 40) - 2
    visits.push({ id: `V-${c.id}-1`, customerId: c.id, at: dayISO(last), outcome: OUTCOMES[i % 3], note: i % 3 === 1 ? 'สินค้ายังเหลือ ให้กลับมาอาทิตย์หน้า' : 'รับออเดอร์ตามปกติ' })
    if (i % 2 === 0) visits.push({ id: `V-${c.id}-0`, customerId: c.id, at: dayISO(last - c.visitCycleDays), outcome: OUTCOMES[0], note: '' })
    activities.push({ id: `A-${c.id}-1`, customerId: c.id, type: i % 2 ? 'โทร' : 'รับออเดอร์', at: dayISO(last, 14), note: '' })
    for (let b = 0; b < 3; b++) {
      const items = [0, 1, 2].slice(0, 1 + ((i + b) % 3)).map(k => {
        const p = PRODUCTS[(i + b + k) % PRODUCTS.length]; return { code: p.code, name: p.name, qty: 2 + ((i + k + b) % 8), price: p.price }
      })
      bills.push({ no: `${406000 + i * 3 + b}`, date: dateOnly(last - b * c.visitCycleDays), customerId: c.id, items })
    }
  })
  const tasks: Task[] = [
    { id: 'T-1', customerId: customers[1].id, type: 'ติดตาม', title: 'ติดตามผลทดลองสินค้าใหม่', dueAt: dateOnly(0), status: 'open', note: '' },
    { id: 'T-2', customerId: customers[4].id, type: 'ส่งของ', title: 'ส่งแชมพูสุนัข 12 ขวด', dueAt: dateOnly(0), status: 'open', note: 'ก่อนบ่าย 2' },
    { id: 'T-3', customerId: customers[7].id, type: 'เก็บเงิน', title: 'เก็บเงินบิลค้าง', dueAt: dateOnly(-2), status: 'open', note: '' },
    { id: 'T-4', customerId: customers[12].id, type: 'เสนอสินค้าใหม่', title: 'เสนอน้ำมันนวดแพ็กใหญ่', dueAt: dateOnly(2), status: 'open', note: '' },
    { id: 'T-5', customerId: customers[3].id, type: 'ติดตาม', title: 'โทรถามออเดอร์', dueAt: dateOnly(-1), status: 'done', note: '' },
  ]
  const m = <T,>(a: T[]) => a.map(x => ({ ...x, src: 'demo' as const }))
  return { customers: m(customers), visits: m(visits), tasks: m(tasks), activities: m(activities), bills: m(bills), products: m(PRODUCTS) }
}
