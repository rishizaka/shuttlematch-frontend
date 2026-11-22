// 法務ページ(/privacy・/terms)の公開窓口。文面は legal.ts、表示は LegalDocument。
// 文面を改定したら PRIVACY_UPDATED_AT / TERMS_UPDATED_AT も更新する(LegalDocument.test.tsx が記載漏れを固定)。
export { LegalDocument } from './LegalDocument'
export {
  PRIVACY_LEAD,
  PRIVACY_SECTIONS,
  PRIVACY_UPDATED_AT,
  TERMS_LEAD,
  TERMS_SECTIONS,
  TERMS_UPDATED_AT,
} from './legal'
