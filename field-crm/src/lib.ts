import type { Bill, BillItem, Customer } from './data'

/* ---------- วันที่ / ตัวเลข ---------- */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const todayStr = () => ymd(new Date())
export const localDay = (iso: string) => ymd(new Date(iso))
export const baht = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 })
export const fmt = (iso: string) => new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
export const daysSince = (iso?: string) => (iso ? Math.floor((Date.now() - new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).getTime()) / 86400000) : 9999)
export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/** แปลงวันที่หลายรูปแบบ (dd/mm/yyyy, yyyy-mm-dd, พ.ศ.) เป็น yyyy-mm-dd — คืนค่าว่างถ้าอ่านไม่ได้ */
export function normDate(s: string): string {
  const t = (s || '').trim(); if (!t) return ''
  let y: number, m: number, d: number, r: RegExpMatchArray | null
  if ((r = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) { y = +r[1]; m = +r[2]; d = +r[3] }
  else if ((r = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) { d = +r[1]; m = +r[2]; y = +r[3]; if (y < 100) y += 2000 }
  else return ''
  if (y > 2400) y -= 543
  if (m < 1 || m > 12 || d < 1 || d > 31) return ''
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
export const cname = (c?: { id: string; name: string }, fb = '') => (c ? `${c.id} · ${c.name}` : fb)
export const num = (s: string) => { const n = parseFloat((s || '').replace(/,/g, '').trim()); return isNaN(n) ? NaN : n }

/* ---------- ระยะทาง / แผนที่ ---------- */
export function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, t = (x: number) => (x * Math.PI) / 180
  const dLat = t(b.lat - a.lat), dLng = t(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
export const kmTo = (c: Customer, p: { lat: number; lng: number }) => (c.lat == null || c.lng == null ? Infinity : distM({ lat: c.lat, lng: c.lng }, p) / 1000)
export const mapLink = (lat: number, lng: number) => `https://maps.google.com/?q=${lat},${lng}`
export const navUrl = (c: Customer) =>
  c.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}` :
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name + ' ' + c.address)}`

export type Pos = { lat: number; lng: number; accuracy: number }
export function getPosition(): Promise<Pos> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('อุปกรณ์ไม่รองรับ GPS'))
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => rej(new Error(e.code === 1 ? 'ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง (ตั้งค่าเบราว์เซอร์)' : 'อ่านตำแหน่งไม่ได้ ลองออกที่โล่งแล้วกดใหม่')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  })
}

/* ---------- ยอดบิล ---------- */
export const VAT = 0.07
export function billTotals(b: Pick<Bill, 'items' | 'vatMode'>) {
  const sub = b.items.reduce((s, i) => s + i.qty * i.price, 0)
  if (b.vatMode === 'VAT_OUT') { const v = sub * VAT; return { sub, vat: v, total: sub + v } }
  if (b.vatMode === 'VAT_IN') return { sub: sub - (sub * VAT) / (1 + VAT), vat: (sub * VAT) / (1 + VAT), total: sub }
  return { sub, vat: 0, total: sub }
}
export const vatLabel = (m?: string) => (m === 'VAT_OUT' ? 'แยก VAT 7%' : m === 'VAT_IN' ? 'รวม VAT แล้ว' : 'ไม่มี VAT')

/* ---------- ตั้งค่า (บริษัท / ชีท) ---------- */
export type Settings = {
  sheetUrl: string; sheetToken: string; months: number
  companyName: string; companyAddress: string; companyPhone: string; companyTaxId: string; bankInfo: string
  salesName: string; billBase: string
}
const SKEY = 'field-crm-settings-v1'
export const defaultSettings: Settings = {
  sheetUrl: '', sheetToken: '', months: 12, companyName: 'หจก.ฮาแวน คอสเมติค', companyAddress: '', companyPhone: '02-460-1668, 02-875-7977-8',
  companyTaxId: '', bankInfo: 'ธนาคารกรุงไทย 029-1-42575-5', salesName: '', billBase: '',
}
export function loadSettings(): Settings {
  try { const s = localStorage.getItem(SKEY); if (s) return { ...defaultSettings, ...JSON.parse(s) } } catch { /* ignore */ }
  return defaultSettings
}
export function saveSettings(s: Settings) { try { localStorage.setItem(SKEY, JSON.stringify(s)) } catch { /* ignore */ } }

