import { X } from 'lucide-react'

export const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] outline-none transition focus:border-[#14284b] focus:ring-2 focus:ring-[#14284b]/15'
export const btnPrimary = 'rounded-xl bg-gradient-to-b from-[#1b3560] to-[#14284b] py-3 text-[15px] font-bold text-white shadow-[0_2px_8px_rgba(20,40,75,.25)] transition active:scale-[.98] active:opacity-90 disabled:opacity-40 disabled:shadow-none'
export const btnGhost = 'rounded-xl border border-[#14284b]/30 bg-white py-2.5 text-sm font-semibold text-[#14284b] transition active:scale-[.98] active:bg-[#14284b]/10 disabled:opacity-40'
export const Field = ({ l, children }: { l: string; children: React.ReactNode }) => (
  <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">{l}</span>{children}</label>
)
export const H = ({ children }: { children: React.ReactNode }) => (
  <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">{children}</h4>
)

export function Sheet({ title, onClose, children, z = 50, full = false }: { title: string; onClose: () => void; children: React.ReactNode; z?: number; full?: boolean }) {
  return (
    <div className="fixed inset-0 flex items-end justify-center bg-[#0a1630]/50 backdrop-blur-[2px]" style={{ zIndex: z }}>
      <div className={`flex w-full max-w-md flex-col rounded-t-3xl bg-[#eef2f8] shadow-2xl ${full ? 'h-[100dvh] rounded-none' : 'max-h-[94dvh]'}`}>
        <div className="relative flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-slate-300" />
          <h3 className="mt-2 truncate pr-2 text-[15px] font-bold text-[#14284b]">{title}</h3>
          <button aria-label="ปิด" onClick={onClose} className="rounded-full p-1.5 active:bg-slate-300"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
