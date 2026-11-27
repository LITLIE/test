import {
  Color, DataTexture, DoubleSide, LinearFilter, LinearMipmapLinearFilter, MeshPhysicalMaterial,
  MeshStandardMaterial, RepeatWrapping, RGBAFormat, SRGBColorSpace, Texture, Vector2,
} from 'three';
import { architecturalTexture } from './architecturalTextures.ts';

/** Small, deterministic GPU textures provide a complete material before local CC0 assets arrive. */
function surfaceTexture(kind: 'sand' | 'stone' | 'grass' | 'water', normal = false) {
  const size = 128;
  const bytes = new Uint8Array(size * size * 4);
  const palette = kind === 'sand' ? [224, 213, 187] : kind === 'stone' ? [207, 209, 198] : kind === 'grass' ? [91, 118, 70] : [126, 128, 255];
  const hash = (x: number, y: number) => {
    const value = Math.sin(x * 127.1 + y * 311.7 + 17.2) * 43758.5453;
    return value - Math.floor(value);
  };
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx;
    const b = hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx;
    return a * (1 - sy) + b * sy;
  };
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const offset = (y * size + x) * 4;
    const grain = noise(x * 0.23, y * 0.23) * 0.55 + noise(x * 0.79, y * 0.79) * 0.3 + hash(x, y) * 0.15;
    if (normal) {
      const strength = kind === 'water' ? 15 : kind === 'grass' ? 20 : 9;
      bytes[offset] = 128 + (hash(x, y) - 0.5) * strength;
      bytes[offset + 1] = 128 + (hash(x + 7, y + 9) - 0.5) * strength;
      bytes[offset + 2] = 254;
    } else {
      const variation = 0.88 + grain * 0.22;
      for (let channel = 0; channel < 3; channel += 1) bytes[offset + channel] = palette[channel] * variation;
    }
    bytes[offset + 3] = 255;
  }
  const texture = new DataTexture(bytes, size, size, RGBAFormat);
  texture.name = `askway-procedural-${kind}-${normal ? 'normal' : 'color'}`;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  if (!normal) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export interface CoastalMaterials {
  sand: MeshStandardMaterial;
  wetSand: MeshStandardMaterial;
  grass: MeshStandardMaterial;
  rock: MeshStandardMaterial;
  wetRock: MeshStandardMaterial;
  paving: MeshStandardMaterial;
  shell: MeshPhysicalMaterial;
  glass: MeshPhysicalMaterial;
  operaGlass: MeshPhysicalMaterial;
  metal: MeshStandardMaterial;
  facade: MeshStandardMaterial;
  roof: MeshStandardMaterial;
  asphalt: MeshStandardMaterial;
  foliage: MeshStandardMaterial;
  urbanGround: MeshStandardMaterial;
  bark: MeshStandardMaterial;
  water: MeshPhysicalMaterial;
  ownedTextures: Set<Texture>;
  waterTime: { value: number };
  cancelLoads: () => void;
  load: (onChange: () => void) => Promise<number>;
}

