/* ============================================================
   Stellars Lab — 背景・スクロール演出 (fx.js)
   index.html / en/index.html 共用。
   構成: 1. Lenis慣性スクロール(お試し) / 2. GSAPスクロール登場アニメ / 3. WebGL星空
   JS無効・CDN失敗時はコンテンツがそのまま表示される（演出は上乗せのみ）
   ============================================================ */

const ENABLE_LENIS = true; // ← falseにすると慣性スクロールを完全無効化（お試し導入のため戻せる）

import * as THREE from 'three';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 600px)').matches;

// moduleスクリプトはdeferスクリプト(gsap/lenis)より先に実行されうるため、
// DOMContentLoaded（＝defer全完了後）を待ってから初期化する
// 注: module実行時のreadyStateは'interactive'なので'loading'判定では検知できない
let fxStarted = false;
function start() {
  if (fxStarted) return;
  fxStarted = true;
  init();
}
if (document.readyState === 'complete') {
  start();
} else {
  document.addEventListener('DOMContentLoaded', start);
  window.addEventListener('load', start); // DCL後にmodule評価された場合の保険
}

function init() {

/* ---------- 1. Lenis 慣性スクロール（お試し） ---------- */
if (ENABLE_LENIS && !reduceMotion && window.Lenis && window.gsap && window.ScrollTrigger) {
  // Lenisが自らhtmlに'lenis'クラスを付与する（CSS側はそれを使ってscroll-behavior:smoothを無効化）
  const lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // ページ内アンカーはLenis経由で滑らかに（固定ヘッダー分オフセット）
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -72 });
    });
  });
}

/* ---------- 2. スクロール登場アニメ (GSAP + ScrollTrigger) ---------- */
if (!reduceMotion && window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);

  // Hero: バッジ → 見出し → リード文の順に登場
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('.hero-badge', { y: 18, opacity: 0, duration: 0.7 })
    .from('.hero h1',    { y: 26, opacity: 0, duration: 0.9 }, '-=0.45')
    .from('.hero p',     { y: 18, opacity: 0, duration: 0.8 }, '-=0.6');

  // セクション内要素: ビューポート進入でフェードアップ
  // 初期非表示はここ(JS)で設定するため、JS無効環境では最初から全て見える
  const targets = gsap.utils.toArray(
    '.section-label, .section h2, .section-desc, .news-item, .tool-card, .product-card, .writing-card, .profile-card'
  );
  gsap.set(targets, { opacity: 0, y: 24 });
  ScrollTrigger.batch(targets, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: 0.7, stagger: 0.07, ease: 'power2.out', overwrite: true }),
  });
  ScrollTrigger.refresh(); // 初期表示時に画面内へ入っている要素の取りこぼし防止
  // リロード時のスクロール位置復元はload後に起きるため、復元後にもう一度再評価する
  const lateRefresh = () => setTimeout(() => {
    ScrollTrigger.refresh();
    // 最終保険: 画面内に入っているのに非表示のまま残った要素を表示する（コンテンツ欠けゼロ保証）
    targets.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0 && gsap.getProperty(el, 'opacity') === 0) {
        gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', overwrite: true });
      }
    });
  }, 300);
  if (document.readyState === 'complete') lateRefresh();
  else window.addEventListener('load', lateRefresh);
}

/* ---------- 3. WebGL星空（ブランド3色のパーティクル） ---------- */
const canvas = document.getElementById('bg-fx');
if (canvas && !reduceMotion) {
  try {
    initStarfield(canvas);
  } catch (e) {
    canvas.style.display = 'none'; // WebGL不可時はCSSの星雲グラデにフォールバック
  }
} else if (canvas) {
  canvas.style.display = 'none';
}

} // init() ここまで

function initStarfield(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.z = 30;

  const COUNT = isMobile ? 600 : 1500; // モバイルは負荷軽減のため削減
  const positions = new Float32Array(COUNT * 3);
  const starColors = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const phases = new Float32Array(COUNT);

  const palette = [
    new THREE.Color('#ffffff'), // 白（基調）
    new THREE.Color('#ffe08a'), // ゴールド
    new THREE.Color('#8f88d8'), // インディゴ
  ];
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 130;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 95;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 70 - 30; // カメラ(z=30)の手前20〜遠方95に収め、巨大な前ボケ星を防ぐ
    const c = palette[Math.random() < 0.62 ? 0 : Math.random() < 0.5 ? 1 : 2];
    starColors[i * 3] = c.r;
    starColors[i * 3 + 1] = c.g;
    starColors[i * 3 + 2] = c.b;
    sizes[i] = 0.5 + Math.random() * 1.4;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vColor = aColor;
        vTwinkle = 0.55 + 0.45 * sin(uTime * (0.5 + aPhase * 0.22) + aPhase * 7.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(aSize * uPixelRatio * (90.0 / -mv.z), 7.0 * uPixelRatio);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.05, d) * vTwinkle * 0.85;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // スクロール量→カメラ縦移動 / マウス→視線の微パララックス
  let scrollY = window.scrollY;
  let mouseX = 0;
  let mouseY = 0;
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  window.addEventListener('pointermove', (e) => {
    mouseX = e.clientX / window.innerWidth - 0.5;
    mouseY = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    material.uniforms.uTime.value = t;
    points.rotation.y = t * 0.008; // 星野全体がごくゆっくり回る
    camera.position.y = -scrollY * 0.004;
    camera.rotation.x += (-mouseY * 0.04 - camera.rotation.x) * 0.05;
    camera.rotation.y += (-mouseX * 0.04 - camera.rotation.y) * 0.05;
    renderer.render(scene, camera);
  });
}
