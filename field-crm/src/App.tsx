import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  Home, Menu, Bell, ChevronLeft, Store, Scissors, Flower2, Phone, MapPin, Navigation, Search, CalendarCheck, Users, ListChecks, BarChart3, Settings as Cog, Plus, MessageCircle, Clock, AlertTriangle,
  ChevronRight, Check, ShoppingCart, LocateFixed, Minus, Receipt, Camera, RefreshCw, FileUp, Building2, Crosshair,
} from 'lucide-react'
import { buildDemo, OUTCOMES, TASK_TYPES, type Bill, type BillItem, type Customer, type DB, type Task, type Visit } from './data'
import {
  baht, billTotals, cname, companyOrderText, customerBillText, daysSince, distM, fmt, getPhoto, getPosition, kmTo, lineShare, loadSettings, localDay, navUrl, putPhoto,
  readBillHash, saveSettings, smsLink, stampPhoto, todayStr, uid, ymd, type Pos, type Settings, copyText,
} from './lib'
import { syncFromSheet } from './sheet'
import { Bills, BillDetail, SharedBillPage } from './Bill'
import Analytics from './Analytics'
import ImportWizard from './ImportWizard'
import { btnGhost, btnPrimary, Field, H, inputCls, Sheet } from './ui'

const KEY = 'field-crm-v2'
function load(): DB {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) } catch { /* ignore */ }
  return buildDemo()
}

type Status = 'overdue' | 'soon' | 'ok' | 'new'
function status(c: Customer, lastVisit?: string): { s: Status; days: number } {
  if (!lastVisit) return { s: 'new', days: 0 }
  const d = daysSince(lastVisit)
  return { s: d > c.visitCycleDays ? 'overdue' : d >= c.visitCycleDays * 0.8 ? 'soon' : 'ok', days: d }
}
export const dot: Record<Status, string> = { overdue: 'bg-[#c2410c]', soon: 'bg-[#2c5aa0]', ok: 'bg-[#2f7d57]', new: 'bg-slate-400' }
const label: Record<Status, string> = { overdue: 'เลยรอบเยี่ยม', soon: 'ใกล้ถึงรอบ', ok: 'ปกติ', new: 'ยังไม่เคยเยี่ยม' }

export default function Root() {
  const shared = useMemo(() => readBillHash(), [])
  return shared ? <SharedBillPage d={shared} /> : <App />
}

