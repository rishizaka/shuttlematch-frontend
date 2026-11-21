/**
 * ランクインの祝福シーン(three.js)。順位が上ほど派手になる。
 *
 * 共通の見せ物(プレート・弾ける粒・広がるリング)をここで組み立て、
 * 順位ごとの世界観は「舞台」に分けてある:
 * - 1位: 深宇宙(`rankInCosmicStage`) + リング3重 + 大量の粒 + 何回転もするプレート
 * - 2位: 大海原(`rankInOceanStage`) + リング2重 + そこそこの粒
 * - 3位: 大陸(`rankInContinentStage`) + リング1重 + 控えめな粒
 * (4〜5位はこのシーンを使わず、CSS だけの軽い演出にする)
 *
 * three.js はこのモジュール内で動的 import する(SSR と初期バンドルに載せない)。
 * このモジュール自体も呼び出し側から動的 import される前提なので、
 * 静的 import されるもの(演出の長さなど)は rankInTiers.ts に置くこと。
 * 呼び出し側は dispose() を必ず呼ぶこと。About ページの badmintonScene.ts と同じ流儀。
 */
import { createCosmicStage } from './rankInCosmicStage'
import { createContinentStage } from './rankInContinentStage'
import { createOceanStage } from './rankInOceanStage'
import { RANK_IN_TIERS, type TierConfig } from './rankInTiers'
import type { Stage, StageContext } from './rankInStage'

type Disposer = { dispose: () => void }

/** 円形にぼけた点のテクスチャ。パーティクルと光芒に使う。 */
function makeSpriteCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  return canvas
}

/** 「RANK IN / 1ST」のプレート。ゲーセンの表示に寄せて等幅・字間広めで描く。 */
function makePlateCanvas(tier: TierConfig, hex: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.font = '700 74px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillStyle = '#7de3ff'
  ctx.fillText('R A N K   I N !!', 512, 110)

  ctx.font = '800 300px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.shadowColor = hex
  ctx.shadowBlur = 60
  ctx.fillStyle = hex
  ctx.fillText(tier.label, 512, 300)
  ctx.shadowBlur = 0

  ctx.font = '700 56px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('CONGRATULATIONS', 512, 455)
  return canvas
}

/**
 * 祝福シーンを開始する。順位が {@link hasRankInScene} を満たさない場合は呼ばないこと。
 */
