import { createFileRoute } from '@tanstack/react-router'
import { LegalDocument, PRIVACY_LEAD, PRIVACY_SECTIONS, PRIVACY_UPDATED_AT } from '../features/legal'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'プライバシーポリシー — シャトルマッチ' },
      {
        name: 'description',
        content:
          'シャトルマッチにおける利用者の情報の取り扱い、Cookie および広告配信についての方針です。',
      },
    ],
  }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <LegalDocument
      title="プライバシーポリシー"
      updatedAt={PRIVACY_UPDATED_AT}
      lead={PRIVACY_LEAD}
      sections={PRIVACY_SECTIONS}
    />
  )
}