function App() {
  const [db, setDbRaw] = useState<DB>(load)
  const [settings, setSettingsRaw] = useState<Settings>(loadSettings)
  const [tab, setTab] = useState<'today' | 'customers' | 'checkin' | 'bills' | 'more'>('today'); const [page, setPage] = useState<'tasks' | 'analytics' | null>(null)
  const [openId, setOpenId0] = useState<string | null>(null); const [openSub, setOpenSub] = useState<'visit' | 'task' | 'order' | undefined>()
  const setOpenId = (id: string | null, sb?: 'visit' | 'task' | 'order') => { setOpenSub(sb); setOpenId0(id) }
  const [cog, setCog] = useState(false)
  const [toast, setToast] = useState('')
  const [pos, setPos] = useState<Pos | null>(null)
  const [doneBill, setDoneBill] = useState<Bill | null>(null)

  const setDb = (d: DB) => setDbRaw(d)
  const setSettings = (s: Settings) => { setSettingsRaw(s); saveSettings(s) }
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { setToast('พื้นที่เก็บข้อมูลในเครื่องเต็ม') } }, [db])
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) } }, [toast])

  const lastVisit = useMemo(() => {
    const m: Record<string, string> = {}
    db.visits.forEach(v => { if (!m[v.customerId] || v.at > m[v.customerId]) m[v.customerId] = v.at })
    return m
  }, [db.visits])
  const byId = useMemo(() => Object.fromEntries(db.customers.map(c => [c.id, c])), [db.customers])
  const open = openId ? byId[openId] : null

  const locate = async () => {
    try { setPos(await getPosition()); setToast('จัดเรียงตามระยะทางจาก GPS แล้ว') } catch (e) { setToast((e as Error).message) }
  }
  const upd = (f: (d: DB) => Partial<DB>) => setDbRaw(d => ({ ...d, ...f(d) }))
  const addVisit = (v: Omit<Visit, 'id' | 'at'>) => { upd(d => ({ visits: [...d.visits, { ...v, id: uid('V'), at: new Date().toISOString() }] })); setToast('บันทึกการเยี่ยมแล้ว') }
  const addTask = (t: Omit<Task, 'id' | 'status'>) => { upd(d => ({ tasks: [...d.tasks, { ...t, id: uid('T'), status: 'open' }] })); setToast('เพิ่มงานแล้ว') }
  const toggleTask = (id: string) => upd(d => ({ tasks: d.tasks.map(t => (t.id === id ? { ...t, status: t.status === 'done' ? 'open' : 'done' } : t)) }))
  const logCall = (c: Customer) => upd(d => ({ activities: [...d.activities, { id: uid('A'), customerId: c.id, type: 'โทร', at: new Date().toISOString(), note: c.phone }] }))
  const setCustPos = (id: string, lat: number, lng: number) => {
    upd(d => ({ customers: d.customers.map(c => (c.id === id ? { ...c, lat, lng } : c)), patches: { ...d.patches, [id]: { ...d.patches?.[id], lat, lng } } })); setToast('บันทึกพิกัดร้านแล้ว')
  }
  const addOrder = (customerId: string, items: BillItem[], vatMode: Bill['vatMode']) => {
    const c = byId[customerId]; const now = new Date()
    const b: Bill = {
      no: `SO-${ymd(now).replace(/-/g, '').slice(2)}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`,
      date: ymd(now), customerId, customerName: c?.name, items, vatMode, salesperson: settings.salesName, paymentTerm: c?.paymentTerm, lat: pos?.lat, lng: pos?.lng,
    }
    upd(d => ({ bills: [...d.bills, b], activities: [...d.activities, { id: uid('A'), customerId, type: 'รับออเดอร์', at: now.toISOString(), note: b.no }] }))
    setDoneBill(b)
  }

  type Tab = 'today' | 'customers' | 'checkin' | 'bills' | 'more'
  const TABS: [Tab, typeof Home, string][] = [['today', Home, 'หน้าหลัก'], ['customers', Users, 'ลูกค้า'], ['checkin', Check, 'เช็คอิน'], ['bills', Receipt, 'ออเดอร์'], ['more', Menu, 'เพิ่มเติม']]
  const lateTasks = db.tasks.filter(t => t.status === 'open' && t.dueAt <= todayStr()).length
  const lateCust = db.customers.filter(c => status(c, lastVisit[c.id]).s === 'overdue').length
  const bell = lateTasks + lateCust
  const goTab = (t: Tab) => { setPage(null); setTab(t) }
  const clock = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  return (
    <Quick.Provider value={{ go: setOpenId, call: logCall }}>
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-[#f3f5f4] text-[#16201b]" style={{ fontFamily: "'Sarabun','Noto Sans Thai',-apple-system,system-ui,sans-serif" }}>
      <header className="bg-gradient-to-br from-[#172f57] via-[#1f3d6e] to-[#2c5aa0] px-4 pb-2 pt-[max(.5rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between">
          <span className="text-base font-extrabold tracking-wide">CRM</span>
          <div className="flex items-center gap-1">
            <button aria-label="แจ้งเตือน" onClick={() => { setPage('tasks') }} className="relative grid h-9 w-9 place-items-center rounded-full active:bg-white/15">
              <Bell size={19} />{bell > 0 && <em className="absolute -right-0.5 top-0 min-w-[18px] rounded-full bg-[#f5a524] px-1 text-center text-[11px] font-bold not-italic leading-[18px] text-[#16201b]">{bell}</em>}
            </button>
            <button aria-label="ตั้งค่า" onClick={() => setCog(true)} className="grid h-9 w-9 place-items-center rounded-full active:bg-white/15"><Cog size={19} /></button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs opacity-90">
          <span>{new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: '2-digit' })} • {clock}</span>
          <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${db.syncedAt ? 'bg-[#34c759]' : 'bg-[#f5a524]'}`} />{db.syncedAt ? `ซิงก์ชีท ${new Date(db.syncedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : 'ข้อมูลตัวอย่าง'}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-2.5 pb-4 pt-2.5">
        {page && <button onClick={() => setPage(null)} className="mb-1 flex items-center gap-0.5 text-sm font-semibold text-[#1f3d6e]"><ChevronLeft size={18} />กลับ</button>}
        {page === 'tasks' && <Tasks db={db} byId={byId} openC={setOpenId} toggleTask={toggleTask} />}
        {page === 'analytics' && <Analytics db={db} openC={setOpenId} />}
        {!page && tab === 'today' && <Today db={db} byId={byId} lastVisit={lastVisit} pos={pos} locate={locate} openC={setOpenId} toggleTask={toggleTask} goPage={setPage} />}
        {!page && tab === 'customers' && <Customers db={db} lastVisit={lastVisit} pos={pos} locate={locate} openC={setOpenId} />}
        {!page && tab === 'checkin' && <CheckinPick db={db} pos={pos} locate={locate} lastVisit={lastVisit} openC={setOpenId} />}
        {!page && tab === 'bills' && <Bills bills={db.bills} byId={byId} s={settings} say={setToast} />}
        {!page && tab === 'more' && (
          <div className="space-y-2.5">
            <h2 className="px-1 text-base font-bold">เพิ่มเติม</h2>
            <div className="overflow-hidden rounded-[14px] border border-[#e3e8e5] bg-white shadow-[0_1px_2px_rgba(20,40,70,.05),0_4px_12px_rgba(20,40,70,.04)]">
              {[
                [ListChecks, 'งานติดตาม', `${lateTasks} งานวันนี้และที่เลยกำหนด`, () => setPage('tasks')],
                [BarChart3, 'สรุปและวิเคราะห์การขาย', 'ยอดขาย สินค้า ลูกค้า เซลล์', () => setPage('analytics')],
                [FileUp, 'นำเข้าข้อมูลและเชื่อมชีท', 'ไฟล์ .txt/.csv จากโปรแกรมบัญชี · ชีท A', () => setCog(true)],
                [Building2, 'ข้อมูลบริษัทและตั้งค่า', 'ชื่อ ที่อยู่ ช่องทางชำระเงินบนบิล', () => setCog(true)],
              ].map(([Ic, t, sub, fn], i) => { const I = Ic as typeof Home; return (
                <button key={i} onClick={fn as () => void} className="flex min-h-[56px] w-full items-center gap-3 border-b border-[#e3e8e5] px-3.5 py-2.5 text-left last:border-0 active:bg-[#e8eef8]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#e8eef8] text-[#1f3d6e]"><I size={18} /></span>
                  <span className="min-w-0 flex-1"><b className="block text-[15px] font-semibold">{t as string}</b><small className="block truncate text-xs text-[#6b7670]">{sub as string}</small></span>
                  <ChevronRight size={16} className="text-[#a3ada8]" />
                </button>) })}
            </div>
          </div>
        )}
      </main>

      <nav className="relative grid grid-cols-5 border-t border-[#e3e8e5] bg-white/95 px-1.5 pb-[calc(4px+env(safe-area-inset-bottom))] pt-1 backdrop-blur">
        {TABS.map(([k, Icon, t]) => {
          const on = !page && tab === k, fab = k === 'checkin'
          return (
            <button key={k} onClick={() => goTab(k)} className={`flex min-h-[50px] flex-col items-center justify-center gap-0.5 text-xs font-semibold ${fab ? '-translate-y-4 font-extrabold text-[#1f3d6e]' : on ? 'text-[#1f3d6e]' : 'text-[#7a847f]'}`}>
              <span className={fab ? `grid h-[58px] w-[58px] place-items-center rounded-full border-4 border-white text-white shadow-[0_8px_18px_#1f3d6e59] ${on ? 'bg-[#2c5aa0]' : 'bg-[#1f3d6e]'}` : `grid h-[26px] w-11 place-items-center rounded-full ${on ? 'bg-[#e8eef8]' : ''}`}>
                <Icon size={fab ? 26 : 22} strokeWidth={on || fab ? 2.3 : 1.8} />
              </span>{t}
            </button>
          )
        })}
      </nav>

      {open && (
        <CustomerSheet key={open.id + (openSub || '')} initSub={openSub} c={open} db={db} byId={byId} s={settings} pos={pos} lastVisit={lastVisit[open.id]} close={() => setOpenId(null)} say={setToast}
          addVisit={addVisit} addTask={addTask} addOrder={addOrder} logCall={logCall} toggleTask={toggleTask} setCustPos={setCustPos} />
      )}
      {doneBill && <OrderDone b={doneBill} c={byId[doneBill.customerId]} s={settings} byId={byId} say={setToast} close={() => setDoneBill(null)} />}
      {cog && <SettingsSheet db={db} setDb={setDb} s={settings} setS={setSettings} close={() => setCog(false)} say={setToast} />}
      {toast && <div className="fixed bottom-24 left-1/2 z-[90] max-w-[90vw] -translate-x-1/2 rounded-2xl bg-slate-900 px-4 py-2 text-center text-sm text-white shadow-lg">{toast}</div>}
    </div>
    </Quick.Provider>
  )
}

