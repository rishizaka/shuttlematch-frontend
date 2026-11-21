/**
 * 1位の舞台「深宇宙」。
 *
 * 「一回りして夜明け」の先にある宇宙のイメージ。ワープアウトして深宇宙に出た、
 * という筋書きで作る:
 *   星が奥から手前へ流れ(だんだん減速する) → 星雲の中に惑星が昇ってくる →
 *   プレートのまわりを環が周回し、ときどき彗星が横切る。
 */
import type { Stage, StageContext } from './rankInStage'

/** 星をリセットする奥行き。 */
const WARP_DEPTH = 90

/**
 * 深宇宙の背景。内側から見る球に貼るので、経緯度に引き伸ばされる前提で横長に描く。
 * 真っ黒だと「宇宙」ではなく「暗いだけ」に見えるので、星雲の色を置く。
 */
function makeDeepSpaceCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#03040d'
  ctx.fillRect(0, 0, 1024, 512)

  // 星雲。加算で重ねて、色同士が混ざったところだけ明るくする。
  // 濃く塗ると画面全体が紫にかすんで「宇宙の暗さ」が消える。淡く、黒を残す。
  ctx.globalCompositeOperation = 'lighter'
  const clouds: Array<[number, number, number, string]> = [
    [180, 170, 260, 'rgba(86, 38, 156, 0.34)'],
    [420, 330, 300, 'rgba(24, 54, 140, 0.3)'],
    [700, 150, 240, 'rgba(158, 44, 122, 0.24)'],
    [900, 380, 280, 'rgba(20, 86, 148, 0.24)'],
  ]
  for (const [x, y, radius, color] of clouds) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }

  // 遠くの星。テクスチャ側にも散らしておくと、奥行きが二層になって密度が出る。
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * 1024
    const y = Math.random() * 512
    const alpha = 0.25 + Math.random() * 0.6
    ctx.fillStyle = `rgba(255,255,255,${alpha})`
    ctx.fillRect(x, y, Math.random() < 0.08 ? 2 : 1, 1)
  }
  ctx.globalCompositeOperation = 'source-over'
  return canvas
}

/** 惑星の表面。ガス惑星の縞模様。光の当たり方はライトに任せる。 */
function makePlanetCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const base = ctx.createLinearGradient(0, 0, 0, 512)
  base.addColorStop(0, '#1b2352')
  base.addColorStop(0.5, '#3a4fa8')
  base.addColorStop(1, '#161c40')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 1024, 512)

  // 緯度方向の縞。太さと明るさを揺らして、単調な横縞に見えないようにする。
  for (let y = 0; y < 512; ) {
    const height = 6 + Math.random() * 26
    const tone = Math.random()
    ctx.fillStyle =
      tone > 0.72
        ? `rgba(180, 206, 255, ${0.1 + Math.random() * 0.16})`
        : `rgba(12, 18, 48, ${0.1 + Math.random() * 0.2})`
    ctx.fillRect(0, y, 1024, height)
    y += height
  }

  // 大赤斑のような渦をひとつ置くと、回転しているのが分かりやすい。
  const spot = ctx.createRadialGradient(700, 300, 4, 700, 300, 78)
  spot.addColorStop(0, 'rgba(255, 186, 140, 0.85)')
  spot.addColorStop(1, 'rgba(255, 150, 110, 0)')
  ctx.fillStyle = spot
  ctx.save()
  ctx.translate(700, 300)
  ctx.scale(1.6, 1)
  ctx.translate(-700, -300)
  ctx.fillRect(600, 220, 200, 160)
  ctx.restore()
  return canvas
}

