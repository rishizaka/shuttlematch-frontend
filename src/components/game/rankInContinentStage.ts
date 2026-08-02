/**
 * 3位の舞台「大陸」。
 *
 * 高いところから見下ろす、赤茶けた大地。地平線まで起伏が続き、
 * 卓状の台地(メサ)が点々と立ち、砂塵が風に流れる。
 * 銅色のプレートに合わせて、大地も空も暖色寄りにしてある。
 *
 * 海と違って大地は動かないので、頂点の高さは最初に一度だけ入れる。
 * 動くのは砂塵と雲、それにカメラのわずかな漂いだけ。
 */
import { createGroundGrid } from './rankInGroundGrid'
import type { Stage, StageContext } from './rankInStage'

/** 地平線の色。霧・空の下端・大地の遠くをこの色で揃える。 */
const HORIZON_COLOR = 0xd9c3a0
/** 大地の高さ。カメラは 0 付近にいるので、この高さから見下ろすことになる。 */
const GROUND_Y = -14
/** 霧が完全にかかる距離。大地はこれより遠くまで張って、端を隠す。 */
const FOG_FAR = 520
/** カメラの位置(シーン側と合わせる)。格子をここから切るために要る。 */
const CAMERA_Z = 7

/** 起伏の高さ。うねる丘に、手前だけ細かい凹凸を足す。 */
function terrainAt(x: number, z: number, damp: number): number {
  const hills =
    Math.sin(x * 0.06 + 0.6) * 2.6 +
    Math.sin(z * 0.045 - 1.2) * 2.2 +
    Math.sin((x + z) * 0.025 + 2.4) * 3.4
  const rough =
    Math.sin(x * 0.35 - 0.4) * 0.8 +
    Math.sin(z * 0.42 + 1.1) * 0.6 +
    Math.sin(x * 1.05 + 2.2) * 0.3 +
    Math.sin(z * 1.25 - 0.7) * 0.25
  return hills + rough * damp
}

/**
 * 空。内側から見る球に貼る。上端が天頂、上下の真ん中が地平線
 * (下半分は大地に隠れるので地平線の色で塗り潰しておく)。
 *
 * 白っぽいのは地平線のすぐ上だけ。広げるとプレートの後ろまで明るくなって、
 * 銅色の「3RD」が背景に負ける。
 */
function makeSkyCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const sky = ctx.createLinearGradient(0, 0, 0, 512)
  sky.addColorStop(0, '#0a2352') // 天頂
  sky.addColorStop(0.34, '#2a63ab')
  sky.addColorStop(0.45, '#5f9ed0')
  sky.addColorStop(0.487, '#a8c4d4')
  sky.addColorStop(0.5, '#d9c3a0') // 地平線(砂塵で黄ばむ)
  sky.addColorStop(1, '#d9c3a0')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 512, 512)

  // 積雲。大地の広さは、空に浮かぶ雲の並びからも出る。
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 512
    const y = 150 + Math.random() * 90
    const width = 24 + Math.random() * 70
    const cloud = ctx.createRadialGradient(x, y, 0, x, y, width)
    cloud.addColorStop(0, `rgba(255, 250, 240, ${0.12 + Math.random() * 0.2})`)
    cloud.addColorStop(1, 'rgba(255, 250, 240, 0)')
    ctx.fillStyle = cloud
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1, 0.32)
    ctx.translate(-x, -y)
    ctx.fillRect(x - width, y - width, width * 2, width * 2)
    ctx.restore()
  }
  ctx.globalCompositeOperation = 'source-over'
  return canvas
}