/* ---------- ลิสต์ลูกค้า ---------- */
type SubK = 'visit' | 'task' | 'order'
const Quick = createContext<{ go: (id: string, sb?: SubK) => void; call: (c: Customer) => void }>({ go: () => {}, call: () => {} })
function TypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  return /ซาลอน|เสริมสวย|ตัดผม/.test(type) ? <Scissors size={size} /> : /สปา|นวด/.test(type) ? <Flower2 size={size} /> : <Store size={size} />
}
function StatusPill({ st, cycle }: { st: { s: Status; days: number }; cycle: number }) {
  const cls = st.s === 'overdue' ? 'bg-[#fcebe8] text-[#b02a1f]' : st.s === 'soon' ? 'bg-[#fdf3e1] text-[#8a5508]' : st.s === 'ok' ? 'bg-[#e6f3ec] text-[#2f7a4f]' : 'bg-[#e8eef8] text-[#1f3d6e]'
  const t = st.s === 'overdue' ? `เลยรอบ ${st.days - cycle} วัน` : st.s === 'soon' ? `ใกล้ถึงรอบ ${Math.max(0, cycle - st.days)} วัน` : st.s === 'ok' ? 'ปกติ' : 'ยังไม่เคยเยี่ยม'
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{t}</span>
}
const CARD = 'rounded-[14px] border border-[#e3e8e5] bg-white shadow-[0_1px_2px_rgba(20,40,70,.05),0_4px_12px_rgba(20,40,70,.04)]'
function CustomerRow({ c, last, dist, onClick, actions }: { c: Customer; last?: string; dist?: number; onClick: () => void; actions?: boolean }) {
  const st = status(c, last); const q = useContext(Quick)
  const qa = 'grid h-8 flex-1 place-items-center rounded-[10px] border border-[#e3e8e5] text-[#1f3d6e] active:bg-[#e8eef8]'
  return (
    <div className="border-b border-[#e3e8e5] px-3 pb-2 pt-1 last:border-0">
      <button onClick={onClick} className="flex w-full items-center gap-2.5 py-1.5 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e8eef8] text-[#1f3d6e]"><TypeIcon type={c.type} /></span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[15px] font-semibold"><span className="mr-1.5 rounded bg-[#e8eef8] px-1.5 py-0.5 text-[11px] font-bold text-[#1f3d6e]">{c.id}</span>{c.name}</b>
          <small className="block truncate text-xs text-[#6b7670]">{c.area}{dist != null && isFinite(dist) ? ` · ห่าง ${dist.toFixed(1)} กม.` : ''}{last ? ` · เยี่ยม ${st.days} วันก่อน` : ''}</small>
        </span>
        <StatusPill st={st} cycle={c.visitCycleDays} />
      </button>
      {actions && <div className="flex gap-1.5">
        {c.phone && <a aria-label="โทร" href={`tel:${c.phone.split(/[,/ ]/)[0]}`} onClick={() => q.call(c)} className={qa}><Phone size={16} /></a>}
        <a aria-label="นำทาง" href={navUrl(c)} target="_blank" rel="noreferrer" className={qa}><Navigation size={16} /></a>
        <button aria-label="เช็กอิน" onClick={() => q.go(c.id, 'visit')} className={qa}><Camera size={16} /></button>
        <button aria-label="รับออเดอร์" onClick={() => q.go(c.id, 'order')} className={`${qa} !border-[#1f3d6e] !bg-[#1f3d6e] !text-white`}><ShoppingCart size={16} /></button>
      </div>}
    </div>
  )
}

function Today({ db, byId, lastVisit, pos, locate, openC, toggleTask, goPage }: {
  db: DB; byId: Record<string, Customer>; lastVisit: Record<string, string>; pos: Pos | null
  locate: () => void; openC: (id: string) => void; toggleTask: (id: string) => void; goPage: (p: 'tasks' | 'analytics') => void
}) {
  const t = todayStr()
  const due = db.tasks.filter(x => x.status === 'open' && x.dueAt <= t).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const todayVisits = db.visits.filter(v => localDay(v.at) === t).length
  const todaySales = db.bills.filter(b => b.date === t).reduce((s, b) => s + billTotals(b).total, 0)
  const list = db.customers
    .map(c => ({ c, st: status(c, lastVisit[c.id]), d: pos ? kmTo(c, pos) : undefined }))
    .filter(x => x.st.s === 'overdue' || x.st.s === 'soon' || x.st.s === 'new')
    .sort((a, b) => (pos ? a.d! - b.d! : b.st.days - b.c.visitCycleDays - (a.st.days - a.c.visitCycleDays)))
  const overdueN = list.filter(x => x.st.s === 'overdue').length, soonN = list.filter(x => x.st.s === 'soon').length
  const hour = new Date().getHours(); const greet = hour < 12 ? 'สวัสดียามเช้า' : hour < 18 ? 'สวัสดียามบ่าย' : 'สวัสดียามเย็น'
  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-3 rounded-[18px] bg-gradient-to-br from-[#172f57] via-[#1f3d6e] to-[#2c5aa0] p-4 text-white shadow-[0_8px_24px_#1f3d6e33]">
        <div className="min-w-0">
          <div className="text-xs opacity-85">{greet}</div>
          <div className="my-1 text-xl font-extrabold tracking-tight">{overdueN ? `ต้องเยี่ยม ${overdueN} ร้าน` : 'วันนี้ไม่มีร้านเลยรอบ'}</div>
          <div className="text-xs opacity-85">{soonN ? `และใกล้ถึงรอบอีก ${soonN} ร้าน` : overdueN ? 'ควรเข้าก่อนเที่ยง' : 'ทุกร้านอยู่ในรอบปกติ'}</div>
        </div>
        <button onClick={() => goPage('analytics')} className="flex shrink-0 items-center gap-1 rounded-[10px] border border-white/25 bg-white/15 px-2.5 py-1.5 text-xs font-semibold"><BarChart3 size={15} />รายงาน</button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[['เยี่ยมวันนี้', todayVisits], ['งานครบกำหนด', due.length], ['ถึงรอบเยี่ยม', list.length], ['ยอดวันนี้', baht(Math.round(todaySales))]].map(([k, v], i) => (
          <div key={k as string} className={`${CARD} px-1 py-2 text-center`}><div className={`text-xl font-extrabold leading-tight ${i === 1 && due.length ? 'text-[#8a5508]' : 'text-[#1f3d6e]'}`}>{v}</div><div className="text-xs text-[#6b7670]">{k}</div></div>
        ))}
      </div>
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
          <b className="text-[15px]">คิวเยี่ยมวันนี้</b>
          <button onClick={locate} className="flex items-center gap-1 rounded-full border border-[#1f3d6e]/30 px-2.5 py-1 text-xs font-semibold text-[#1f3d6e] active:bg-[#e8eef8]"><LocateFixed size={13} />{pos ? 'อัปเดตตำแหน่ง' : 'เรียงตามใกล้ฉัน'}</button>
        </div>
        {list.length === 0 && <p className="px-4 py-6 text-center text-sm text-[#6b7670]">ไม่มีลูกค้าถึงรอบเยี่ยม</p>}
        {list.slice(0, 8).map(x => <CustomerRow actions key={x.c.id} c={x.c} last={lastVisit[x.c.id]} dist={x.d} onClick={() => openC(x.c.id)} />)}
        {list.length > 8 && <div className="px-3 py-2.5 text-center text-xs text-[#6b7670]">แสดง 8 จาก {list.length} ร้าน · ดูทั้งหมดที่แท็บลูกค้า</div>}
      </div>
      <button onClick={() => goPage('tasks')} className={`${CARD} flex w-full items-center gap-2.5 p-3 text-left`}>
        <span className="grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-[#fdf3e1] text-[#8a5508]"><Check size={18} /></span>
        <span className="min-w-0 flex-1"><b className="block text-[15px]">งานติดตามค้างอยู่</b><small className="text-xs text-[#6b7670]">{due.length} งาน วันนี้และที่เลยกำหนด</small></span>
        <ChevronRight size={16} className="text-[#a3ada8]" />
      </button>
    </div>
  )
}

