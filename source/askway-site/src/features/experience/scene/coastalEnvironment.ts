import {
  ACESFilmicToneMapping, Color, DataTexture, DataUtils, DirectionalLight, EquirectangularReflectionMapping,
  Float32BufferAttribute, FogExp2, Group, HemisphereLight, LinearFilter, LinearSRGBColorSpace, Mesh, PlaneGeometry,
  PMREMGenerator, RGBAFormat, Scene, SRGBColorSpace,
} from 'three';
import type { WebGLRenderer, WebGLRenderTarget } from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import type { CoastalFrame } from './paperTerrain.ts';
import type { CoastalMaterials } from './realisticMaterials.ts';

export type CoastalLighting = 'day' | 'dusk';

/** Three's PBR sampler negates the scene Euler to accommodate its left-handed environment frame. */
export function panoramaRotationForSun(sourceAzimuth: number, sun: { x: number; z: number }) {
  return sourceAzimuth - Math.atan2(sun.z, sun.x);
}

/** Two seamless water patches reach the horizon without a rectangular model plinth. */
export function buildOcean(frame: CoastalFrame, materials: CoastalMaterials, quality: 'high' | 'low' = 'high') {
  const group = new Group();
  group.name = 'physical-coastal-water';
  const segments = quality === 'high' ? 64 : 48;
  const geometry = new PlaneGeometry(340, 340, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const colors: number[] = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index), z = positions.getZ(index);
    let distance = x - frame.shoreXAt(z);
    for (const island of frame.islands) {
      distance = Math.min(distance, (Math.hypot((x - island.x) / island.radiusX, (z - island.z) / island.radiusZ) - 1) * 8);
    }
    const shallow = Math.max(0, 1 - Math.max(0, distance) / 12);
    colors.push(0.9 + shallow * 0.35, 0.92 + shallow * 0.33, 1 + shallow * 0.12);
  }
  // Vertex colours affect the physical diffuse colour; environment reflections retain their HDR range.
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const ocean = new Mesh(geometry, materials.water);
  ocean.position.y = -0.17;
  ocean.receiveShadow = true;
  ocean.name = 'near-ocean-with-wave-normals';
  const farGeometry = new PlaneGeometry(1600, 1600);
  farGeometry.rotateX(-Math.PI / 2);
  farGeometry.setAttribute('color', new Float32BufferAttribute([0.9, 0.92, 1, 0.9, 0.92, 1, 0.9, 0.92, 1, 0.9, 0.92, 1], 3));
  const farOcean = new Mesh(farGeometry, materials.water);
  farOcean.position.y = -0.275;
  farOcean.name = 'ocean-horizon';
  group.add(ocean, farOcean);
  return group;
}

export interface CoastalEnvironment {
  setLighting: (lighting: CoastalLighting) => void;
  load: () => Promise<number>;
  dispose: () => void;
}