/* ---------- ลิงก์หน้าบิล (ข้อมูลฝังใน URL ไม่ต้องมีเซิร์ฟเวอร์) ---------- */
export type SharedBill = { n: string; d: string; c: string; cc?: string; ad?: string; cp?: string; sl?: string; i: [string, number, number, string?, string?][]; v?: string; p?: string; co: string; ph?: string; tx?: string; bk?: string }
const b64e = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64d = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))
export function billLink(b: Bill, cust: Customer | undefined, s: Settings) {
  const data: SharedBill = {
    n: b.no, d: b.date, c: cust?.name || b.customerName || '', cc: cust?.id || b.customerId, ad: cust?.address, cp: [cust?.phone, cust?.contactName].filter(Boolean).join(' '), sl: b.salesperson || s.salesName, i: b.items.map(i => [i.name, i.qty, i.price, i.code, i.unit]), v: b.vatMode, p: b.paymentTerm || cust?.paymentTerm,
    co: s.companyName, ph: s.companyPhone, tx: s.companyTaxId, bk: s.bankInfo,
  }
  const base = s.billBase || location.origin + location.pathname
  return `${base}#bill=${b64e(JSON.stringify(data))}`
}
export function readBillHash(): SharedBill | null {
  const m = location.hash.match(/^#bill=(.+)$/); if (!m) return null
  try { return JSON.parse(b64d(m[1])) } catch { return null }
}

/* ---------- ข้อความแชร์ ---------- */
export const lineShare = (text: string) => `https://line.me/R/share?text=${encodeURIComponent(text)}`
export const smsLink = (phone: string, text: string) => `sms:${phone.replace(/[^0-9+]/g, '')}?body=${encodeURIComponent(text)}`
export function companyOrderText(b: Bill, cust: Customer | undefined, s: Settings) {
  const t = billTotals(b)
  return [
    `🧾 ออเดอร์ใหม่ ${b.no}`, `ลูกค้า: ${cust ? cname(cust) : [b.customerId, b.customerName].filter(Boolean).join(' · ')}`,
    `วันที่: ${fmt(b.date)}   เงื่อนไข: ${b.paymentTerm || cust?.paymentTerm || '-'}`, '', 'รายการ:',
    ...b.items.map(i => `• ${i.name} ×${i.qty} @${baht(i.price)} = ${baht(i.qty * i.price)}`), '',
    `รวม ${baht(t.total)} บาท (${vatLabel(b.vatMode)})`, `เซลล์: ${b.salesperson || s.salesName || '-'}`,
    ...(b.lat != null && b.lng != null ? [`📍 ${mapLink(b.lat, b.lng)}`] : []),
  ].join('\n')
}
export function customerBillText(b: Bill, cust: Customer | undefined, s: Settings) {
  const t = billTotals(b)
  return [
    `เรียน ${cust?.contactName || cust?.name || 'ลูกค้า'}`, `${s.companyName} ขอแจ้งยอดบิลเลขที่ ${b.no} วันที่ ${fmt(b.date)}`,
    `รหัสลูกค้า: ${b.customerId}`, `ยอดรวม ${baht(t.total)} บาท (${b.paymentTerm || cust?.paymentTerm || 'เงินสด'})`,
    s.bankInfo ? `ช่องทางชำระเงิน: ${s.bankInfo}` : '', `ดูใบแจ้งยอด: ${billLink(b, cust, s)}`, 'ขอบคุณที่ใช้บริการค่ะ/ครับ',
  ].filter(Boolean).join('\n')
}
export async function copyText(t: string) { try { await navigator.clipboard.writeText(t); return true } catch { return false } }

/* ---------- ดาวน์โหลด CSV ---------- */
export function downloadCSV(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const blob = new Blob(['﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
export function billRows(bills: Bill[], byId: Record<string, Customer>): (string | number)[][] {
  const out: (string | number)[][] = [['billNo', 'date', 'customerId', 'customerName', 'paymentTerm', 'vatMode', 'line', 'code', 'name', 'qty', 'price', 'amount']]
  bills.forEach(b => b.items.forEach((i, k) => out.push([b.no, b.date, b.customerId, byId[b.customerId]?.name ?? b.customerName ?? '', b.paymentTerm ?? '', b.vatMode ?? 'NONE', k + 1, i.code, i.name, i.qty, i.price, i.qty * i.price])))
  return out
}
export type { BillItem }

/* ---------- แยกไฟล์ข้อความ (csv / tsv / txt) ---------- */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find(l => l.trim()) || ''
  const c: [string, number][] = ['\t', ',', '|', ';'].map(d => [d, line.split(d).length - 1])
  c.sort((a, b) => b[1] - a[1]); return c[0][1] > 0 ? c[0][0] : ','
}
export function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false
  text = text.replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += ch }
    else if (ch === '"' && cur === '') q = true
    else if (ch === delim) { row.push(cur); cur = '' }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else if (ch !== '\r') cur += ch
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}
/** อ่านไฟล์: ลอง UTF-8 ก่อน ถ้าเพี้ยนใช้ Windows-874 (ไฟล์ไทยจากโปรแกรมบัญชีรุ่นเก่า) */
export async function readTextFile(f: File, enc: 'auto' | 'utf-8' | 'windows-874'): Promise<{ text: string; enc: string }> {
  const buf = await f.arrayBuffer()
  if (enc === 'auto') { try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), enc: 'utf-8' } } catch { enc = 'windows-874' } }
  return { text: new TextDecoder(enc).decode(buf), enc }
}