function CheckinPick({ db, pos, locate, lastVisit, openC }: { db: DB; pos: Pos | null; locate: () => void; lastVisit: Record<string, string>; openC: (id: string, sb?: SubK) => void }) {
  const [q, setQ] = useState('')
  useEffect(() => { if (!pos) locate() }, []) // eslint-disable-line
  const rows = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (k) return db.customers.filter(c => (c.name + c.id + c.phone + c.area).toLowerCase().includes(k)).slice(0, 12).map(c => ({ c, d: pos ? kmTo(c, pos) : undefined }))
    if (pos) return db.customers.filter(c => c.lat != null).map(c => ({ c, d: kmTo(c, pos) })).sort((a, b) => a.d - b.d).slice(0, 8)
    return []
  }, [db.customers, q, pos])
  return (
    <div className="space-y-2.5">
      <h2 className="px-1 text-base font-bold">เช็คอินหน้าร้าน</h2>
      <div className={`${CARD} p-3`}>
        <button onClick={locate} className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#1f3d6e] py-2.5 text-[15px] font-semibold text-white active:opacity-90"><LocateFixed size={17} />{pos ? 'อัปเดตตำแหน่ง' : 'ใช้ตำแหน่งหาร้านใกล้ฉัน'}</button>
        <label className="mt-2 flex items-center gap-2 rounded-[11px] border border-[#e3e8e5] bg-white px-3">
          <Search size={17} className="text-[#a3ada8]" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="หรือค้นหาชื่อร้าน รหัส เบอร์" className="h-11 w-full bg-transparent text-base outline-none" />
        </label>
      </div>
      <div className={`${CARD} overflow-hidden`}>
        {rows.length === 0 && <p className="px-4 py-6 text-center text-sm text-[#6b7670]">{pos ? 'ไม่พบร้านที่มีพิกัด' : 'กำลังหาตำแหน่ง… หรือพิมพ์ชื่อร้านเพื่อเช็คอิน'}</p>}
        {rows.map(({ c, d }) => (
          <button key={c.id} onClick={() => openC(c.id, 'visit')} className="flex w-full items-center gap-2.5 border-b border-[#e3e8e5] px-3 py-2.5 text-left last:border-0 active:bg-[#e8eef8]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e8eef8] text-[#1f3d6e]"><TypeIcon type={c.type} /></span>
            <span className="min-w-0 flex-1"><b className="block truncate text-[15px] font-semibold"><span className="mr-1.5 rounded bg-[#e8eef8] px-1.5 py-0.5 text-[11px] font-bold text-[#1f3d6e]">{c.id}</span>{c.name}</b>
              <small className="block truncate text-xs text-[#6b7670]">{c.area}{d != null && isFinite(d) ? ` · ห่าง ${d < 1 ? Math.round(d * 1000) + ' ม.' : d.toFixed(1) + ' กม.'}` : ''}</small></span>
            <StatusPill st={status(c, lastVisit[c.id])} cycle={c.visitCycleDays} />
          </button>
        ))}
      </div>
    </div>
  )
}

function Customers({ db, lastVisit, pos, locate, openC }: { db: DB; lastVisit: Record<string, string>; pos: Pos | null; locate: () => void; openC: (id: string) => void }) {
  const [q, setQ] = useState(''); const [type, setType] = useState('ทั้งหมด'); const [limit, setLimit] = useState(60); const [late, setLate] = useState(false)
  const types = ['ทั้งหมด', ...Array.from(new Set(db.customers.map(c => c.type)))]
  const rows = useMemo(() => db.customers
    .filter(c => (type === 'ทั้งหมด' || c.type === type) && (!late || status(c, lastVisit[c.id]).s === 'overdue') && (!q || (c.name + c.phone + c.contactName + c.area + c.address + c.id + c.labels.join(' ')).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (pos ? kmTo(a, pos) - kmTo(b, pos) : a.name.localeCompare(b.name, 'th'))), [db.customers, q, type, pos, late, lastVisit])
  return (
    <div>
      <div className="sticky -top-2.5 z-10 -mx-2.5 mb-2 space-y-2 bg-[#f3f5f4] px-2.5 pb-1 pt-2.5">
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <Search size={17} className="text-slate-400" />
            <input value={q} onChange={e => { setQ(e.target.value); setLimit(60) }} placeholder="ค้นหาชื่อร้าน เบอร์ โซน รหัส" className="h-11 w-full bg-transparent text-[15px] outline-none" />
          </label>
          <button onClick={locate} aria-label="ใกล้ฉัน" className={`grid h-11 w-11 place-items-center rounded-xl border ${pos ? 'border-[#1f3d6e] bg-[#1f3d6e] text-white' : 'border-slate-200 bg-white'}`}><LocateFixed size={19} /></button>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <button onClick={() => { setLate(!late); setLimit(60) }} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${late ? 'bg-[#c2410c] font-semibold text-white' : 'border border-[#c2410c]/40 bg-white text-[#c2410c]'}`}>⚠ เลยรอบ</button>
          {types.map(t => <button key={t} onClick={() => { setType(t); setLimit(60) }} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${type === t ? 'bg-[#1f3d6e] font-semibold text-white' : 'border border-slate-200 bg-white'}`}>{t}</button>)}
        </div>
        <div className="text-xs text-slate-500">{rows.length} ราย</div>
      </div>
      <div className={`${CARD} overflow-hidden`}>
      {rows.slice(0, limit).map(c => <CustomerRow key={c.id} c={c} last={lastVisit[c.id]} dist={pos ? kmTo(c, pos) : undefined} onClick={() => openC(c.id)} />)}
      {rows.length > limit && <button onClick={() => setLimit(limit + 100)} className="w-full py-4 text-sm font-semibold text-[#1f3d6e]">แสดงเพิ่ม (เหลือ {rows.length - limit})</button>}
      </div>
    </div>
  )
}

