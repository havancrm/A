import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Link2, MessageCircle, MessageSquare, Printer, Copy, Building2, Search } from 'lucide-react'
import type { Bill, Customer } from './data'
import {
  baht, bahtText, billLink, billRows, dueDate, fmtTH, billTotals, companyOrderText, copyText, customerBillText, downloadCSV, fmt, lineShare, smsLink, vatLabel, type Settings, type SharedBill,
} from './lib'
import { btnGhost, Sheet } from './ui'

export type PaperItem = { code?: string; name: string; qty: number; price: number; unit?: string }
export type PaperData = { no: string; date: string; customer: string; code?: string; address?: string; phone?: string; sales?: string; items: PaperItem[]; vatMode?: string; paymentTerm?: string }
export type Template = 'form' | 'slip'
const BLUE = '#0043ba'
type PaperSettings = Pick<Settings, 'companyName' | 'companyAddress' | 'companyPhone' | 'companyTaxId' | 'bankInfo'>
const PAPER_W = 730

/** ฟอร์ม "ใบส่งสินค้าชั่วคราว" ตามแบบบิลของบริษัท (A4 แนวตั้ง) */
function FormPaper({ d, s }: { d: PaperData; s: PaperSettings }) {
  const t = billTotals({ items: d.items.map(i => ({ code: '', name: i.name, qty: i.qty, price: i.price })), vatMode: d.vatMode as Bill['vatMode'] })
  const ROWS = 13, filler = Math.max(0, ROWS - d.items.length)
  const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const th = (hd: string, sub: string, w: number) => <th style={{ width: w || undefined, background: BLUE, color: '#fff', fontWeight: 600, padding: '4px 2px', lineHeight: 1.15, borderLeft: '1px solid #fff' }}><div style={{ fontSize: 15 }}>{hd}</div><div style={{ fontSize: 12, fontWeight: 400 }}>{sub}</div></th>
  const cell = (extra: React.CSSProperties = {}): React.CSSProperties => ({ borderLeft: `1px solid ${BLUE}`, padding: '2px 8px', height: 28, ...extra })
  const dueTH = fmtTH(dueDate(d.date, d.paymentTerm))
  return (
    <div style={{ width: PAPER_W, boxSizing: 'border-box', background: '#fff', color: BLUE, padding: '14px 14px 10px', fontFamily: "'Sarabun','Noto Sans Thai',system-ui,sans-serif", fontSize: 15, lineHeight: 1.3 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 235px', alignItems: 'center', columnGap: 8 }}>
        <img src="/havan-logo.png" alt="Havan Cosmetic" style={{ width: 200, height: 'auto', display: 'block' }} />
        <div style={{ textAlign: 'center', fontSize: 25, fontWeight: 700, borderBottom: `2px solid ${BLUE}`, paddingBottom: 1, margin: '0 10px' }}>ใบส่งสินค้าชั่วคราว</div>
        <div style={{ textAlign: 'right', fontSize: 16, whiteSpace: 'nowrap' }}><div>{s.companyName}</div><div>{s.bankInfo}</div></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
        <div>
          <div style={{ fontSize: 15.5 }}>โทร. {s.companyPhone || '02-460-1668'} โทรสาร. 02-875-8621</div>
          <div style={{ display: 'flex', gap: 22, fontSize: 14, fontWeight: 600, marginTop: 3 }}>
            <span><b style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 5, background: BLUE, color: '#fff', textAlign: 'center', fontSize: 11, lineHeight: '18px', marginRight: 6 }}>L</b>HAVANCOSMETIC</span>
            <span><b style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 9, background: BLUE, color: '#fff', textAlign: 'center', fontSize: 12, lineHeight: '19px', marginRight: 6 }}>f</b>HAVANCOSMETICTHAILAND</span>
          </div>
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, paddingRight: 28 }}><span style={{ fontWeight: 500, fontSize: 17 }}>เลขที่ : </span>{d.no}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', border: `1.5px solid ${BLUE}`, borderRadius: 14, marginTop: 8, minHeight: 118 }}>
        <div style={{ padding: '8px 12px', borderRight: `1.5px solid ${BLUE}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 17, fontWeight: 600 }}><span><span style={{ fontWeight: 500 }}>ลูกค้า : </span>{d.customer}</span>{d.code && <span style={{ whiteSpace: 'nowrap' }}><span style={{ fontWeight: 500 }}>รหัส </span>{d.code}</span>}</div>
          <div style={{ fontSize: 12.5, marginTop: -2 }}>Customer</div>
          {d.address && <div style={{ fontSize: 14, marginTop: 2 }}>{d.address}</div>}
          {d.phone && <div style={{ fontSize: 14 }}>โทร.{d.phone}</div>}
        </div>
        <div style={{ padding: '8px 12px', fontSize: 15.5, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 6, rowGap: 2, alignContent: 'start' }}>
          {([['วันที่ :', fmtTH(d.date)], ['กำหนดชำระ :', dueTH], ['เงื่อนไขการชำระเงิน :', d.paymentTerm || 'เงินสด'], ['พนักงานขาย :', d.sales || '']] as const).map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}><span style={{ textAlign: 'right', fontWeight: 500 }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>))}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, tableLayout: 'fixed', border: `1.5px solid ${BLUE}`, borderRadius: 12 }}>
        <thead><tr>{th('ลำดับ', 'Item', 56)}{th('รหัสสินค้า', 'Product Code', 130)}{th('รายการ', 'Description', 0)}{th('จำนวน', 'Quantity', 120)}{th('หน่วยละ', 'Unit Price', 100)}{th('จำนวนเงิน', 'Amount', 118)}</tr></thead>
        <tbody>
          {d.items.map((i, k) => (
            <tr key={k} style={{ fontSize: 16 }}>
              <td style={cell({ textAlign: 'center', borderLeft: 0 })}>{k + 1}</td><td style={cell({ textAlign: 'center' })}>{i.code}</td><td style={cell()}>{i.name}</td>
              <td style={cell({ textAlign: 'center' })}>{i.qty}{i.unit ? ' ' + i.unit : ''}</td><td style={cell({ textAlign: 'right' })}>{money(i.price)}</td><td style={cell({ textAlign: 'right' })}>{money(i.qty * i.price)}</td>
            </tr>))}
          {filler > 0 && <tr style={{ height: filler * 28 }}>{[0, 1, 2, 3, 4, 5].map(k => <td key={k} style={{ borderLeft: k ? `1px solid ${BLUE}` : 0 }} />)}</tr>}
        </tbody>
      </table>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 330px', border: `1.5px solid ${BLUE}`, borderTop: 0, borderRadius: '0 0 14px 14px', padding: '8px 14px', gap: 8, marginTop: -1 }}>
        <div><i style={{ fontSize: 15 }}>บริษัทฯ ออกใบกำกับภาษีเมื่อมีการสั่งซื้อ และส่งสินค้าแล้ว</i><div style={{ fontSize: 17, marginTop: 14 }}>({bahtText(t.total)})</div></div>
        <div style={{ fontSize: 15.5, display: 'grid', gridTemplateColumns: '1fr 104px', rowGap: 2 }}>
          <span style={{ textAlign: 'right' }}>ราคาสินค้าไม่รวมภาษีมูลค่าเพิ่ม</span><span style={{ textAlign: 'right' }}>{money(t.sub)}</span>
          {t.vat > 0 && <><span style={{ textAlign: 'right' }}>ภาษีมูลค่าเพิ่ม 7%</span><span style={{ textAlign: 'right' }}>{money(t.vat)}</span></>}
          <span style={{ textAlign: 'right' }}>ส่วนลดพิเศษ</span><span style={{ textAlign: 'right' }}>-</span>
          <span style={{ textAlign: 'right', fontWeight: 700 }}>รวมทั้งสิ้น</span><span style={{ textAlign: 'right', fontWeight: 700, fontSize: 17 }}>{money(t.total)}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', border: `1.5px solid ${BLUE}`, marginTop: 8 }}>
        {['ผู้รับสินค้า', 'ผู้ส่งสินค้า', 'ผู้รับเงิน', 'ผู้ตรวจสอบ'].map((x, k) => (
          <div key={x} style={{ borderLeft: k ? `1px solid ${BLUE}` : 0, padding: '22px 10px 6px', textAlign: 'center' }}>
            <div style={{ borderTop: `1px dotted ${BLUE}`, paddingTop: 4, fontSize: 15 }}>{x}</div>
            <div style={{ textAlign: 'left', fontSize: 14, marginTop: 8 }}>วันที่ ........../........../..........</div>
          </div>))}
      </div>
      <img src="/havan-footer.png" alt="หมายเหตุ" style={{ width: '100%', height: 'auto', display: 'block', marginTop: 6 }} />
    </div>
  )
}

function SlipPaper({ d, s }: { d: PaperData; s: PaperSettings }) {
  const t = billTotals({ items: d.items.map(i => ({ code: '', name: i.name, qty: i.qty, price: i.price })), vatMode: d.vatMode as Bill['vatMode'] })
  return (
    <div className="mx-auto w-[302px] bg-white p-3 text-[12px] text-slate-900 shadow" style={{ fontFamily: "'Sarabun','Noto Sans Thai',sans-serif" }}>
      <div className="text-center"><div className="text-sm font-bold">{s.companyName}</div><div className="text-slate-600">โทร {s.companyPhone}</div></div>
      <div className="my-2 border-y border-dashed border-slate-400 py-1 text-center font-bold">ใบแจ้งยอด · เลขที่ {d.no}<br />{fmt(d.date)}</div>
      <div className="font-semibold">ลูกค้า: {d.code ? d.code + ' · ' : ''}{d.customer}</div>
      <table className="mt-2 w-full"><tbody>{d.items.map((i, k) => <tr key={k} className="align-top"><td className="py-0.5 pr-1">{i.name}<br /><span className="text-slate-500">{i.qty} × {baht(i.price)}</span></td><td className="text-right">{baht(i.qty * i.price)}</td></tr>)}</tbody></table>
      <div className="mt-2 flex justify-between border-t-2 border-slate-800 pt-1 text-sm font-bold"><span>รวมทั้งสิ้น</span><span>฿{baht(t.total)}</span></div>
      {s.bankInfo && <div className="mt-2 text-slate-700">ชำระเงิน: {s.bankInfo}</div>}
    </div>
  )
}

/** ย่อฟอร์ม A4 ให้พอดีจอมือถือ แตะปุ่มเพื่อขยายดูเต็มขนาด */
function Fit({ children, tall }: { children: React.ReactNode; tall?: number }) {
  const ref = useRef<HTMLDivElement>(null); const [w, setW] = useState(360); const [full, setFull] = useState(false)
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect() }, [])
  const k = full ? 1 : Math.min(1, w / PAPER_W)
  return (
    <div>
      <div className="no-print mb-1 flex justify-end"><button onClick={() => setFull(!full)} className="rounded-full border border-[#1f3d6e]/30 bg-white px-3 py-1 text-xs font-semibold text-[#1f3d6e]">{full ? 'ย่อให้พอดีจอ' : 'ขยายเต็มขนาด'}</button></div>
      <div ref={ref} className={full ? 'overflow-x-auto' : 'overflow-hidden'} style={{ height: full ? undefined : (tall || 1000) * k }}>
        <div style={{ width: PAPER_W, transform: `scale(${k})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  )
}

