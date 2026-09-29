import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardBody, CardHeader } from '../ui/Card'
import { Field, Input } from '../ui/Field'
import { createDoublesPracticePlan } from '../../lib/doubles-practice-plan'

const EXAMPLE_SETS = [
  {
    set: 1,
    court1: '1・2 vs 3・4',
    court2: '5・6 vs 7・8',
    resting: '9・10',
  },
  {
    set: 2,
    court1: '1・5 vs 7・9',
    court2: '2・6 vs 8・10',
    resting: '3・4',
  },
  {
    set: 3,
    court1: '1・7 vs 3・9',
    court2: '2・8 vs 4・10',
    resting: '5・6',
  },
]

function numericInput(value: string, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

/**
 * 試合表を作る前に、人数・コート数と時間から当日の回し方を見積もる小さな計算機。
 * 完成した組み合わせを装わず、あくまで主催者が条件を決めるための補助として出す。
 */
export function DoublesPracticePlanner() {
  const [participantCount, setParticipantCount] = useState('10')
  const [courtCount, setCourtCount] = useState('2')
  const [availableMinutes, setAvailableMinutes] = useState('90')
  const [minutesPerSet, setMinutesPerSet] = useState('6')

  const plan = createDoublesPracticePlan({
    participantCount: numericInput(participantCount, 10),
    courtCount: numericInput(courtCount, 2),
    availableMinutes: numericInput(availableMinutes, 90),
    minutesPerSet: numericInput(minutesPerSet, 6),
  })
  const hasEnoughPlayers = plan.playersNeeded === 0
  const playCount =
    plan.minimumPlayCount === plan.maximumPlayCount
      ? `${plan.minimumPlayCount}回`
      : `${plan.minimumPlayCount}〜${plan.maximumPlayCount}回`

  return (
    <section aria-labelledby="practice-planner-heading">
      <Card className="overflow-hidden border-brand-200">
        <CardHeader
          title={<span id="practice-planner-heading">人数・コート数から練習会を見積もる</span>}
          description="乱数表をつくる前に、休憩人数と出場回数の目安を確認できます。"
        />
        <CardBody className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="参加人数" htmlFor="planner-participant-count">
              <Input
                id="planner-participant-count"
                type="number"
                min="1"
                inputMode="numeric"
                value={participantCount}
                onChange={(event) => setParticipantCount(event.target.value)}
              />
            </Field>
            <Field label="コート数" htmlFor="planner-court-count">
              <Input
                id="planner-court-count"
                type="number"
                min="1"
                inputMode="numeric"
                value={courtCount}
                onChange={(event) => setCourtCount(event.target.value)}
              />
            </Field>
            <Field label="試合に使える時間（分）" htmlFor="planner-available-minutes">
              <Input
                id="planner-available-minutes"
                type="number"
                min="1"
                inputMode="numeric"
                value={availableMinutes}
                onChange={(event) => setAvailableMinutes(event.target.value)}
              />
            </Field>
            <Field label="1セットの目安（分）" htmlFor="planner-minutes-per-set">
              <Input
                id="planner-minutes-per-set"
                type="number"
                min="1"
                inputMode="numeric"
                value={minutesPerSet}
                onChange={(event) => setMinutesPerSet(event.target.value)}
              />
            </Field>
          </div>

          {hasEnoughPlayers ? (
            <div className="rounded-xl bg-brand-50 p-4">
              <h3 className="text-sm font-semibold text-brand-900">この条件での目安</h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <PlanStat label="1セットの出場・休憩" value={`${plan.activePlayersPerSet}人・${plan.restingPlayersPerSet}人`} />
                <PlanStat label="回せるセット数" value={`${plan.setCount}セット前後`} />
                <PlanStat label="1人あたりの出場回数" value={playCount} />
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-brand-800">
                {plan.totalPlaySlots}枠を{plan.participantCount}人で分けた計算です。実際の組み合わせは、
                遅刻・早退・固定ペアなどの条件に応じて作成してください。
              </p>
            </div>
          ) : (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
              {plan.courtCount}面のダブルスには、同時に{plan.activePlayersPerSet}人必要です。あと
              {plan.playersNeeded}人集まるか、使うコート数を減らしてください。
            </p>
          )}

          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold text-slate-900">10人・2面: 最初の3セットの組み合わせ例</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              各セットで8人が出場し、休憩の2人を入れ替える例です。3セット内で同じ2人が続けてパートナーになることはありません。
            </p>
            <ol className="mt-3 grid gap-3 lg:grid-cols-3">
              {EXAMPLE_SETS.map((example) => (
                <li key={example.set} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-slate-900">第{example.set}セット</p>
                  <dl className="mt-2 space-y-1.5 text-slate-600">
                    <div className="flex justify-between gap-3">
                      <dt>1コート</dt>
                      <dd className="font-medium text-slate-800">{example.court1}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>2コート</dt>
                      <dd className="font-medium text-slate-800">{example.court2}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-slate-100 pt-1.5">
                      <dt>休憩</dt>
                      <dd className="font-medium text-slate-800">{example.resting}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              この表は番号で運用するときの説明用の例です。実際には、参加者の条件とこれまでの出場・ペア履歴に応じて結果が変わります。
            </p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link
              to="/organizer/rooms/new"
              className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
            >
              この条件で乱数表をつくる →
            </Link>
            <Link
              to="/guide/$id"
              params={{ id: 'ten-players-two-courts-doubles-example' }}
              className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              10人・2面の詳しい回し方を見る →
            </Link>
          </div>
        </CardBody>
      </Card>
    </section>
  )
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-base font-bold text-slate-900">{value}</dd>
    </div>
  )
}
