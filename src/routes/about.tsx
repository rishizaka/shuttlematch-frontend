import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import aboutCss from '../styles/about.css?url'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'ShuttleMatch について — バドミントンの試合表を、公平に・よく混ざる形で' },
      {
        name: 'description',
        content:
          'ShuttleMatch はバドミントン練習会のダブルスの組み合わせ(乱数表)を自動生成・共有するサービス。出場回数は常に公平、同じ顔ぶれで固まらないマッチング、受付モードや再編成で当日運営もかんたん。テニスなど4人1組で回す練習にも使えます。',
      },
    ],
    // このページでしか使わないので、ルート単位で読み込む
    links: [{ rel: 'stylesheet', href: aboutCss }],
  }),
  component: AboutPage,
})

/**
 * 背景とスクロール連動をまとめて動かす。
 *
 * 素の DOM 操作でよい類の処理(canvas への描画、CSS 変数の書き換え、
 * スクロール量に応じた進行度の反映)なので、React の状態には載せない。
 * 参照は stage の中だけに閉じてあるので、ページを離れれば影響も消える。
 *
 * 戻り値は後始末の関数。登録したリスナーと rAF をすべて止める。
 */
function startAboutStage(stage: HTMLElement): () => void {

      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // 画面を離れるときに全部止められるよう、登録したものを控えておく
      var cleanups: Array<() => void> = [];
      var rafIds: number[] = [];
      var on = function (
        target: Window | HTMLElement,
        type: string,
        fn: EventListenerOrEventListenerObject,
        opts?: AddEventListenerOptions,
      ) {
        target.addEventListener(type, fn, opts);
        cleanups.push(function () { target.removeEventListener(type, fn, opts); });
      };
      var trackRaf = function (fn: FrameRequestCallback) {
        var id = requestAnimationFrame(fn);
        rafIds.push(id);
        return id;
      };
      var clamp01 = function (v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; };

      /* =====================================================
         スクロール駆動の中核
         登録された要素に --p (0..1) を書き込むだけ。
         「0/1 のどちらか」ではなく連続値なので、スクロールを
         止めた位置でアニメーションも途中で止まる。
         ===================================================== */
      /* 連続追従させるのは装飾だけ(いまは表紙の視差のみ)。
         本文や図表をここに入れると、読もうとして止めた位置で
         半透明のまま固定されてしまう。 */
      type ScrollItem = { el: HTMLElement; cover: boolean };
      var items: ScrollItem[] = [];
      stage.querySelectorAll('[data-scroll]').forEach(function (el) {
        var kind = el.getAttribute('data-scroll');
        items.push({ el: el as HTMLElement, cover: kind === 'cover' });
      });

      /* 読む要素は「画面に入ったら一度だけ .shown を付ける」。
         付けたら外さないので、読み返しても消えない。 */

      /* =====================================================
         背景 — 紺と紙が滲み合う面

         セクションごとに地色を切り替えると、境界が必ず直線で出る。
         そこでページ全体を1枚の面として扱い、その面の色をスクロールで
         動かしている。

         描き方: 小さなオフスクリーン(120px 四方)にぼかした円をいくつか
         置き、それを画面いっぱいに引き伸ばす。拡大時の補間がそのまま
         なめらかなグラデーションになるので、ぼかし処理を一切かけずに
         流体のような混ざりが出せる(重いフィルタを使わなくて済む)。
         ===================================================== */
      var bg = stage.querySelector('#bg') as HTMLCanvasElement | null;
      const bgCtx: CanvasRenderingContext2D | null = bg ? bg.getContext('2d') : null;
      var OFF = 120;
      var off = document.createElement('canvas');
      off.width = off.height = OFF;
      const oc = off.getContext('2d') as CanvasRenderingContext2D;
      var bgW = 0, bgH = 0;

      // 紺側と紙側、それぞれの「文字・罫線の色」。背景の混ざり具合で補間する。
      var INK_ON_NAVY  = [234, 240, 251];
      var INK_ON_PAPER = [0, 20, 51];
      var SOFT_ON_NAVY = [182, 200, 230];
      var SOFT_ON_PAPER = [40, 62, 98];
      var FAINT_ON_NAVY = [146, 168, 204];
      var FAINT_ON_PAPER = [82, 101, 136];

      var mixRgb = function (a: number[], b: number[], t: number) {
        return [
          Math.round(a[0] + (b[0] - a[0]) * t),
          Math.round(a[1] + (b[1] - a[1]) * t),
          Math.round(a[2] + (b[2] - a[2]) * t),
        ];
      };
      var rgb = function (c: number[]) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; };

      function sizeBg() {
        if (!bg || !bgCtx) return;
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        bgW = window.innerWidth;
        bgH = window.innerHeight;
        bg.width = Math.round(bgW * dpr);
        bg.height = Math.round(bgH * dpr);
        bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        bgCtx.imageSmoothingEnabled = true;
      }

      /** ぼかした円。中心が濃く、外へ向かって透明に抜ける。 */
      function blob(x: number, y: number, r: number, color: string, alpha: number) {
        var g = oc.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(' + color + ',' + alpha + ')');
        g.addColorStop(0.55, 'rgba(' + color + ',' + alpha * 0.5 + ')');
        g.addColorStop(1, 'rgba(' + color + ',0)');
        oc.fillStyle = g;
        oc.fillRect(0, 0, OFF, OFF);
      }

      /**
       * paper = 0 なら紺一色、1 なら紙が主役。
       * 本文が画面の真ん中を占めるほど 1 に近づく。
       */
      function paintBg(paper: number, time: number) {
        if (!bgCtx) return;

        // 下地: 上が持ち上がった紺、下へ向かって深く沈む
        var base = oc.createLinearGradient(0, 0, OFF * 0.35, OFF);
        base.addColorStop(0, '#0b2c58');
        base.addColorStop(0.45, '#001b42');
        base.addColorStop(1, '#00081a');
        oc.fillStyle = base;
        oc.fillRect(0, 0, OFF, OFF);

        // 紺の濃淡。ゆっくり漂わせて、面が生きているように見せる
        blob(OFF * (0.22 + Math.sin(time * 0.11) * 0.06),
             OFF * (0.18 + Math.cos(time * 0.09) * 0.05),
             OFF * 0.62, '30,72,140', 0.55);
        blob(OFF * (0.86 + Math.cos(time * 0.08) * 0.05),
             OFF * (0.82 + Math.sin(time * 0.1) * 0.05),
             OFF * 0.55, '10,42,92', 0.6);

        // 紙。画面の中央から滲み出し、paper が上がるほど広く濃くなる。
        if (paper > 0.001) {
          var pk = smoothstep(0, 1, paper);
          var cx = OFF * (0.5 + Math.sin(time * 0.07) * 0.035);
          var cy = OFF * (0.48 + Math.cos(time * 0.06) * 0.035);
          var pr = OFF * (0.46 + pk * 0.34);

          // 縁のなじみ(暖色)を先に、広めに置く
          var gw = oc.createRadialGradient(cx, cy, 0, cx, cy, pr * 1.45);
          gw.addColorStop(0, 'rgba(226,214,190,' + pk * 0.4 + ')');
          gw.addColorStop(0.6, 'rgba(226,214,190,' + pk * 0.26 + ')');
          gw.addColorStop(1, 'rgba(226,214,190,0)');
          oc.fillStyle = gw;
          oc.fillRect(0, 0, OFF, OFF);

          // 紙本体。中心から 72% までは減衰させず、そこから一気に抜く。
          // こうすると画面の左右端まで紙が届き、混ざりは四隅だけで起きる。
          var a = Math.min(pk * 1.25, 1);
          var gp = oc.createRadialGradient(cx, cy, 0, cx, cy, pr);
          gp.addColorStop(0, 'rgba(247,244,236,' + a + ')');
          gp.addColorStop(0.72, 'rgba(247,244,236,' + a + ')');
          gp.addColorStop(1, 'rgba(247,244,236,0)');
          oc.fillStyle = gp;
          oc.fillRect(0, 0, OFF, OFF);
        }

        // 金の光。常にごく薄く漂わせる(箔の反射)
        blob(OFF * (0.72 + Math.sin(time * 0.13) * 0.12),
             OFF * (0.3 + Math.cos(time * 0.12) * 0.14),
             OFF * 0.3, '224,160,32', 0.1 + paper * 0.04);

        bgCtx.clearRect(0, 0, bgW, bgH);
        bgCtx.drawImage(off, 0, 0, OFF, OFF, 0, 0, bgW, bgH);
      }

      /** 背景の混ざり具合に合わせて、文字と罫線の色を追従させる。 */
      function applyInk(paper: number) {
        var root = stage.style;
        root.setProperty('--ink', rgb(mixRgb(INK_ON_NAVY, INK_ON_PAPER, paper)));
        root.setProperty('--ink-soft', rgb(mixRgb(SOFT_ON_NAVY, SOFT_ON_PAPER, paper)));
        root.setProperty('--ink-faint', rgb(mixRgb(FAINT_ON_NAVY, FAINT_ON_PAPER, paper)));
        root.setProperty(
          '--line',
          paper > 0.5
            ? 'rgba(0,20,51,' + (0.06 + paper * 0.08).toFixed(3) + ')'
            : 'rgba(190,210,240,' + (0.2 - paper * 0.18).toFixed(3) + ')',
        );
        root.setProperty(
          '--card',
          paper > 0.5
            ? 'rgba(255,253,248,' + (0.35 + paper * 0.5).toFixed(3) + ')'
            : 'rgba(255,255,255,' + (0.05 + paper * 0.06).toFixed(3) + ')',
        );
      }

      var smoothstep = function (a: number, b: number, x: number) {
        var t = clamp01((x - a) / (b - a));
        return t * t * (3 - 2 * t);
      };

      /**
       * 紙らしさ(0=紺 / 1=紙)。
       *
       * 背景と文字色を同じ値で動かすので、途中の値では両方が中間の灰色になり、
       * コントラストが消える。そこで「遷移は本文テキストが読まれない区間で
       * 終わらせる」ように基準を取る:
       *   入り … 本文の先頭が画面下端に触れてから、画面を 1/3 ほど上がるまで
       *   抜け … 本文の末尾が画面上端へ抜けていく最後の 1/3
       * どちらもテキストが画面の中央に無い時間帯なので、
       * 読む位置では常に paper = 1(紙・濃い文字)に落ち着く。
       */
      function paperness() {
        var sets = stage.querySelectorAll('.set');
        if (!sets.length) return 0;
        var vh = window.innerHeight;
        var span = vh * 0.34;

        // 入りは表紙(cover)の抜け際を基準にする。本文の先頭で測ると、
        // 表紙のテキストがまだ画面に残っているうちに地色が紙へ変わり、
        // 明るい前提の見出しが紙の上に乗って読めなくなる。
        var enter = 1;
        var cover = stage.querySelector('.cover');
        if (cover) enter = smoothstep(0, span, vh * 0.45 - cover.getBoundingClientRect().bottom);

        // 抜けは本文の末尾ではなく巻末セクションを基準にする。
        // 本文末尾で測ると、巻末(紺)が画面に入ってきても本文の下端がまだ
        // 画面内に残っているため、いつまでも紙のままになる。
        var exit = 1;
        var colo = stage.querySelector('.colophon-cover');
        if (colo) exit = smoothstep(0, span, colo.getBoundingClientRect().top - vh * 0.34);

        return Math.min(enter, exit);
      }

      var bgTime = 0;
      var lastPaper = -1;
      function bgFrame(now: number) {
        trackRaf(bgFrame);
        bgTime = now / 1000;
        var pv = paperness();
        paintBg(pv, bgTime);
        // 色の書き換えは変化があったときだけ(毎フレームの再計算を避ける)
        if (Math.abs(pv - lastPaper) > 0.004) {
          applyInk(pv);
          lastPaper = pv;
        }
      }

      if (bg) {
        sizeBg();
        on(window, 'resize', function () { sizeBg(); });
        applyInk(paperness());
        if (reduce) {
          // 動きを減らす設定では、時間による漂いを止めて一度だけ描く
          paintBg(paperness(), 0);
          window.addEventListener('scroll', function () {
            var pv = paperness();
            paintBg(pv, 0);
            applyInk(pv);
          }, { passive: true });
        } else {
          trackRaf(bgFrame);
        }
      }

      var revealTargets = stage.querySelectorAll('.reveal');
      if (reduce || !('IntersectionObserver' in window)) {
        revealTargets.forEach(function (el) { el.classList.add('shown'); });
      } else {
        var revealIO = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (e) {
              if (!e.isIntersecting) return;
              e.target.classList.add('shown');
              revealIO.unobserve(e.target);
            });
          },
          // 画面に入る手前(下端の 15% 外)で発火させ、読む位置に来たときには
          // 表示が終わっているようにする
          { threshold: 0, rootMargin: '0px 0px 15% 0px' },
        );
        revealTargets.forEach(function (el) { revealIO.observe(el); });
      }

      var railLabel = stage.querySelector('#railLabel') as HTMLElement | null;
      type Chapter = { el: Element; text: string };
      var chapters: Chapter[] = Array.prototype.map.call(
        stage.querySelectorAll('[data-chapter]'),
        function (el: Element): Chapter {
          return { el: el, text: el.getAttribute('data-chapter') || '' };
        },
      ) as Chapter[];
      var currentChapter = '';

      var progressBar = stage.querySelector('.progress') as HTMLElement | null;

      function update() {
        var vh = window.innerHeight;

        /* --- ページ全体の進捗(上端のバー + 章インジケーターの金線) --- */
        var max = document.documentElement.scrollHeight - vh;
        var sp = max > 0 ? clamp01(window.scrollY / max) : 0;
        if (progressBar) progressBar.style.setProperty('--sp', sp.toFixed(4));
        var rail = stage.querySelector('.rail') as HTMLElement | null;
        if (rail) rail.style.setProperty('--sp', sp.toFixed(4));

        /* --- 各要素の進行度 --- */
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          var r = it.el.getBoundingClientRect();
          var p;
          if (it.cover) {
            // 表紙は「画面から出ていくまで」を 0→1 にして、退場の視差に使う
            p = clamp01(-r.top / Math.max(r.height * 0.85, 1));
          } else {
            // 本文は下から入り始めて画面の 45% に達するまでを 0→1
            var start = vh * 0.95;
            var end = vh * 0.42;
            p = clamp01((start - r.top) / (start - end));
          }
          it.el.style.setProperty('--p', p.toFixed(4));
        }

        /* --- 章インジケーターの文字を、画面中央に近い章に合わせる --- */
        var best: Chapter | null = null;
        var bestDist = Infinity;
        for (var c = 0; c < chapters.length; c++) {
          var cr = chapters[c].el.getBoundingClientRect();
          if (cr.bottom < 0 || cr.top > vh) continue;
          var dist = Math.abs(cr.top + cr.height / 2 - vh / 2);
          if (dist < bestDist) { bestDist = dist; best = chapters[c]; }
        }
        var next = best ? best.text : 'ABOUT SHUTTLEMATCH';
        if (next !== currentChapter && railLabel) {
          const label = railLabel;
          currentChapter = next;
          label.classList.add('swap');
          setTimeout(function () {
            label.textContent = next;
            label.classList.remove('swap');
          }, 200);
        }
      }

      var queued = false;
      function onScroll() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; update(); });
      }

      if (reduce) {
        if (railLabel) railLabel.textContent = 'ABOUT SHUTTLEMATCH';
      } else {
        update();
        on(window, 'scroll', onScroll, { passive: true });
        on(window, 'resize', update);
      }

      /* =====================================================
         表紙で舞うシャトル(canvas 2D)
         実物のシャトルコックの抗力(k = ρ·Cd·A / 2m ≒ 0.252 /m)で積分する。
         終端速度は約 6.2 m/s。上りは伸びて下りは急に落ちる——
         放物線ではないこの弧が、シャトルだけが持つ形。
         ===================================================== */
      var DRAG_K = 0.252;
      var G = 9.81;

      function buildTrail() {
        var vx = 16 + Math.random() * 16;
        var vy = 17 + Math.random() * 12;
        var dir = Math.random() < 0.5 ? 1 : -1;
        var x = dir > 0 ? 0.5 : 12.9;
        var y = 1.0 + Math.random() * 0.5;
        var pts = [];
        for (var i = 0; i < 1500; i++) {
          var sp = Math.hypot(vx, vy);
          vx += -DRAG_K * sp * vx * (1 / 120);
          vy += (-DRAG_K * sp * vy - G) * (1 / 120);
          x += dir * vx * (1 / 120);
          y += vy * (1 / 120);
          if (y <= 0 || x < -1 || x > 14.4) break;
          pts.push([x / 13.4, 1 - y / 9]);
        }
        return pts;
      }

      function startTrails(el: HTMLCanvasElement | null) {
        if (!el) return;
        const canvas = el;
        const maybeCtx = canvas.getContext('2d');
        if (!maybeCtx) return;
        const ctx: CanvasRenderingContext2D = maybeCtx;
        var w = 0, h = 0;
        var trails: Array<{ pts: number[][]; age: number; life: number; draw: number }> = [];
        var raf = 0, spawnAt = 0, t = 0;

        function resize() {
          var r = canvas.getBoundingClientRect();
          if (!r.width || !r.height) return;
          var dpr = Math.min(window.devicePixelRatio || 1, 2);
          w = r.width; h = r.height;
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);

        if (reduce) {
          for (var k = 0; k < 3; k++) {
            var pts = buildTrail();
            for (var j = 1; j < pts.length; j++) {
              ctx.strokeStyle = 'rgba(237,187,78,0.22)';
              ctx.lineWidth = 1.1;
              ctx.beginPath();
              ctx.moveTo(pts[j - 1][0] * w, pts[j - 1][1] * h);
              ctx.lineTo(pts[j][0] * w, pts[j][1] * h);
              ctx.stroke();
            }
          }
          return;
        }

        function frame(now: number) {
          raf = trackRaf(frame);
          var dt = t ? Math.min((now - t) / 1000, 0.05) : 0.016;
          t = now;
          if (now > spawnAt) {
            trails.push({ pts: buildTrail(), age: 0, life: 7.5, draw: 0 });
            if (trails.length > 5) trails.shift();
            spawnAt = now + 1500 + Math.random() * 1600;
          }
          ctx.clearRect(0, 0, w, h);
          for (var i = 0; i < trails.length; i++) {
            var tr = trails[i];
            tr.age += dt;
            tr.draw = Math.min(tr.draw + dt / 1.5, 1);
            var n = Math.floor(tr.pts.length * tr.draw);
            if (n < 2) continue;
            var fade = tr.age > tr.life - 2 ? Math.max((tr.life - tr.age) / 2, 0) : 1;
            for (var j2 = 1; j2 < n; j2++) {
              var p0 = tr.pts[j2 - 1], p1 = tr.pts[j2];
              var a = (j2 / n) * 0.5 * fade;
              ctx.strokeStyle = 'rgba(237,187,78,' + a.toFixed(3) + ')';
              ctx.lineWidth = 0.6 + (j2 / n) * 1.5;
              ctx.beginPath();
              ctx.moveTo(p0[0] * w, p0[1] * h);
              ctx.lineTo(p1[0] * w, p1[1] * h);
              ctx.stroke();
            }
            var tip = tr.pts[n - 1];
            ctx.fillStyle = 'rgba(247,224,168,' + (0.85 * fade).toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(tip[0] * w, tip[1] * h, 2.1, 0, Math.PI * 2);
            ctx.fill();
          }
          trails = trails.filter(function (x) { return x.age < x.life; });
        }

        // 画面外では回さない
        if ('IntersectionObserver' in window) {
          new IntersectionObserver(function (es) {
            if (es[0].isIntersecting && !raf) { t = 0; raf = trackRaf(frame); }
            else if (!es[0].isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
          }, { threshold: 0 }).observe(canvas);
        } else {
          raf = trackRaf(frame);
        }
      }

      startTrails(stage.querySelector('#trails'));
      startTrails(stage.querySelector('#trails2'));


      return function dispose() {
        cleanups.forEach(function (f) { f(); });
        rafIds.forEach(function (id) { cancelAnimationFrame(id); });
      };

}

