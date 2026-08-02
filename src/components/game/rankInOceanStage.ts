/**
 * 2位の舞台「大海原」。
 *
 * よく晴れた昼の外洋。低い視点から水平線までうねりが続き、太陽へ向かって
 * 光の道(きらめき)が伸びて、遠くをカモメが横切る。
 * 空を明るくしすぎると銀色のプレートが背景に負けるので、白く飛ぶのは
 * 水平線の帯だけに絞り、プレートの後ろは濃い青のまま残している。
 *
 * 遠景は霧で水平線の色に溶かす。海面の端を隠すためでもあり、
 * 「どこまでも続く」感じもここから出る。霧はシーン全体に効くので、
 * 共通の見せ物(プレート・粒・リング)側は `fog: false` にしてある。
 */
import { createGroundGrid } from './rankInGroundGrid'
import type { Stage, StageContext } from './rankInStage'

/** 水平線の色。霧・空の下端・海の遠くをこの色で揃える。 */
const HORIZON_COLOR = 0xcfe6f7
/** 海面の高さ(カメラは 0 付近にいるので、これだけ見下ろす)。 */
const SEA_Y = -2.4
/** 太陽の方位(正面から右へ何ラジアン)。光の道もこの向きへ伸ばす。 */
const SUN_ANGLE = 0.12
/** 霧が完全にかかる距離。海面はこれより遠くまで張って、端を隠す。 */
const FOG_FAR = 190
/** カメラの位置(シーン側と合わせる)。格子をここから切るために要る。 */
const CAMERA_Z = 7

/**
 * うねりの高さ。海面と光の道で同じ式を使う(粒が波から浮かないように)。
 * 長いうねりは常に、細かい波は手前だけ({@link damp} で減衰させる)。
 */
function waveAt(x: number, z: number, t: number, damp: number): number {
  const swell = Math.sin(x * 0.14 + t * 0.8) * 0.42 + Math.sin(z * 0.11 - t * 0.65) * 0.34
  const chop =
    Math.sin(x * 0.8 - t * 2.3) * 0.1 +
    Math.sin(z * 0.95 + t * 2.7) * 0.08 +
    Math.sin((x + z) * 0.55 + t * 1.9) * 0.06
  return swell + chop * damp
}

/**
 * 昼の空。内側から見る球に貼る。上端が天頂、上下の真ん中が水平線
 * (下半分は海面に隠れるので水平線の色で塗り潰しておく)。
 *
 * 白っぽいのは水平線のすぐ上だけ。広げるとプレートの後ろまで明るくなって、
 * 銀色の「2ND」が背景に負ける。
 */
function makeSkyCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const sky = ctx.createLinearGradient(0, 0, 0, 512)
  sky.addColorStop(0, '#062a6e') // 天頂
  sky.addColorStop(0.3, '#12468f')
  sky.addColorStop(0.42, '#2f6fbe')
  sky.addColorStop(0.47, '#5f9ed6')
  sky.addColorStop(0.492, '#a9cfea')
  sky.addColorStop(0.5, '#cfe6f7') // 水平線のかすみ(ここだけ白く飛ばす)
  sky.addColorStop(1, '#cfe6f7')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 512, 512)

  // 雲。水平線の少し上に薄く並べると、空の高さが出る。
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * 512
    const y = 190 + Math.random() * 50
    const width = 30 + Math.random() * 90
    const cloud = ctx.createRadialGradient(x, y, 0, x, y, width)
    cloud.addColorStop(0, `rgba(255,255,255,${0.12 + Math.random() * 0.16})`)
    cloud.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = cloud
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1, 0.24) // 横に伸ばして雲らしくする
    ctx.translate(-x, -y)
    ctx.fillRect(x - width, y - width, width * 2, width * 2)
    ctx.restore()
  }
  ctx.globalCompositeOperation = 'source-over'
  return canvas
}

/** カモメのシルエット。遠景なので「く」の字が2つ並ぶだけで鳥に見える。 */
function makeGullCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(8, 34)
  ctx.quadraticCurveTo(20, 22, 32, 32)
  ctx.quadraticCurveTo(44, 22, 56, 34)
  ctx.stroke()
  return canvas
}

