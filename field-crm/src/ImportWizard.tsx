import { useMemo, useState } from 'react'
import { AlertTriangle, Trash2, Wand2 } from 'lucide-react'
import type { Bill, Customer, DB, Product } from './data'
import { detectDelimiter, normDate, num, parseDelimited, readTextFile } from './lib'
import { btnGhost, btnPrimary, Field, inputCls, Sheet } from './ui'

type FieldDef = [key: string, label: string, required?: boolean, hint?: RegExp]
const TARGETS: Record<string, { label: string; fields: FieldDef[] }> = {
  customers: {
    label: 'ลูกค้า',
    fields: [
      ['id', 'รหัสลูกค้า', true, /^(id|code|รหัส|รหัสลูกค้า|cust)/i], ['name', 'ชื่อร้าน', true, /name|ชื่อ/i], ['type', 'ประเภท', false, /type|ประเภท/i],
      ['phone', 'เบอร์โทร', false, /phone|tel|โทร|เบอร์/i], ['contactName', 'ผู้ติดต่อ', false, /contact|ผู้ติดต่อ/i], ['address', 'ที่อยู่', false, /addr|ที่อยู่/i],
      ['area', 'โซน/พื้นที่', false, /area|zone|โซน|พื้นที่|เขต/i], ['paymentTerm', 'เงื่อนไขชำระ', false, /payment|term|ชำระ|เครดิต/i],
      ['lat', 'ละติจูด', false, /lat|ละติจูด/i], ['lng', 'ลองจิจูด', false, /lng|lon|ลองจิจูด/i], ['lineId', 'LINE ID', false, /line/i],
      ['visitCycleDays', 'รอบเยี่ยม (วัน)', false, /cycle|รอบ/i], ['note', 'หมายเหตุ', false, /note|หมายเหตุ/i],
    ],
  },
  products: {
    label: 'สินค้า',
    fields: [['code', 'รหัสสินค้า', true, /code|รหัส|sku/i], ['name', 'ชื่อสินค้า', true, /name|ชื่อ|รายการ/i], ['price', 'ราคา', false, /price|ราคา/i]],
  },
  bills: {
    label: 'บิลขาย (หนึ่งแถวต่อหนึ่งรายการสินค้า)',
    fields: [
      ['billNo', 'เลขที่บิล', true, /bill|no|เลขที่|บิล/i], ['date', 'วันที่', true, /date|วันที่/i], ['customerId', 'รหัสลูกค้า', true, /cust.*id|รหัสลูกค้า|customerid/i],
      ['code', 'รหัสสินค้า', false, /^code|รหัสสินค้า|sku/i], ['name', 'ชื่อสินค้า', true, /item|product|สินค้า|รายการ|name/i],
      ['qty', 'จำนวน', true, /qty|quantity|จำนวน/i], ['price', 'ราคา/หน่วย', true, /price|ราคา/i], ['vatMode', 'VAT (NONE/VAT_OUT/VAT_IN)', false, /vat/i],
    ],
  },
}
type Row = { v: Record<string, string>; skip: boolean }

