/**
 * 「番号で運用するとこう回る」を見せるための、最初の数セットの組み合わせ例。
 *
 * 本物の試合表づくり(サーバー側)は全セットの出場・同コート履歴を見て組むので、
 * ここで作るのはあくまで**説明用**。ただし TOP に出す以上、本文で約束している
 * 「出場回数の差は1回以内」「また同じ4人にならない」を見た目で裏切ってはいけないため、
 * その2点だけは満たすように組む。
 *
 * - 出場回数: 休む人を毎セット `休憩人数` ぶんずらすので、一周すれば全員が同じ回数になり、
 *   途中で切っても差は1回以内に収まる。
 * - 顔ぶれ: **同じコートに入った相手**の回数を数えておき、次のセットではその合計が
 *   小さくなる人から順にコートへ入れる。この競技では敵味方を区別しない(どちらの側に
 *   いたかは問題にならない)ので、避けるべきは「また同じ4人が同じコート」であって
 *   ペアの重複ではない。
 */

/** 1コートに入る4人。表示の都合で、各チーム内は昇順に並べてある。 */
export type DoublesPracticeExampleCourt = {
  teamA: [number, number]
  teamB: [number, number]
}

export type DoublesPracticeExampleSet = {
  /** 1 始まりのセット番号。 */
  set: number
  courts: DoublesPracticeExampleCourt[]
  /** そのセットで休む番号(昇順)。全員が出るときは空。 */
  resting: number[]
}

export type DoublesPracticeExampleInput = {
  participantCount: number
  courtCount: number
  /** 作るセット数。 */
  setCount: number
}

const ascending = (a: number, b: number) => a - b

/** 同コートに入った回数を数えるための、順序を問わないキー。 */
function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

/**
 * 4人を 2対2 に割る3通り。どう割っても「同じコートに入った」事実は変わらないので、
 * ここでの選択は表示上の見やすさ(同じペアが並び続けないこと)のためだけにある。
 */
type TeamSplit = readonly [readonly [number, number], readonly [number, number]]

const TEAM_SPLITS: readonly TeamSplit[] = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
]

export function createDoublesPracticeExample({
  participantCount,
  courtCount,
  setCount,
}: DoublesPracticeExampleInput): DoublesPracticeExampleSet[] {
  const activePerSet = courtCount * 4
  // 4人そろわないコートは作れない。人数が足りないときは例を出さない。
  if (participantCount < activePerSet || setCount < 1) return []

  const restingPerSet = participantCount - activePerSet
  // 同コートに入った回数と、ペアを組んだ回数。
  const sameCourtCount = new Map<string, number>()
  const partnerCount = new Map<string, number>()
  const countOf = (m: Map<string, number>, a: number, b: number) => m.get(pairKey(a, b)) ?? 0
  const increment = (m: Map<string, number>, a: number, b: number) =>
    m.set(pairKey(a, b), countOf(m, a, b) + 1)

  const sets: DoublesPracticeExampleSet[] = []

  for (let set = 0; set < setCount; set++) {
    // 休む人をセットごとにずらす。これで出場回数が偏らない。
    const offset = restingPerSet > 0 ? (set * restingPerSet) % participantCount : 0
    const waiting: number[] = []
    const resting: number[] = []
    for (let i = 0; i < activePerSet; i++) {
      waiting.push(((offset + i) % participantCount) + 1)
    }
    for (let i = 0; i < restingPerSet; i++) {
      resting.push(((offset + activePerSet + i) % participantCount) + 1)
    }

    const courts: DoublesPracticeExampleCourt[] = []
    for (let court = 0; court < courtCount; court++) {
      // 先頭の1人を軸に、「すでに同じコートで一緒になった回数」が少ない人から3人集める。
      const four = [waiting.shift() as number]
      while (four.length < 4) {
        let pickedAt = 0
        let lowestCost = Number.POSITIVE_INFINITY
        for (let i = 0; i < waiting.length; i++) {
          const cost = four.reduce(
            (total, member) => total + countOf(sameCourtCount, member, waiting[i]),
            0,
          )
          if (cost < lowestCost) {
            lowestCost = cost
            pickedAt = i
          }
        }
        four.push(waiting.splice(pickedAt, 1)[0])
      }

      // 2対2 の割り方は、同じペアが続かないものを選ぶ(見た目のため)。
      let split = TEAM_SPLITS[0]
      let lowestPartnerCost = Number.POSITIVE_INFINITY
      for (const candidate of TEAM_SPLITS) {
        const cost =
          countOf(partnerCount, four[candidate[0][0]], four[candidate[0][1]]) +
          countOf(partnerCount, four[candidate[1][0]], four[candidate[1][1]])
        if (cost < lowestPartnerCost) {
          lowestPartnerCost = cost
          split = candidate
        }
      }

      const teamA: [number, number] = [four[split[0][0]], four[split[0][1]]]
      const teamB: [number, number] = [four[split[1][0]], four[split[1][1]]]
      teamA.sort(ascending)
      teamB.sort(ascending)

      // この4人は全員が「同じコートに入った」ので、6通りすべてを数える。
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) increment(sameCourtCount, four[i], four[j])
      }
      increment(partnerCount, teamA[0], teamA[1])
      increment(partnerCount, teamB[0], teamB[1])

      courts.push({ teamA, teamB })
    }

    sets.push({ set: set + 1, courts, resting: resting.sort(ascending) })
  }

  return sets
}