/* ---------- รูปถ่าย: ย่อ + ลายน้ำเวลา/พิกัด + เก็บใน IndexedDB ---------- */
export async function stampPhoto(file: File, caption: string): Promise<string> {
  const bmp = await createImageBitmap(file)
  const max = 1280, k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k)
  const g = cv.getContext('2d')!; g.drawImage(bmp, 0, 0, cv.width, cv.height)
  const fs = Math.max(14, Math.round(cv.width / 36)); g.font = `bold ${fs}px sans-serif`
  const lines = caption.split('\n'); const h = lines.length * (fs + 4) + 10
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, cv.height - h, cv.width, h)
  g.fillStyle = '#fff'; lines.forEach((l, i) => g.fillText(l, 10, cv.height - h + 8 + (i + 1) * (fs + 4) - 4))
  return cv.toDataURL('image/jpeg', 0.72)
}
const idb = (): Promise<IDBDatabase> => new Promise((res, rej) => {
  const r = indexedDB.open('field-crm-photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
})
export async function putPhoto(id: string, dataUrl: string) { const db = await idb(); await new Promise<void>((res, rej) => { const t = db.transaction('p', 'readwrite'); t.objectStore('p').put(dataUrl, id); t.oncomplete = () => res(); t.onerror = () => rej(t.error) }) }
export async function getPhoto(id: string): Promise<string | undefined> { try { const db = await idb(); return await new Promise(res => { const r = db.transaction('p').objectStore('p').get(id); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined) }) } catch { return undefined } }

/** อ่านจำนวนเงินเป็นตัวหนังสือภาษาไทย เช่น 10600 → หนึ่งหมื่นหกร้อยบาทถ้วน */
export function bahtText(n: number): string {
  const D = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'], P = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']
  const six = (str: string): string => {
    let out = ''; const L = str.length
    for (let i = 0; i < L; i++) {
      const d = +str[i], p = L - i - 1; if (!d) continue
      if (p === 1) out += d === 1 ? 'สิบ' : d === 2 ? 'ยี่สิบ' : D[d] + 'สิบ'
      else if (p === 0) out += d === 1 && L > 1 ? 'เอ็ด' : D[d]
      else out += D[d] + P[p]
    }
    return out
  }
  const read = (str: string): string => { str = str.replace(/^0+/, ''); if (!str) return ''; return str.length > 6 ? read(str.slice(0, -6)) + 'ล้าน' + six(str.slice(-6)) : six(str) }
  const [b, s] = (Math.round(n * 100) / 100).toFixed(2).split('.')
  return (read(b) || 'ศูนย์') + 'บาท' + (s === '00' ? 'ถ้วน' : six(String(+s)) + 'สตางค์')
}
/** dd/mm/yyyy (พ.ศ.) */
export const fmtTH = (d: string) => { const [y, m, dd] = d.slice(0, 10).split('-'); return `${dd}/${m}/${+y + 543}` }
export const dueDate = (date: string, term?: string) => {
  const n = +(term?.match(/(\d+)\s*วัน/)?.[1] || 0); if (!n) return date
  const [y, m, d] = date.split('-').map(Number); return ymd(new Date(y, m - 1, d + n))
}
