// Dawnbell graphics pipeline: quality tiers, post-processing (ambient occlusion, bloom,
// colour grading, vignette), atmospheric height fog with sun glow, and dynamic resolution
// so phones stay smooth.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export type GfxTier = 'low' | 'medium' | 'high';
export type GfxSetting = 'auto' | GfxTier;

const GFX_KEY = 'dawnbell-gfx';
const SETTINGS: GfxSetting[] = ['auto', 'low', 'medium', 'high'];

/* ---------------- Atmospheric fog (patched into every built-in material) ----------------
 * The uniform values are Float32Arrays, which three.js shares by reference when it clones
 * built-in uniforms, so one update per frame reaches every material in the scene. */
const atmoSunDir = new Float32Array([0.45, 0.7, 0.35]);
const atmoSunCol = new Float32Array([1, 0.94, 0.78]);
// x = height-fog base Y, y = height falloff, z = height-fog density, w = enabled (0/1)
const atmoParams = new Float32Array([0, 0.11, 0.012, 1]);
const atmoInvView = new Float32Array(16);
new THREE.Matrix4().toArray(atmoInvView);

let atmoInstalled = false;
function installAtmosphere(): void {
  if (atmoInstalled) return;
  atmoInstalled = true;
  const C = THREE.ShaderChunk as unknown as Record<string, string>;
  C.fog_pars_vertex = `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vAtmoWorld;
  uniform mat4 uAtmoInvView;
#endif`;
  C.fog_vertex = `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vAtmoWorld = ( uAtmoInvView * vec4( mvPosition.xyz, 1.0 ) ).xyz;
#endif`;
  C.fog_pars_fragment = `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vAtmoWorld;
  uniform vec3 uAtmoSunDir;
  uniform vec3 uAtmoSunCol;
  uniform vec4 uAtmoParams;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  C.fog_fragment = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  vec3 atmoFogCol = fogColor;
  if ( uAtmoParams.w > 0.5 ) {
    vec3 atmoRay = vAtmoWorld - cameraPosition;
    float atmoDist = length( atmoRay );
    vec3 atmoDir = atmoRay / max( atmoDist, 0.0001 );
    // Low-lying valley haze: thick near the ground, clearing with height.
    float atmoH = exp( - max( vAtmoWorld.y - uAtmoParams.x, 0.0 ) * uAtmoParams.y );
    float atmoHaze = ( 1.0 - exp( - atmoDist * uAtmoParams.z ) ) * atmoH;
    fogFactor = clamp( fogFactor + atmoHaze * ( 1.0 - fogFactor ) * 0.32, 0.0, 1.0 );
    // Light scattering: haze glows warm when looking toward the sun.
    float atmoSun = pow( max( dot( atmoDir, normalize( uAtmoSunDir ) ), 0.0 ), 6.0 );
    atmoFogCol = mix( fogColor, uAtmoSunCol, atmoSun * 0.45 );
  }
  gl_FragColor.rgb = mix( gl_FragColor.rgb, atmoFogCol, fogFactor );
#endif`;
  const L = THREE.ShaderLib as unknown as Record<string, { uniforms: Record<string, THREE.IUniform> }>;
  for (const key of Object.keys(L)) {
    const u = L[key].uniforms;
    if (!u || !('fogColor' in u)) continue;
    u.uAtmoSunDir = { value: atmoSunDir };
    u.uAtmoSunCol = { value: atmoSunCol };
    u.uAtmoParams = { value: atmoParams };
    u.uAtmoInvView = { value: atmoInvView };
  }
}

