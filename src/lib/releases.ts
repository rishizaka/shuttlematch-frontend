import { formatJapaneseDate } from './date'

export type ReleaseTag = '新機能' | '改善' | '不具合修正'

export type ReleaseNote = {
  /** URL スラッグ。詳細ページは /release/{id} */
  id: string
  /** 公開日 (JST) 'YYYY-MM-DD' */
  date: string
  title: string
  /** 一覧カードに表示する 1〜2 文の要約 */
  summary: string
  tags: ReleaseTag[]
  /** 詳細ページの本文。heading を省略したセクションは地の文として表示する */
  sections: Array<{ heading?: string; paragraphs: string[] }>
}

/**
 * リリースノートの原本。新しいものを先頭に追加していく。
 * 現状は人手(Claude 経由)でこの配列を編集して公開する運用。
 */
export const RELEASES: ReleaseNote[] = [
  {
    id: '2026-07-27-matching-mix',
    date: '2026-07-27',
    title: 'マッチングアルゴリズムを改善し、顔ぶれがさらに混ざるように',
    summary:
      '試合の組み合わせ探索を強化し、「また同じメンバーと同じコート」になる偏りを大きく減らしました。',
    tags: ['改善'],
    sections: [
      {
        paragraphs: [
          '試合表を生成するマッチングアルゴリズムを改善しました。出場回数の公平さ(差は常に1以内)はそのままに、「誰と同じコートに入ったか」の偏りがこれまでよりずっと小さくなります。',
        ],
      },
      {
        heading: '同じ顔ぶれで固まらない組み合わせ探索',
        paragraphs: [
          '誰と誰が同じコートに入ったかを全ペアぶん記録し、共起の偏りをスコア化して組み合わせを探索するようにしました。候補の試合表を何通りも作り、部分的な入れ替えで改善を繰り返したうえで、いちばん混ざったものを採用します。',
          'これにより「毎回ほぼ同じ4人がコート1に集まる」「特定の2人がずっと当たらない」といった偏りが起きにくくなりました。',
        ],
      },
      {
        heading: '人数が多い回でも2グループに固定されない',
        paragraphs: [
          '休みの人数が出場人数以上になる回(例: 2コートに16人)で、参加者が前半組・後半組の2グループに固定されてしまい、グループをまたいだ対戦が生まれない問題を解消しました。全員が回をまたいでまんべんなく混ざります。',
        ],
      },
    ],
  },
]

/** id からリリースノートを引く。見つからなければ undefined。 */
export function findRelease(id: string): ReleaseNote | undefined {
  return RELEASES.find((r) => r.id === id)
}

/** 'YYYY-MM-DD' を「2026年7月27日」形式に整形する。 */
export const formatReleaseDate = formatJapaneseDate
