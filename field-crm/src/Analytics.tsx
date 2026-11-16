import { useMemo, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { DB } from './data'
import { baht, billTotals, cname, daysSince, ymd } from './lib'
import { H } from './ui'

const PERIODS = [['30', '30 วัน'], ['90', '90 วัน'], ['365', '12 เดือน'], ['0', 'ทั้งหมด']] as const

function Bars({ rows, fmtV = baht }: { rows: [string, number][]; fmtV?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map(r => r[1]))
  return (
    <div className="space-y-1.5">
      {rows.map(([k, v]) => (
        <div key={k} className="text-xs">
          <div className="flex justify-between"><span className="truncate pr-2">{k}</span><b>{fmtV(v)}</b></div>
          <div className="h-2 rounded bg-slate-200"><div className="h-2 rounded bg-[#14284b]" style={{ width: `${(v / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

export default function Analytics({ db, openC }: { db: DB; openC: (id: string) => void }) {
  const [p, setP] = useState<string>('90')
  const A = useMemo(() => {
    const days = +p; const now = new Date(); const from = days ? ymd(new Date(now.getTime() - days * 86400000)) : '0000-00-00'
    const prevFrom = days ? ymd(new Date(now.getTime() - 2 * days * 86400000)) : ''
    const byC = Object.fromEntries(db.customers.map(c => [c.id, c]))
    const tot = (b: DB['bills'][number]) => billTotals(b).total
    const cur = db.bills.filter(b => b.date >= from), prev = days ? db.bills.filter(b => b.date >= prevFrom && b.date < from) : []
    const rev = cur.reduce((s, b) => s + tot(b), 0), prevRev = prev.reduce((s, b) => s + tot(b), 0)
    const monthly: Record<string, number> = {}
    db.bills.forEach(b => { const m = b.date.slice(0, 7); monthly[m] = (monthly[m] || 0) + tot(b) })
    const months = Object.keys(monthly).sort().slice(-12)
    const sumBy = <T,>(items: T[], key: (x: T) => string, val: (x: T) => number) => {
      const m: Record<string, number> = {}; items.forEach(x => { const k = key(x); m[k] = (m[k] || 0) + val(x) }); return Object.entries(m).sort((a, b) => b[1] - a[1])
    }
    const byType = sumBy(cur, b => byC[b.customerId]?.type || 'อื่น ๆ', tot)
    const byCust = sumBy(cur, b => b.customerId, tot).slice(0, 8)
    const lines = cur.flatMap(b => b.items.map(i => ({ n: i.name, q: i.qty, a: i.qty * i.price })))
    const byProd = sumBy(lines, l => l.n, l => l.a).slice(0, 8)
    const bySales = sumBy(cur, b => b.salesperson || '-', tot)
    // ลูกค้าที่หายไป: เคยซื้อ แต่ไม่ซื้อนานเกิน 2 เท่าของรอบเยี่ยม (อย่างน้อย 45 วัน)
    const last: Record<string, string> = {}, spend: Record<string, number> = {}
    db.bills.forEach(b => { if (!last[b.customerId] || b.date > last[b.customerId]) last[b.customerId] = b.date; spend[b.customerId] = (spend[b.customerId] || 0) + tot(b) })
    const lapsed = db.customers.filter(c => last[c.id] && daysSince(last[c.id]) > Math.max(45, c.visitCycleDays * 2))
      .map(c => ({ c, d: daysSince(last[c.id]), v: spend[c.id] })).sort((a, b) => b.v - a.v).slice(0, 8)
    const active = new Set(cur.map(b => b.customerId)).size
    return { rev, prevRev, n: cur.length, active, monthly, months, byType, byCust, byProd, bySales, lapsed, byC, days }
  }, [db, p])
  const delta = A.prevRev ? ((A.rev - A.prevRev) / A.prevRev) * 100 : null
  const maxM = Math.max(1, ...A.months.map(m => A.monthly[m]))
  return (
    <div className="space-y-5 p-4">
      <div className="flex gap-2">{PERIODS.map(([k, t]) => <button key={k} onClick={() => setP(k)} className={`flex-1 rounded-full py-2 text-xs ${p === k ? 'bg-[#14284b] font-bold text-white' : 'border border-slate-300 bg-white'}`}>{t}</button>)}</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#14284b] p-4 text-white">
          <div className="text-xs opacity-70">ยอดขาย</div><div className="text-2xl font-bold">฿{baht(Math.round(A.rev))}</div>
          {delta != null && <div className="mt-0.5 flex items-center gap-1 text-xs">{delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{delta > 999 ? 'มากกว่า +999' : (delta >= 0 ? '+' : '') + delta.toFixed(1)}% เทียบช่วงก่อนหน้า</div>}
        </div>
        <div className="grid gap-2">
          <div className="rounded-xl border border-slate-300 bg-[#f7f9fc] px-3 py-2"><div className="text-[11px] text-slate-500">บิล · เฉลี่ย/บิล</div><b>{A.n} · ฿{baht(Math.round(A.rev / Math.max(A.n, 1)))}</b></div>
          <div className="rounded-xl border border-slate-300 bg-[#f7f9fc] px-3 py-2"><div className="text-[11px] text-slate-500">ลูกค้าที่สั่งซื้อ</div><b>{A.active} / {db.customers.length} ราย</b></div>
        </div>
      </div>

      <section><H>ยอดขายรายเดือน</H>
        {A.months.length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีบิล</p> : (
          <div className="flex h-32 items-end gap-1">
            {A.months.map(m => (
              <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${m}: ฿${baht(Math.round(A.monthly[m]))}`}>
                <div className="w-full rounded-t bg-[#14284b]" style={{ height: `${Math.max(3, (A.monthly[m] / maxM) * 100)}%` }} />
                <span className="text-[9px] text-slate-500">{m.slice(5)}</span>
              </div>
            ))}
          </div>)}
      </section>
      <section><H>ยอดขายตามประเภทร้าน</H><Bars rows={A.byType.slice(0, 7).map(([k, v]) => [k, Math.round(v)])} /></section>
      <section><H>สินค้าขายดี (มูลค่า)</H><Bars rows={A.byProd.map(([k, v]) => [k, Math.round(v)])} /></section>
      <section><H>ลูกค้ายอดสูงสุด</H>
        {A.byCust.map(([id, v], i) => (
          <button key={id} onClick={() => openC(id)} className="flex w-full items-center justify-between border-b border-slate-200 py-2 text-left text-sm">
            <span className="truncate"><b className="mr-2 text-[#14284b]">{i + 1}</b>{A.byC[id] ? cname(A.byC[id]) : id}</span><b>฿{baht(Math.round(v))}</b>
          </button>))}
      </section>
      {A.bySales.length > 1 && <section><H>ตามพนักงานขาย</H><Bars rows={A.bySales.map(([k, v]) => [k, Math.round(v)])} /></section>}
      <section><H>ลูกค้าที่หายไป (ควรรีบติดตาม)</H>
        {A.lapsed.length === 0 && <p className="text-sm text-slate-500">ไม่พบ</p>}
        {A.lapsed.map(({ c, d, v }) => (
          <button key={c.id} onClick={() => openC(c.id)} className="flex w-full items-center justify-between border-b border-slate-200 py-2 text-left text-sm">
            <span className="min-w-0"><span className="block truncate font-semibold">{cname(c)}</span><span className="text-xs font-semibold text-[#c2410c]">ไม่สั่งมา {d} วัน</span></span>
            <span className="shrink-0 text-xs text-slate-500">ยอดสะสม ฿{baht(Math.round(v))}</span>
          </button>))}
      </section>
    </div>
  )
}
