/**
 * ランクインの祝福シーンの「舞台」。順位ごとの世界観をここで差し替える。
 *
 * - 1位: 深宇宙(`rankInCosmicStage`)
 * - 2位: 大海原(`rankInOceanStage`)
 * - 3位: 舞台なし(共通の見せ物だけ)
 *
 * 共通の見せ物(プレート・弾ける粒・広がるリング)は `rankInScene.ts` が持つ。
 * three.js はシーン側が動的 import した実体を {@link StageContext.three} で受け取る
 * (舞台モジュールが静的 import すると、初期バンドルに three.js が載ってしまう)。
 */
import type * as THREE from 'three'

export type ThreeModule = typeof THREE

export interface StageContext {
  three: ThreeModule
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** 丸くぼけた点のテクスチャ。粒や光芒に使い回す。 */
  sprite: THREE.Texture
}

export interface Stage {
  /**
   * プレートを上下にずらす量。舞台の地平線や水平線とぶつからない位置に逃がす。
   * 省略したら 0(画面の中央)。
   */
  plateOffsetY?: number
  /**
   * プレート裏の光芒の強さ(1 が既定)。明るい舞台では下げないと、
   * 加算合成の後光が背景と足し合わさって文字まで白く飛ぶ。
   */
  haloOpacity?: number
  /**
   * 舞台が作ったテクスチャ。`material.dispose()` では解放されないので、
   * シーン側がまとめて捨てられるように渡しておく。
   */
  textures: THREE.Texture[]
  /**
   * 毎フレーム呼ばれる。
   *
   * @param t 演出が始まってからの秒数
   * @param ease プレートの登場が終わった度合い(0→1)
   * @param fit プレートを画面幅に収めるための倍率(縦長の画面だと 1 未満)
   */
  update(t: number, ease: number, fit: number): void
}