export async function createRankInScene(host: HTMLElement, rank: number): Promise<Disposer> {
  const THREE = await import('three')
  const tier = RANK_IN_TIERS[rank] ?? RANK_IN_TIERS[3]
  const hex = '#' + tier.color.toString(16).padStart(6, '0')

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(host.clientWidth, host.clientHeight)
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  // 遠くまで抜ける舞台(大陸)があるので far は大きめに取る。
  // near を 0.1 のままにすると、その比で深度の精度が落ちる。
  const camera = new THREE.PerspectiveCamera(50, host.clientWidth / host.clientHeight, 0.5, 1500)
  const CAMERA_Z = 7 // 演出中に少しだけ寄る。倍率の計算にはこの初期値を使う
  camera.position.set(0, 0, CAMERA_Z)

  const spriteTexture = new THREE.CanvasTexture(makeSpriteCanvas())

  // 共通の見せ物は霧の外に置く。2位の大海原がシーンに霧をかけるので、
  // 指定しないとプレートや粒まで水平線の色に溶けてしまう。
  // --- プレート(RANK IN / 1ST) ---------------------------------------------
  const plateTexture = new THREE.CanvasTexture(makePlateCanvas(tier, hex))
  plateTexture.colorSpace = THREE.SRGBColorSpace
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 2.0),
    new THREE.MeshBasicMaterial({ map: plateTexture, transparent: true, fog: false }),
  )
  // パーティクルより手前に置く。奥に置くと弾けた粒に順位の数字が埋もれて読めない。
  plate.position.z = 1.4
  scene.add(plate)

  // スマホの縦画面ではプレートの横幅(4.0)が画面に収まらず「1ST」が見切れる。
  // 収まる倍率を出しておき、プレートと舞台の飾りにかける(横長の画面では 1 のまま)。
  let fit = 1
  const updateFit = () => {
    const distance = CAMERA_Z - plate.position.z
    const visibleHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance
    // 0.86 は左右の余白。カメラが漂う分(舞台側の position.x)を吸収できる幅を残す。
    fit = Math.min(1, (visibleHeight * camera.aspect * 0.86) / 4.0)
  }
  updateFit()

  // プレート裏の光芒。金/銀/銅の色で後光を作る。
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: spriteTexture,
      color: tier.color,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  )
  halo.scale.set(9, 9, 1)
  halo.position.z = -1
  scene.add(halo)

  // --- パーティクル(中心から外へ弾ける) -------------------------------------
  const count = tier.particles
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    // 球状に均等な向きへ初速を与える
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const speed = 2.5 + Math.random() * 4.5
    velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
    velocities[i * 3 + 1] = Math.cos(phi) * speed
    velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed * 0.6
  }
  const particleGeometry = new THREE.BufferGeometry()
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      map: spriteTexture,
      color: tier.color,
      size: 0.22,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  )
  scene.add(particles)

  // --- リング(順位が上ほど重ねる) -------------------------------------------
  const rings = Array.from({ length: tier.rings }, (_, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.03, 8, 96),
      new THREE.MeshBasicMaterial({
        color: tier.color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    )
    ring.userData.delay = i * 0.28
    scene.add(ring)
    return ring
  })

  // --- 舞台(順位ごとの世界観) -----------------------------------------------
  const context: StageContext = { three: THREE, scene, camera, sprite: spriteTexture }
  const stage: Stage =
    tier.stage === 'cosmic'
      ? createCosmicStage(context)
      : tier.stage === 'ocean'
        ? createOceanStage(context)
        : createContinentStage(context)
  const plateOffsetY = stage.plateOffsetY ?? 0
  const haloGain = stage.haloOpacity ?? 1

  const onResize = () => {
    if (host.clientWidth === 0 || host.clientHeight === 0) return
    renderer.setSize(host.clientWidth, host.clientHeight)
    camera.aspect = host.clientWidth / host.clientHeight
    camera.updateProjectionMatrix()
    updateFit()
  }
  window.addEventListener('resize', onResize)

  const duration = tier.durationMs / 1000
  const particleLife = Math.min(duration, 2.8)
  const start = performance.now()
  let raf = 0

  const frame = () => {
    raf = requestAnimationFrame(frame)
    const t = (performance.now() - start) / 1000
    const progress = Math.min(t / duration, 1)

    // プレート: 回りながら現れ、最後に正面で静止する(easeOutCubic)
    const ease = 1 - Math.pow(1 - Math.min(t / 0.9, 1), 3)
    plate.rotation.y = (1 - ease) * Math.PI * 2 * tier.spins
    const scale = (0.2 + ease * 0.8) * fit
    plate.scale.set(scale, scale, 1)
    // 静止後はゆっくり揺らす(完全に止めると書き割りに見える)
    plate.position.y = plateOffsetY + Math.sin(t * 1.6) * 0.08 * ease
    halo.position.y = plateOffsetY
    halo.material.opacity = 0.55 * haloGain * ease * (1 - progress * 0.5)
    halo.scale.setScalar((9 + Math.sin(t * 2.2) * 0.6) * fit)

    // パーティクル: 外へ飛びながら落ちる
    const position = particleGeometry.getAttribute('position') as {
      array: Float32Array
      needsUpdate: boolean
    }
    for (let i = 0; i < count; i++) {
      velocities[i * 3 + 1] -= 3.2 * 0.016 // 重力
      position.array[i * 3] += velocities[i * 3] * 0.016
      position.array[i * 3 + 1] += velocities[i * 3 + 1] * 0.016
      position.array[i * 3 + 2] += velocities[i * 3 + 2] * 0.016
    }
    position.needsUpdate = true
    // 弾けた粒は演出の長さに関わらず 2.8 秒で消す。上位ほど演出が長いので、
    // 進捗に比例させると最後まで粒が残って舞台が見えなくなる。
    ;(particles.material as { opacity: number }).opacity = 1 - Math.min(t / particleLife, 1)

    // リング: 時間差で広がりながら消える
    rings.forEach((ring) => {
      const rt = Math.max(0, t - (ring.userData.delay as number))
      const r = rt * 5.5
      ring.scale.setScalar(0.2 + r)
      ring.rotation.x = Math.PI / 2.6
      ring.rotation.z = t * 0.6
      ;(ring.material as { opacity: number }).opacity = Math.max(0, 0.9 - rt * 0.8)
    })

    // カメラをわずかに寄せる。この先の漂い(位置・傾き)は舞台に任せる。
    camera.position.z = CAMERA_Z - ease * 0.8
    stage.update(t, ease, fit)
    renderer.render(scene, camera)
  }
  frame()

  return {
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      scene.traverse((obj) => {
        const anyObj = obj as { geometry?: { dispose: () => void }; material?: unknown }
        anyObj.geometry?.dispose()
        const m = anyObj.material
        if (Array.isArray(m)) m.forEach((x) => (x as { dispose: () => void }).dispose())
        else if (m) (m as { dispose: () => void }).dispose()
      })
      // map に貼ったテクスチャは material.dispose() では解放されない。
      ;[spriteTexture, plateTexture, ...stage.textures].forEach((texture) =>
        texture.dispose(),
      )
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