function TaskRow({ t, c, openC, toggle }: { t: Task; c?: Customer; openC: (id: string) => void; toggle: (id: string) => void }) {
  const late = t.status === 'open' && t.dueAt < todayStr()
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
      <button aria-label="ทำเสร็จ" onClick={() => toggle(t.id)} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${t.status === 'done' ? 'border-[#2f7d57] bg-[#2f7d57] text-white' : 'border-slate-400'}`}>
        {t.status === 'done' && <Check size={16} />}
      </button>
      <button onClick={() => c && openC(c.id)} className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-[15px] font-semibold ${t.status === 'done' ? 'text-slate-400 line-through' : ''}`}>{t.type} · {t.title}</span>
        <span className="block truncate text-xs text-slate-500">{c ? cname(c) : 'ลูกค้า'}</span>
      </button>
      <span className={`shrink-0 text-xs ${late ? 'font-bold text-[#c2410c]' : 'text-slate-500'}`}>{late && <AlertTriangle size={12} className="mr-0.5 inline" />}{fmt(t.dueAt)}</span>
    </div>
  )
}

function Tasks({ db, byId, openC, toggleTask }: { db: DB; byId: Record<string, Customer>; openC: (id: string) => void; toggleTask: (id: string) => void }) {
  const [f, setF] = useState<'open' | 'done'>('open')
  const rows = db.tasks.filter(t => t.status === f).sort((a, b) => (f === 'open' ? a.dueAt.localeCompare(b.dueAt) : b.dueAt.localeCompare(a.dueAt))).slice(0, 150)
  return (
    <div>
      <div className="flex gap-2 px-4 py-3">
        {([['open', 'ค้างอยู่'], ['done', 'เสร็จแล้ว']] as const).map(([k, t]) => <button key={k} onClick={() => setF(k)} className={`rounded-full px-4 py-1.5 text-sm ${f === k ? 'bg-[#1f3d6e] font-semibold text-white' : 'border border-slate-200 bg-white'}`}>{t}</button>)}
      </div>
      {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">ไม่มีรายการ</p>}
      {rows.map(t => <TaskRow key={t.id} t={t} c={byId[t.customerId]} openC={openC} toggle={toggleTask} />)}
    </div>
  )
}

/* ---------- รูปถ่าย ---------- */
function Photo({ id, size = 64 }: { id: string; size?: number }) {
  const [u, setU] = useState<string>(); const [big, setBig] = useState(false)
  useEffect(() => { getPhoto(id).then(setU) }, [id])
  if (!u) return <div className="rounded-lg bg-slate-200" style={{ width: size, height: size }} />
  return (<>
    <button onClick={() => setBig(true)}><img src={u} alt="รูปเช็กอิน" className="rounded-lg object-cover" style={{ width: size, height: size }} /></button>
    {big && <button onClick={() => setBig(false)} className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-3"><img src={u} alt="รูปเช็กอิน" className="max-h-full max-w-full rounded-lg" /></button>}
  </>)
}

/* ---------- ชีทลูกค้า ---------- */
function CustomerSheet({ c, db, byId, s, pos, lastVisit, close, say, addVisit, addTask, addOrder, logCall, toggleTask, setCustPos, initSub }: {
  c: Customer; db: DB; byId: Record<string, Customer>; s: Settings; pos: Pos | null; lastVisit?: string; close: () => void; say: (t: string) => void
  addVisit: (v: Omit<Visit, 'id' | 'at'>) => void; addTask: (t: Omit<Task, 'id' | 'status'>) => void
  addOrder: (id: string, items: BillItem[], vat: Bill['vatMode']) => void; logCall: (c: Customer) => void; toggleTask: (id: string) => void
  setCustPos: (id: string, lat: number, lng: number) => void; initSub?: 'visit' | 'task' | 'order'
}) {
  const [sub, setSub] = useState<null | 'visit' | 'task' | 'order'>(initSub ?? null); const [bill, setBill] = useState<Bill | null>(null); const [allBills, setAllBills] = useState(false)
  const st = status(c, lastVisit)
  const visits = db.visits.filter(v => v.customerId === c.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6)
  const bills = useMemo(() => db.bills.filter(b => b.customerId === c.id).sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no)), [db.bills, c.id])
  const spend = bills.reduce((x, b) => x + billTotals(b).total, 0)
  const tasks = db.tasks.filter(t => t.customerId === c.id && t.status === 'open')
  const usual = Object.values(bills.slice(0, 12).flatMap(b => b.items).reduce<Record<string, BillItem & { n: number }>>((m, i) => {
    m[i.code || i.name] = m[i.code || i.name] ? { ...m[i.code || i.name], n: m[i.code || i.name].n + 1 } : { ...i, n: 1 }; return m }, {})).sort((a, b) => b.n - a.n).slice(0, 5)
  const act = 'flex flex-1 flex-col items-center gap-1 rounded-xl py-3 text-xs font-semibold active:opacity-70'
  const grabPos = async () => { try { const p = await getPosition(); setCustPos(c.id, p.lat, p.lng) } catch (e) { say((e as Error).message) } }
  return (
    <>
      <Sheet title={cname(c)} onClose={close}>
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-2 text-sm">
            <span className={`h-3 w-3 rounded-full ${dot[st.s]}`} /><span className="font-semibold">{label[st.s]}</span>
            <span className="text-slate-500">· {c.type} · {c.paymentTerm}</span>
          </div>
          <div className="flex gap-2">
            <a href={`tel:${c.phone.split(/[,/ ]/)[0]}`} onClick={() => logCall(c)} className={`${act} bg-[#1f3d6e] text-white`}><Phone size={22} />โทร</a>
            <a href={navUrl(c)} target="_blank" rel="noreferrer" className={`${act} bg-[#2c5aa0] text-white`}><Navigation size={22} />นำทาง</a>
            {c.lineId
              ? <a href={`https://line.me/R/ti/p/~${c.lineId}`} target="_blank" rel="noreferrer" className={`${act} bg-[#2f7d57] text-white`}><MessageCircle size={22} />LINE</a>
              : <span className={`${act} bg-slate-200 text-slate-400`}><MessageCircle size={22} />LINE</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSub('visit')} className={`${act} border border-[#1f3d6e]/40 text-[#1f3d6e]`}><Camera size={20} />เช็กอิน+รูป</button>
            <button onClick={() => setSub('order')} className={`${act} border border-[#1f3d6e]/40 text-[#1f3d6e]`}><ShoppingCart size={20} />รับออเดอร์</button>
            <button onClick={() => setSub('task')} className={`${act} border border-[#1f3d6e]/40 text-[#1f3d6e]`}><Plus size={20} />เพิ่มงาน</button>
          </div>

          <div className="space-y-1.5 rounded-xl bg-[#ffffff] p-3 text-sm">
            <div><b>รหัส:</b> {c.id} · <b>ติดต่อ:</b> {c.contactName || '-'} · {c.phone}</div>
            <div><b>ที่อยู่:</b> {c.address || '-'}</div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-xs text-slate-600"><MapPin size={14} />{c.lat != null ? `${c.lat.toFixed(5)}, ${c.lng!.toFixed(5)}${pos ? ` · ห่าง ${Math.round(distM({ lat: c.lat, lng: c.lng! }, pos))} ม.` : ''}` : 'ยังไม่มีพิกัดร้าน'}</span>
              <button onClick={grabPos} className="flex shrink-0 items-center gap-1 rounded-lg border border-[#1f3d6e] px-2 py-1 text-xs font-semibold text-[#1f3d6e]"><Crosshair size={13} />ตั้งพิกัดร้าน = ตำแหน่งฉัน</button>
            </div>
            {c.storeHours && <div className="flex gap-1"><Clock size={15} className="mt-0.5 shrink-0" />{c.storeHours}</div>}
            <div><b>รอบเยี่ยม:</b> ทุก {c.visitCycleDays} วัน{lastVisit ? ` · ล่าสุด ${fmt(lastVisit)}` : ''}</div>
            {c.specialConditions && <div className="rounded-lg bg-[#fdebd2] p-2 text-[#8a3b0c]"><AlertTriangle size={14} className="mr-1 inline" />{c.specialConditions}</div>}
            {c.note && <div className="text-slate-600">📝 {c.note}</div>}
          </div>

          {tasks.length > 0 && (
            <section><H>งานค้าง</H>
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <button aria-label="เสร็จ" onClick={() => toggleTask(t.id)} className="h-6 w-6 rounded-full border-2 border-slate-400" />
                  <span className="flex-1">{t.type} · {t.title}</span><span className="text-xs text-slate-500">{fmt(t.dueAt)}</span>
                </div>))}
            </section>
          )}
          {usual.length > 0 && (
            <section><H>สินค้าที่สั่งประจำ</H>
              <div className="flex flex-wrap gap-1.5">{usual.map(u => <span key={u.code || u.name} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">{u.name}</span>)}</div>
            </section>
          )}
          <section><H>ประวัติเยี่ยม</H>
            {visits.length === 0 && <p className="text-sm text-slate-500">ยังไม่มี</p>}
            {visits.map(v => (
              <div key={v.id} className="border-b border-slate-200 py-2 text-sm">
                <b>{fmt(v.at)}</b> · {v.outcome}
                {v.note && <div className="text-xs text-slate-500">{v.note}</div>}
                {v.lat != null && <a href={`https://maps.google.com/?q=${v.lat},${v.lng}`} target="_blank" rel="noreferrer" className="text-xs text-[#1f3d6e] underline">📍 {v.lat.toFixed(5)}, {v.lng?.toFixed(5)}{v.distM != null ? ` · ห่างร้าน ${Math.round(v.distM)} ม.` : ''}</a>}
                {v.photoIds && v.photoIds.length > 0 && <div className="mt-1 flex gap-1.5">{v.photoIds.map(id => <Photo key={id} id={id} />)}</div>}
              </div>))}
          </section>
          <section>
            <div className="mb-1 flex items-center justify-between"><H>บิลย้อนหลัง ({bills.length}) · รวม ฿{baht(Math.round(spend))}</H></div>
            {bills.length === 0 && <p className="text-sm text-slate-500">ยังไม่มีบิล</p>}
            {(allBills ? bills : bills.slice(0, 4)).map(b => (
              <button key={b.no} onClick={() => setBill(b)} className="block w-full border-b border-slate-200 py-2 text-left text-sm">
                <div className="flex justify-between"><b>#{b.no} · {fmt(b.date)}</b><b>฿{baht(billTotals(b).total)}</b></div>
                <div className="truncate text-xs text-slate-500">{b.items.map(i => `${i.name} ×${i.qty}`).join(', ')}</div>
              </button>))}
            {bills.length > 4 && <button onClick={() => setAllBills(!allBills)} className="py-2 text-xs font-semibold text-[#1f3d6e]">{allBills ? 'แสดงน้อยลง' : `ดูทั้งหมด ${bills.length} บิล`}</button>}
          </section>
        </div>
      </Sheet>
      {bill && <BillDetail b={bill} c={c} s={s} byId={byId} say={say} close={() => setBill(null)} />}
      {sub === 'visit' && <VisitForm c={c} onClose={() => setSub(null)} save={addVisit} setCustPos={setCustPos} />}
      {sub === 'task' && <TaskForm c={c} onClose={() => setSub(null)} save={addTask} />}
      {sub === 'order' && <OrderForm c={c} db={db} usual={usual} onClose={() => setSub(null)} save={(i, v) => { addOrder(c.id, i, v) }} />}
    </>
  )
}

