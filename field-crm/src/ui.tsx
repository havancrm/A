import { X } from 'lucide-react'

export const inputCls = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#0f4c47]'
export const btnPrimary = 'rounded-xl bg-[#0f4c47] py-3.5 text-base font-bold text-white active:opacity-80 disabled:opacity-40'
export const btnGhost = 'rounded-xl border-2 border-[#0f4c47] py-3 text-sm font-semibold text-[#0f4c47] active:bg-[#0f4c47]/10 disabled:opacity-40'
export const Field = ({ l, children }: { l: string; children: React.ReactNode }) => (
  <label className="block"><span className="mb-1 block text-xs font-semibold text-stone-500">{l}</span>{children}</label>
)
export const H = ({ children }: { children: React.ReactNode }) => (
  <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-500">{children}</h4>
)

export function Sheet({ title, onClose, children, z = 50, full = false }: { title: string; onClose: () => void; children: React.ReactNode; z?: number; full?: boolean }) {
  return (
    <div className="fixed inset-0 flex items-end justify-center bg-black/40" style={{ zIndex: z }}>
      <div className={`flex w-full max-w-md flex-col rounded-t-2xl bg-[#f5f0e6] ${full ? 'h-[100dvh] rounded-none' : 'max-h-[94dvh]'}`}>
        <div className="flex items-center justify-between border-b border-stone-300 px-4 py-3">
          <h3 className="truncate pr-2 text-base font-bold">{title}</h3>
          <button aria-label="ปิด" onClick={onClose} className="rounded-full p-1.5 active:bg-stone-300"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
