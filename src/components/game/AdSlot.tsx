/**
 * 将来の広告枠。マネタイズはミニゲームのページに閉じて、試合表や TOP には出さない方針。
 * AdSense 等を入れるときはこの中身をタグに差し替える。
 */
export function AdSlot() {
  return (
    <div className="flex h-[100px] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-100/60">
      <span className="text-xs tracking-wider text-slate-400">AD SPACE</span>
    </div>
  )
}