function AboutPage() {
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    return startAboutStage(stage)
  }, [])

  return (
    // 親レイアウト(max-w-5xl + padding)を抜けて全幅で敷く
    <div
      ref={stageRef}
      className="about-stage relative left-1/2 -my-6 w-screen -translate-x-1/2"
    >
      <canvas id="bg" aria-hidden />

      <div className="progress" aria-hidden><i></i></div>

      <div className="rail" aria-hidden>
        <span className="rail-line"></span>
        <span className="rail-label" id="railLabel">ABOUT SHUTTLEMATCH</span>
      </div>

      <header className="cover" data-scroll="cover" data-chapter="ABOUT SHUTTLEMATCH">
        <canvas id="trails" aria-hidden />
        <div className="sheet cover-inner">
          <div className="brand">
            <i className="brand-rule"></i>
            <span className="brand-name">SHUTTLEMATCH</span>
          </div>

          <h1 className="cover-head">
            <span className="line-mask"><span>コートの上の</span></span>
            <span className="line-mask"><span className="foil">ことだけを。</span></span>
          </h1>

          <p className="cover-lede">
            バドミントン練習会の試合表を、自動でつくって共有する。
            組み合わせに悩む時間を、ぜんぶラリーの時間に変えるために。
          </p>

          <div className="cta-row">
            <Link className="btn btn-gold" to="/organizer/rooms/new">
              試合表を作ってみる
            </Link>
            <Link className="btn btn-outline" to="/">
              今日のルームを見る
            </Link>
          </div>
        </div>

        <div className="scroll-cue"><span>SCROLL</span><i></i></div>
      </header>

      <main className="body-wrap">

        <section className="set sheet" data-chapter="SET 01 — 公平さ">
          <div className="reveal">
            <div className="set-mark reveal"><i></i><span>SET</span><b className="num">01</b><span>公平さ</span></div>
          </div>
          <div className="split">
            <div className="col">
              <h2 className="set-title reveal">
                <span className="line-mask" style={{ '--d': '0' } as CSSProperties}><span>出場回数の差は、</span></span>
                <span className="line-mask" style={{ '--d': '.14' } as CSSProperties}><span>いつでも 1 以内。</span></span>
              </h2>
              <div className="reveal">
                <p className="set-body">
                  誰が何回出たかをずっと数えながら、次のセットの出場者を選びます。
                  たくさん休む人も、出ずっぱりの人も出しません。
                </p>
                <p className="set-body">
                  連続の休みはゼロ、連続の出場も抑えて、身体にもやさしい輪番に。
                </p>
              </div>
            </div>
            <div className="reveal">
              <div className="fair">
                <p className="fair-num foil num" style={{ margin: '0' }}>1<small>以内</small></p>
                <div className="bars">
                  <div className="bar-col"><div className="bar" style={{ height: '72%', '--d': '0' } as CSSProperties}></div><span className="bar-cap num">4</span></div>
                  <div className="bar-col top"><div className="bar" style={{ height: '90%', '--d': '.06' } as CSSProperties}></div><span className="bar-cap num">5</span></div>
                  <div className="bar-col"><div className="bar" style={{ height: '72%', '--d': '.12' } as CSSProperties}></div><span className="bar-cap num">4</span></div>
                  <div className="bar-col"><div className="bar" style={{ height: '72%', '--d': '.18' } as CSSProperties}></div><span className="bar-cap num">4</span></div>
                  <div className="bar-col top"><div className="bar" style={{ height: '90%', '--d': '.24' } as CSSProperties}></div><span className="bar-cap num">5</span></div>
                  <div className="bar-col"><div className="bar" style={{ height: '72%', '--d': '.3' } as CSSProperties}></div><span className="bar-cap num">4</span></div>
                </div>
              </div>
              <p className="fair-foot"><span>6名・8セットの出場回数</span><span className="num">最大 5 − 最小 4 = 1</span></p>
            </div>
          </div>
        </section>


        <section className="set sheet" data-chapter="SET 02 — 混ざり">
          <div className="reveal">
            <div className="set-mark reveal"><i></i><span>SET</span><b className="num">02</b><span>混ざり</span></div>
          </div>
          <div className="split rev">
            <div className="reveal">
              <div className="courts">
                <div className="court-row" style={{ '--d': '0' } as CSSProperties}>
                  <span className="num">SET 1</span>
                  <svg viewBox="0 0 200 82" role="img" aria-label="第1セット: 1番は2番と組み、3番・4番と対戦">
                    <rect className="frame" x="1" y="1" width="198" height="80" />
                    <line className="mid" x1="100" y1="1" x2="100" y2="81" />
                    <path className="tie" d="M52,26 V56" stroke="var(--gold)" />
                    <circle cx="52" cy="26" r="11" fill="var(--gold)" stroke="var(--gold)" stroke-width="1.4" />
                    <text x="52" y="26" fill="#241500" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central">1</text>
                    <circle cx="52" cy="56" r="11" fill="var(--card)" stroke="var(--ink-faint)" stroke-width="1.4" />
                    <text x="52" y="56" fill="var(--ink-soft)" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central">2</text>
                    <path className="tie" d="M148,26 V56" stroke="var(--ink-faint)" />
                    <circle cx="148" cy="26" r="11" fill="var(--card)" stroke="var(--ink-faint)" stroke-width="1.4" />
                    <text x="148" y="26" fill="var(--ink-soft)" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central">3</text>
                    <circle cx="148" cy="56" r="11" fill="var(--card)" stroke="var(--ink-faint)" stroke-width="1.4" />
                    <text x="148" y="56" fill="var(--ink-soft)" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central">4</text>
                  </svg>
                </div>
                <div className="court-row" style={{ '--d': '.1' } as CSSProperties}>
                  <span className="num">SET 2</span>
                  <svg viewBox="0 0 200 82" role="img" aria-label="第2セット: 1番は3番と組み、2番・4番と対戦">
                    <rect className="frame" x="1" y="1" width="198" height="80" />
                    <line className="mid" x1="100" y1="1" x2="100" y2="81" />
                    <path className="tie" d="M52,26 V56" stroke="var(--gold)" />
                    <circle cx="52" cy="26" r="11" fill="var(--gold)" stroke="var(--gold)" stroke-width="1.4" />
                    <text x="52" y="26" fill="#241500" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central">1</text>
                    <circle cx="52" cy="56" r="11" fill="var(--card)" stroke="var(--ink-faint)" stroke-width="1.4" />
                    <text x="52" y="56" fill="var(--ink-soft)" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central">3</text>
                    <path className="tie" d="M148,26 V56" stroke="var(--ink-faint)" />
                    <circle cx="148" cy="26" r="11" fill="var(--card)" stroke="var(--ink-faint)" stroke-width="1.4" />
                    <text x="148" y="26" fill="var(--ink-soft)" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central">2</text>
                    <circle cx="148" cy="56" r="11" fill="var(--card)" stroke="var(--ink-faint)" stroke-width="1.4" />
                    <text x="148" y="56" fill="var(--ink-soft)" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central">4</text>
                  </svg>
                </div>
                <div className="court-row" style={{ '--d': '.2' } as CSSProperties}>
                  <span className="num">SET 3</span>
                  <svg viewBox="0 0 200 82" role="img" aria-label="第3セット: 1番は4番と組み、2番・3番と対戦">
                    <rect className="frame" x="1" y="1" width="198" height="80" />
                    <line className="mid" x1="100" y1="1" x2="100" y2="81" />
                    <path className="tie" d="M52,26 V56" stroke="var(--gold)" />
                    <circle cx="52" cy="26" r="11" fill="var(--gold)" stroke="var(--gold)" stroke-width="1.4" />
                    <text x="52" y="26" fill="#241500" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central">1</text>
                    <circle cx="52" cy="56" r="11" fill="var(--card)" stroke="var(--ink-faint)" stroke-width="1.4" />
                    <text x="52" y="56" fill="var(--ink-soft)" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central">4</text>
                    <path className="tie" d="M148,26 V56" stroke="var(--ink-faint)" />
                    <circle cx="148" cy="26" r="11" fill="var(--card)" stroke="var(--ink-faint)" stroke-width="1.4" />
                    <text x="148" y="26" fill="var(--ink-soft)" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central">2</text>
                    <circle cx="148" cy="56" r="11" fill="var(--card)" stroke="var(--ink-faint)" stroke-width="1.4" />
                    <text x="148" y="56" fill="var(--ink-soft)" font-size="12" font-weight="800" text-anchor="middle" dominant-baseline="central">3</text>
                  </svg>
                </div>
              </div>
              <p className="set-note">1番の人は毎セット違う相手と組む。4人なら組み方は3通りしかないので、その全部を使い切る。</p>
            </div>
            <div className="col">
              <h2 className="set-title reveal">
                <span className="line-mask" style={{ '--d': '0' } as CSSProperties}><span>同じ顔ぶれで、</span></span>
                <span className="line-mask" style={{ '--d': '.14' } as CSSProperties}><span>固まらない。</span></span>
              </h2>
              <div className="reveal">
                <p className="set-body">
                  「またこの4人…」をなくすため、誰と誰が同じコートに入ったかを全ペアぶん記録します。
                  毎セット、できるだけ新鮮な顔合わせになる組み合わせを探索します。
                </p>
                <p className="set-body">
                  試合表を何通りも作って、いちばん混ざったものだけをお出しします。
                </p>
                <a className="set-link" href="/about/algorithm">
                  アルゴリズムの中身をゼロから学ぶ<em>→</em>
                </a>
              </div>
            </div>
          </div>
        </section>


        <section className="set sheet" data-chapter="SET 03 — 当日運営">
          <div className="reveal">
            <div className="set-mark reveal"><i></i><span>SET</span><b className="num">03</b><span>当日運営</span></div>
          </div>
          <div className="split top">
            <div className="col">
              <h2 className="set-title reveal">
                <span className="line-mask" style={{ '--d': '0' } as CSSProperties}><span>当日の「いつもの」に、</span></span>
                <span className="line-mask" style={{ '--d': '.14' } as CSSProperties}><span>ぜんぶ対応。</span></span>
              </h2>
              <div className="reveal">
                <p className="set-body">
                  人は遅れて来るし、先に帰る。急に1セット増える。
                  現場で起きることは、だいたい決まっています。
                </p>
              </div>
            </div>
            <ul className="ops reveal">
              <li style={{ '--d': '0' } as CSSProperties}>
                <span className="ops-no num">01</span>
                <div><h3>受付モード</h3><p>リンクを共有するだけ。参加者が名前を書くと番号が決まります。</p></div>
              </li>
              <li style={{ '--d': '.08' } as CSSProperties}>
                <span className="ops-no num">02</span>
                <div><h3>遅刻・早退・途中参加</h3><p>未開始のセットだけをワンタップで組み直し。消化済みの試合はそのまま。</p></div>
              </li>
              <li style={{ '--d': '.16' } as CSSProperties}>
                <span className="ops-no num">03</span>
                <div><h3>セット追加</h3><p>「もう1セットだけ」も、公平さと混ざりを引き継いで継ぎ足せます。</p></div>
              </li>
              <li style={{ '--d': '.24' } as CSSProperties}>
                <span className="ops-no num">04</span>
                <div><h3>固定ペア</h3><p>いつも一緒に組みたい2人は、ずっと同じチームに。</p></div>
              </li>
            </ul>
          </div>
        </section>


        <section className="set sheet" data-chapter="SET 04 — 通知">
          <div className="reveal">
            <div className="set-mark reveal"><i></i><span>SET</span><b className="num">04</b><span>通知</span></div>
          </div>
          <div className="split rev">
            <div className="reveal">
              <div className="notice">
                <p className="notice-top"><i></i>SHUTTLEMATCH</p>
                <p className="notice-msg">第3セットが始まりました</p>
                <p className="notice-sub">あなたの試合です・コート2</p>
              </div>
            </div>
            <div className="col">
              <h2 className="set-title reveal">
                <span className="line-mask" style={{ '--d': '0' } as CSSProperties}><span>「次、あなたの試合です」</span></span>
                <span className="line-mask" style={{ '--d': '.14' } as CSSProperties}><span>まで届く。</span></span>
              </h2>
              <div className="reveal">
                <p className="set-body">
                  モバイルアプリなら、セット開始をプッシュ通知でお知らせ。
                  自分の番号を設定しておけば、第何セットのどのコートかまで教えてくれます。
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="colophon-cover" data-chapter="ABOUT SHUTTLEMATCH">
        <canvas id="trails2" aria-hidden />
        <div className="sheet">
          <h2 className="colophon-head reveal">今日の練習会から、<br /><span className="foil">どうぞ。</span></h2>
          <div className="cta-row reveal">
            <Link className="btn btn-gold" to="/organizer/rooms/new">
              ルームを作成する
            </Link>
            <Link className="btn btn-outline" to="/">
              ルーム一覧へ
            </Link>
          </div>
          <p className="imprint">
            <span>SHUTTLEMATCH</span><span>バドミントンの試合表を、公平に</span><span>SPRING BOOT / REACT</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