export function BillPaper({ d, s, tpl }: { d: PaperData; s: PaperSettings; tpl: Template }) {
  return tpl === 'slip' ? <SlipPaper d={d} s={s} /> : <FormPaper d={d} s={s} />
}

const toPaper = (b: Bill, c: Customer | undefined, s: Settings): PaperData => ({
  no: b.no, date: b.date, customer: c?.name || b.customerName || b.customerId, code: c?.id || b.customerId, address: c?.address,
  phone: [c?.phone, c?.contactName].filter(Boolean).join(' '), sales: b.salesperson || s.salesName,
  items: b.items.map(i => ({ code: i.code, name: i.name, qty: i.qty, price: i.price, unit: i.unit })), vatMode: b.vatMode, paymentTerm: b.paymentTerm || c?.paymentTerm,
})

export function BillDetail({ b, c, s, close, say, byId }: { b: Bill; c?: Customer; s: Settings; close: () => void; say: (t: string) => void; byId: Record<string, Customer> }) {
  const [tpl, setTpl] = useState<Template>('form')
  const act = 'flex flex-col items-center gap-1 rounded-2xl shadow-sm border border-slate-200 bg-white py-2.5 text-[11px] font-semibold active:bg-slate-100'
  const link = billLink(b, c, s), msg = customerBillText(b, c, s)
  const cp = async (t: string, ok: string) => say((await copyText(t)) ? ok : 'คัดลอกไม่สำเร็จ — กดค้างที่ข้อความเพื่อคัดลอกเอง')
  return (
    <Sheet title={`บิล ${b.no}`} onClose={close} z={85} full>
      <div className="space-y-3 p-3">
        <div className="no-print flex gap-2">
          {([['form', 'ใบส่งสินค้า (ฟอร์มบริษัท)'], ['slip', 'สลิป 80มม.']] as const).map(([k, t]) => (
            <button key={k} onClick={() => setTpl(k)} className={`flex-1 rounded-full py-2 text-xs ${tpl === k ? 'bg-[#1f3d6e] font-bold text-white' : 'border border-slate-200 bg-white'}`}>{t}</button>
          ))}
        </div>
        <div className="no-print">{tpl === 'form' ? <Fit tall={1000}><BillPaper d={toPaper(b, c, s)} s={s} tpl={tpl} /></Fit> : <div className="overflow-x-auto"><BillPaper d={toPaper(b, c, s)} s={s} tpl={tpl} /></div>}</div>
        {createPortal(<div className="print-only"><BillPaper d={toPaper(b, c, s)} s={s} tpl={tpl} /></div>, document.body)}
        <div className="no-print grid grid-cols-4 gap-2">
          <button className={act} onClick={() => window.print()}><Printer size={19} />พิมพ์/PDF</button>
          <a className={act} href={lineShare(msg)} target="_blank" rel="noreferrer"><MessageCircle size={19} />LINE ลูกค้า</a>
          <a className={act} href={smsLink(c?.phone || '', msg)}><MessageSquare size={19} />SMS</a>
          <button className={act} onClick={() => cp(msg, 'คัดลอกข้อความแล้ว')}><Copy size={19} />คัดลอกข้อความ</button>
          <button className={act} onClick={() => cp(link, 'คัดลอกลิงก์หน้าบิลแล้ว')}><Link2 size={19} />คัดลอกลิงก์</button>
          <button className={act} onClick={() => downloadCSV(`bill-${b.no}.csv`, billRows([b], byId))}><Download size={19} />CSV</button>
          <a className={`${act} col-span-2`} href={lineShare(companyOrderText(b, c, s))} target="_blank" rel="noreferrer"><Building2 size={19} />แจ้งบริษัททาง LINE</a>
        </div>
        <details className="no-print rounded-xl bg-[#ffffff] p-3 text-xs">
          <summary className="cursor-pointer font-semibold">ดูข้อความที่จะส่งให้ลูกค้า</summary>
          <pre className="mt-2 whitespace-pre-wrap font-[inherit] text-slate-700">{msg}</pre>
        </details>
      </div>
    </Sheet>
  )
}