export function createCoastalMaterials(): CoastalMaterials {
  const sandMap = surfaceTexture('sand');
  const sandNormal = surfaceTexture('sand', true);
  const stoneMap = surfaceTexture('stone');
  const stoneNormal = surfaceTexture('stone', true);
  const grassMap = surfaceTexture('grass');
  const grassNormal = surfaceTexture('grass', true);
  const waterNormal = surfaceTexture('water', true);
  waterNormal.repeat.set(32, 32);
  const ownedTextures = new Set<Texture>([sandMap, sandNormal, stoneMap, stoneNormal, grassMap, grassNormal, waterNormal]);
  const detail = (kind: 'shell' | 'paving' | 'asphalt') => {
    const normalMap = architecturalTexture(kind, 'normal');
    const roughnessMap = architecturalTexture(kind, 'roughness');
    ownedTextures.add(normalMap);
    ownedTextures.add(roughnessMap);
    return { normalMap, roughnessMap };
  };
  const sand = new MeshStandardMaterial({ map: sandMap, normalMap: sandNormal, normalScale: new Vector2(0.25, 0.25), roughness: 0.93 });
  const wetSand = new MeshStandardMaterial({ map: sandMap, normalMap: sandNormal, color: '#a9a694', roughness: 0.36, metalness: 0.04, normalScale: new Vector2(0.17, 0.17) });
  const grass = new MeshStandardMaterial({ map: grassMap, normalMap: grassNormal, color: '#d2d8c4', roughness: 0.98, normalScale: new Vector2(0.6, 0.6), vertexColors: true });
  const rock = new MeshStandardMaterial({ map: stoneMap, normalMap: stoneNormal, color: '#929a90', roughness: 0.88, normalScale: new Vector2(0.6, 0.6) });
  const wetRock = new MeshStandardMaterial({ map: stoneMap, normalMap: stoneNormal, color: '#4b5855', roughness: 0.34, metalness: 0, normalScale: new Vector2(0.35, 0.35) });
  const paving = new MeshStandardMaterial({ ...detail('paving'), color: '#b9b7ad', roughness: 0.92, normalScale: new Vector2(0.48, 0.48) });
  paving.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 pavingUv = vNormalMapUv * 4.0;
      vec2 pavingDistance = 0.5 - abs(fract(pavingUv) - 0.5);
      vec2 pavingAA = max(fwidth(pavingUv), vec2(0.001));
      vec2 pavingEdges = 1.0 - smoothstep(vec2(0.008), vec2(0.008) + pavingAA, pavingDistance);
      float pavingJoint = max(pavingEdges.x, pavingEdges.y) * (1.0 - smoothstep(0.18, 0.8, max(pavingAA.x, pavingAA.y)));
      diffuseColor.rgb *= 1.0 - pavingJoint * 0.075;`);
  };
  paving.customProgramCacheKey = () => 'askway-paving-aa-v1';
  const shell = new MeshPhysicalMaterial({ ...detail('shell'), color: '#efeee4', roughness: 0.65, metalness: 0.035, clearcoat: 0.16, clearcoatRoughness: 0.42, normalScale: new Vector2(0.36, 0.36) });
  shell.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 panelUv = vec2(vNormalMapUv.x * 26.0 + vNormalMapUv.y * 5.0, vNormalMapUv.y * 19.0);
      vec2 panelDistance = 0.5 - abs(fract(panelUv) - 0.5);
      vec2 panelAA = max(fwidth(panelUv), vec2(0.001));
      vec2 panelEdges = 1.0 - smoothstep(vec2(0.013), vec2(0.013) + panelAA, panelDistance);
      float panelJoint = max(panelEdges.x, panelEdges.y) * (1.0 - smoothstep(0.18, 0.8, max(panelAA.x, panelAA.y)));
      diffuseColor.rgb *= 1.0 - panelJoint * 0.12;`);
  };
  shell.customProgramCacheKey = () => 'askway-clad-shell-aa-v3';
  const glass = new MeshPhysicalMaterial({ color: '#5c777d', metalness: 0.22, roughness: 0.2, clearcoat: 0.75, clearcoatRoughness: 0.15, envMapIntensity: 1.35 });
  const operaGlass = new MeshPhysicalMaterial({ color: '#60818d', metalness: 0.12, roughness: 0.14, clearcoat: 0.9, clearcoatRoughness: 0.1, envMapIntensity: 1.6, ior: 1.5, side: DoubleSide });
  const metal = new MeshStandardMaterial({ color: '#b6bfbd', metalness: 0.85, roughness: 0.24 });
  const facade = new MeshStandardMaterial({ color: '#c6bfb1', roughness: 0.77, normalMap: stoneNormal, normalScale: new Vector2(0.035, 0.035) });
  const roof = new MeshStandardMaterial({ color: '#778482', roughness: 0.72, metalness: 0.16 });
  const asphalt = new MeshStandardMaterial({ ...detail('asphalt'), color: '#485455', roughness: 1, normalScale: new Vector2(0.32, 0.32) });
  const foliage = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.97 });
  const urbanGround = new MeshStandardMaterial({ map: stoneMap, normalMap: stoneNormal, color: '#9caaa7', roughness: 0.91, normalScale: new Vector2(0.16, 0.16) });
  const bark = new MeshStandardMaterial({ color: '#777260', roughness: 1 });
  const waterTime = { value: 0 };
  const water = new MeshPhysicalMaterial({
    color: '#387489', roughness: 0.2, metalness: 0.02, clearcoat: 0.74,
    clearcoatRoughness: 0.17, normalMap: waterNormal, normalScale: new Vector2(0.14, 0.14),
    envMapIntensity: 0.9, vertexColors: true, ior: 1.333,
  });
  // Analytic wave slopes affect the real lighting/IBL normal, so glints and Fresnel change with view.
  water.onBeforeCompile = shader => {
    shader.uniforms.uCoastalTime = waterTime;
    shader.vertexShader = `uniform float uCoastalTime; varying vec2 vCoastalWorldXZ;\n${shader.vertexShader}`;
    shader.fragmentShader = `uniform float uCoastalTime; varying vec2 vCoastalWorldXZ;
      float coastalHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float coastalNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(coastalHash(i), coastalHash(i + vec2(1.0, 0.0)), f.x),
          mix(coastalHash(i + vec2(0.0, 1.0)), coastalHash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float coastalFbm(vec2 p) {
        float value = 0.0, amplitude = 0.5;
        mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);
        for (int octave = 0; octave < 3; octave++) {
          value += amplitude * coastalNoise(p);
          p = turn * p * 2.07 + vec2(8.3, 2.7); amplitude *= 0.48;
        }
        return value;
      }
      float coastalRipple(vec2 p) {
        return coastalFbm(p * 2.6 + vec2(uCoastalTime * 0.12, uCoastalTime * 0.06)) * 0.022
          + coastalNoise(p * 6.7 + vec2(-uCoastalTime * 0.045, uCoastalTime * 0.085)) * 0.004;
      }
      ${shader.fragmentShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      float waveA = position.x * 0.22 + position.z * 0.13 + uCoastalTime * 0.45;
      float waveB = position.x * -0.14 + position.z * 0.31 + uCoastalTime * 0.29;
      objectNormal = normalize(vec3(-0.024 * cos(waveA) * 0.22 + 0.014 * cos(waveB) * 0.14, 1.0,
        -0.024 * cos(waveA) * 0.13 - 0.014 * cos(waveB) * 0.31));`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y += sin(waveA) * 0.024 + sin(waveB) * 0.014;
      vCoastalWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float rippleX = (coastalRipple(vCoastalWorldXZ + vec2(0.035, 0.0)) - coastalRipple(vCoastalWorldXZ - vec2(0.035, 0.0))) / 0.07;
      float rippleZ = (coastalRipple(vCoastalWorldXZ + vec2(0.0, 0.035)) - coastalRipple(vCoastalWorldXZ - vec2(0.0, 0.035))) / 0.07;
      vec3 ripple = vec3(-rippleX, 0.0, -rippleZ);
      normal = normalize(normal + (viewMatrix * vec4(ripple, 0.0)).xyz);`);
  };
  water.customProgramCacheKey = () => 'askway-physical-ocean-v4';
  const abort = new AbortController();
  let cancelled = false;
  const load = async (onChange: () => void) => {
    const base = import.meta.env?.BASE_URL ?? '/';
    const jobs: { path: string; color: boolean; materials: MeshStandardMaterial[]; slot: 'map' | 'normalMap' | 'roughnessMap' }[] = [
      { path: 'sand-color.webp', color: true, materials: [sand, wetSand], slot: 'map' },
      { path: 'sand-normal.webp', color: false, materials: [sand, wetSand], slot: 'normalMap' },
      { path: 'sand-roughness.webp', color: false, materials: [sand, wetSand], slot: 'roughnessMap' },
      { path: 'stone-color.webp', color: true, materials: [rock, wetRock, urbanGround], slot: 'map' },
      { path: 'stone-normal.webp', color: false, materials: [rock, wetRock, facade, urbanGround], slot: 'normalMap' },
      { path: 'stone-roughness.webp', color: false, materials: [rock, urbanGround], slot: 'roughnessMap' },
      ...(['shell', 'paving', 'asphalt'] as const).flatMap(kind => [
        { path: `${kind}-normal.webp`, color: false, materials: [{ shell, paving, asphalt }[kind]], slot: 'normalMap' as const },
        { path: `${kind}-roughness.webp`, color: false, materials: [{ shell, paving, asphalt }[kind]], slot: 'roughnessMap' as const },
      ]),
    ];
    const results = await Promise.allSettled(jobs.map(async job => {
      const response = await fetch(`${base}assets/realism/${job.path}`, { signal: abort.signal });
      if (!response.ok) throw new Error(`Texture status ${response.status}`);
      const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
      if (cancelled) { bitmap.close(); return; }
      const texture = new Texture(bitmap);
      texture.name = `${/^(shell|paving|asphalt)-/.test(job.path) ? 'AskWay-original' : 'CC0'}-${job.path}`;
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.magFilter = LinearFilter;
      if (/^(paving|asphalt)-/.test(job.path)) texture.repeat.setScalar(2.25);
      if (job.color) texture.colorSpace = SRGBColorSpace;
      texture.needsUpdate = true;
      ownedTextures.add(texture);
      for (const material of job.materials) { material[job.slot] = texture; material.needsUpdate = true; }
      if (job.path === 'sand-color.webp') sand.color.set('#e0d7c5');
      onChange();
    }));
    return results.filter(result => result.status === 'rejected').length;
  };
  return {
    sand, wetSand, grass, rock, wetRock, paving, shell, glass, operaGlass, metal, facade, roof, asphalt, foliage, urbanGround, bark, water,
    ownedTextures, waterTime,
    cancelLoads: () => { cancelled = true; abort.abort(); },
    load,
  };
}

/** Keep the foliage variation in linear colour, matching Three's instance-colour contract. */
export function foliageColor(index: number) {
  return new Color(['#24412c', '#2b4930', '#244b32', '#31492d', '#20412b', '#294833'][index % 6]);
}
