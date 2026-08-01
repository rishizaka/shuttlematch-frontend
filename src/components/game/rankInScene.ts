/**
 * ランクインの祝福シーン(three.js)。順位が上ほど派手になる。
 *
 * - 1位: 星空 + リング3重 + 大量のパーティクル + 何回転もするプレート(いちばん派手)
 * - 2位: リング2重 + そこそこのパーティクル
 * - 3位: リング1重 + 控えめなパーティクル
 * (4〜5位はこのシーンを使わず、CSS だけの軽い演出にする)
 *
 * three.js はこのモジュール内で動的 import する(SSR と初期バンドルに載せない)。
 * このモジュール自体も呼び出し側から動的 import される前提なので、
 * 静的 import されるもの(演出の長さなど)は rankInTiers.ts に置くこと。
 * 呼び出し側は dispose() を必ず呼ぶこと。About ページの badmintonScene.ts と同じ流儀。
 */
import { RANK_IN_TIERS, type TierConfig } from './rankInTiers'

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
  const camera = new THREE.PerspectiveCamera(
    50,
    host.clientWidth / host.clientHeight,
    0.1,
    200,
  )
  camera.position.set(0, 0, 7)

  const spriteTexture = new THREE.CanvasTexture(makeSpriteCanvas())

  // --- プレート(RANK IN / 1ST) ---------------------------------------------
  const plateTexture = new THREE.CanvasTexture(makePlateCanvas(tier, hex))
  plateTexture.colorSpace = THREE.SRGBColorSpace
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 2.0),
    new THREE.MeshBasicMaterial({ map: plateTexture, transparent: true }),
  )
  // パーティクルより手前に置く。奥に置くと弾けた粒に順位の数字が埋もれて読めない。
  plate.position.z = 1.4
  scene.add(plate)

  // プレート裏の光芒。金/銀/銅の色で後光を作る。
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: spriteTexture,
      color: tier.color,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
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
      }),
    )
    ring.userData.delay = i * 0.28
    scene.add(ring)
    return ring
  })

  // --- 星空(1位だけ) --------------------------------------------------------
  let starfield: InstanceType<typeof THREE.Points> | null = null
  if (tier.starfield) {
    const stars = 600
    const starPositions = new Float32Array(stars * 3)
    for (let i = 0; i < stars; i++) {
      const r = 20 + Math.random() * 40
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      starPositions[i * 3 + 1] = r * Math.cos(phi)
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    starfield = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        map: spriteTexture,
        color: 0xffffff,
        size: 0.9,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    scene.add(starfield)
  }

  const onResize = () => {
    if (host.clientWidth === 0 || host.clientHeight === 0) return
    renderer.setSize(host.clientWidth, host.clientHeight)
    camera.aspect = host.clientWidth / host.clientHeight
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', onResize)

  const duration = tier.durationMs / 1000
  const start = performance.now()
  let raf = 0

  const frame = () => {
    raf = requestAnimationFrame(frame)
    const t = (performance.now() - start) / 1000
    const progress = Math.min(t / duration, 1)

    // プレート: 回りながら現れ、最後に正面で静止する(easeOutCubic)
    const ease = 1 - Math.pow(1 - Math.min(t / 0.9, 1), 3)
    plate.rotation.y = (1 - ease) * Math.PI * 2 * tier.spins
    const scale = 0.2 + ease * 0.8
    plate.scale.set(scale, scale, 1)
    // 静止後はゆっくり揺らす(完全に止めると書き割りに見える)
    plate.position.y = Math.sin(t * 1.6) * 0.08 * ease
    halo.material.opacity = 0.55 * ease * (1 - progress * 0.5)
    halo.scale.setScalar(9 + Math.sin(t * 2.2) * 0.6)

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
    ;(particles.material as { opacity: number }).opacity = 1 - progress

    // リング: 時間差で広がりながら消える
    rings.forEach((ring) => {
      const rt = Math.max(0, t - (ring.userData.delay as number))
      const r = rt * 5.5
      ring.scale.setScalar(0.2 + r)
      ring.rotation.x = Math.PI / 2.6
      ring.rotation.z = t * 0.6
      ;(ring.material as { opacity: number }).opacity = Math.max(0, 0.9 - rt * 0.8)
    })

    if (starfield) starfield.rotation.y = t * 0.05

    // カメラをわずかに寄せる
    camera.position.z = 7 - ease * 0.8
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
      spriteTexture.dispose()
      plateTexture.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