function VisitForm({ c, onClose, save, setCustPos }: { c: Customer; onClose: () => void; save: (v: Omit<Visit, 'id' | 'at'>) => void; setCustPos: (id: string, lat: number, lng: number) => void }) {
  const [outcome, setOutcome] = useState(OUTCOMES[0]); const [note, setNote] = useState('')
  const [pos, setPos] = useState<Pos | null>(null); const [gpsErr, setGpsErr] = useState(''); const [loading, setLoading] = useState(true)
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]); const [saving, setSaving] = useState(false); const [setShop, setSetShop] = useState(c.lat == null)
  const fetchPos = () => { setLoading(true); setGpsErr(''); getPosition().then(p => { setPos(p); setLoading(false) }).catch(e => { setGpsErr((e as Error).message); setLoading(false) }) }
  useEffect(fetchPos, [])
  const dist = pos && c.lat != null ? distM({ lat: c.lat, lng: c.lng! }, pos) : undefined
  const addPhotos = async (files: FileList | null) => {
    if (!files) return
    const cap = `${cname(c)}\n${new Date().toLocaleString('th-TH')}\n${pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} ±${Math.round(pos.accuracy)}ม.` : 'ไม่มีพิกัด'}`
    const out: { id: string; url: string }[] = []
    for (const f of Array.from(files)) { try { out.push({ id: uid('P'), url: await stampPhoto(f, cap) }) } catch { /* ข้ามไฟล์ที่อ่านไม่ได้ */ } }
    setPhotos(p => [...p, ...out])
  }
  const go = async () => {
    setSaving(true)
    for (const p of photos) await putPhoto(p.id, p.url)
    save({ customerId: c.id, outcome, note, lat: pos?.lat, lng: pos?.lng, accuracy: pos?.accuracy, distM: dist, photoIds: photos.map(p => p.id) })
    if (pos && setShop) setCustPos(c.id, pos.lat, pos.lng)
    onClose()
  }
  return (
    <Sheet title="เช็กอิน / บันทึกการเยี่ยม" onClose={onClose} z={60}>
      <div className="space-y-4 p-4">
        <div className={`rounded-xl p-3 text-sm ${gpsErr ? 'bg-[#fdebd2] text-[#8a3b0c]' : 'bg-[#ffffff]'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{cname(c)}</span>
            <button onClick={fetchPos} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#1f3d6e]"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />อ่านพิกัดใหม่</button>
          </div>
          {loading && <div className="text-xs text-slate-500">กำลังอ่านตำแหน่งจาก GPS…</div>}
          {gpsErr && <div className="text-xs">{gpsErr} (ยังบันทึกได้โดยไม่มีพิกัด)</div>}
          {pos && <div className="text-xs text-slate-600">📍 {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)} · แม่นยำ ±{Math.round(pos.accuracy)} ม.</div>}
          {dist != null && <div className={`text-xs font-semibold ${dist > 300 ? 'text-[#c2410c]' : 'text-[#2f7d57]'}`}>{dist > 300 ? `⚠ ห่างจากพิกัดร้าน ${Math.round(dist)} ม.` : `✓ ถึงร้านแล้ว (ห่าง ${Math.round(dist)} ม.)`}</div>}
          {pos && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={setShop} onChange={e => setSetShop(e.target.checked)} className="h-4 w-4" />ตั้งพิกัดนี้เป็นตำแหน่งร้าน{c.lat != null ? ' (แทนที่ของเดิม)' : ''}</label>}
        </div>
        <div className="flex flex-wrap gap-2">
          {OUTCOMES.map(o => <button key={o} onClick={() => setOutcome(o)} className={`rounded-full px-3 py-2 text-sm ${outcome === o ? 'bg-[#1f3d6e] font-semibold text-white' : 'border border-slate-200 bg-white'}`}>{o}</button>)}
        </div>
        <Field l="หมายเหตุ"><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={inputCls} placeholder="เช่น สินค้าเหลือครึ่งหนึ่ง ให้กลับมาอาทิตย์หน้า" /></Field>
        <div>
          <H>รูปถ่าย (ใส่ลายน้ำวันที่-เวลา-พิกัดอัตโนมัติ)</H>
          <div className="flex flex-wrap gap-2">
            {photos.map(p => <img key={p.id} src={p.url} alt="" className="h-20 w-20 rounded-lg object-cover" />)}
            <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-[#1f3d6e] text-[#1f3d6e]">
              <span className="flex flex-col items-center text-[11px] font-semibold"><Camera size={22} />ถ่ายรูป</span>
              <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
            </label>
          </div>
        </div>
        <button disabled={saving || loading} onClick={go} className={`${btnPrimary} w-full`}>{saving ? 'กำลังบันทึก…' : loading ? 'รอพิกัดสักครู่…' : 'บันทึกเช็กอิน'}</button>
        {loading && <button onClick={() => setLoading(false)} className="w-full text-xs text-slate-500 underline">ไม่รอพิกัด</button>}
      </div>
    </Sheet>
  )
}

