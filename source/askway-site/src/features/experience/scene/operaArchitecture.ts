import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, DoubleSide, Float32BufferAttribute,
  Group, LineBasicMaterial, LineSegments, Mesh, TubeGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CoastalMaterials } from './realisticMaterials.ts';

interface Shell { x: number; z: number; width: number; height: number; gap: number; bulge: number }
const fanWidth = (t: number) => Math.sqrt(Math.max(0, 1 - ((t - 0.25) / 0.75) ** 2));

/** Two thin, gently convex walls frame a glazed interior: a fan profile with a level base. */
function shellWall(shell: Shell, side: number, high: boolean) {
  const rows = high ? 28 : 18, columns = high ? 36 : 24;
  const verticesPerFace = (rows + 1) * (columns + 1);
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let face = 0; face < 2; face += 1) {
    for (let row = 0; row <= rows; row += 1) for (let column = 0; column <= columns; column += 1) {
      const t = row / rows, v = column / columns * 2 - 1;
      const curve = shell.bulge * Math.sin(Math.PI * t) * (1 - v * v);
      positions.push(shell.x + side * (shell.gap + curve - face * 0.16), 0.83 + t * shell.height,
        shell.z + v * shell.width * fanWidth(t));
      uv.push(column / columns, t);
    }
    for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
      const a = face * verticesPerFace + row * (columns + 1) + column;
      const b = a + 1, c = a + columns + 1, d = c + 1;
      if ((side > 0) !== Boolean(face)) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }
  const join = (a: number, b: number) => indices.push(a, b, a + verticesPerFace, b, b + verticesPerFace, a + verticesPerFace);
  for (let row = 0; row < rows; row += 1) {
    join(row * (columns + 1), (row + 1) * (columns + 1));
    join(row * (columns + 1) + columns, (row + 1) * (columns + 1) + columns);
  }
  for (let column = 0; column < columns; column += 1) join(column, column + 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function glassSurface(shell: Shell, roof = false) {
  const rows = 16, columns = 16;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) for (let column = 0; column <= columns; column += 1) {
    const u = column / columns, v = row / rows;
    const x = shell.x + (u * 2 - 1) * (shell.gap - 0.12);
    const y = roof ? 0.85 + shell.height * (0.59 + 0.08 * (v * 2 - 1) ** 2) : 0.85 + v * shell.height * 0.67;
    const z = roof ? shell.z + (v * 2 - 1) * shell.width * 0.93
      : shell.z + shell.width * fanWidth(v * 0.67) - 0.20 * Math.sin(Math.PI * v);
    positions.push(x, y, z);
    uv.push(u, v);
  }
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
    indices.push(a, b, c, b, d, c);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildOperaArchitecture(materials: CoastalMaterials, quality: 'high' | 'low') {
  const group = new Group();
  group.name = 'double-fan-shell-opera-reference';
  const high = quality === 'high';
  const steps: BufferGeometry[] = [];
  for (const [width, depth, y] of [[21.2, 19.1, 0.13], [20.6, 18.5, 0.34], [20.0, 17.9, 0.55]]) {
    const part = new BoxGeometry(width, 0.23, depth);
    part.translate(-0.4, y, 0.6);
    steps.push(part);
  }
  const stepGeometry = mergeGeometries(steps)!;
  steps.forEach(part => part.dispose());
  const podium = new Mesh(stepGeometry, materials.paving);
  podium.receiveShadow = true;
  group.add(podium);
  const ribbons: BufferGeometry[] = [], glazing: BufferGeometry[] = [], frameLines: number[] = [];
  const shells: Shell[] = [
    { x: 2.9, z: -1.25, width: 6.65, height: 11.8, gap: 1.15, bulge: 0.88 },
    { x: -4.25, z: 1.2, width: 4.5, height: 7.5, gap: 0.77, bulge: 0.6 },
  ];
  for (const shell of shells) {
    for (const side of [-1, 1]) {
      const wall = new Mesh(shellWall(shell, side, high), materials.shell);
      wall.name = 'curved-fan-wall';
      wall.castShadow = wall.receiveShadow = true;
      group.add(wall);
      for (const edge of [-1, 1]) {
        const points = Array.from({ length: 29 }, (_, index) => {
          const t = index / 28;
          return new Vector3(shell.x + side * shell.gap, 0.85 + t * shell.height, shell.z + edge * shell.width * fanWidth(t));
        });
        ribbons.push(new TubeGeometry(new CatmullRomCurve3(points), high ? 32 : 20, 0.048, 5, false));
      }
    }
    glazing.push(glassSurface(shell), glassSurface(shell, true));
    for (let column = 0; column <= 7; column += 1) {
      const u = column / 7, x = shell.x + (u * 2 - 1) * (shell.gap - 0.115);
      for (let row = 0; row < 12; row += 1) for (const v of [row / 12, (row + 1) / 12]) {
        frameLines.push(x, 0.86 + v * shell.height * 0.67, shell.z + shell.width * fanWidth(v * 0.67) - 0.20 * Math.sin(Math.PI * v) + 0.012);
      }
    }
    for (let row = 0; row <= 12; row += 1) {
      const v = row / 12;
      const y = 0.86 + v * shell.height * 0.67;
      const z = shell.z + shell.width * fanWidth(v * 0.67) - 0.20 * Math.sin(Math.PI * v) + 0.012;
      frameLines.push(shell.x - shell.gap + 0.12, y, z, shell.x + shell.gap - 0.12, y, z);
    }
  }
  const rim = new Mesh(mergeGeometries(ribbons)!, materials.metal);
  rim.castShadow = true;
  ribbons.forEach(part => part.dispose());
  materials.glass.side = DoubleSide;
  const interior = new Mesh(mergeGeometries(glazing)!, materials.glass);
  interior.castShadow = interior.receiveShadow = true;
  glazing.forEach(part => part.dispose());
  const mullions = new BufferGeometry();
  mullions.setAttribute('position', new Float32BufferAttribute(frameLines, 3));
  group.add(rim, interior, new LineSegments(mullions, new LineBasicMaterial({ color: '#98a7a7', transparent: true, opacity: 0.65 })));
  const stage = new Mesh(new BoxGeometry(18.2, 0.9, 12.9), materials.roof);
  stage.position.set(-0.5, 0.85, -0.5);
  stage.receiveShadow = true;
  group.add(stage);
  // Low curved public-space wings complete the building's horizontal base.
  const wing = new Mesh(new CylinderGeometry(1, 1, 1.2, high ? 48 : 28), materials.glass);
  wing.scale.set(6.2, 1, 2.55);
  wing.position.set(-4.4, 1.33, 7.1);
  wing.castShadow = wing.receiveShadow = true;
  const roof = new Mesh(new CylinderGeometry(1.035, 1.035, 0.2, high ? 48 : 28), materials.shell);
  roof.scale.set(6.2, 1, 2.55);
  roof.position.set(-4.4, 2.04, 7.1);
  roof.castShadow = roof.receiveShadow = true;
  group.add(wing, roof);
  group.rotation.y = -0.13;
  return group;
}
