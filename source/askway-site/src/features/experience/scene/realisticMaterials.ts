import {
  Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshPhysicalMaterial,
  MeshStandardMaterial, RepeatWrapping, RGBAFormat, SRGBColorSpace, Texture, Vector2,
} from 'three';

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
  paving: MeshStandardMaterial;
  shell: MeshPhysicalMaterial;
  glass: MeshPhysicalMaterial;
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
  const sand = new MeshStandardMaterial({ map: sandMap, normalMap: sandNormal, normalScale: new Vector2(0.25, 0.25), roughness: 0.93 });
  const wetSand = new MeshStandardMaterial({ map: sandMap, normalMap: sandNormal, color: '#a9a694', roughness: 0.36, metalness: 0.04, normalScale: new Vector2(0.17, 0.17) });
  const grass = new MeshStandardMaterial({ map: grassMap, normalMap: grassNormal, color: '#d2d8c4', roughness: 0.98, normalScale: new Vector2(0.6, 0.6), vertexColors: true });
  const rock = new MeshStandardMaterial({ map: stoneMap, normalMap: stoneNormal, color: '#929a90', roughness: 0.88, normalScale: new Vector2(0.6, 0.6) });
  const paving = new MeshStandardMaterial({ map: stoneMap, normalMap: stoneNormal, color: '#c4c0ac', roughness: 0.8, normalScale: new Vector2(0.13, 0.13) });
  const shell = new MeshPhysicalMaterial({ color: '#e8e7dc', roughness: 0.48, metalness: 0.09, clearcoat: 0.1, clearcoatRoughness: 0.5, normalMap: stoneNormal, normalScale: new Vector2(0.045, 0.045) });
  shell.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 panel = abs(fract(vec2(vNormalMapUv.x * 31.0 + vNormalMapUv.y * 8.0, vNormalMapUv.y * 22.0)) - 0.5);
      float panelJoint = max(smoothstep(0.476, 0.498, panel.x), smoothstep(0.478, 0.498, panel.y));
      diffuseColor.rgb *= 1.0 - panelJoint * 0.075;`);
  };
  shell.customProgramCacheKey = () => 'askway-clad-shell-v2';
  const glass = new MeshPhysicalMaterial({ color: '#5c777d', metalness: 0.22, roughness: 0.2, clearcoat: 0.75, clearcoatRoughness: 0.15, envMapIntensity: 1.35 });
  const metal = new MeshStandardMaterial({ color: '#aab7b5', metalness: 0.78, roughness: 0.32 });
  const facade = new MeshStandardMaterial({ color: '#c6bfb1', roughness: 0.77, normalMap: stoneNormal, normalScale: new Vector2(0.035, 0.035) });
  const roof = new MeshStandardMaterial({ color: '#778482', roughness: 0.72, metalness: 0.16 });
  const asphalt = new MeshStandardMaterial({ color: '#6d7777', roughness: 0.95, normalMap: stoneNormal, normalScale: new Vector2(0.08, 0.08) });
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
      { path: 'stone-color.webp', color: true, materials: [rock, paving, urbanGround], slot: 'map' },
      { path: 'stone-normal.webp', color: false, materials: [rock, paving, facade, asphalt, urbanGround, shell], slot: 'normalMap' },
      { path: 'stone-roughness.webp', color: false, materials: [rock, paving, urbanGround], slot: 'roughnessMap' },
    ];
    const results = await Promise.allSettled(jobs.map(async job => {
      const response = await fetch(`${base}assets/realism/${job.path}`, { signal: abort.signal });
      if (!response.ok) throw new Error(`Texture status ${response.status}`);
      const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
      if (cancelled) { bitmap.close(); return; }
      const texture = new Texture(bitmap);
      texture.name = `CC0-${job.path}`;
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.magFilter = LinearFilter;
      if (job.color) texture.colorSpace = SRGBColorSpace;
      texture.needsUpdate = true;
      ownedTextures.add(texture);
      for (const material of job.materials) { material[job.slot] = texture; material.needsUpdate = true; }
      if (job.path === 'sand-color.webp') sand.color.set('#e0d7c5');
      if (job.path === 'stone-color.webp' && typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(256, 256);
        const context = canvas.getContext('2d');
        if (context) {
          context.drawImage(bitmap, 0, 0, 256, 256);
          const pixels = context.getImageData(0, 0, 256, 256).data;
          const cladding = new Uint8Array(pixels.length);
          for (let pixel = 0; pixel < pixels.length; pixel += 4) {
            const grain = (pixels[pixel] * 0.25 + pixels[pixel + 1] * 0.6 + pixels[pixel + 2] * 0.15) / 255;
            cladding[pixel] = 222 + grain * 31;
            cladding[pixel + 1] = 220 + grain * 31;
            cladding[pixel + 2] = 212 + grain * 30;
            cladding[pixel + 3] = 255;
          }
          const claddingMap = new DataTexture(cladding, 256, 256, RGBAFormat);
          claddingMap.name = 'CC0-stone-derived-ivory-cladding';
          claddingMap.colorSpace = SRGBColorSpace;
          claddingMap.wrapS = claddingMap.wrapT = RepeatWrapping;
          claddingMap.repeat.set(2, 2);
          claddingMap.magFilter = LinearFilter;
          claddingMap.minFilter = LinearMipmapLinearFilter;
          claddingMap.generateMipmaps = true;
          claddingMap.needsUpdate = true;
          ownedTextures.add(claddingMap);
          shell.map = claddingMap;
          shell.needsUpdate = true;
        }
      }
      onChange();
    }));
    return results.filter(result => result.status === 'rejected').length;
  };
  return {
    sand, wetSand, grass, rock, paving, shell, glass, metal, facade, roof, asphalt, foliage, urbanGround, bark, water,
    ownedTextures, waterTime,
    cancelLoads: () => { cancelled = true; abort.abort(); },
    load,
  };
}

/** Keep the foliage variation in linear colour, matching Three's instance-colour contract. */
export function foliageColor(index: number) {
  return new Color(['#24412c', '#2b4930', '#244b32', '#31492d', '#20412b', '#294833'][index % 6]);
}