function TaskForm({ c, onClose, save }: { c: Customer; onClose: () => void; save: (t: Omit<Task, 'id' | 'status'>) => void }) {
  const [type, setType] = useState(TASK_TYPES[0]); const [title, setTitle] = useState(''); const [due, setDue] = useState(todayStr()); const [note, setNote] = useState('')
  const quick = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); setDue(ymd(d)) }
  return (
    <Sheet title="เพิ่มงานติดตาม" onClose={onClose} z={60}>
      <div className="space-y-4 p-4">
        <div className="text-sm text-slate-600">{cname(c)}</div>
        <div className="flex flex-wrap gap-2">{TASK_TYPES.map(t => <button key={t} onClick={() => setType(t)} className={`rounded-full px-3 py-2 text-sm ${type === t ? 'bg-[#1f3d6e] font-semibold text-white' : 'border border-slate-200 bg-white'}`}>{t}</button>)}</div>
        <Field l="รายละเอียด"><input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="เช่น โทรถามออเดอร์" /></Field>
        <Field l="กำหนด">
          <div className="flex gap-2"><input type="date" value={due} onChange={e => setDue(e.target.value)} className={inputCls} />
            {[['พรุ่งนี้', 1], ['+7 วัน', 7]].map(([t, n]) => <button key={t as string} onClick={() => quick(n as number)} className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs">{t}</button>)}</div>
        </Field>
        <Field l="หมายเหตุ"><input value={note} onChange={e => setNote(e.target.value)} className={inputCls} /></Field>
        <button onClick={() => { save({ customerId: c.id, type, title: title || type, dueAt: due, note }); onClose() }} className={`${btnPrimary} w-full`}>เพิ่มงาน</button>
      </div>
    </Sheet>
  )
}

function OrderForm({ c, db, usual, onClose, save }: { c: Customer; db: DB; usual: BillItem[]; onClose: () => void; save: (items: BillItem[], vat: Bill['vatMode']) => void }) {
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(usual.map(u => [u.code, u.qty])))
  const [vat, setVat] = useState<Bill['vatMode']>('NONE'); const [q, setQ] = useState('')
  const prods = db.products.filter(p => !q || (p.code + p.name).toLowerCase().includes(q.toLowerCase()))
  const items = db.products.filter(p => qty[p.code] > 0).map(p => ({ code: p.code, name: p.name, price: p.price, qty: qty[p.code] }))
  const t = billTotals({ items, vatMode: vat })
  const set = (code: string, d: number) => setQty(x => ({ ...x, [code]: Math.max(0, (x[code] || 0) + d) }))
  const sorted = [...prods].sort((a, b) => (qty[b.code] > 0 ? 1 : 0) - (qty[a.code] > 0 ? 1 : 0)).slice(0, 60)
  return (
    <Sheet title="รับออเดอร์" onClose={onClose} z={60}>
      <div className="p-4">
        <div className="mb-2 text-sm text-slate-600">{cname(c)} · ตั้งต้นจากสินค้าที่สั่งประจำ</div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาสินค้า" className={`${inputCls} mb-2`} />
        {sorted.map(p => (
          <div key={p.code} className="flex items-center gap-2 border-b border-slate-200 py-2.5">
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{p.name}</div><div className="text-xs text-slate-500">{p.code} · ฿{baht(p.price)}</div></div>
            <button aria-label="ลด" onClick={() => set(p.code, -1)} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white"><Minus size={16} /></button>
            <span className="w-7 text-center font-bold">{qty[p.code] || 0}</span>
            <button aria-label="เพิ่ม" onClick={() => set(p.code, 1)} className="grid h-9 w-9 place-items-center rounded-full bg-[#1f3d6e] text-white"><Plus size={16} /></button>
          </div>
        ))}
        {sorted.length === 0 && <p className="py-6 text-center text-sm text-slate-500">ไม่พบสินค้า — นำเข้าสินค้าได้ที่ตั้งค่า</p>}
        <div className="mt-3"><Field l="VAT"><select value={vat} onChange={e => setVat(e.target.value as Bill['vatMode'])} className={inputCls}><option value="NONE">ไม่มี VAT</option><option value="VAT_OUT">แยก VAT 7%</option><option value="VAT_IN">รวม VAT แล้ว</option></select></Field></div>
        <button disabled={!items.length} onClick={() => { save(items, vat); onClose() }} className={`${btnPrimary} mt-4 w-full`}>บันทึกออเดอร์ · ฿{baht(t.total)}</button>
      </div>
    </Sheet>
  )
}