/* ---------------- Final colour grade (runs in display space, after tone mapping) ---------------- */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uContrast: { value: 1.08 },
    uSaturation: { value: 1.1 },
    uVignette: { value: 0.28 },
    uShadowTint: { value: new THREE.Vector3(-0.012, 0.0, 0.022) },
    uHighTint: { value: new THREE.Vector3(0.02, 0.01, -0.016) },
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uContrast, uSaturation, uVignette, uTime;
    uniform vec3 uShadowTint, uHighTint;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = src.rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      c = (c - 0.5) * uContrast + 0.5;
      // Split toning: cool shadows, warm highlights.
      c += uShadowTint * (1.0 - smoothstep(0.0, 0.5, l)) + uHighTint * smoothstep(0.5, 1.0, l);
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * 1.6;
      c *= mix(1.0, smoothstep(0.0, 1.0, v), uVignette);
      // Tiny dither hides banding in the sky gradient.
      c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
    }`,
};

export interface TierSpec {
  pixelRatioCap: number;
  shadows: boolean;
  shadowMap: number;
  shadowRadius: number;
  post: boolean;
  ao: boolean;
  bloom: boolean;
  msaa: number;
  atmosphere: boolean;
}

export const TIERS: Record<GfxTier, TierSpec> = {
  low: { pixelRatioCap: 1, shadows: true, shadowMap: 1024, shadowRadius: 1, post: false, ao: false, bloom: false, msaa: 0, atmosphere: true },
  medium: { pixelRatioCap: 1.5, shadows: true, shadowMap: 2048, shadowRadius: 2, post: true, ao: false, bloom: true, msaa: 4, atmosphere: true },
  high: { pixelRatioCap: 2, shadows: true, shadowMap: 4096, shadowRadius: 2.5, post: true, ao: true, bloom: true, msaa: 4, atmosphere: true },
};

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(pointer: coarse)').matches) || (navigator.maxTouchPoints ?? 0) > 1 || window.innerWidth <= 900;
}

function readSetting(): GfxSetting {
  try {
    const q = new URLSearchParams(window.location.search).get('gfx');
    if (q && (SETTINGS as string[]).includes(q)) return q as GfxSetting;
    const s = localStorage.getItem(GFX_KEY);
    if (s && (SETTINGS as string[]).includes(s)) return s as GfxSetting;
  } catch {
    /* storage blocked */
  }
  return 'auto';
}

export class GraphicsPipeline {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly sun: THREE.DirectionalLight;
  private readonly isSoftware: boolean;

  private setting: GfxSetting;
  tier: GfxTier = 'medium';
  private composer: EffectComposer | null = null;
  private gradePass: ShaderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private aoPass: GTAOPass | null = null;
  private width = 1;
  private height = 1;

  // Dynamic resolution
  private resScale = 1;
  private frameAvg = 16.7;
  private slowFor = 0;
  private fastFor = 0;
  private dynamicRes = true;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    sun: THREE.DirectionalLight,
    isSoftware: boolean
  ) {
    installAtmosphere();
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sun = sun;
    this.isSoftware = isSoftware;
    this.setting = readSetting();
    // Screenshot / test runs on software GL keep a fixed resolution.
    this.dynamicRes = !isSoftware;
  }

  static install(): void {
    installAtmosphere();
  }

  autoTier(): GfxTier {
    if (this.isSoftware) return 'low';
    if (isMobileDevice()) return 'medium';
    return 'high';
  }

  usesPost(): boolean {
    return this.composer !== null;
  }

  getSetting(): GfxSetting {
    return this.setting;
  }

  label(): string {
    const name = (t: GfxTier) => (t === 'low' ? 'Fast' : t === 'medium' ? 'Balanced' : 'Ultra');
    return this.setting === 'auto' ? `Graphics: Auto (${name(this.tier)})` : `Graphics: ${name(this.tier)}`;
  }

  cycleSetting(): string {
    const i = SETTINGS.indexOf(this.setting);
    this.setting = SETTINGS[(i + 1) % SETTINGS.length];
    try {
      localStorage.setItem(GFX_KEY, this.setting);
    } catch {
      /* storage blocked */
    }
    this.apply();
    return this.label();
  }

  /** (Re)build everything for the current tier. Call once after the scene exists. */
  apply(): void {
    this.tier = this.setting === 'auto' ? this.autoTier() : this.setting;
    const spec = TIERS[this.tier];
    this.resScale = 1;

    const shadows = spec.shadows && !(this.isSoftware && this.setting === 'auto');
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.sun.castShadow = shadows;
    if (this.sun.shadow.mapSize.x !== spec.shadowMap) {
      this.sun.shadow.mapSize.set(spec.shadowMap, spec.shadowMap);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
    this.sun.shadow.radius = spec.shadowRadius;
    this.sun.shadow.blurSamples = 12;
    // Materials must recompile when shadow settings change.
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
      else if (m) m.needsUpdate = true;
    });

    atmoParams[3] = spec.atmosphere ? 1 : 0;

    this.disposeComposer();
    if (spec.post) this.buildComposer(spec);
    this.resize(this.width, this.height, true);
  }

  private buildComposer(spec: TierSpec): void {
    const pr = this.pixelRatio();
    const rt = new THREE.WebGLRenderTarget(Math.max(1, this.width * pr), Math.max(1, this.height * pr), {
      type: THREE.HalfFloatType,
      samples: spec.msaa,
    });
    const composer = new EffectComposer(this.renderer, rt);
    composer.addPass(new RenderPass(this.scene, this.camera));

    if (spec.ao) {
      const ao = new GTAOPass(this.scene, this.camera, this.width, this.height);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = 0.85;
      ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      composer.addPass(ao);
      this.aoPass = ao;
    }
    if (spec.bloom) {
      const bloom = new UnrealBloomPass(new THREE.Vector2(this.width / 2, this.height / 2), 0.22, 0.5, 0.92);
      composer.addPass(bloom);
      this.bloomPass = bloom;
    }
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    this.gradePass = grade;
    this.composer = composer;
  }

  private disposeComposer(): void {
    if (!this.composer) return;
    this.aoPass?.dispose();
    this.bloomPass?.dispose();
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
    this.composer.dispose();
    this.composer = null;
    this.aoPass = null;
    this.bloomPass = null;
    this.gradePass = null;
  }

  private pixelRatio(): number {
    if (this.isSoftware && this.setting === 'auto') return 1;
    const cap = TIERS[this.tier].pixelRatioCap;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    return Math.max(0.6, dpr * this.resScale);
  }

  resize(w: number, h: number, force = false): void {
    if (!force && w === this.width && h === this.height) return;
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    const pr = this.pixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(this.width, this.height);
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(this.width, this.height);
    }
  }

  /** Feed the atmosphere the current sun direction (world space) and colour. */
  updateAtmosphere(sunDir: THREE.Vector3, sunColor: THREE.Color, timeOfDay: string): void {
    atmoSunDir[0] = sunDir.x;
    atmoSunDir[1] = sunDir.y;
    atmoSunDir[2] = sunDir.z;
    atmoSunCol[0] = sunColor.r;
    atmoSunCol[1] = sunColor.g;
    atmoSunCol[2] = sunColor.b;
    atmoParams[0] = timeOfDay === 'starlight' ? 1.5 : 0.5;
    atmoParams[2] = timeOfDay === 'starlight' ? 0.014 : timeOfDay === 'sunset' ? 0.011 : 0.007;
    if (this.bloomPass) this.bloomPass.strength = timeOfDay === 'starlight' ? 0.45 : timeOfDay === 'sunset' ? 0.32 : 0.2;
    if (this.gradePass) {
      const u = this.gradePass.uniforms;
      if (timeOfDay === 'sunset') {
        u.uHighTint.value.set(0.035, 0.012, -0.025);
        u.uShadowTint.value.set(-0.01, -0.004, 0.03);
      } else if (timeOfDay === 'starlight') {
        u.uHighTint.value.set(-0.006, 0.006, 0.02);
        u.uShadowTint.value.set(-0.012, 0.0, 0.03);
      } else {
        u.uHighTint.value.set(0.02, 0.01, -0.016);
        u.uShadowTint.value.set(-0.012, 0.0, 0.022);
      }
    }
  }

  render(realDt: number): void {
    this.camera.updateMatrixWorld();
    this.camera.matrixWorld.toArray(atmoInvView);
    if (this.composer) {
      if (this.gradePass) this.gradePass.uniforms.uTime.value = (this.gradePass.uniforms.uTime.value + realDt) % 100;
      this.composer.render(realDt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.trackFrame(realDt);
  }

  /** Lower the render resolution a little when frames run slow, raise it again when they recover. */
  private trackFrame(realDt: number): void {
    if (!this.dynamicRes) return;
    const ms = realDt * 1000;
    this.frameAvg += (ms - this.frameAvg) * 0.05;
    if (this.frameAvg > 24) {
      this.slowFor += realDt;
      this.fastFor = 0;
    } else if (this.frameAvg < 18) {
      this.fastFor += realDt;
      this.slowFor = 0;
    } else {
      this.slowFor = 0;
      this.fastFor = 0;
    }
    if (this.slowFor > 2 && this.resScale > 0.6) {
      this.resScale = Math.max(0.6, this.resScale - 0.1);
      this.slowFor = 0;
      this.resize(this.width, this.height, true);
    } else if (this.fastFor > 5 && this.resScale < 1) {
      this.resScale = Math.min(1, this.resScale + 0.1);
      this.fastFor = 0;
      this.resize(this.width, this.height, true);
    }
  }

  dispose(): void {
    this.disposeComposer();
  }
}