export function createContinentStage({
  three: THREE,
  scene,
  camera,
  sprite,
}: StageContext): Stage {
  const textures: InstanceType<typeof THREE.Texture>[] = []
  scene.fog = new THREE.Fog(HORIZON_COLOR, 180, FOG_FAR)

  // --- 空 -------------------------------------------------------------------
  const skyTexture = new THREE.CanvasTexture(makeSkyCanvas())
  skyTexture.colorSpace = THREE.SRGBColorSpace
  textures.push(skyTexture)
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(700, 32, 24),
      // 霧をかけると空まで一色になるので、空だけは霧の外に置く。
      new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false }),
    ),
  )

  // --- 大地 -----------------------------------------------------------------
  // 見下ろしているので、手前 20 くらいまでは画面に映らない。そこから始める。
  const grid = createGroundGrid(THREE, {
    rows: 80,
    cols: 80,
    near: 20,
    far: 560,
    cameraZ: CAMERA_Z,
    dampScale: 90,
    margin: 20,
  })
  // 高いところほど明るい岩肌にする。一色で塗ると、起伏があっても
  // のっぺりした一枚の布に見えてしまう。
  const groundColors = new Float32Array(grid.x.length * 3)
  const LOW = [0.3, 0.15, 0.09]
  const HIGH = [0.54, 0.31, 0.18]
  for (let i = 0; i < grid.x.length; i++) {
    const height = terrainAt(grid.x[i], grid.z[i], grid.damp[i])
    grid.position.array[i * 3 + 1] = height
    const mix = Math.min(1, Math.max(0, (height + 7) / 14)) * (0.85 + Math.random() * 0.3)
    for (let c = 0; c < 3; c++) {
      groundColors[i * 3 + c] = LOW[c] + (HIGH[c] - LOW[c]) * mix
    }
  }
  grid.position.needsUpdate = true
  grid.geometry.setAttribute('color', new THREE.BufferAttribute(groundColors, 3))
  const ground = new THREE.Mesh(
    grid.geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      flatShading: true, // 面ごとに明るさが変わって、低ポリの岩肌になる
      side: THREE.DoubleSide,
    }),
  )
  ground.position.y = GROUND_Y
  scene.add(ground)

  // --- メサ(卓状の台地) -----------------------------------------------------
  // 大陸らしさはほぼこれで決まる。地平線に向かって小さくなるように並べる。
  const mesaMaterials = [0xb96a3c, 0xa85c30, 0xc47a48].map(
    (color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true }),
  )
  const MESAS = 16
  for (let i = 0; i < MESAS; i++) {
    // 距離と方位は帯に分けて散らす。任意の乱数だけで置くと、たまたま手前の
    // ど真ん中に大きいのが立って視界を塞ぐ回があるため。
    const distance = 150 + ((i + 0.5) / MESAS) * 260 + (Math.random() - 0.5) * 40
    const angle = -0.9 + 1.8 * ((i * 0.618) % 1) + (Math.random() - 0.5) * 0.1
    const radius = 9 + Math.random() * 12
    const height = 16 + Math.random() * 18
    const mesa = new THREE.Mesh(
      // 上を少しすぼめると、崖が切り立った卓状台地に見える。角は 6〜7 で充分。
      new THREE.CylinderGeometry(radius * 0.82, radius, height, 6 + (i % 2), 1),
      mesaMaterials[i % mesaMaterials.length],
    )
    const x = Math.sin(angle) * distance
    const z = CAMERA_Z - Math.cos(angle) * distance
    mesa.position.set(
      x,
      // 裾を起伏に埋める。浮いて見えるより、少し沈んでいる方が自然。
      GROUND_Y + terrainAt(x, z, 0) + height / 2 - 3,
      z,
    )
    mesa.rotation.y = Math.random() * Math.PI
    scene.add(mesa)
  }

  // --- 砂塵 -----------------------------------------------------------------
  // 大地は動かないので、風だけが動く。これが無いと止め絵に見える。
  const DUST = 700
  const dustPositions = new Float32Array(DUST * 3)
  const dustSpeeds = new Float32Array(DUST)
  const dustSpan = new Float32Array(DUST)
  for (let i = 0; i < DUST; i++) {
    const distance = 30 + Math.pow(Math.random(), 0.7) * 260
    dustSpan[i] = 40 + distance * 0.9
    dustPositions[i * 3] = (Math.random() - 0.5) * 2 * dustSpan[i]
    dustPositions[i * 3 + 1] = GROUND_Y + 2 + Math.random() * 16
    dustPositions[i * 3 + 2] = CAMERA_Z - distance
    dustSpeeds[i] = 3 + Math.random() * 7
  }
  const dustGeometry = new THREE.BufferGeometry()
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      map: sprite,
      color: 0xe6cfa8,
      size: 0.3,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  scene.add(dust)

  // --- 光 -------------------------------------------------------------------
  // 高い太陽。カメラの後ろ上から当てる。奥から当てるとメサがただの黒い塊になる。
  // 高くしすぎると崖が影になって黒い塊に見えるので、斜め上くらいに置く。
  const sunLight = new THREE.DirectionalLight(0xffe9c4, 2.2)
  sunLight.position.set(-60, 45, 55)
  scene.add(sunLight)
  // 空の青を影側に落とす。これが無いと陰が真っ黒になって岩が潰れる。
  scene.add(new THREE.HemisphereLight(0x8fb8dd, 0x3a1d10, 0.9))

  return {
    // 地平線は画面の真ん中に出る。プレートを空まで持ち上げて、下半分は大地だけにする。
    plateOffsetY: 1.35,
    // 空が明るいので、後光を弱めないと文字が飛ぶ。
    haloOpacity: 0.35,
    textures,
    update(t) {
      const dustPosition = dust.geometry.getAttribute('position') as {
        array: Float32Array
        needsUpdate: boolean
      }
      for (let i = 0; i < DUST; i++) {
        let x = dustPosition.array[i * 3] + dustSpeeds[i] * 0.016
        // 風下へ抜けた砂は、また風上から流し直す
        if (x > dustSpan[i]) x = -dustSpan[i]
        dustPosition.array[i * 3] = x
        dustPosition.array[i * 3 + 1] += Math.sin(t * 1.3 + i) * 0.01
      }
      dustPosition.needsUpdate = true

      // 見晴らしのいい場所に立っているように、ごくゆっくり漂わせる。
      camera.position.y = Math.sin(t * 0.5) * 0.1
      camera.position.x = Math.sin(t * 0.3) * 0.14
      camera.rotation.z = Math.sin(t * 0.4) * 0.015
    },
  }
}
