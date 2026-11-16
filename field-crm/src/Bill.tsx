import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Link2, MessageCircle, MessageSquare, Printer, Copy, Building2, Search } from 'lucide-react'
import type { Bill, Customer } from './data'
import {
  baht, billLink, cname, billRows, billTotals, companyOrderText, copyText, customerBillText, downloadCSV, fmt, lineShare, smsLink, vatLabel, type Settings, type SharedBill,
} from './lib'
import { btnGhost, Sheet } from './ui'

export type PaperData = { no: string; date: string; customer: string; address?: string; phone?: string; items: [string, number, number][]; vatMode?: string; paymentTerm?: string }
export type Template = 'invoice' | 'receipt' | 'slip'
const TITLE: Record<Template, string> = { invoice: 'ใบส่งของ / ใบแจ้งยอด', receipt: 'ใบเสร็จรับเงิน', slip: 'ใบแจ้งยอด' }

export function BillPaper({ d, s, tpl }: { d: PaperData; s: Pick<Settings, 'companyName' | 'companyAddress' | 'companyPhone' | 'companyTaxId' | 'bankInfo'>; tpl: Template }) {
  const t = billTotals({ items: d.items.map(([name, qty, price]) => ({ code: '', name, qty, price })), vatMode: d.vatMode as Bill['vatMode'] })
  const slip = tpl === 'slip'
  return (
    <div className={`mx-auto bg-white text-slate-900 shadow ${slip ? 'w-[302px] p-3 text-[12px]' : 'w-full max-w-[560px] p-5 text-[13px]'}`} style={{ fontFamily: "'Sarabun','Noto Sans Thai',sans-serif" }}>
      <div className={slip ? 'text-center' : 'flex items-start justify-between gap-3'}>
        <div>
          <div className={`font-bold ${slip ? 'text-sm' : 'text-lg'}`}>{s.companyName}</div>
          <div className="whitespace-pre-line text-slate-600">{s.companyAddress}</div>
          {(s.companyPhone || s.companyTaxId) && <div className="text-slate-600">{s.companyPhone && `โทร ${s.companyPhone}`}{s.companyTaxId && ` · เลขผู้เสียภาษี ${s.companyTaxId}`}</div>}
        </div>
        <div className={slip ? 'mt-2 border-y border-dashed border-slate-400 py-1 font-bold' : 'text-right'}>
          <div className={`font-bold ${slip ? '' : 'text-base text-[#14284b]'}`}>{TITLE[tpl]}</div>
          <div>เลขที่ {d.no}</div><div>วันที่ {fmt(d.date)}</div>
        </div>
      </div>
      <div className="mt-3 rounded border border-slate-200 p-2">
        <div className="font-semibold">ลูกค้า: {d.customer}</div>
        {d.address && <div className="text-slate-600">{d.address}</div>}
        <div className="text-slate-600">เงื่อนไขชำระ: {d.paymentTerm || 'เงินสด'}</div>
      </div>
      <table className="mt-3 w-full">
        <thead><tr className="border-b-2 border-slate-800 text-left"><th className="py-1">รายการ</th><th className="text-right">จำนวน</th><th className="text-right">ราคา</th><th className="text-right">รวม</th></tr></thead>
        <tbody>{d.items.map(([n, q, p], i) => (
          <tr key={i} className="border-b border-slate-200 align-top"><td className="py-1 pr-1">{n}</td><td className="text-right">{q}</td><td className="text-right">{baht(p)}</td><td className="text-right">{baht(q * p)}</td></tr>))}</tbody>
      </table>
      <div className="mt-2 ml-auto w-full max-w-[240px] space-y-0.5">
        <div className="flex justify-between"><span>รวมเป็นเงิน</span><span>{baht(t.sub)}</span></div>
        {d.vatMode && d.vatMode !== 'NONE' && <div className="flex justify-between"><span>VAT 7% ({vatLabel(d.vatMode)})</span><span>{baht(t.vat)}</span></div>}
        <div className="flex justify-between border-t-2 border-slate-800 pt-1 text-base font-bold"><span>ยอดสุทธิ</span><span>฿{baht(t.total)}</span></div>
      </div>
      {s.bankInfo && <div className="mt-3 whitespace-pre-line rounded bg-slate-100 p-2 text-slate-700">ช่องทางชำระเงิน: {s.bankInfo}</div>}
      {!slip && (
        <div className="mt-8 grid grid-cols-2 gap-6 text-center text-slate-600">
          <div className="border-t border-slate-400 pt-1">ผู้รับของ / ผู้ชำระเงิน</div><div className="border-t border-slate-400 pt-1">ผู้ส่งของ / ผู้รับเงิน</div>
        </div>
      )}
    </div>
  )
}

const toPaper = (b: Bill, c: Customer | undefined): PaperData => ({
  no: b.no, date: b.date, customer: c ? cname(c) : [b.customerId, b.customerName].filter(Boolean).join(' · '), address: c?.address, phone: c?.phone,
  items: b.items.map(i => [i.name, i.qty, i.price]), vatMode: b.vatMode, paymentTerm: b.paymentTerm || c?.paymentTerm,
})

