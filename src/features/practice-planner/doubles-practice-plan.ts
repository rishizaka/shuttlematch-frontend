/**
 * ダブルス練習会を始める前の、人数・コート数・時間の目安。
 *
 * 試合の組み合わせそのものは作らない。主催者が「何人が休むか」「何セット程度
 * 回せそうか」を作成前に判断するための、説明可能な単純計算に限定する。
 */
export type DoublesPracticePlanInput = {
  participantCount: number
  courtCount: number
  availableMinutes: number
  minutesPerSet: number
}

export type DoublesPracticePlan = {
  participantCount: number
  courtCount: number
  activePlayersPerSet: number
  restingPlayersPerSet: number
  playersNeeded: number
  setCount: number
  totalPlaySlots: number
  minimumPlayCount: number
  maximumPlayCount: number
}

function positiveInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1
}

export function createDoublesPracticePlan(input: DoublesPracticePlanInput): DoublesPracticePlan {
  const participantCount = positiveInteger(input.participantCount)
  const courtCount = positiveInteger(input.courtCount)
  const availableMinutes = positiveInteger(input.availableMinutes)
  const minutesPerSet = positiveInteger(input.minutesPerSet)
  const activePlayersPerSet = courtCount * 4
  const setCount = Math.floor(availableMinutes / minutesPerSet)
  const totalPlaySlots = setCount * activePlayersPerSet
  const playersNeeded = Math.max(0, activePlayersPerSet - participantCount)
  const restingPlayersPerSet = Math.max(0, participantCount - activePlayersPerSet)

  return {
    participantCount,
    courtCount,
    activePlayersPerSet,
    restingPlayersPerSet,
    playersNeeded,
    setCount,
    totalPlaySlots,
    minimumPlayCount: Math.floor(totalPlaySlots / participantCount),
    maximumPlayCount: Math.ceil(totalPlaySlots / participantCount),
  }
}