export function Bills({ bills, byId, s, say }: { bills: Bill[]; byId: Record<string, Customer>; s: Settings; say: (t: string) => void }) {
  const [q, setQ] = useState(''); const [month, setMonth] = useState('ทั้งหมด'); const [open, setOpen] = useState<Bill | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set()); const [limit, setLimit] = useState(60)
  const months = useMemo(() => ['ทั้งหมด', ...Array.from(new Set(bills.map(b => b.date.slice(0, 7)))).sort().reverse().slice(0, 18)], [bills])
  const rows = useMemo(() => bills.filter(b => (month === 'ทั้งหมด' || b.date.startsWith(month)) &&
    (!q || (b.no + b.customerId + (byId[b.customerId]?.name ?? b.customerName ?? '')).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no)), [bills, q, month, byId])
  const toggle = (no: string) => setSel(p => { const n = new Set(p); n.has(no) ? n.delete(no) : n.add(no); return n })
  const exportBills = rows.filter(b => sel.has(b.no)).length ? rows.filter(b => sel.has(b.no)) : rows
  return (
    <div>
      <div className="sticky top-0 z-10 space-y-2 bg-[#f3f5f4] px-4 pb-2 pt-3">
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search size={17} className="text-slate-400" />
          <input value={q} onChange={e => { setQ(e.target.value); setLimit(60) }} placeholder="เลขที่บิล หรือ ชื่อร้าน" className="h-11 w-full bg-transparent text-[15px] outline-none" /></label>
        <div className="flex gap-2">
          <select value={month} onChange={e => { setMonth(e.target.value); setLimit(60) }} className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-sm">{months.map(m => <option key={m}>{m}</option>)}</select>
          <button onClick={() => downloadCSV(`bills-${month}.csv`, billRows(exportBills, byId))} className={`${btnGhost} flex shrink-0 items-center gap-1 px-3 !py-0 text-xs`}><Download size={15} />ส่งออก CSV ({exportBills.length})</button>
        </div>
        <div className="text-xs text-slate-500">{rows.length} บิล · ติ๊กเลือกเพื่อส่งออกเฉพาะบิลที่เลือก</div>
      </div>
      {rows.slice(0, limit).map(b => {
        const c = byId[b.customerId]; const t = billTotals(b)
        return (
          <div key={b.no} className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
            <input type="checkbox" checked={sel.has(b.no)} onChange={() => toggle(b.no)} aria-label="เลือกบิล" className="h-5 w-5 shrink-0" />
            <button onClick={() => setOpen(b)} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
              <span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{c ? <><span className="mr-1.5 rounded bg-[#1f3d6e]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#1f3d6e]">{c.id}</span>{c.name}</> : [b.customerId, b.customerName].filter(Boolean).join(' · ')}</span>
                <span className="block text-xs text-slate-500">#{b.no} · {fmt(b.date)} · {b.items.length} รายการ</span></span>
              <span className="shrink-0 font-bold text-[#1f3d6e]">฿{baht(t.total)}</span>
            </button>
          </div>
        )
      })}
      {rows.length > limit && <button onClick={() => setLimit(limit + 100)} className="w-full py-4 text-sm font-semibold text-[#1f3d6e]">แสดงเพิ่ม</button>}
      {rows.length === 0 && <p className="p-10 text-center text-sm text-slate-500">ไม่พบบิล</p>}
      {open && <BillDetail b={open} c={byId[open.customerId]} s={s} byId={byId} say={say} close={() => setOpen(null)} />}
    </div>
  )
}