export function createOceanStage({ three: THREE, scene, camera, sprite }: StageContext): Stage {
  const textures: InstanceType<typeof THREE.Texture>[] = []
  scene.fog = new THREE.Fog(HORIZON_COLOR, 90, FOG_FAR)

  // --- 空 -------------------------------------------------------------------
  const skyTexture = new THREE.CanvasTexture(makeSkyCanvas())
  skyTexture.colorSpace = THREE.SRGBColorSpace
  textures.push(skyTexture)
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(300, 32, 24),
      // 霧をかけると空まで一色になるので、空だけは霧の外に置く。
      new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false }),
    ),
  )

  // --- 海面 -----------------------------------------------------------------
  const grid = createGroundGrid(THREE, {
    rows: 72,
    cols: 72,
    near: 3,
    far: 200,
    cameraZ: CAMERA_Z,
    dampScale: 55,
  })
  const seaColors = new Float32Array(grid.x.length * 3)
  grid.geometry.setAttribute('color', new THREE.BufferAttribute(seaColors, 3))
  const sea = new THREE.Mesh(
    grid.geometry,
    // flatShading にすると法線を計算し直さずに済み(シェーダが面から出す)、
    // 面ごとに明るさが変わって波らしくなる。裏表は気にしないので DoubleSide。
    // 鏡面反射のあるマテリアル(Standard)だと、傾いた面が一斉に鈍く光って
    // 海全体が銀色にくすむ。きらめきは光の道の粒に任せて、ここは拡散反射だけにする。
    // 色は頂点色(下の update で波の高さから決める)。マテリアルの色を青にして
    // 鏡面反射に任せると、傾いた面が一斉に鈍く光って海全体が銀色にくすむ。
    // roughness を高くして照りを弱め、面の向きの差だけが残るようにする。
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
  )
  sea.position.y = SEA_Y
  scene.add(sea)

  // 太陽。水平線のすぐ上、プレートの下に収まる高さに置く。空と同じく霧の外。
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sprite,
      color: 0xfff6df,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  )
  sunSprite.position.set(Math.sin(SUN_ANGLE) * 140, 4.5, -Math.cos(SUN_ANGLE) * 140)
  sunSprite.scale.setScalar(11)
  scene.add(sunSprite)

  // --- 光の道(きらめき) -----------------------------------------------------
  // 太陽へ向かって伸びる帯。手前ほど広く、水平線に近づくほど細くなる。
  // 大海原らしさはほぼこれで決まるので、粒は多めに撒く。
  const GLITTER = 1100
  const glitterPositions = new Float32Array(GLITTER * 3)
  const glitterColors = new Float32Array(GLITTER * 3)
  const glitterPhases = new Float32Array(GLITTER)
  const glitterX = new Float32Array(GLITTER)
  const glitterZ = new Float32Array(GLITTER)
  const glitterDamp = new Float32Array(GLITTER)
  for (let i = 0; i < GLITTER; i++) {
    const distance = 10 + Math.pow(Math.random(), 0.55) * 120
    const spread = 0.5 + 5.5 * Math.exp(-distance / 45)
    glitterX[i] = Math.tan(SUN_ANGLE) * distance + (Math.random() - 0.5) * 2 * spread
    glitterZ[i] = CAMERA_Z - distance
    glitterDamp[i] = Math.exp(-distance / 55)
    glitterPhases[i] = Math.random() * Math.PI * 2
  }
  const glitterGeometry = new THREE.BufferGeometry()
  glitterGeometry.setAttribute('position', new THREE.BufferAttribute(glitterPositions, 3))
  glitterGeometry.setAttribute('color', new THREE.BufferAttribute(glitterColors, 3))
  const glitter = new THREE.Points(
    glitterGeometry,
    new THREE.PointsMaterial({
      map: sprite,
      size: 0.18,
      vertexColors: true, // 粒ごとに明滅させたいので、色を毎フレーム書き換える
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  scene.add(glitter)

  // --- カモメ ---------------------------------------------------------------
  const gullTexture = new THREE.CanvasTexture(makeGullCanvas())
  textures.push(gullTexture)
  const gulls = [
    { at: 0.4, life: 5.5, y: 2.4, z: -52, dir: 1, scale: 2.4 },
    { at: 1.3, life: 6.5, y: 4.2, z: -74, dir: 1, scale: 3.0 },
    { at: 2.2, life: 5.0, y: 1.4, z: -40, dir: -1, scale: 1.9 },
  ].map((spec) => {
    const gull = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: gullTexture,
        color: 0x2e4258, // 逆光のシルエット
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    )
    gull.scale.setScalar(spec.scale)
    scene.add(gull)
    return { gull, ...spec }
  })

  // --- 光 -------------------------------------------------------------------
  // 太陽は水平線の向こう側。海面の面がこちらを向いた瞬間だけ強く光る。
  const sunLight = new THREE.DirectionalLight(0xfff2d8, 1.4)
  sunLight.position.set(Math.sin(SUN_ANGLE) * 100, 16, -Math.cos(SUN_ANGLE) * 100)
  scene.add(sunLight)
  // 空の色を海に落とす。これが無いと波の影が真っ黒になって空と馴染まない。
  scene.add(new THREE.HemisphereLight(0x4f96de, 0x05294f, 0.85))

  return {
    // 水平線は画面の真ん中に出る。プレートをそのまま置くと海と水平線の帯にかぶって
    // 読みにくいので、濃い青の空まで持ち上げて、下半分は海だけにする。
    plateOffsetY: 1.35,
    // 空が明るいので、後光はかなり弱くしないと文字が飛ぶ。
    haloOpacity: 0.3,
    textures,
    update(t) {
      // 海面。うねりの式は時間を渡し直すだけで流れ続ける。
      // 高いところ(波の頂)ほど明るい青にして、うねりを見せる。
      const seaColor = grid.geometry.getAttribute('color') as {
        array: Float32Array
        needsUpdate: boolean
      }
      for (let i = 0; i < grid.x.length; i++) {
        const height = waveAt(grid.x[i], grid.z[i], t, grid.damp[i])
        grid.position.array[i * 3 + 1] = height
        const mix = Math.min(1, Math.max(0, (height + 0.8) / 1.6))
        seaColor.array[i * 3] = 0.004 + 0.02 * mix
        seaColor.array[i * 3 + 1] = 0.05 + 0.18 * mix
        seaColor.array[i * 3 + 2] = 0.22 + 0.42 * mix
      }
      grid.position.needsUpdate = true
      seaColor.needsUpdate = true

      // きらめき。波に乗せたうえで、粒ごとにばらばらに閃かせる。
      // 尖らせた sin(8乗)にすると、点いている時間が短くなって水面らしくなる。
      const glitterPosition = glitter.geometry.getAttribute('position') as {
        array: Float32Array
        needsUpdate: boolean
      }
      const glitterColor = glitter.geometry.getAttribute('color') as {
        array: Float32Array
        needsUpdate: boolean
      }
      for (let i = 0; i < GLITTER; i++) {
        glitterPosition.array[i * 3] = glitterX[i]
        glitterPosition.array[i * 3 + 1] =
          SEA_Y + waveAt(glitterX[i], glitterZ[i], t, glitterDamp[i]) + 0.06
        glitterPosition.array[i * 3 + 2] = glitterZ[i]
        const flash = Math.pow(Math.max(0, Math.sin(glitterPhases[i] + t * 3.2)), 8)
        glitterColor.array[i * 3] = flash * 0.8
        glitterColor.array[i * 3 + 1] = flash * 0.75
        glitterColor.array[i * 3 + 2] = flash * 0.6
      }
      glitterPosition.needsUpdate = true
      glitterColor.needsUpdate = true

      // カモメ。画面の外から外へ、ゆっくり横切らせる。
      gulls.forEach(({ gull, at, life, y, z, dir }) => {
        const local = (t - at) / life
        if (local < 0 || local > 1) {
          gull.material.opacity = 0
          return
        }
        const span = 90
        gull.position.set(dir * (-span / 2 + span * local), y + Math.sin(t * 1.1 + z) * 0.4, z)
        gull.material.opacity = Math.min(1, Math.sin(local * Math.PI) * 3) * 0.8
      })

      // 船の上から見ているように、カメラをゆっくり上下させて傾ける。
      camera.position.y = Math.sin(t * 0.75) * 0.14
      camera.rotation.z = Math.sin(t * 0.5) * 0.025
    },
  }
}