export function BillDetail({ b, c, s, close, say, byId }: { b: Bill; c?: Customer; s: Settings; close: () => void; say: (t: string) => void; byId: Record<string, Customer> }) {
  const [tpl, setTpl] = useState<Template>('invoice')
  const act = 'flex flex-col items-center gap-1 rounded-2xl shadow-sm border border-slate-200 bg-white py-2.5 text-[11px] font-semibold active:bg-slate-100'
  const link = billLink(b, c, s), msg = customerBillText(b, c, s)
  const cp = async (t: string, ok: string) => say((await copyText(t)) ? ok : 'คัดลอกไม่สำเร็จ — กดค้างที่ข้อความเพื่อคัดลอกเอง')
  return (
    <Sheet title={`บิล ${b.no}`} onClose={close} z={85} full>
      <div className="space-y-3 p-3">
        <div className="no-print flex gap-2">
          {([['invoice', 'ใบส่งของ'], ['receipt', 'ใบเสร็จ'], ['slip', 'สลิป 80มม.']] as const).map(([k, t]) => (
            <button key={k} onClick={() => setTpl(k)} className={`flex-1 rounded-full py-2 text-xs ${tpl === k ? 'bg-[#14284b] font-bold text-white' : 'border border-slate-200 bg-white'}`}>{t}</button>
          ))}
        </div>
        <div className="overflow-x-auto"><BillPaper d={toPaper(b, c)} s={s} tpl={tpl} /></div>
        {createPortal(<div className="print-only"><BillPaper d={toPaper(b, c)} s={s} tpl={tpl} /></div>, document.body)}
        <div className="no-print grid grid-cols-4 gap-2">
          <button className={act} onClick={() => window.print()}><Printer size={19} />พิมพ์/PDF</button>
          <a className={act} href={lineShare(msg)} target="_blank" rel="noreferrer"><MessageCircle size={19} />LINE ลูกค้า</a>
          <a className={act} href={smsLink(c?.phone || '', msg)}><MessageSquare size={19} />SMS</a>
          <button className={act} onClick={() => cp(msg, 'คัดลอกข้อความแล้ว')}><Copy size={19} />คัดลอกข้อความ</button>
          <button className={act} onClick={() => cp(link, 'คัดลอกลิงก์หน้าบิลแล้ว')}><Link2 size={19} />คัดลอกลิงก์</button>
          <button className={act} onClick={() => downloadCSV(`bill-${b.no}.csv`, billRows([b], byId))}><Download size={19} />CSV</button>
          <a className={`${act} col-span-2`} href={lineShare(companyOrderText(b, c, s))} target="_blank" rel="noreferrer"><Building2 size={19} />แจ้งบริษัททาง LINE</a>
        </div>
        <details className="no-print rounded-xl bg-[#f7f9fc] p-3 text-xs">
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
      <div className="sticky top-0 z-10 space-y-2 bg-[#eef2f8] px-4 pb-2 pt-3">
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
              <span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{c ? <><span className="mr-1.5 rounded bg-[#14284b]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#14284b]">{c.id}</span>{c.name}</> : [b.customerId, b.customerName].filter(Boolean).join(' · ')}</span>
                <span className="block text-xs text-slate-500">#{b.no} · {fmt(b.date)} · {b.items.length} รายการ</span></span>
              <span className="shrink-0 font-bold text-[#14284b]">฿{baht(t.total)}</span>
            </button>
          </div>
        )
      })}
      {rows.length > limit && <button onClick={() => setLimit(limit + 100)} className="w-full py-4 text-sm font-semibold text-[#14284b]">แสดงเพิ่ม</button>}
      {rows.length === 0 && <p className="p-10 text-center text-sm text-slate-500">ไม่พบบิล</p>}
      {open && <BillDetail b={open} c={byId[open.customerId]} s={s} byId={byId} say={say} close={() => setOpen(null)} />}
    </div>
  )
}

/** หน้าบิลสำหรับลูกค้า เปิดจากลิงก์ที่เซลล์ส่งให้ (#bill=...) */
export function SharedBillPage({ d }: { d: SharedBill }) {
  const [tpl, setTpl] = useState<Template>('invoice')
  const s = { companyName: d.co, companyAddress: '', companyPhone: d.ph || '', companyTaxId: d.tx || '', bankInfo: d.bk || '' }
  return (
    <div className="min-h-[100dvh] bg-slate-200 p-3">
      <div className="no-print mx-auto mb-3 flex max-w-[560px] gap-2">
        {([['invoice', 'ใบแจ้งยอด'], ['receipt', 'ใบเสร็จ']] as const).map(([k, t]) => <button key={k} onClick={() => setTpl(k)} className={`flex-1 rounded-full py-2 text-sm ${tpl === k ? 'bg-[#14284b] font-bold text-white' : 'bg-white'}`}>{t}</button>)}
        <button onClick={() => window.print()} className="flex items-center gap-1 rounded-full bg-white px-4 text-sm font-semibold"><Printer size={16} />พิมพ์/PDF</button>
      </div>
      <BillPaper d={{ no: d.n, date: d.d, customer: d.c, items: d.i, vatMode: d.v, paymentTerm: d.p }} s={s} tpl={tpl} />
      {createPortal(<div className="print-only"><BillPaper d={{ no: d.n, date: d.d, customer: d.c, items: d.i, vatMode: d.v, paymentTerm: d.p }} s={s} tpl={tpl} /></div>, document.body)}
    </div>
  )
}
