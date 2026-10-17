import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { createDoublesPracticePlan } from '../../lib/doubles-practice-plan'
import { createDoublesPracticeExample } from '../../lib/doubles-practice-example'

/** 組み合わせ例として見せるセット数。見出しの「最初の3セット」と揃える。 */
const EXAMPLE_SET_COUNT = 3

function numericInput(value: string, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

/**
 * 乱数表をつくる前に、人数・コート数と時間から当日の回し方を見積もる小さな計算機。
 * 完成した組み合わせを装わず、あくまで主催者が条件を決めるための補助として出す。
 *
 * 入れた人数・コート数は「この条件で乱数表をつくる」のリンクに載せて作成フォームへ渡す
 * (ここで決めた条件をもう一度入力させないため)。
 */
export function DoublesPracticePlanner() {
  const [participantCount, setParticipantCount] = useState('10')
  const [courtCount, setCourtCount] = useState('2')
  const [availableMinutes, setAvailableMinutes] = useState('90')
  const [minutesPerSet, setMinutesPerSet] = useState('6')

  const people = numericInput(participantCount, 10)
  const courts = numericInput(courtCount, 2)

  const plan = createDoublesPracticePlan({
    participantCount: people,
    courtCount: courts,
    availableMinutes: numericInput(availableMinutes, 90),
    minutesPerSet: numericInput(minutesPerSet, 6),
  })
  const hasEnoughPlayers = plan.playersNeeded === 0
  const playCount =
    plan.minimumPlayCount === plan.maximumPlayCount
      ? `${plan.minimumPlayCount}`
      : `${plan.minimumPlayCount}–${plan.maximumPlayCount}`

  const exampleSets = createDoublesPracticeExample({
    participantCount: plan.participantCount,
    courtCount: plan.courtCount,
    setCount: EXAMPLE_SET_COUNT,
  })

  return (
    <section
      aria-labelledby="practice-planner-heading"
      className="rounded-[20px] border border-slate-200 bg-white shadow-sm"
    >
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <h2 id="practice-planner-heading" className="jp-tight text-xl font-semibold text-slate-900">
          人数・コート数から練習会を見積もる
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          乱数表をつくる前に、休憩人数と出場回数の目安を確認できます。
        </p>
      </div>

      <div className="space-y-5 px-5 pb-6 pt-5 sm:px-6">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <CountField
            id="planner-participant-count"
            label="参加人数"
            unit="人"
            value={participantCount}
            onChange={setParticipantCount}
          />
          <CountField
            id="planner-court-count"
            label="コート数"
            unit="面"
            value={courtCount}
            onChange={setCourtCount}
          />
          <CountField
            id="planner-available-minutes"
            label="試合に使える時間"
            unit="分"
            value={availableMinutes}
            onChange={setAvailableMinutes}
          />
          <CountField
            id="planner-minutes-per-set"
            label="1セットの目安"
            unit="分"
            value={minutesPerSet}
            onChange={setMinutesPerSet}
          />
        </div>

        {hasEnoughPlayers ? (
          <div>
            <dl className="grid gap-2.5 sm:grid-cols-3">
              <PlanStat label="1セットの出場・休憩">
                <StatValue value={plan.activePlayersPerSet} />
                <StatUnit>人</StatUnit>
                <span className="fig mx-1 text-lg text-brand-200">/</span>
                <StatValue value={plan.restingPlayersPerSet} />
                <StatUnit>人</StatUnit>
              </PlanStat>
              <PlanStat label="回せるセット数">
                <StatValue value={plan.setCount} />
                <StatUnit>セット前後</StatUnit>
              </PlanStat>
              <PlanStat label="1人あたりの出場回数">
                <StatValue value={playCount} />
                <StatUnit>回</StatUnit>
              </PlanStat>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              {plan.totalPlaySlots}枠を{plan.participantCount}人で分けた計算です。実際の組み合わせは、
              遅刻・早退・固定ペアなどの条件に応じて作成してください。
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm leading-relaxed text-accent-700">
            {plan.courtCount}面のダブルスには、同時に{plan.activePlayersPerSet}人必要です。あと
            {plan.playersNeeded}人集まるか、使うコート数を減らしてください。
          </p>
        )}

        <div className="border-t border-slate-100 pt-5">
          <h3 className="jp-tight text-[15px] font-semibold text-slate-900">
            {plan.participantCount}人・{plan.courtCount}面: 最初の{EXAMPLE_SET_COUNT}
            セットの組み合わせ例
          </h3>
          {exampleSets.length > 0 ? (
            <>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {plan.restingPlayersPerSet > 0
                  ? `各セットで${plan.activePlayersPerSet}人が出場し、休憩の${plan.restingPlayersPerSet}人を入れ替える例です。`
                  : '参加者全員が毎セット出場するため、休憩は出ません。'}
                {EXAMPLE_SET_COUNT}セット内で同じ4人が同じコートに入ることはありません。
              </p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-slate-500">
                        セット
                      </th>
                      {Array.from({ length: plan.courtCount }, (_, index) => (
                        <th
                          key={index}
                          scope="col"
                          className="lbl px-3 py-2.5 text-[10.5px] text-slate-400"
                        >
                          Court {index + 1}
                        </th>
                      ))}
                      {plan.restingPlayersPerSet > 0 ? (
                        <th
                          scope="col"
                          className="px-3 py-2.5 text-xs font-semibold text-slate-500"
                        >
                          休憩
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {exampleSets.map((set) => (
                      <tr key={set.set} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-3 py-2.5">
                          <span className="fig inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent-50 text-xs text-accent-700">
                            {set.set}
                          </span>
                        </td>
                        {set.courts.map((court, index) => (
                          <td key={index} className="whitespace-nowrap px-3 py-2.5">
                            <span className="tab text-[15px] text-slate-800">
                              {court.teamA.join('・')}
                            </span>
                            <span className="mx-2 text-[11px] text-slate-400">vs</span>
                            <span className="tab text-[15px] text-slate-800">
                              {court.teamB.join('・')}
                            </span>
                          </td>
                        ))}
                        {plan.restingPlayersPerSet > 0 ? (
                          <td className="tab whitespace-nowrap px-3 py-2.5 text-sm text-slate-500">
                            {set.resting.join('・')}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                この表は番号で運用するときの説明用の例です。実際には、参加者の条件とこれまでの出場・ペア履歴に応じて結果が変わります。
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              人数がそろうと、ここに組み合わせの例が出ます。
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            to="/organizer/rooms/new"
            search={{ participantCount: people, courtCount: courts }}
            className="lift inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-brand-900 shadow-sm hover:bg-accent-400"
          >
            {plan.participantCount}人・{plan.courtCount}面で乱数表をつくる
            <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
          </Link>
          <Link
            to="/guide/$id"
            params={{ id: 'ten-players-two-courts-doubles-example' }}
            className="border-b-2 border-transparent pb-0.5 text-sm font-semibold text-slate-500 transition hover:border-accent-400 hover:text-slate-900"
          >
            10人・2面の詳しい回し方を見る →
          </Link>
        </div>
      </div>
    </section>
  )
}

/**
 * 数字だけを入れる欄。入力した値そのものを大きく見せたいので、ラベルは上の小さな文字、
 * 単位は欄の中に置く。文字サイズは 16px 以上(iOS がフォーカス時にズームするのを防ぐ)。
 */
function CountField({
  id,
  label,
  unit,
  value,
  onChange,
}: {
  id: string
  label: string
  unit: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-slate-500">
        {label}
      </label>
      <div className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-slate-200 bg-slate-50 px-3 py-2 transition focus-within:border-accent-400 focus-within:bg-accent-50">
        <input
          id={id}
          type="number"
          min="1"
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="fig w-full min-w-0 bg-transparent text-[23px] text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="shrink-0 text-xs font-semibold text-slate-400">{unit}</span>
      </div>
    </div>
  )
}

/** 目安の1枚。濃紺の下地に白い数字を置いて、入力の結果だと分かるようにする。 */
function PlanStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-brand-800 px-4 py-3.5">
      <dt className="lbl mb-2.5 text-[10.5px] text-accent-200">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-0.5 overflow-hidden text-white">
        {children}
      </dd>
    </div>
  )
}

/** 値が変わるたびに key で差し替え、下からせり上がる(サイト共通の animate-tick)。 */
function StatValue({ value }: { value: number | string }) {
  return (
    <span key={value} className="fig animate-tick text-[32px]">
      {value}
    </span>
  )
}

function StatUnit({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold text-brand-100">{children}</span>
}
