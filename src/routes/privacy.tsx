import { createFileRoute } from '@tanstack/react-router'
import { LegalDocument } from '../components/legal/LegalDocument'
import { PRIVACY_LEAD, PRIVACY_SECTIONS, PRIVACY_UPDATED_AT } from '../lib/legal'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'プライバシーポリシー — ShuttleMatch' },
      {
        name: 'description',
        content:
          'ShuttleMatch における利用者の情報の取り扱い、Cookie および広告配信についての方針です。',
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
