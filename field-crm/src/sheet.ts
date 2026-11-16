import type { Bill, Customer, DB, Product, Task, Visit } from './data'
import { normDate, num } from './lib'

type Grid = string[][]
const rowsOf = (g?: Grid) => {
  if (!g || g.length < 2) return [] as Record<string, string>[]
  const h = g[0]
  return g.slice(1).map(r => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? '').trim()]).filter(([k]) => k)))
}

/** ดึงข้อมูลจากชีท A ผ่าน Apps Script (อ่านอย่างเดียว) แล้วรวมกับข้อมูลที่เซลล์บันทึกไว้ในเครื่อง */
export async function syncFromSheet(url: string, token: string, months: number, cur: DB): Promise<{ db: DB; counts: Record<string, number> }> {
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}&months=${months}`)
  if (!res.ok) throw new Error('เชื่อมต่อไม่ได้ (HTTP ' + res.status + ')')
  const j = await res.json().catch(() => { throw new Error('ตอบกลับไม่ใช่ข้อมูล JSON — ตรวจ URL /exec และสิทธิ์การเข้าถึง') })
  if (j.error) throw new Error(j.error === 'unauthorized' ? 'TOKEN ไม่ถูกต้อง' : String(j.error))

  const labels: Record<string, string[]> = {}
  rowsOf(j.customer_labels).forEach(r => { (labels[r.customerId] ||= []).push(r.label) })
  const customers: Customer[] = rowsOf(j.customers)
    .filter(r => r.id && r.name && r.activeFlag?.toLowerCase() !== 'false')
    .map(r => ({
      id: r.id, name: r.name, type: r.type || 'อื่น ๆ', address: r.address, phone: r.phone, contactName: r.contactName,
      paymentTerm: r.paymentTerm || 'เงินสด', lineId: r.lineId, lat: num(r.gpsLat) || undefined, lng: num(r.gpsLng) || undefined,
      specialConditions: r.specialConditions, storeHours: r.storeHours, note: r.customerNote || r.keepNote,
      visitCycleDays: parseInt(r.visitCycleDays) || 14, area: r.area || labels[r.id]?.[0] || '-',
      labels: labels[r.id] || [r.area, r.type].filter(Boolean), src: 'sheet' as const,
    }))
    .map(c => ({ ...c, ...(cur.patches?.[c.id] || {}) }))

  const items: Record<string, Bill['items']> = {}
  rowsOf(j.bill_items).forEach(r => { (items[r.billNo] ||= []).push({ code: r.code, name: r.name, qty: num(r.qty) || 0, price: num(r.price) || 0, unit: r.unit || undefined }) })
  const bills: Bill[] = rowsOf(j.bills).filter(r => r.no && items[r.no]).map(r => ({
    no: r.no, date: normDate(r.date) || r.date, customerId: r.customerId, customerName: r.customerName, items: items[r.no],
    vatMode: (r.vatMode as Bill['vatMode']) || 'NONE', salesperson: r.salesperson, paymentTerm: r.paymentTerm, src: 'sheet' as const,
  }))
  const products: Product[] = rowsOf(j.products).filter(r => r.code && r.name).map(r => ({ code: r.code, name: r.name, price: num(r.price) || 0, src: 'sheet' as const }))
  // ถ้าแท็บ products ไม่มีราคา ให้ดึงราคาล่าสุดจากบิล
  const lastPrice: Record<string, number> = {}
  bills.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(b => b.items.forEach(i => { lastPrice[i.code] = i.price }))
  products.forEach(p => { if (!p.price) p.price = lastPrice[p.code] || 0 })

  const visits: Visit[] = rowsOf(j.visits).filter(r => r.visitId && r.customerId).map(r => ({
    id: r.visitId, customerId: r.customerId, at: r.completedAt || r.at, outcome: r.outcome || r.status, note: r.note,
    lat: num(r.lat) || undefined, lng: num(r.lng) || undefined, src: 'sheet' as const,
  }))
  const tasks: Task[] = rowsOf(j.tasks).filter(r => r.taskId && r.customerId).map(r => ({
    id: r.taskId, customerId: r.customerId, type: r.type, title: r.title, dueAt: normDate(r.dueAt) || r.dueAt,
    status: r.status === 'done' ? 'done' : 'open', note: r.note, src: 'sheet' as const,
  }))

  // เก็บข้อมูลที่เซลล์สร้างในเครื่อง (ไม่มี src หรือ import) ทิ้งข้อมูลตัวอย่าง
  const mine = <T extends { src?: string }>(a: T[]) => a.filter(x => !x.src || x.src === 'import')
  const ids = new Set(customers.map(c => c.id)), codes = new Set(products.map(p => p.code)), bnos = new Set(bills.map(b => b.no))
  const db: DB = {
    customers: [...customers, ...mine(cur.customers).filter(c => !ids.has(c.id))],
    products: [...products, ...mine(cur.products).filter(p => !codes.has(p.code))],
    bills: [...bills, ...mine(cur.bills).filter(b => !bnos.has(b.no))],
    visits: [...visits, ...mine(cur.visits)], tasks: [...tasks, ...mine(cur.tasks)], activities: mine(cur.activities),
    patches: cur.patches, syncedAt: new Date().toISOString(),
  }
  return { db, counts: { ลูกค้า: customers.length, บิล: bills.length, สินค้า: products.length, เยี่ยม: visits.length, งาน: tasks.length } }
}