export function createCosmicStage({ three: THREE, scene, camera, sprite }: StageContext): Stage {
  const textures: InstanceType<typeof THREE.Texture>[] = []

  // 背景の球。内側から見るので BackSide。これがあるだけで「暗い画面」が「宇宙」になる。
  const spaceTexture = new THREE.CanvasTexture(makeDeepSpaceCanvas())
  spaceTexture.colorSpace = THREE.SRGBColorSpace
  textures.push(spaceTexture)
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(140, 32, 24),
      new THREE.MeshBasicMaterial({ map: spaceTexture, side: THREE.BackSide }),
    ),
  )

  // 手前に浮かぶ星。背景テクスチャの星とは別に、瞬く層を2枚重ねる。
  const starfield = [0.42, 0.24].map((size, layer) => {
    const COUNT = 320
    const points = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      // 球殻状に散らす
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 40 + Math.random() * 55
      points[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
      points[i * 3 + 1] = Math.cos(phi) * radius
      points[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(points, 3))
    const layerPoints = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: sprite,
        color: layer === 0 ? 0xffffff : 0xa9c8ff,
        size: size * 3.2,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    scene.add(layerPoints)
    return layerPoints
  })

  // 流れる星。点ではなく線分にして、伸びた光跡(ワープ)に見せる。
  // 頂点色を頭=明るい/尾=暗いにすると、止まっていても進行方向が読める。
  const STARS = 700
  const STAR_TINTS = [
    [0.85, 0.92, 1],
    [1, 1, 1],
    [0.68, 0.78, 1],
    [1, 0.88, 0.7],
  ]
  const warpPositions = new Float32Array(STARS * 2 * 3)
  const warpColors = new Float32Array(STARS * 2 * 3)
  const warpSpeeds = new Float32Array(STARS)
  for (let i = 0; i < STARS; i++) {
    // 画面中央付近は空けて、周辺から流れてくるようにする
    const radius = 3 + Math.random() * 26
    const angle = Math.random() * Math.PI * 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    const z = -Math.random() * WARP_DEPTH
    warpSpeeds[i] = 16 + Math.random() * 34
    const tail = warpSpeeds[i] * 0.06
    warpPositions[i * 6] = x
    warpPositions[i * 6 + 1] = y
    warpPositions[i * 6 + 2] = z
    warpPositions[i * 6 + 3] = x
    warpPositions[i * 6 + 4] = y
    warpPositions[i * 6 + 5] = z - tail
    const tint = STAR_TINTS[(Math.random() * STAR_TINTS.length) | 0]
    for (let c = 0; c < 3; c++) {
      warpColors[i * 6 + c] = tint[c]
      warpColors[i * 6 + 3 + c] = tint[c] * 0.1
    }
  }
  const warpGeometry = new THREE.BufferGeometry()
  warpGeometry.setAttribute('position', new THREE.BufferAttribute(warpPositions, 3))
  warpGeometry.setAttribute('color', new THREE.BufferAttribute(warpColors, 3))
  const warp = new THREE.LineSegments(
    warpGeometry,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  scene.add(warp)

  // 星雲。大きなスプライトを薄く重ねて、色の濃淡だけで奥行きを出す。
  const nebula = new THREE.Group()
  const NEBULA_COLORS = [0x5b2ea6, 0x1e3a8a, 0xb03a8a, 0x2563eb]
  NEBULA_COLORS.forEach((color, i) => {
    const cloud = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sprite,
        color,
        transparent: true,
        opacity: 0.09,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    const angle = (i / NEBULA_COLORS.length) * Math.PI * 2
    cloud.position.set(Math.cos(angle) * 12, Math.sin(angle) * 7, -26 - i * 5)
    cloud.scale.setScalar(34 + i * 8)
    nebula.add(cloud)
  })
  scene.add(nebula)

  // 惑星。左下から昇ってくるように置く(プレートに重ならない位置)。
  // 陰影はライトに任せる。自転しても明暗の境目が動かないので、球に見える。
  const planetTexture = new THREE.CanvasTexture(makePlanetCanvas())
  planetTexture.colorSpace = THREE.SRGBColorSpace
  textures.push(planetTexture)
  const planet = new THREE.Group()
  planet.position.set(-4.8, -6.4, -14)
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 48, 32),
    new THREE.MeshStandardMaterial({ map: planetTexture, roughness: 1, metalness: 0 }),
  )
  globe.rotation.z = 0.3 // 自転軸を少し傾ける
  planet.add(globe)

  // 大気の光。輪郭をぼかして、切り抜いた円板に見えないようにする。
  const atmosphere = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sprite,
      color: 0x6aa6ff,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  atmosphere.scale.setScalar(13)
  planet.add(atmosphere)

  // 惑星の環。粒で作ると、真横から見たときに薄い線になって自然。
  // 粒は小さく数を多くする。大きい粒を少しだけ並べると数珠つなぎに見えてしまう。
  const DUST = 2400
  const dustPositions = new Float32Array(DUST * 3)
  for (let i = 0; i < DUST; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 5.6 + Math.random() * 2.6
    dustPositions[i * 3] = Math.cos(angle) * radius
    dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.18
    dustPositions[i * 3 + 2] = Math.sin(angle) * radius
  }
  const dustGeometry = new THREE.BufferGeometry()
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
  const planetDust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      map: sprite,
      color: 0xbcd0ff,
      size: 0.11,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  planetDust.rotation.x = 1.32
  planetDust.rotation.z = 0.3
  planet.add(planetDust)
  scene.add(planet)

  // 惑星を照らす光。太陽は右上にある想定。環境光を強くしすぎると
  // 明暗の境目が消えて、球ではなく丸く切り抜いた絵に見える。
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.4)
  sun.position.set(7, 6, 5)
  scene.add(sun)
  scene.add(new THREE.AmbientLight(0x2b3f7a, 0.5))

  // プレートを周回する環(土星の環のイメージ)。傾きを変えて2重にする。
  const orbits = [
    { tilt: 1.15, radius: 3.1, color: 0xffe9a8, size: 0.1 },
    { tilt: -0.72, radius: 3.8, color: 0x8fd8ff, size: 0.075 },
  ].map(({ tilt, radius: base, color, size }) => {
    const ORBIT = 560
    const orbitPositions = new Float32Array(ORBIT * 3)
    for (let i = 0; i < ORBIT; i++) {
      const angle = (i / ORBIT) * Math.PI * 2
      const radius = base + Math.random() * 0.5
      orbitPositions[i * 3] = Math.cos(angle) * radius
      orbitPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.25
      orbitPositions[i * 3 + 2] = Math.sin(angle) * radius
    }
    const orbitGeometry = new THREE.BufferGeometry()
    orbitGeometry.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3))
    const ring = new THREE.Points(
      orbitGeometry,
      new THREE.PointsMaterial({
        map: sprite,
        color,
        size,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    ring.rotation.x = tilt
    scene.add(ring)
    return ring
  })

  // 彗星。奥を横切らせる。スプライトを進行方向に回して細長くするだけで光跡に見える。
  const comets = [
    { at: 1.0, life: 1.5, from: [-17, 10, -24], to: [13, -5, -15] },
    { at: 2.6, life: 1.8, from: [16, 7, -28], to: [-14, -8, -19] },
  ].map(({ at, life, from, to }) => {
    const comet = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sprite,
        color: 0xeaf3ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    comet.material.rotation = Math.atan2(to[1] - from[1], to[0] - from[0])
    comet.scale.set(9, 0.5, 1)
    comet.position.set(from[0], from[1], from[2])
    scene.add(comet)
    return { comet, at, life, from, to }
  })

  return {
    textures,
    update(t, ease, fit) {
      // ワープアウト。星の流れは最初が最速で、そこから減速して漂いに変わる。
      // 尾の長さも速度に連れて縮むので、「止まっていく」のが見た目で分かる。
      const warpFactor = 0.16 + Math.exp(-t * 0.8)
      const wp = warp.geometry.getAttribute('position') as {
        array: Float32Array
        needsUpdate: boolean
      }
      for (let i = 0; i < warpSpeeds.length; i++) {
        const speed = warpSpeeds[i] * warpFactor
        const tail = speed * 0.06
        let head = wp.array[i * 6 + 2] + speed * 0.016
        // カメラを追い越した星は、また奥から流し直す
        if (head - tail > camera.position.z) head = -WARP_DEPTH
        wp.array[i * 6 + 2] = head
        wp.array[i * 6 + 5] = head - tail
      }
      wp.needsUpdate = true

      // 減速しきったところで星の瞬きが立ち上がる(ワープ中に瞬いても見えない)。
      starfield.forEach((layer, i) => {
        const material = layer.material as { opacity: number }
        const settled = 1 - Math.min(warpFactor, 1)
        material.opacity = settled * (0.55 + Math.sin(t * (1.7 + i * 0.9) + i) * 0.25)
        layer.rotation.y = t * 0.012
      })

      nebula.rotation.z = t * 0.04
      nebula.children.forEach((cloud, i) => {
        const material = (cloud as unknown as { material: { opacity: number } }).material
        material.opacity = 0.09 + Math.sin(t * 0.8 + i) * 0.035
      })

      // 惑星は下から昇ってくる。自転と環の回転は独立して回す。
      const rise = 1 - Math.pow(1 - Math.min(t / 3.4, 1), 3)
      planet.position.y = -9.5 + rise * 3.1
      globe.rotation.y = t * 0.07
      planetDust.rotation.y = t * 0.16

      orbits.forEach((ring, i) => {
        const dir = i % 2 === 0 ? 1 : -1
        ring.rotation.y = t * 1.1 * dir
        ring.rotation.z = Math.sin(t * 0.5) * 0.12 * dir
        ring.scale.setScalar(fit) // 環はプレートの大きさに従わせる
        ;(ring.material as { opacity: number }).opacity = 0.9 * ease
      })

      // 彗星。出番の時間になったら、決めた線分を一定速度で横切って消える。
      comets.forEach(({ comet, at, life, from, to }) => {
        const local = (t - at) / life
        if (local < 0 || local > 1) {
          comet.material.opacity = 0
          return
        }
        comet.position.set(
          from[0] + (to[0] - from[0]) * local,
          from[1] + (to[1] - from[1]) * local,
          from[2] + (to[2] - from[2]) * local,
        )
        // 入りと抜けをなだらかにする(唐突に現れて唐突に消えると紙芝居に見える)
        comet.material.opacity = Math.sin(local * Math.PI) * 0.95
      })

      // 船が漂うように、カメラをゆっくり傾けて流す。
      camera.rotation.z = Math.sin(t * 0.35) * 0.05
      camera.position.x = Math.sin(t * 0.23) * 0.16
      camera.position.y = Math.cos(t * 0.19) * 0.12
    },
  }
}