/** หน้าบิลสำหรับลูกค้า เปิดจากลิงก์ที่เซลล์ส่งให้ (#bill=...) */
export function SharedBillPage({ d }: { d: SharedBill }) {
  const [tpl, setTpl] = useState<Template>('form')
  const s = { companyName: d.co, companyAddress: '', companyPhone: d.ph || '', companyTaxId: d.tx || '', bankInfo: d.bk || '' }
  const paper: PaperData = { no: d.n, date: d.d, customer: d.c, code: d.cc, address: d.ad, phone: d.cp, sales: d.sl, items: d.i.map(([name, qty, price, code, unit]) => ({ name, qty, price, code, unit })), vatMode: d.v, paymentTerm: d.p }
  return (
    <div className="min-h-[100dvh] bg-[#f3f5f4] p-3">
      <div className="no-print mx-auto mb-3 flex max-w-[560px] gap-2">
        {([['form', 'ใบส่งสินค้า'], ['slip', 'แบบสลิป']] as const).map(([k, t]) => <button key={k} onClick={() => setTpl(k)} className={`flex-1 rounded-full py-2 text-sm ${tpl === k ? 'bg-[#1f3d6e] font-bold text-white' : 'bg-white'}`}>{t}</button>)}
        <button onClick={() => window.print()} className="flex items-center gap-1 rounded-full bg-white px-4 text-sm font-semibold"><Printer size={16} />พิมพ์/PDF</button>
      </div>
      <div className="no-print mx-auto max-w-[760px]">{tpl === 'form' ? <Fit tall={1000}><BillPaper d={paper} s={s} tpl={tpl} /></Fit> : <BillPaper d={paper} s={s} tpl={tpl} />}</div>
      {createPortal(<div className="print-only"><BillPaper d={paper} s={s} tpl={tpl} /></div>, document.body)}
    </div>
  )
}
