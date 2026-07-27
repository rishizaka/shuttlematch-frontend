import { Lightbulb, ListOrdered } from 'lucide-react'

/**
 * 各ミニゲームの「遊び方」「コツ」。
 *
 * キャンバスの下・広告枠の上に置く。ゲーム本体は canvas なので、テキストで遊び方を
 * 説明しておかないとページの中身が実質空になる(検索エンジンにも広告配信の審査にも
 * 中身のないページとして扱われる)。誤タップ防止のため、キャンバスと広告枠の間の
 * 緩衝地帯という役割も兼ねている。
 */
export function GameGuide({ howTo, tips }: { howTo: string[]; tips: string[] }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <Section icon={<ListOrdered className="h-4 w-4 text-brand-500" />} title="遊び方">
        {howTo}
      </Section>
      <Section icon={<Lightbulb className="h-4 w-4 text-accent-500" />} title="コツ">
        {tips}
      </Section>
    </div>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: string[]
}) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
        {icon}
        {title}
      </h2>
      <ul className="mt-2 space-y-1.5">
        {children.map((line, i) => (
          <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-600">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
