import { Card, CardBody } from '../ui/Card'
import { formatJapaneseDate } from '../../lib/date'
import type { LegalSection } from '../../lib/legal'

/**
 * プライバシーポリシー / 利用規約の表示。
 * 条文は素の文章なので、リリースノート詳細と同じ「1枚のカードに節を積む」体裁に揃えている。
 */
export function LegalDocument({
  title,
  updatedAt,
  lead,
  sections,
}: {
  title: string
  /** 最終改定日 'YYYY-MM-DD' */
  updatedAt: string
  lead: string
  sections: LegalSection[]
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          最終改定日:{' '}
          <time dateTime={updatedAt}>{formatJapaneseDate(updatedAt)}</time>
        </p>
      </div>

      <Card>
        <CardBody className="space-y-6 py-6">
          <p className="text-sm leading-relaxed text-slate-700">{lead}</p>

          {sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-base font-semibold text-slate-900">{section.heading}</h2>

              {section.paragraphs?.map((paragraph, i) => (
                <p key={i} className="text-sm leading-relaxed text-slate-700">
                  {paragraph}
                </p>
              ))}

              {section.items ? (
                <ul className="space-y-2 pl-1">
                  {section.items.map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-sm leading-relaxed text-slate-700"
                    >
                      <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {section.links ? (
                <ul className="space-y-1.5">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