/** The CC0 panorama lights the illustrative model; it is not presented as a Zhuhai photograph. */
export function createCoastalEnvironment(scene: Scene, renderer: WebGLRenderer, onChange: () => void): CoastalEnvironment {
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  const sky = new Sky();
  sky.name = 'physical-atmosphere';
  sky.scale.setScalar(1800);
  const skyUniforms = sky.material.uniforms;
  skyUniforms.atmosphereExposure = { value: 0.2 };
  skyUniforms.atmosphereDusk = { value: 0 };
  sky.material.fragmentShader = `uniform float atmosphereExposure; uniform float atmosphereDusk;\n${sky.material.fragmentShader}`
    .replace('gl_FragColor = vec4( retColor, 1.0 );', `
      vec3 dayGrade = mix(vec3(1.0), vec3(0.68, 0.87, 1.12), smoothstep(0.0, 0.24, direction.y));
      vec3 duskGrade = mix(vec3(1.23, 0.96, 0.74), vec3(0.9, 0.93, 1.1), smoothstep(0.0, 0.35, direction.y));
      gl_FragColor = vec4(retColor * atmosphereExposure * mix(dayGrade, duskGrade, atmosphereDusk), 1.0);`);
  skyUniforms.turbidity.value = 2.4;
  skyUniforms.rayleigh.value = 1.25;
  skyUniforms.mieCoefficient.value = 0.0035;
  skyUniforms.mieDirectionalG.value = 0.82;
  const hemisphere = new HemisphereLight('#d3e5ed', '#a6a18d', 0.7);
  const sun = new DirectionalLight('#fff3dc', 3.6);
  const bounce = new DirectionalLight('#ffd9b4', 0.15);
  bounce.position.set(72, 34, 24);
  sun.name = 'coastal-sun';
  sun.castShadow = true;
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  sun.shadow.mapSize.setScalar(mobile ? 1024 : 2048);
  sun.shadow.camera.left = -86;
  sun.shadow.camera.right = 86;
  sun.shadow.camera.top = 86;
  sun.shadow.camera.bottom = -86;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  sun.shadow.normalBias = 0.022;
  sun.shadow.bias = -0.00016;
  sun.shadow.radius = 3;
  scene.add(sky, hemisphere, sun, sun.target, bounce);
  scene.fog = new FogExp2('#bfd1d3', 0.0027);
  const generator = new PMREMGenerator(renderer);
  generator.compileEquirectangularShader();
  let environment: WebGLRenderTarget | null = null;
  let source: DataTexture | null = null;
  const fallbackScene = new Scene();
  fallbackScene.add(sky.clone());
  const fallbackEnvironments = new Map<CoastalLighting, WebGLRenderTarget>();
  let currentLighting: CoastalLighting = 'day';
  let hdrLoaded = false;
  let hdrSunAzimuth = 0;
  const abort = new AbortController();
  let disposed = false;
  const setLighting = (lighting: CoastalLighting) => {
    if (disposed) return;
    currentLighting = lighting;
    const dusk = lighting === 'dusk';
    sun.position.set(dusk ? -95 : 65, dusk ? 15 : 88, dusk ? -74 : 45);
    sun.color.set(dusk ? '#ffc58f' : '#fff3df');
    sun.intensity = dusk ? 4.4 : 3.5;
    hemisphere.intensity = dusk ? 0.77 : 0.9;
    hemisphere.color.set(dusk ? '#a8bfd4' : '#c9e0ee');
    bounce.intensity = dusk ? 1.1 : 0.15;
    bounce.color.set(dusk ? '#ffd1a4' : '#fff3df');
    skyUniforms.sunPosition.value.copy(sun.position).normalize();
    skyUniforms.turbidity.value = dusk ? 6.5 : 2.4;
    skyUniforms.rayleigh.value = dusk ? 2.8 : 1.25;
    skyUniforms.mieCoefficient.value = dusk ? 0.011 : 0.0035;
    skyUniforms.atmosphereExposure.value = dusk ? 0.28 : 0.2;
    skyUniforms.atmosphereDusk.value = dusk ? 1 : 0;
    scene.environmentIntensity = dusk ? 0.78 : 0.84;
    renderer.toneMappingExposure = dusk ? 0.78 : 0.72;
    (scene.fog as FogExp2).color.set(dusk ? '#d1bca3' : '#bfd1d3');
    scene.background = new Color(dusk ? '#d1bca3' : '#bfd1d3');
    if (!hdrLoaded) {
      let fallback = fallbackEnvironments.get(lighting);
      if (!fallback) {
        fallback = generator.fromScene(fallbackScene, 0.04, 0.1, 2500);
        fallbackEnvironments.set(lighting, fallback);
      }
      environment = fallback;
      scene.environment = fallback.texture;
    }
    // Rotate only the panorama; procedural fallback already follows the actual sun direction.
    scene.environmentRotation.set(0, hdrLoaded ? panoramaRotationForSun(hdrSunAzimuth, sun.position) : 0, 0);
    onChange();
  };
  setLighting('day');
  // A physically generated sky is also the complete offline/failed-asset environment.
  const load = async () => {
    try {
      const base = import.meta.env?.BASE_URL ?? '/';
      const response = await fetch(`${base}assets/realism/coastal-sunrise-1k.hdr`, { signal: abort.signal });
      if (!response.ok) throw new Error(`Environment status ${response.status}`);
      const parsed = new RGBELoader().parse(await response.arrayBuffer());
      if (disposed) return 0;
      let brightest = -1;
      const valueAt = (index: number) => parsed.data instanceof Uint16Array ? DataUtils.fromHalfFloat(parsed.data[index]) : parsed.data[index];
      for (let pixel = 0; pixel < parsed.width * parsed.height; pixel += 1) {
        const luminance = valueAt(pixel * 4) * 0.2126 + valueAt(pixel * 4 + 1) * 0.7152 + valueAt(pixel * 4 + 2) * 0.0722;
        if (luminance > brightest) {
          brightest = luminance;
          hdrSunAzimuth = ((pixel % parsed.width + 0.5) / parsed.width - 0.5) * Math.PI * 2;
        }
      }
      source = new DataTexture(parsed.data, parsed.width, parsed.height, RGBAFormat, parsed.type);
      source.name = 'CC0-PolyHaven-coastal-sunrise-1k';
      source.colorSpace = LinearSRGBColorSpace;
      source.mapping = EquirectangularReflectionMapping;
      source.minFilter = source.magFilter = LinearFilter;
      source.flipY = true;
      source.generateMipmaps = false;
      source.needsUpdate = true;
      const next = generator.fromEquirectangular(source);
      for (const fallback of fallbackEnvironments.values()) fallback.dispose();
      fallbackEnvironments.clear();
      environment = next;
      scene.environment = environment.texture;
      hdrLoaded = true;
      setLighting(currentLighting);
      return 0;
    } catch {
      return disposed ? 0 : 1;
    }
  };
  return {
    setLighting,
    load,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      abort.abort();
      scene.remove(sky, hemisphere, sun, sun.target, bounce);
      scene.environment = null;
      sky.geometry.dispose();
      sky.material.dispose();
      const targets = new Set(fallbackEnvironments.values());
      if (environment) targets.add(environment);
      for (const target of targets) target.dispose();
      fallbackEnvironments.clear();
      fallbackScene.clear();
      source?.dispose();
      generator.dispose();
      sun.shadow.map?.dispose();
      sun.shadow.mapPass?.dispose();
    },
  };
}
