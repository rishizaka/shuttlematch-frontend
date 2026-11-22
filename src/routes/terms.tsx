import { createFileRoute } from '@tanstack/react-router'
import { LegalDocument, TERMS_LEAD, TERMS_SECTIONS, TERMS_UPDATED_AT } from '../features/legal'

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: '利用規約 — シャトルマッチ' },
      {
        name: 'description',
        content: 'シャトルマッチの利用条件を定めた利用規約です。',
      },
    ],
  }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <LegalDocument
      title="利用規約"
      updatedAt={TERMS_UPDATED_AT}
      lead={TERMS_LEAD}
      sections={TERMS_SECTIONS}
    />
  )
}
