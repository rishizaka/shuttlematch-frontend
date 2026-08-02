/**
 * 地面(海面・大地)を張るための格子。
 *
 * ふつうの格子(`PlaneGeometry`)を寝かせると、手前は目が粗すぎて凹凸が平らに見えるのに
 * 遠くは目が細かすぎて無駄になる。カメラからの距離を等比で伸ばした台形の格子を組み、
 * 画面に映る三角形の大きさをどこでも同じくらいにする。
 *
 * 高さ(y)は入れずに返すので、舞台ごとの式で書き込むこと。
 */
import type { ThreeModule } from './rankInStage'

export interface GroundGrid {
  /** そのまま Mesh に渡すジオメトリ。 */
  geometry: ReturnType<ThreeModule['BufferGeometry']['prototype']['clone']>
  /** 頂点の世界座標。高さの式に渡す。 */
  x: Float32Array
  z: Float32Array
  /**
   * 細かい凹凸をどれだけ効かせるか(遠いほど 0 に近い)。
   * 遠くの細かい凹凸は格子の目より細かくなってちらつくだけなので、消してしまう。
   */
  damp: Float32Array
  /** 高さの書き込み先。書いたら needsUpdate を立てる。 */
  position: { array: Float32Array; needsUpdate: boolean }
}

export function createGroundGrid(
  THREE: ThreeModule,
  {
    rows,
    cols,
    near,
    far,
    cameraZ,
    dampScale,
    margin = 8,
  }: {
    rows: number
    cols: number
    /** いちばん手前の行までの距離。画面の下端に地面が映り始める距離より近くに取る。 */
    near: number
    /** いちばん奥の行までの距離。霧で完全に消える距離より遠くに取る。 */
    far: number
    cameraZ: number
    /** 細かい凹凸が消えるまでの距離の目安。 */
    dampScale: number
    /** 手前の行の幅の余裕。 */
    margin?: number
  },
): GroundGrid {
  const positions = new Float32Array(rows * cols * 3)
  const x = new Float32Array(rows * cols)
  const z = new Float32Array(rows * cols)
  const damp = new Float32Array(rows * cols)
  const indices: number[] = []
  const ratio = Math.pow(far / near, 1 / (rows - 1))

  for (let r = 0; r < rows; r++) {
    const distance = near * Math.pow(ratio, r)
    const halfWidth = margin + distance * 0.95 // 画面の外まで届く幅
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      const vx = -halfWidth + (2 * halfWidth * c) / (cols - 1)
      positions[i * 3] = vx
      positions[i * 3 + 2] = cameraZ - distance
      x[i] = vx
      z[i] = cameraZ - distance
      damp[i] = Math.exp(-distance / dampScale)
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c
      indices.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return {
    geometry,
    x,
    z,
    damp,
    position: geometry.getAttribute('position') as unknown as {
      array: Float32Array
      needsUpdate: boolean
    },
  }
}
