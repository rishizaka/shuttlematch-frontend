import { useCallback, useEffect, useState } from 'react'
import { useGameRanking, useSubmitScore } from '../../hooks/queries'
import { canEnterRanking, rankForScore } from '../../lib/ranking'
import { ArcadeScreen } from './ArcadeScreen'
import { NameEntryModal } from './NameEntryModal'
import { PLAYER_NAME_KEY } from './playerName'
import { RankInCelebration } from './RankInCelebration'
import { RankingBoard } from './RankingBoard'

/**
 * ゲームオーバー画面のランキング欄。ヘッダーの冠から開くモーダルと同じ、
 * レトロなアーケード筐体の見た目で揃える。
 *
 * 順番はゲーセンと同じで、
 * <ol>
 *   <li>ランクインしていれば、まず祝福の演出(順位が上ほど派手)</li>
 *   <li>続いて名前入力のモーダル(ENTER か SKIP を選ぶまで進めない)</li>
 *   <li>最後にこの欄の上位5件が結果として残る</li>
 * </ol>
 *
 * ランクインの判定は表示中のランキングを使った先読みで、確定はサーバーの応答による
 * (入力している間に他の人に抜かれることがある)。
 */
export function GameOverRanking({
  game,
  unit,
  score,
}: {
  game: string
  unit: string
  score: number
}) {
  const { data, isLoading } = useGameRanking(game)
  const submit = useSubmitScore(game)
  const [name, setName] = useState('')
  // 登録して確定した順位。
  const [resultRank, setResultRank] = useState<number | null>(null)
  // pending=入力待ち / skipped=自分で見送った / registered=載った / missed=入力中に抜かれた
  const [outcome, setOutcome] = useState<'pending' | 'skipped' | 'registered' | 'missed'>(
    'pending',
  )
  // 祝福モーダルを出している順位(null なら出していない)。
  const [celebratingRank, setCelebratingRank] = useState<number | null>(null)
  // 祝福は1回のゲームオーバーにつき一度だけ。
  const [celebrated, setCelebrated] = useState(false)
  // 参照が変わると自動クローズのタイマーが張り直されるので固定する。
  const endCelebration = useCallback(() => setCelebratingRank(null), [])

  // 前回の名前を引き継ぐ(毎回入れ直さなくてよいように)。
  useEffect(() => {
    const stored = localStorage.getItem(PLAYER_NAME_KEY)
    if (stored) setName(stored)
  }, [])

  const entries = data?.entries ?? []
  const predictedRank = rankForScore(entries, score)
  const canEnter = outcome === 'pending' && canEnterRanking(entries, score)

  // ランキングが分かった時点で、名前入力より先に祝福を出す(ゲーセンと同じ順番)。
  useEffect(() => {
    if (celebrated || !data) return
    setCelebrated(true)
    const predicted = rankForScore(data.entries, score)
    if (score > 0 && predicted != null) setCelebratingRank(predicted)
  }, [celebrated, data, score])

  const register = () => {
    const trimmed = name.trim()
    if (!trimmed || submit.isPending) return
    submit.mutate(
      { playerName: trimmed, score },
      {
        onSuccess: (result) => {
          localStorage.setItem(PLAYER_NAME_KEY, trimmed)
          setResultRank(result.rank)
          // 入力している間に他の人に抜かれると、サーバー側でランクインが取り消される。
          setOutcome(result.rankedIn ? 'registered' : 'missed')
        },
      },
    )
  }

  if (isLoading) {
    return (
      <ArcadeScreen className="mt-3">
        <p className="animate-arcade-blink py-2 text-center text-[11px] text-[#7de3ff]">
          RANKING CHECK...
        </p>
      </ArcadeScreen>
    )
  }

  return (
    <>
      {celebratingRank != null ? (
        <RankInCelebration rank={celebratingRank} onDone={endCelebration} />
      ) : null}

      {/* 名前入力は祝福が終わってから出す。ENTER か SKIP を選ぶまで閉じない。 */}
      {canEnter && celebratingRank == null && predictedRank != null ? (
        <NameEntryModal
          rank={predictedRank}
          name={name}
          onNameChange={setName}
          onSubmit={register}
          onSkip={() => setOutcome('skipped')}
          pending={submit.isPending}
          error={submit.isError ? (submit.error as Error).message : null}
        />
      ) : null}

      <ArcadeScreen className="mt-3 text-left" title="★ HIGH SCORE ★">
        {outcome === 'registered' ? (
          <p className="arcade-glow mb-1.5 text-center text-[11px] font-bold tracking-[0.15em] text-[#ffd24a]">
            {resultRank}位に登録しました！
          </p>
        ) : outcome === 'missed' ? (
          <p className="mb-1.5 text-center text-[11px] tracking-[0.1em] text-[#ff9d4a]">
            入力している間に抜かれてしまいました…
          </p>
        ) : null}
        <RankingBoard entries={entries} unit={unit} highlightRank={resultRank} compact />
      </ArcadeScreen>
    </>
  )
}