function OrderDone({ b, c, s, byId, say, close }: { b: Bill; c?: Customer; s: Settings; byId: Record<string, Customer>; say: (t: string) => void; close: () => void }) {
  const [view, setView] = useState(false)
  const act = 'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold active:opacity-80'
  const msg = customerBillText(b, c, s)
  return (
    <>
      <Sheet title="บันทึกออเดอร์แล้ว" onClose={close} z={75}>
        <div className="space-y-3 p-4">
          <div className="rounded-xl bg-[#ffffff] p-3 text-sm"><b>{b.no}</b> · {c ? cname(c) : b.customerId}<div className="text-lg font-bold text-[#1f3d6e]">฿{baht(billTotals(b).total)}</div></div>
          <a href={lineShare(companyOrderText(b, c, s))} target="_blank" rel="noreferrer" className={`${act} bg-[#06c755] text-white`}><Building2 size={19} />แจ้งออเดอร์ให้บริษัททาง LINE</a>
          <a href={lineShare(msg)} target="_blank" rel="noreferrer" className={`${act} border border-[#1f3d6e]/40 text-[#1f3d6e]`}><MessageCircle size={19} />ส่งยอด+ลิงก์บิลให้ลูกค้า (LINE)</a>
          <div className="flex gap-2">
            <a href={smsLink(c?.phone || '', msg)} className={`${act} flex-1 border border-slate-400`}>SMS</a>
            <button onClick={async () => say((await copyText(msg)) ? 'คัดลอกข้อความแล้ว' : 'คัดลอกไม่สำเร็จ')} className={`${act} flex-1 border border-slate-400`}>คัดลอก</button>
            <button onClick={() => setView(true)} className={`${act} flex-1 border border-slate-400`}>ดูบิล</button>
          </div>
          <p className="text-xs text-slate-500">LINE จะเปิดหน้าเลือกแชต/กลุ่มปลายทางพร้อมข้อความที่เตรียมไว้ — เลือกกลุ่มบริษัทแล้วกดส่ง</p>
        </div>
      </Sheet>
      {view && <BillDetail b={b} c={c} s={s} byId={byId} say={say} close={() => setView(false)} />}
    </>
  )
}

function SettingsSheet({ db, setDb, s, setS, close, say }: { db: DB; setDb: (d: DB) => void; s: Settings; setS: (s: Settings) => void; close: () => void; say: (t: string) => void }) {
  const [f, setF] = useState(s); const [busy, setBusy] = useState(false); const [imp, setImp] = useState(false); const [err, setErr] = useState('')
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setF(p => ({ ...p, [k]: v }))
  const sync = async () => {
    setS(f); setBusy(true); setErr('')
    try { const r = await syncFromSheet(f.sheetUrl.trim(), f.sheetToken.trim(), f.months, db); setDb(r.db); say('ซิงก์แล้ว: ' + Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(' · ')); close() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <>
      <Sheet title="ตั้งค่า" onClose={close}>
        <div className="space-y-5 p-4 text-sm">
          <section className="space-y-3">
            <H>เชื่อมชีท A (อ่านอย่างเดียว)</H>
            <Field l="URL ของ Apps Script (ลงท้าย /exec)"><input value={f.sheetUrl} onChange={e => set('sheetUrl', e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" className={inputCls} /></Field>
            <Field l="TOKEN"><input type="password" value={f.sheetToken} onChange={e => set('sheetToken', e.target.value)} className={inputCls} /></Field>
            <Field l="ดึงบิลย้อนหลัง (เดือน)"><input type="number" min={1} max={60} value={f.months} onChange={e => set('months', +e.target.value || 12)} className={inputCls} /></Field>
            {err && <div className="rounded-lg bg-[#fdebd2] p-2 text-xs text-[#8a3b0c]">{err}</div>}
            <button disabled={busy || !f.sheetUrl || !f.sheetToken} onClick={sync} className={`${btnPrimary} flex w-full items-center justify-center gap-2`}><RefreshCw size={17} className={busy ? 'animate-spin' : ''} />{busy ? 'กำลังดึงข้อมูล…' : 'ซิงก์จากชีท A'}</button>
            <p className="text-xs text-slate-500">ลูกค้า {db.customers.length} · บิล {db.bills.length} · เยี่ยม {db.visits.length}{db.syncedAt ? ` · ซิงก์ล่าสุด ${new Date(db.syncedAt).toLocaleString('th-TH')}` : ' · ตอนนี้เป็นข้อมูลตัวอย่าง'}. ข้อมูลที่บันทึกในแอปเก็บในเครื่อง ไม่เขียนกลับชีท</p>
          </section>
          <section className="space-y-3">
            <H>นำเข้าจากไฟล์ (txt / csv)</H>
            <button onClick={() => { setS(f); setImp(true) }} className={`${btnGhost} flex w-full items-center justify-center gap-2`}><FileUp size={17} />เลือกไฟล์ → จับคู่ → ตรวจแก้ → นำเข้า</button>
          </section>
          <section className="space-y-3">
            <H>ข้อมูลบริษัท (ใช้บนบิลและข้อความ)</H>
            <Field l="ชื่อเซลล์ (แสดงในข้อความแจ้งบริษัท)"><input value={f.salesName} onChange={e => set('salesName', e.target.value)} className={inputCls} /></Field>
            <Field l="ชื่อบริษัท"><input value={f.companyName} onChange={e => set('companyName', e.target.value)} className={inputCls} /></Field>
            <Field l="ที่อยู่"><textarea rows={2} value={f.companyAddress} onChange={e => set('companyAddress', e.target.value)} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field l="โทร"><input value={f.companyPhone} onChange={e => set('companyPhone', e.target.value)} className={inputCls} /></Field>
              <Field l="เลขผู้เสียภาษี"><input value={f.companyTaxId} onChange={e => set('companyTaxId', e.target.value)} className={inputCls} /></Field>
            </div>
            <Field l="ช่องทางชำระเงิน (ธนาคาร / พร้อมเพย์)"><textarea rows={2} value={f.bankInfo} onChange={e => set('bankInfo', e.target.value)} className={inputCls} /></Field>
            <Field l="URL แอปสำหรับลิงก์หน้าบิล (เว้นว่าง = ใช้ที่อยู่ปัจจุบัน)"><input value={f.billBase} onChange={e => set('billBase', e.target.value)} className={inputCls} /></Field>
            <button onClick={() => { setS(f); say('บันทึกการตั้งค่าแล้ว') }} className={`${btnPrimary} w-full`}>บันทึกการตั้งค่า</button>
          </section>
          <button onClick={() => { if (confirm('ล้างข้อมูลในเครื่องและกลับไปข้อมูลตัวอย่าง?')) { setDb(buildDemo()); say('รีเซ็ตแล้ว'); close() } }} className="w-full rounded-xl border border-slate-400 py-3 font-semibold">ล้างข้อมูลในเครื่อง → ข้อมูลตัวอย่าง</button>
        </div>
      </Sheet>
      {imp && <ImportWizard db={db} setDb={d => { setDb(d) }} close={() => setImp(false)} say={say} />}
    </>
  )
}
