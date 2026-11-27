import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat } from 'three';

export type ArchitecturalSurface = 'shell' | 'paving' | 'asphalt';
export type SurfaceChannel = 'normal' | 'roughness';

/** Original seamless height fields, sampled identically for small fallback and baked 1K assets. */
export function architecturalPixels(kind: ArchitecturalSurface, channel: SurfaceChannel, size: number) {
  const heights = new Float32Array(size * size);
  const bytes = new Uint8Array(size * size * 4);
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const u = x / size, v = y / size;
    const fine = Math.sin(tau * (u * 43 + v * 29)) * Math.cos(tau * (u * 17 - v * 31));
    const grain = Math.sin(tau * (u * 97 + v * 61)) * Math.sin(tau * (u * 71 - v * 83));
    const joint = Math.exp(-Math.pow(Math.sin(tau * u * 2) * 34, 2)) + Math.exp(-Math.pow(Math.sin(tau * v * 2) * 34, 2));
    heights[y * size + x] = kind === 'shell' ? fine * 0.0003 + Math.sin(tau * u * 67) * 0.00015
      : kind === 'paving' ? fine * 0.0006 - joint * 0.003 : fine * 0.0008 + grain * 0.0006;
  }
  const height = (x: number, y: number) => heights[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const offset = (y * size + x) * 4;
    if (channel === 'normal') {
      const nx = -(height(x + 1, y) - height(x - 1, y)) * size * 0.5;
      const ny = -(height(x, y + 1) - height(x, y - 1)) * size * 0.5;
      const length = Math.hypot(nx, ny, 1);
      bytes[offset] = (nx / length * 0.5 + 0.5) * 255;
      bytes[offset + 1] = (ny / length * 0.5 + 0.5) * 255;
      bytes[offset + 2] = (1 / length * 0.5 + 0.5) * 255;
    } else {
      const base = kind === 'shell' ? 177 : kind === 'paving' ? 225 : 247;
      const variation = heights[y * size + x] * (kind === 'paving' ? -1600 : 4500);
      bytes[offset] = bytes[offset + 1] = bytes[offset + 2] = Math.min(255, Math.max(0, base + variation));
    }
    bytes[offset + 3] = 255;
  }
  return bytes;
}

export function architecturalTexture(kind: ArchitecturalSurface, channel: SurfaceChannel) {
  const texture = new DataTexture(architecturalPixels(kind, channel, 128), 128, 128, RGBAFormat);
  texture.name = `AskWay-original-${kind}-${channel}`;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.repeat.setScalar(kind === 'shell' ? 1 : 2.25);
  texture.needsUpdate = true;
  return texture;
}
