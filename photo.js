/* Фото-рендер: накопление многих кадров. В каждом кадре солнце чуть смещено (мягкая полутень), а второй источник
   с тенями стоит в новом месте — на небе (вид сверху) или внутри комнаты (вид изнутри). Среднее даёт мягкий свет и тени в углах. */
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
let R = null;
function init(renderer) {
  if (R) return R;
  const geo = new THREE.PlaneGeometry(2, 2), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blend = new THREE.ShaderMaterial({ uniforms: { a: { value: null }, b: { value: null }, k: { value: 1 } }, vertexShader: VS, fragmentShader: 'uniform sampler2D a; uniform sampler2D b; uniform float k; varying vec2 vUv; void main(){ gl_FragColor = mix(texture2D(a, vUv), texture2D(b, vUv), k); }', depthTest: false, depthWrite: false, toneMapped: false });
  const show = new THREE.ShaderMaterial({ uniforms: { a: { value: null } }, vertexShader: VS, fragmentShader: 'uniform sampler2D a; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(a, vUv).rgb, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}', depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(geo, blend), sc = new THREE.Scene(); sc.add(quad);
  const sky = new THREE.DirectionalLight('#dfeaff', 0); sky.castShadow = true; sky.shadow.mapSize.set(2048, 2048); sky.shadow.bias = -0.0005; sky.shadow.normalBias = 0.03; Object.assign(sky.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 60 });
  const bulb = new THREE.PointLight('#fff3e2', 0, 0, 1.2); bulb.castShadow = true; bulb.shadow.mapSize.set(1024, 1024); bulb.shadow.bias = -0.002; bulb.shadow.normalBias = 0.03; bulb.shadow.camera.near = 0.05; bulb.shadow.camera.far = 30;
  R = { cam, blend, show, quad, sc, sky, bulb, rts: null, run: 0 };
  return R;
}
function targets(renderer) {
  const s = renderer.getDrawingBufferSize(new THREE.Vector2()), w = s.x, h = s.y;
  if (R.rts && R.rts[0].width === w && R.rts[0].height === h) return R.rts;
  if (R.rts) R.rts.forEach(t => t.dispose());
  const mk = depth => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: depth, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  R.rts = [mk(true), mk(false), mk(false)]; return R.rts;
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/* opts: { renderer, scene, camera, sun, hemi, samples, inside, room:{x1,z1,x2,z2,h}, onProgress(i,n), onDone(ok) }. Возвращает функцию отмены. */
export function renderPhoto(o) {
  const { renderer, scene, camera, sun, hemi } = o, N = o.samples || 96; init(renderer);
  const [cur, accA, accB] = targets(renderer); let acc = [accA, accB], i = 0; const id = ++R.run;
  const keep = { sunP: sun.position.clone(), sunI: sun.intensity, hemiI: hemi.intensity, exp: renderer.toneMappingExposure, env: scene.environmentIntensity, bg: scene.backgroundIntensity };
  const w = cur.width, h = cur.height, base = sun.position.clone();
  scene.add(R.sky); scene.add(R.sky.target); scene.add(R.bulb); seed = 7;
  const gl = (o.matte || []).map(m => [m, m.roughness]); if (o.inside) { hemi.intensity = keep.hemiI * 0.45; gl.forEach(([m]) => { m.roughness = 0.7; }); } else hemi.intensity = keep.hemiI * 0.3;
  const restore = () => { gl.forEach(([m, r]) => { m.roughness = r; }); sun.position.copy(keep.sunP); sun.intensity = keep.sunI; hemi.intensity = keep.hemiI; renderer.toneMappingExposure = keep.exp; scene.remove(R.sky); scene.remove(R.sky.target); scene.remove(R.bulb); camera.clearViewOffset(); renderer.setRenderTarget(null); };
  const present = () => { R.quad.material = R.show; R.show.uniforms.a.value = acc[0].texture; renderer.setRenderTarget(null); renderer.render(R.sc, R.cam); };
  function step() {
    if (id !== R.run) return;
    const per = o.fast ? 1 : 2;
    for (let s = 0; s < per && i < N; s++, i++) {
      // солнце: диск ~2.5°, чтобы край тени был мягким
      sun.position.set(base.x + (rnd() - 0.5) * 1.3, base.y + (rnd() - 0.5) * 0.6, base.z + (rnd() - 0.5) * 1.3);
      if (o.inside && o.room) {   // свет «от комнаты»: лампа в случайной точке под потолком — мягкие тени под мебелью и в углах
        const r = o.room, m = 0.35; R.sky.intensity = 0;
        R.bulb.position.set(r.x1 + m + rnd() * Math.max(0.1, r.x2 - r.x1 - 2 * m), r.h - 0.25 - rnd() * 0.9, r.z1 + m + rnd() * Math.max(0.1, r.z2 - r.z1 - 2 * m)); R.bulb.intensity = o.night ? 4 : 1.7;
        sun.intensity = o.night ? 0 : keep.sunI * 1.25;
      } else {    // небо: направление из верхней полусферы
        const u = rnd(), v = rnd(), el = Math.asin(Math.sqrt(0.04 + 0.96 * u)), az = v * Math.PI * 2, d = 26;
        R.sky.position.set(Math.cos(el) * Math.cos(az) * d, Math.sin(el) * d, Math.cos(el) * Math.sin(az) * d); R.sky.target.position.set(0, 0, 0); R.sky.intensity = 1.5; R.bulb.intensity = 0; sun.intensity = keep.sunI * 0.8;
      }
      camera.setViewOffset(w, h, rnd() - 0.5, rnd() - 0.5, w, h);
      renderer.setRenderTarget(cur); renderer.render(scene, camera);
      R.quad.material = R.blend; R.blend.uniforms.a.value = acc[0].texture; R.blend.uniforms.b.value = cur.texture; R.blend.uniforms.k.value = 1 / (i + 1);
      renderer.setRenderTarget(acc[1]); renderer.render(R.sc, R.cam); acc.reverse();
    }
    present(); o.onProgress && o.onProgress(i, N);
    if (i < N) requestAnimationFrame(step); else { present(); restore(); o.onDone && o.onDone(true); }
  }
  requestAnimationFrame(step);
  return () => { if (id === R.run) { R.run++; restore(); o.onDone && o.onDone(false); } };
}
