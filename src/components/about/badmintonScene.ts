/**
 * About ページの three.js シーン。
 * バドミントンコートの世界を1つ作り、スクロール進行度でカメラが空間を移動する。
 * - シャトルが放物線でラリーを続け、着弾で波紋が広がる(軌跡はパーティクルの尾)
 * - コート上+ベンチの15個の「プレーヤー玉」が数秒ごとに入れ替わる(混ざるマッチングの暗喩)
 * - 浮遊パーティクルとフォグで奥行きを出す
 *
 * three.js はこのモジュール内で動的 import する(SSR と初期バンドルに載せない)。
 * 呼び出し側は dispose() を必ず呼ぶこと。
 */

type Disposer = { dispose: () => void }

/** スクロール進行度(0..1)を返す関数を受け取り、シーンを開始する。 */
export async function createBadmintonScene(
  host: HTMLElement,
  getProgress: () => number,
): Promise<Disposer> {
  const THREE = await import('three')

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // reduced-motion では物の動きを止める(カメラのスクロール追従だけ残す)。
  const timeScale = prefersReduced ? 0 : 1

  // --- 基本セットアップ -----------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(host.clientWidth, host.clientHeight)
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const BG = 0x060f22 // ブランド紺の最深部
  scene.background = new THREE.Color(BG)
  scene.fog = new THREE.FogExp2(BG, 0.026)

  const camera = new THREE.PerspectiveCamera(
    50,
    host.clientWidth / host.clientHeight,
    0.1,
    120,
  )

  scene.add(new THREE.AmbientLight(0xbfd4ff, 0.55))
  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.position.set(6, 12, 4)
  scene.add(sun)
  const netGlow = new THREE.PointLight(0x7196c3, 8, 18)
  netGlow.position.set(0, 3.2, 0)
  scene.add(netGlow)

  // --- コート(13.4 × 6.1、ネットは x=0) ------------------------------------
  const HALF_L = 6.7
  const HALF_W = 3.05

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 40),
    new THREE.MeshStandardMaterial({ color: 0x0a1a36, roughness: 0.95 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  const courtMat = new THREE.MeshStandardMaterial({ color: 0x123a70, roughness: 0.85 })
  const court = new THREE.Mesh(new THREE.PlaneGeometry(HALF_L * 2, HALF_W * 2), courtMat)
  court.rotation.x = -Math.PI / 2
  court.position.y = 0.01
  scene.add(court)

  // コートライン(実際の規格に近い配置)。y をわずかに浮かせて Z ファイトを避ける。
  {
    const pts: number[] = []
    const y = 0.02
    const seg = (x1: number, z1: number, x2: number, z2: number) =>
      pts.push(x1, y, z1, x2, y, z2)
    const box = (x1: number, z1: number, x2: number, z2: number) => {
      seg(x1, z1, x2, z1)
      seg(x2, z1, x2, z2)
      seg(x2, z2, x1, z2)
      seg(x1, z2, x1, z1)
    }
    box(-HALF_L, -HALF_W, HALF_L, HALF_W) // 外周
    seg(-HALF_L, -HALF_W + 0.46, HALF_L, -HALF_W + 0.46) // シングルスサイド
    seg(-HALF_L, HALF_W - 0.46, HALF_L, HALF_W - 0.46)
    seg(-1.98, -HALF_W, -1.98, HALF_W) // ショートサービスライン
    seg(1.98, -HALF_W, 1.98, HALF_W)
    seg(-HALF_L + 0.76, -HALF_W, -HALF_L + 0.76, HALF_W) // ダブルスロングサービス
    seg(HALF_L - 0.76, -HALF_W, HALF_L - 0.76, HALF_W)
    seg(-HALF_L, 0, -1.98, 0) // センターライン(サービスコート分割)
    seg(1.98, 0, HALF_L, 0)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    scene.add(
      new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ color: 0xdce8f8, transparent: true, opacity: 0.9 }),
      ),
    )
  }

  // --- ネット ---------------------------------------------------------------
  {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x223c60, roughness: 0.4 })
    for (const z of [-HALF_W - 0.1, HALF_W + 0.1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.55, 10), postMat)
      post.position.set(0, 0.775, z)
      scene.add(post)
    }
    // 網は縦横のラインで表現(テクスチャ不要で軽い)
    const pts: number[] = []
    const top = 1.55
    const bottom = 0.79
    for (let i = 0; i <= 40; i++) {
      const z = -HALF_W - 0.1 + (i / 40) * (HALF_W + 0.1) * 2
      pts.push(0, bottom, z, 0, top, z)
    }
    for (let i = 0; i <= 8; i++) {
      const yy = bottom + (i / 8) * (top - bottom)
      pts.push(0, yy, -HALF_W - 0.1, 0, yy, HALF_W + 0.1)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    scene.add(
      new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ color: 0x8fb0d8, transparent: true, opacity: 0.45 }),
      ),
    )
    // 白帯
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.07, (HALF_W + 0.1) * 2),
      new THREE.MeshStandardMaterial({ color: 0xf0f5fc }),
    )
    band.position.y = top - 0.035
    scene.add(band)
  }

  // --- シャトル(プリミティブだけで組む) ------------------------------------
  const buildShuttle = (): InstanceType<typeof THREE.Group> => {
    const g = new THREE.Group()
    const cork = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xf7efe1, roughness: 0.55 }),
    )
    cork.scale.set(1, 1.15, 1)
    cork.position.y = -0.01
    g.add(cork)
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.092, 0.092, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0x1d4685, roughness: 0.5 }),
    )
    band.position.y = 0.05
    g.add(band)
    const featherMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      roughness: 0.9,
    })
    const featherGeo = new THREE.PlaneGeometry(0.06, 0.3)
    featherGeo.translate(0, 0.15, 0) // 根本を原点にして傾けやすく
    for (let i = 0; i < 12; i++) {
      const f = new THREE.Mesh(featherGeo, featherMat)
      const a = (i / 12) * Math.PI * 2
      f.position.set(Math.cos(a) * 0.05, 0.07, Math.sin(a) * 0.05)
      f.rotation.order = 'YXZ'
      f.rotation.y = -a + Math.PI / 2
      f.rotation.x = -0.42 // 外向きに開く
      g.add(f)
    }
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0 })
    for (const [r, yy] of [
      [0.12, 0.2],
      [0.165, 0.32],
    ] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 24), ringMat)
      ring.rotation.x = Math.PI / 2
      ring.position.y = yy
      g.add(ring)
    }
    return g
  }
  const NOSE = new THREE.Vector3(0, -1, 0) // モデルのコルク方向

  // ラリーするシャトル。放物線 A→B を往復し続ける。
  type Rally = {
    group: InstanceType<typeof THREE.Group>
    from: InstanceType<typeof THREE.Vector3>
    to: InstanceType<typeof THREE.Vector3>
    t: number
    duration: number
    apex: number
    trail: Array<InstanceType<typeof THREE.Vector3>>
    trailGeo: InstanceType<typeof THREE.BufferGeometry>
  }
  const TRAIL_N = 56
  const rallies: Rally[] = []
  const trailMat = new THREE.PointsMaterial({
    size: 0.07,
    transparent: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const randSide = (side: 1 | -1) =>
    new THREE.Vector3(
      side * (1.2 + Math.random() * (HALF_L - 1.6)),
      0.35,
      (Math.random() * 2 - 1) * (HALF_W - 0.5),
    )
  for (let i = 0; i < 3; i++) {
    const group = buildShuttle()
    scene.add(group)
    const from = randSide(i % 2 === 0 ? -1 : 1)
    const to = randSide(i % 2 === 0 ? 1 : -1)
    const trailGeo = new THREE.BufferGeometry()
    trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(TRAIL_N * 3, 3))
    trailGeo.setAttribute('color', new THREE.Float32BufferAttribute(TRAIL_N * 3, 3))
    scene.add(new THREE.Points(trailGeo, trailMat))
    rallies.push({
      group,
      from,
      to,
      t: Math.random() * 0.8,
      duration: 1.7 + Math.random() * 0.7,
      apex: 2.6 + Math.random() * 1.8,
      trail: Array.from({ length: TRAIL_N }, () => from.clone()),
      trailGeo,
    })
  }

  // 着弾の波紋(リングを使い回す)
  type Ripple = { mesh: InstanceType<typeof THREE.Mesh>; age: number }
  const ripples: Ripple[] = []
  const rippleGeo = new THREE.RingGeometry(0.18, 0.24, 40)
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(
      rippleGeo,
      new THREE.MeshBasicMaterial({
        color: 0x9cc0ee,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    )
    m.rotation.x = -Math.PI / 2
    m.position.y = 0.03
    scene.add(m)
    ripples.push({ mesh: m, age: 99 })
  }
  const spawnRipple = (p: InstanceType<typeof THREE.Vector3>) => {
    const r = ripples.reduce((a, b) => (a.age > b.age ? a : b))
    r.age = 0
    r.mesh.position.set(p.x, 0.03, p.z)
  }

  // --- プレーヤー玉(15人)。コート8枠+ベンチ7枠を数秒ごとに入れ替える ------
  const PLAYERS = 15
  const spots: Array<InstanceType<typeof THREE.Vector3>> = []
  for (const sx of [-1, 1]) {
    for (const [dx, dz] of [
      [3.9, -1.55],
      [3.9, 1.55],
      [1.6, -1.55],
      [1.6, 1.55],
    ] as const) {
      spots.push(new THREE.Vector3(sx * dx, 0.18, dz))
    }
  }
  for (let i = 0; i < PLAYERS - 8; i++) {
    spots.push(new THREE.Vector3(-4.5 + i * 1.5, 0.18, HALF_W + 1.7))
  }
  type Dot = {
    mesh: InstanceType<typeof THREE.Mesh>
    fromSpot: InstanceType<typeof THREE.Vector3>
    toSpot: InstanceType<typeof THREE.Vector3>
    hopT: number // 1 で到着済み
    delay: number
  }
  const dots: Dot[] = []
  const dotGeo = new THREE.SphereGeometry(0.17, 20, 14)
  for (let i = 0; i < PLAYERS; i++) {
    const color = new THREE.Color().setHSL((i / PLAYERS + 0.55) % 1, 0.62, 0.6)
    const mesh = new THREE.Mesh(
      dotGeo,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        emissive: color.clone().multiplyScalar(0.25),
      }),
    )
    mesh.position.copy(spots[i])
    scene.add(mesh)
    dots.push({ mesh, fromSpot: spots[i].clone(), toSpot: spots[i].clone(), hopT: 1, delay: 0 })
  }
  let shuffleTimer = 1.2 // 最初は少し待ってから混ぜる
  const reshuffle = () => {
    // 「試合表の組み直し」: 15人を15枠へランダムに割り当て直し、時間差でホップさせる。
    const order = Array.from({ length: PLAYERS }, (_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    dots.forEach((d, i) => {
      d.fromSpot.copy(d.mesh.position)
      d.toSpot.copy(spots[order[i]])
      d.hopT = 0
      d.delay = i * 0.045
    })
  }

  // --- 浮遊パーティクル -------------------------------------------------------
  const DUST_N = 380
  const dustPos = new Float32Array(DUST_N * 3)
  for (let i = 0; i < DUST_N; i++) {
    dustPos[i * 3] = (Math.random() * 2 - 1) * 16
    dustPos[i * 3 + 1] = Math.random() * 7
    dustPos[i * 3 + 2] = (Math.random() * 2 - 1) * 11
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0x7196c3,
      size: 0.05,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  scene.add(dust)

  // --- カメラワーク(スクロールでキーフレーム間を補間) -----------------------
  const camKeys = [
    { pos: new THREE.Vector3(10.5, 1.6, 8.0), look: new THREE.Vector3(0, 1.1, 0) },
    { pos: new THREE.Vector3(0.0, 11.5, 9.5), look: new THREE.Vector3(0, 0.0, 0.8) },
    { pos: new THREE.Vector3(-8.5, 1.1, 5.0), look: new THREE.Vector3(0, 1.5, 0) },
    { pos: new THREE.Vector3(0.0, 3.4, 13.0), look: new THREE.Vector3(0, 1.0, 0) },
  ]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const camPos = camKeys[0].pos.clone()
  const camLook = camKeys[0].look.clone()
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
  const onMouse = (e: MouseEvent) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1
  }
  window.addEventListener('mousemove', onMouse)

  const onResize = () => {
    camera.aspect = host.clientWidth / host.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(host.clientWidth, host.clientHeight)
  }
  window.addEventListener('resize', onResize)

  // --- フレームループ ----------------------------------------------------------
  const clock = new THREE.Clock()
  const tmpV = new THREE.Vector3()
  const tmpQ = new THREE.Quaternion()
  const rollQ = new THREE.Quaternion()
  let raf = 0

  const frame = () => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(clock.getDelta(), 0.05) * timeScale
    const time = clock.elapsedTime

    // ラリー
    for (const r of rallies) {
      r.t += dt / r.duration
      if (r.t >= 1) {
        spawnRipple(r.to)
        r.from = r.to
        r.to = randSide(r.to.x > 0 ? -1 : 1)
        r.t = 0
        r.duration = 1.7 + Math.random() * 0.7
        r.apex = 2.6 + Math.random() * 1.8
      }
      const t = r.t
      tmpV.lerpVectors(r.from, r.to, t)
      tmpV.y += r.apex * 4 * t * (1 - t)
      r.group.position.copy(tmpV)
      // 進行方向にコルクを向け、軸まわりにゆっくりロールさせる
      const t2 = Math.min(t + 0.02, 1)
      const ahead = new THREE.Vector3().lerpVectors(r.from, r.to, t2)
      ahead.y += r.apex * 4 * t2 * (1 - t2)
      const dir = ahead.sub(r.group.position).normalize()
      tmpQ.setFromUnitVectors(NOSE, dir)
      rollQ.setFromAxisAngle(dir, time * 2.2)
      r.group.quaternion.copy(rollQ.multiply(tmpQ))
      // 軌跡(先頭に現在位置を入れて後ろへ流す)
      r.trail.pop()
      r.trail.unshift(r.group.position.clone())
      const pos = r.trailGeo.getAttribute('position') as unknown as {
        setXYZ: (i: number, x: number, y: number, z: number) => void
        needsUpdate: boolean
      }
      const col = r.trailGeo.getAttribute('color') as unknown as {
        setXYZ: (i: number, x: number, y: number, z: number) => void
        needsUpdate: boolean
      }
      r.trail.forEach((p, i) => {
        pos.setXYZ(i, p.x, p.y, p.z)
        const f = (1 - i / TRAIL_N) * 0.9
        col.setXYZ(i, 0.65 * f, 0.8 * f, f)
      })
      pos.needsUpdate = true
      col.needsUpdate = true
    }

    // 波紋
    for (const rp of ripples) {
      rp.age += dt
      const k = rp.age / 0.7
      const mat = rp.mesh.material as { opacity: number }
      if (k >= 1) {
        mat.opacity = 0
      } else {
        rp.mesh.scale.setScalar(0.4 + k * 3.2)
        mat.opacity = (1 - k) * 0.8
      }
    }

    // プレーヤー玉のシャッフル
    shuffleTimer -= dt
    if (shuffleTimer <= 0) {
      reshuffle()
      shuffleTimer = 3.4
    }
    for (const d of dots) {
      if (d.delay > 0) {
        d.delay -= dt
        continue
      }
      if (d.hopT < 1) {
        d.hopT = Math.min(d.hopT + dt / 0.85, 1)
        const k = smooth(d.hopT)
        d.mesh.position.lerpVectors(d.fromSpot, d.toSpot, k)
        d.mesh.position.y = 0.18 + Math.sin(k * Math.PI) * 0.9
      } else {
        // 待機中はその場でわずかに弾む
        const i = dots.indexOf(d)
        d.mesh.position.y = 0.18 + Math.abs(Math.sin(time * 2.1 + i * 1.3)) * 0.05
      }
    }

    // 塵はゆっくり上昇して循環
    const dp = dustGeo.getAttribute('position') as unknown as {
      array: Float32Array
      needsUpdate: boolean
    }
    for (let i = 0; i < DUST_N; i++) {
      dp.array[i * 3 + 1] += dt * 0.12
      if (dp.array[i * 3 + 1] > 7) dp.array[i * 3 + 1] = 0
    }
    dp.needsUpdate = true

    // カメラ: スクロール進行度でキーフレームを補間 + マウス視差 + 呼吸
    const p = Math.min(Math.max(getProgress(), 0), 1) * (camKeys.length - 1)
    const seg = Math.min(Math.floor(p), camKeys.length - 2)
    const k = smooth(p - seg)
    camPos.lerpVectors(camKeys[seg].pos, camKeys[seg + 1].pos, k)
    camLook.lerpVectors(camKeys[seg].look, camKeys[seg + 1].look, k)
    mouse.x += (mouse.tx - mouse.x) * 0.05
    mouse.y += (mouse.ty - mouse.y) * 0.05
    camera.position.set(
      camPos.x + mouse.x * 0.7 + Math.sin(time * 0.4) * 0.15,
      camPos.y - mouse.y * 0.45 + Math.sin(time * 0.6) * 0.1,
      camPos.z,
    )
    camera.lookAt(camLook)

    renderer.render(scene, camera)
  }
  frame()

  return {
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('resize', onResize)
      scene.traverse((obj) => {
        const anyObj = obj as { geometry?: { dispose: () => void }; material?: unknown }
        anyObj.geometry?.dispose()
        const m = anyObj.material
        if (Array.isArray(m)) m.forEach((x) => (x as { dispose: () => void }).dispose())
        else if (m) (m as { dispose: () => void }).dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