export default function ImportWizard({ db, setDb, close, say }: { db: DB; setDb: (d: DB) => void; close: () => void; say: (s: string) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [fileName, setFileName] = useState(''); const [encUsed, setEncUsed] = useState('')
  const [raw, setRaw] = useState<string[][]>([]); const [text, setText] = useState('')
  const [delim, setDelim] = useState(','); const [hasHeader, setHasHeader] = useState(true)
  const [target, setTarget] = useState<keyof typeof TARGETS>('customers')
  const [map, setMap] = useState<Record<string, number>>({})
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<'all' | 'bad' | 'dup' | 'skip'>('all'); const [q, setQ] = useState(''); const [limit, setLimit] = useState(100)
  const def = TARGETS[target]

  const loadFile = async (f: File, enc: 'auto' | 'utf-8' | 'windows-874' = 'auto') => {
    const r = await readTextFile(f, enc); setText(r.text); setEncUsed(r.enc); setFileName(f.name)
    const d = detectDelimiter(r.text); setDelim(d); setRaw(parseDelimited(r.text, d)); setFile(f)
  }
  const [file, setFile] = useState<File | null>(null)
  const reparse = (d: string) => { setDelim(d); setRaw(parseDelimited(text, d)) }
  const header = hasHeader ? raw[0] || [] : (raw[0] || []).map((_, i) => `คอลัมน์ ${i + 1}`)
  const body = hasHeader ? raw.slice(1) : raw

  const autoMap = (t = target) => {
    const m: Record<string, number> = {}; const used = new Set<number>()
    TARGETS[t].fields.forEach(([k, , , re]) => {
      const i = header.findIndex((h, ix) => !used.has(ix) && (h.trim().toLowerCase() === k.toLowerCase() || (re && re.test(h.trim()))))
      m[k] = i; if (i >= 0) used.add(i)
    })
    setMap(m)
  }
  const goMap = () => { autoMap(); setStep(2) }
  const build = () => {
    setRows(body.map(r => ({ v: Object.fromEntries(def.fields.map(([k]) => [k, map[k] >= 0 ? (r[map[k]] ?? '').trim() : ''])), skip: false })))
    setTab('all'); setLimit(100); setStep(3)
  }

  /* ----- ตรวจข้อมูล ----- */
  const exCust = useMemo(() => new Set(db.customers.map(c => c.id)), [db.customers])
  const exProd = useMemo(() => new Set(db.products.map(p => p.code)), [db.products])
  const exBill = useMemo(() => new Set(db.bills.map(b => b.no)), [db.bills])
  const checks = useMemo(() => {
    const seen: Record<string, number> = {}
    if (target !== 'bills') rows.forEach(r => { const k = r.v[target === 'customers' ? 'id' : 'code']; if (k) seen[k] = (seen[k] || 0) + 1 })
    return rows.map(r => {
      const e: string[] = [], w: string[] = []; const v = r.v
      def.fields.forEach(([k, l, req]) => { if (req && !v[k]) e.push(`ไม่มี${l}`) })
      if (target === 'customers') {
        if (v.id && seen[v.id] > 1) w.push('รหัสซ้ำในไฟล์ (ใช้แถวล่าสุด)')
        if (v.id && exCust.has(v.id)) w.push('มีลูกค้านี้แล้ว → อัปเดต')
        if (v.phone && v.phone.replace(/\D/g, '').length < 9) e.push('เบอร์สั้นผิดปกติ')
        if (v.lat && !(num(v.lat) >= -90 && num(v.lat) <= 90)) e.push('ละติจูดผิด')
        if (v.lng && !(num(v.lng) >= -180 && num(v.lng) <= 180)) e.push('ลองจิจูดผิด')
        if (v.visitCycleDays && !(num(v.visitCycleDays) > 0)) e.push('รอบเยี่ยมต้องเป็นตัวเลข')
      } else if (target === 'products') {
        if (v.code && seen[v.code] > 1) w.push('รหัสซ้ำในไฟล์ (ใช้แถวล่าสุด)')
        if (v.code && exProd.has(v.code)) w.push('มีสินค้านี้แล้ว → อัปเดต')
        if (v.price && !(num(v.price) >= 0)) e.push('ราคาผิด')
      } else {
        if (v.date && !normDate(v.date)) e.push('วันที่อ่านไม่ได้')
        if (v.qty && !(num(v.qty) > 0)) e.push('จำนวนผิด')
        if (v.price && !(num(v.price) >= 0)) e.push('ราคาผิด')
        if (v.customerId && !exCust.has(v.customerId)) w.push('ไม่พบรหัสลูกค้านี้ในระบบ')
        if (v.billNo && exBill.has(v.billNo)) w.push('มีบิลนี้แล้ว → ข้าม')
      }
      return { e, w }
    })
  }, [rows, target, def, exCust, exProd, exBill])

  const setCell = (i: number, k: string, val: string) => setRows(rs => rs.map((r, ix) => (ix === i ? { ...r, v: { ...r.v, [k]: val } } : r)))
  const flagSkip = (i: number, skip: boolean) => setRows(rs => rs.map((r, ix) => (ix === i ? { ...r, skip } : r)))
  const tidy = () => setRows(rs => rs.map(r => ({ ...r, v: Object.fromEntries(Object.entries(r.v).map(([k, val]) => {
    let s = val.replace(/\s+/g, ' ').trim()
    if (k === 'phone') s = s.replace(/[^\d+\-, ]/g, '')
    if (k === 'date') s = normDate(s) || s
    return [k, s]
  })) })))
  const skipBad = () => setRows(rs => rs.map((r, i) => (checks[i].e.length ? { ...r, skip: true } : r)))

  const view = rows.map((r, i) => ({ r, i, c: checks[i] })).filter(({ r, c }) =>
    (tab === 'all' || (tab === 'bad' && c.e.length > 0) || (tab === 'dup' && c.w.length > 0) || (tab === 'skip' && r.skip)) &&
    (!q || Object.values(r.v).join(' ').toLowerCase().includes(q.toLowerCase())))
  const nBad = checks.filter(c => c.e.length).length, nWarn = checks.filter(c => c.w.length).length
  const ready = rows.filter((r, i) => !r.skip && !checks[i].e.length)

  /* ----- นำเข้า ----- */
  const apply = () => {
    if (target === 'customers') {
      const map2 = new Map(db.customers.map(c => [c.id, c]))
      ready.forEach(({ v }) => {
        const old = map2.get(v.id)
        const c: Customer = {
          ...(old || { visitCycleDays: 14, labels: [], paymentTerm: 'เงินสด', area: '-', type: 'อื่น ๆ', address: '', phone: '', contactName: '' }),
          id: v.id, name: v.name, type: v.type || old?.type || 'อื่น ๆ', phone: v.phone || old?.phone || '', contactName: v.contactName || old?.contactName || '',
          address: v.address || old?.address || '', area: v.area || old?.area || '-', paymentTerm: v.paymentTerm || old?.paymentTerm || 'เงินสด',
          lat: num(v.lat) || old?.lat, lng: num(v.lng) || old?.lng, lineId: v.lineId || old?.lineId, note: v.note || old?.note,
          visitCycleDays: num(v.visitCycleDays) || old?.visitCycleDays || 14, src: old?.src === 'sheet' ? 'sheet' : 'import',
        }
        c.labels = [c.area, c.type].filter(x => x && x !== '-'); map2.set(c.id, c)
      })
      setDb({ ...db, customers: [...map2.values()] })
    } else if (target === 'products') {
      const map2 = new Map(db.products.map(p => [p.code, p]))
      ready.forEach(({ v }) => map2.set(v.code, { code: v.code, name: v.name, price: num(v.price) || map2.get(v.code)?.price || 0, src: 'import' } as Product))
      setDb({ ...db, products: [...map2.values()] })
    } else {
      const g = new Map<string, Bill>()
      ready.forEach(({ v }) => {
        if (exBill.has(v.billNo)) return
        const b = g.get(v.billNo) || { no: v.billNo, date: normDate(v.date), customerId: v.customerId, items: [], vatMode: (['VAT_OUT', 'VAT_IN'].includes(v.vatMode?.toUpperCase()) ? v.vatMode.toUpperCase() : 'NONE') as Bill['vatMode'], src: 'import' as const }
        b.items.push({ code: v.code, name: v.name, qty: num(v.qty), price: num(v.price) }); g.set(v.billNo, b)
      })
      setDb({ ...db, bills: [...db.bills, ...g.values()] })
      say(`นำเข้า ${g.size} บิล`); return close()
    }
    say(`นำเข้า ${ready.length} แถว`); close()
  }

  return (
    <Sheet title={`นำเข้าไฟล์ · ขั้น ${step}/3`} onClose={close} z={80} full>
      {step === 1 && (
        <div className="space-y-4 p-4 text-sm">
          <p className="text-slate-600">เลือกไฟล์ .txt / .csv / .tsv ที่ส่งออกจากโปรแกรมบัญชี ระบบเดาตัวคั่นและการเข้ารหัสภาษาไทยให้เอง และยังไม่เขียนข้อมูลจนกว่าจะกดยืนยันในขั้นสุดท้าย</p>
          <input type="file" accept=".txt,.csv,.tsv,.ttx,text/*" onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f) }} className={inputCls} />
          {raw.length > 0 && (
            <>
              <div className="rounded-xl bg-[#f7f9fc] p-3">ไฟล์ <b>{fileName}</b> · {raw.length} แถว · เข้ารหัส {encUsed}</div>
              <div className="grid grid-cols-2 gap-3">
                <Field l="ตัวคั่น"><select value={delim} onChange={e => reparse(e.target.value)} className={inputCls}><option value=",">, (คอมมา)</option><option value={'\t'}>Tab</option><option value="|">| (ขีดตั้ง)</option><option value=";">; (เซมิโคลอน)</option></select></Field>
                <Field l="ตัวอักษรเพี้ยน?"><select value={encUsed} onChange={e => file && loadFile(file, e.target.value as 'utf-8' | 'windows-874')} className={inputCls}><option value="utf-8">UTF-8</option><option value="windows-874">Windows-874 (ไฟล์ไทยเก่า)</option></select></Field>
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} className="h-5 w-5" />แถวแรกเป็นหัวคอลัมน์</label>
              <Field l="นำเข้าเป็นข้อมูลชนิด">
                <select value={target} onChange={e => setTarget(e.target.value as keyof typeof TARGETS)} className={inputCls}>{Object.entries(TARGETS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select>
              </Field>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-xs"><tbody>{raw.slice(0, 4).map((r, i) => <tr key={i} className={i === 0 && hasHeader ? 'bg-slate-100 font-bold' : ''}>{r.slice(0, 8).map((c, j) => <td key={j} className="max-w-[120px] truncate border-b border-slate-200 px-2 py-1">{c}</td>)}</tr>)}</tbody></table>
              </div>
              <button onClick={goMap} className={`${btnPrimary} w-full`}>ถัดไป: จับคู่คอลัมน์</button>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 p-4 text-sm">
          <p className="text-slate-600">เลือกว่าคอลัมน์ในไฟล์ตรงกับข้อมูลไหน (ระบบจับคู่ให้เบื้องต้นแล้ว) ช่อง * จำเป็น</p>
          {def.fields.map(([k, l, req]) => (
            <Field key={k} l={`${l}${req ? ' *' : ''}`}>
              <select value={map[k] ?? -1} onChange={e => setMap({ ...map, [k]: +e.target.value })} className={`${inputCls} ${req && (map[k] ?? -1) < 0 ? 'border-[#c2410c]' : ''}`}>
                <option value={-1}>— ไม่นำเข้า —</option>{header.map((h, i) => <option key={i} value={i}>{h || `คอลัมน์ ${i + 1}`}{body[0]?.[i] ? `  (เช่น ${body[0][i].slice(0, 18)})` : ''}</option>)}
              </select>
            </Field>
          ))}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setStep(1)} className={`${btnGhost} flex-1`}>กลับ</button>
            <button disabled={def.fields.some(([k, , r]) => r && (map[k] ?? -1) < 0)} onClick={build} className={`${btnPrimary} flex-[2]`}>ตรวจข้อมูล ({body.length} แถว)</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-sm">
          <div className="sticky top-0 z-10 space-y-2 border-b border-slate-200 bg-[#eef2f8] p-3">
            <div className="flex flex-wrap gap-1.5">
              {([['all', `ทั้งหมด ${rows.length}`], ['bad', `ต้องแก้ ${nBad}`], ['dup', `แจ้งเตือน ${nWarn}`], ['skip', `ข้าม ${rows.filter(r => r.skip).length}`]] as const).map(([k, t]) => (
                <button key={k} onClick={() => { setTab(k); setLimit(100) }} className={`rounded-full px-3 py-1.5 text-xs ${tab === k ? 'bg-[#14284b] font-semibold text-white' : 'border border-slate-200 bg-white'}`}>{t}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="กรอง/ค้นหาในแถว" className={`${inputCls} !py-2`} />
              <button onClick={tidy} className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs"><Wand2 size={14} />ล้างช่องว่าง</button>
              <button onClick={skipBad} className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs">ข้ามแถวเสีย</button>
            </div>
          </div>
          {view.length === 0 && <p className="p-8 text-center text-slate-500">ไม่มีแถวในตัวกรองนี้</p>}
          {view.slice(0, limit).map(({ r, i, c }) => (
            <div key={i} className={`border-b border-slate-200 p-3 ${r.skip ? 'opacity-40' : ''} ${c.e.length ? 'bg-[#fdebd2]/60' : ''}`}>
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="text-xs">
                  <span className="mr-1 font-bold text-slate-400">#{i + 1}</span>
                  {c.e.map(m => <span key={m} className="mr-1 inline-flex items-center gap-0.5 rounded bg-[#c2410c] px-1.5 py-0.5 text-white"><AlertTriangle size={10} />{m}</span>)}
                  {c.w.map(m => <span key={m} className="mr-1 rounded bg-[#e0a82e]/30 px-1.5 py-0.5 text-[#7a5200]">{m}</span>)}
                </div>
                <button onClick={() => flagSkip(i, !r.skip)} aria-label="ข้ามแถว" className="shrink-0 rounded p-1 text-slate-500 active:bg-slate-200">{r.skip ? 'คืนค่า' : <Trash2 size={16} />}</button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {def.fields.filter(([k]) => map[k] >= 0).map(([k, l, req]) => (
                  <label key={k} className={target === 'customers' && (k === 'name' || k === 'address') ? 'col-span-2' : target !== 'customers' && k === 'name' ? 'col-span-2' : ''}>
                    <span className="text-[10px] text-slate-500">{l}</span>
                    <input value={r.v[k]} onChange={e => setCell(i, k, e.target.value)} className={`w-full rounded-lg border px-2 py-1.5 text-[13px] outline-none focus:border-[#14284b] ${req && !r.v[k] ? 'border-[#c2410c] bg-white' : 'border-slate-200 bg-white'}`} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          {view.length > limit && <button onClick={() => setLimit(limit + 200)} className="w-full py-4 text-sm font-semibold text-[#14284b]">แสดงเพิ่ม (เหลือ {view.length - limit})</button>}
          <div className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-[#eef2f8] p-3">
            <button onClick={() => setStep(2)} className={`${btnGhost} flex-1`}>กลับ</button>
            <button disabled={!ready.length} onClick={apply} className={`${btnPrimary} flex-[2]`}>นำเข้า {ready.length} แถว</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
