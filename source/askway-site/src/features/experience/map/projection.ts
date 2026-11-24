import type { Catalog, ConfirmedPlan, Place } from '../contracts.ts';

/** Source coordinates are WGS84 in GeoJSON order: longitude, latitude. */
export type Wgs84Coordinate = readonly [number, number];
export interface LocalPoint { x: number; y: number }
export interface LocalBounds { minX: number; maxX: number; minY: number; maxY: number }
export interface ScenePlacePoint {
  place: Place;
  local: LocalPoint;
  order: number | null;
  previousOrder: number | null;
}
export interface SceneLeg {
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  points: LocalPoint[];
}
export interface SceneLayout {
  origin: Wgs84Coordinate;
  points: ScenePlacePoint[];
  currentLegs: SceneLeg[];
  previousLegs: SceneLeg[];
  routePlaceIds: string[];
  previousPlaceIds: string[];
  bounds: LocalBounds;
  rejectedPlaceIds: string[];
  rejectedLegIds: string[];
}

const MEAN_EARTH_RADIUS_METRES = 6_371_008.8;
const RADIANS_PER_DEGREE = Math.PI / 180;

export function isWgs84Coordinate(value: unknown): value is Wgs84Coordinate {
  return Array.isArray(value) && value.length === 2 &&
    value.every(item => typeof item === 'number' && Number.isFinite(item)) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

/**
 * A local equirectangular layout, in metres: x is east and y is north.
 * It does not convert the source datum, resolve entrances, or provide navigation.
 * The origin latitude is fixed for both SVG and Three so routes never drift.
 */
export function projectWgs84(coordinate: Wgs84Coordinate, origin: Wgs84Coordinate): LocalPoint {
  if (!isWgs84Coordinate(coordinate) || !isWgs84Coordinate(origin) || Math.abs(origin[1]) >= 85) {
    throw new RangeError('Local projection requires finite WGS84 [longitude, latitude] coordinates and a non-polar origin.');
  }
  const longitudeDifference = ((coordinate[0] - origin[0] + 540) % 360) - 180;
  return {
    x: longitudeDifference * RADIANS_PER_DEGREE * MEAN_EARTH_RADIUS_METRES * Math.cos(origin[1] * RADIANS_PER_DEGREE),
    y: (coordinate[1] - origin[1]) * RADIANS_PER_DEGREE * MEAN_EARTH_RADIUS_METRES,
  };
}

function boundsFor(points: readonly LocalPoint[]): LocalBounds {
  if (points.length === 0) return { minX: -500, maxX: 500, minY: -500, maxY: 500 };
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  const span = Math.max(maxX - minX, maxY - minY, 800);
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  const halfX = Math.max((maxX - minX) / 2, span * 0.18) + span * 0.08;
  const halfY = Math.max((maxY - minY) / 2, span * 0.18) + span * 0.08;
  return { minX: centreX - halfX, maxX: centreX + halfX, minY: centreY - halfY, maxY: centreY + halfY };
}

function projectPlanLegs(
  plan: ConfirmedPlan | null | undefined,
  byId: Map<string, ScenePlacePoint>,
  origin: Wgs84Coordinate,
  rejected: string[],
): SceneLeg[] {
  if (!plan) return [];
  const result: SceneLeg[] = [];
  for (let index = 1; index < plan.orderedPlaceIds.length; index += 1) {
    const fromPlaceId = plan.orderedPlaceIds[index - 1];
    const toPlaceId = plan.orderedPlaceIds[index];
    const leg = plan.legs.find(item => item.fromPlaceId === fromPlaceId && item.toPlaceId === toPlaceId);
    const from = byId.get(fromPlaceId);
    const to = byId.get(toPlaceId);
    const coordinates = leg?.geometry?.coordinates;
    if (!leg || !from || !to || leg.geometry.kind !== 'schematic' ||
      !Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(isWgs84Coordinate)) {
      rejected.push(leg?.id ?? `${fromPlaceId}→${toPlaceId}`);
      continue;
    }
    result.push({
      id: leg.id, fromPlaceId, toPlaceId,
      // Place references own the endpoint positions; optional leg vertices stay in WGS84.
      points: [from.local, ...coordinates.slice(1, -1).map(coordinate => projectWgs84(coordinate, origin)), to.local],
    });
  }
  return result;
}

export function buildSceneLayout(
  catalog: Catalog,
  plan: ConfirmedPlan | null,
  previousPlan: ConfirmedPlan | null | undefined = null,
): SceneLayout {
  const rejectedPlaceIds: string[] = [];
  const validPlaces = catalog.places.filter(place => {
    const valid = place.coordinateSystem === 'WGS84' && isWgs84Coordinate(place.coordinates.value) && Math.abs(place.coordinates.value[1]) < 85;
    if (!valid) rejectedPlaceIds.push(place.id);
    return valid;
  });
  const originPlace = validPlaces.find(place => place.id === catalog.originPlaceId) ?? validPlaces[0];
  // Empty catalogues use a mathematical zero frame; they do not create a fabricated place.
  const origin = (originPlace?.coordinates.value ?? [0, 0]) as Wgs84Coordinate;
  const routePlaceIds = plan?.orderedPlaceIds.slice() ?? [];
  const previousPlaceIds = previousPlan?.orderedPlaceIds.slice() ?? [];
  const routeOrder = new Map(routePlaceIds.map((id, index) => [id, index + 1]));
  const previousOrder = new Map(previousPlaceIds.map((id, index) => [id, index + 1]));
  const points = validPlaces.map(place => ({
    place,
    local: projectWgs84(place.coordinates.value as Wgs84Coordinate, origin),
    order: routeOrder.get(place.id) ?? null,
    previousOrder: previousOrder.get(place.id) ?? null,
  }));
  const byId = new Map(points.map(point => [point.place.id, point]));
  const rejectedLegIds: string[] = [];
  const currentLegs = projectPlanLegs(plan, byId, origin, rejectedLegIds);
  const previousLegs = projectPlanLegs(previousPlan, byId, origin, rejectedLegIds);
  return {
    origin, points, currentLegs, previousLegs, routePlaceIds, previousPlaceIds,
    // A stable catalogue frame avoids camera jumps when a different route is adopted.
    bounds: boundsFor(points.map(point => point.local)),
    rejectedPlaceIds, rejectedLegIds: [...new Set(rejectedLegIds)],
  };
}

export function createSvgProjection(bounds: LocalBounds, width = 720, height = 520, padding = 32) {
  const scale = 1 / svgMetresPerPixel(bounds, width, height, padding);
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const centreY = (bounds.minY + bounds.maxY) / 2;
  return (point: LocalPoint): LocalPoint => ({ x: width / 2 + (point.x - centreX) * scale, y: height / 2 - (point.y - centreY) * scale });
}

/** A display fit only; coordinates and the stable shared catalogue frame are unchanged. */
export function fitMapBounds(points: readonly LocalPoint[], fallback: LocalBounds, minimumSpan = 800): LocalBounds {
  const finite = points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!finite.length) return { ...fallback };
  const minX = Math.min(...finite.map(point => point.x));
  const maxX = Math.max(...finite.map(point => point.x));
  const minY = Math.min(...finite.map(point => point.y));
  const maxY = Math.max(...finite.map(point => point.y));
  const span = Math.max(maxX - minX, maxY - minY, minimumSpan);
  const halfX = Math.max((maxX - minX) / 2, span * 0.18) + span * 0.09;
  const halfY = Math.max((maxY - minY) / 2, span * 0.18) + span * 0.09;
  return {
    minX: (minX + maxX) / 2 - halfX, maxX: (minX + maxX) / 2 + halfX,
    minY: (minY + maxY) / 2 - halfY, maxY: (minY + maxY) / 2 + halfY,
  };
}

/** Equal metre scale on both axes, used by the SVG adapter and its scale bar. */
export function svgMetresPerPixel(bounds: LocalBounds, width: number, height: number, padding = 32): number {
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  if (![...Object.values(bounds), width, height, padding].every(Number.isFinite) ||
    spanX <= 0 || spanY <= 0 || padding < 0 || width <= padding * 2 || height <= padding * 2) {
    throw new RangeError('The map frame must have a positive finite drawable area.');
  }
  return Math.max(spanX / (width - padding * 2), spanY / (height - padding * 2));
}

/** Zoom around the fit centre and constrain panning to the catalogue, not an arbitrary empty sea. */
export function createMapViewportBounds(
  fit: LocalBounds, zoom = 1, offset: LocalPoint = { x: 0, y: 0 }, limits: LocalBounds = fit,
): LocalBounds {
  if (!Number.isFinite(zoom) || zoom <= 0 || !Number.isFinite(offset.x) || !Number.isFinite(offset.y)) {
    throw new RangeError('The map zoom and offset must be finite, with a positive zoom.');
  }
  const halfX = (fit.maxX - fit.minX) / (2 * zoom);
  const halfY = (fit.maxY - fit.minY) / (2 * zoom);
  const clampCentre = (value: number, min: number, max: number, half: number) =>
    half * 2 >= max - min ? (min + max) / 2 : Math.min(max - half, Math.max(min + half, value));
  const centreX = clampCentre((fit.minX + fit.maxX) / 2 + offset.x, limits.minX, limits.maxX, halfX);
  const centreY = clampCentre((fit.minY + fit.maxY) / 2 + offset.y, limits.minY, limits.maxY, halfY);
  return { minX: centreX - halfX, maxX: centreX + halfX, minY: centreY - halfY, maxY: centreY + halfY };
}

export interface MapLabelRect { x: number; y: number; width: number; height: number }
export interface MapLabelInput {
  id: string;
  anchor: LocalPoint;
  lines: readonly string[];
  preferredSide?: 'left' | 'right';
}
export interface MapLabelPlacement extends MapLabelInput {
  marker: LocalPoint;
  label: MapLabelRect;
}

/**
 * Names are laid out in CSS-pixel-sized SVG units, independently from map zoom.
 * A displaced badge retains a fine leader to its unchanged geographic anchor.
 */
export function layoutMapLabels(
  inputs: readonly MapLabelInput[], width: number, height: number, reserved: readonly MapLabelRect[] = [],
): MapLabelPlacement[] {
  const margin = 12;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const markerPositions: LocalPoint[] = [];
  const sorted = [...inputs].sort((a, b) => a.anchor.y - b.anchor.y || a.anchor.x - b.anchor.x);
  const placed = sorted.map(input => {
    const candidates: LocalPoint[] = [{ ...input.anchor }];
    for (const radius of [36, 56, 80, 108]) {
      for (let step = 0; step < 8; step += 1) {
        const angle = step * Math.PI / 4;
        candidates.push({ x: input.anchor.x + Math.cos(angle) * radius, y: input.anchor.y + Math.sin(angle) * radius });
      }
    }
    let best = candidates[0], score = Infinity;
    for (const candidate of candidates) {
      const position = { x: clamp(candidate.x, 24, width - 24), y: clamp(candidate.y, 24, height - 24) };
      const overlap = markerPositions.reduce((penalty, prior) => penalty +
        (Math.hypot(position.x - prior.x, position.y - prior.y) < 34 ? 1_000_000 : 0), 0);
      const nextScore = overlap + (position.x - input.anchor.x) ** 2 + (position.y - input.anchor.y) ** 2;
      if (nextScore < score) { best = position; score = nextScore; }
    }
    markerPositions.push(best);
    return { ...input, marker: best };
  });
  const markerObstacles = markerPositions.map(marker => ({ x: marker.x - 20, y: marker.y - 20, width: 40, height: 40 }));
  const occupied: MapLabelRect[] = [...reserved, ...markerObstacles];
  const overlapArea = (a: MapLabelRect, b: MapLabelRect) => Math.max(0,
    Math.min(a.x + a.width + 4, b.x + b.width) - Math.max(a.x - 4, b.x)) * Math.max(0,
    Math.min(a.y + a.height + 4, b.y + b.height) - Math.max(a.y - 4, b.y));
  const result: MapLabelPlacement[] = [];
  for (const input of placed) {
    const textWidth = Math.max(...input.lines.map(line => Array.from(line).reduce((sum, letter) =>
      sum + (letter.codePointAt(0)! > 255 ? 14 : 8), 0)), 28);
    const labelWidth = Math.min(textWidth + 18, width - margin * 2);
    const labelHeight = input.lines.length * 19 + 11;
    const left = input.marker.x - labelWidth - 24, right = input.marker.x + 24;
    const preferredX = input.preferredSide === 'left' ? left : right;
    const otherX = input.preferredSide === 'left' ? right : left;
    const xCandidates = [preferredX, otherX, margin, width - labelWidth - margin, (width - labelWidth) / 2];
    const yCandidates = [input.marker.y - labelHeight / 2];
    for (let row = margin; row <= height - labelHeight - margin; row += 12) yCandidates.push(row);
    let label: MapLabelRect = { x: margin, y: margin, width: labelWidth, height: labelHeight };
    let score = Infinity;
    for (const x of xCandidates) for (const y of yCandidates) {
      const candidate = { x: clamp(x, margin, width - labelWidth - margin), y: clamp(y, margin, height - labelHeight - margin),
        width: labelWidth, height: labelHeight };
      const overlap = occupied.reduce((area, rect) => area + overlapArea(candidate, rect), 0);
      const centreX = candidate.x + labelWidth / 2, centreY = candidate.y + labelHeight / 2;
      const distance = (centreX - input.marker.x) ** 2 + (centreY - input.marker.y) ** 2;
      const sidePenalty = Math.abs(candidate.x - preferredX) * 2;
      const nextScore = overlap * 1_000_000 + distance + sidePenalty;
      if (nextScore < score) { label = candidate; score = nextScore; }
    }
    occupied.push(label);
    result.push({ ...input, label });
  }
  const byId = new Map(result.map(item => [item.id, item]));
  return inputs.map(input => byId.get(input.id)!);
}

export function createWorldProjection(bounds: LocalBounds, extent = 120) {
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  if (span <= 0 || !Number.isFinite(extent) || extent <= 0) throw new RangeError('The scene frame must have a positive extent.');
  const scale = extent / span;
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const centreY = (bounds.minY + bounds.maxY) / 2;
  return (point: LocalPoint): { x: number; z: number } => ({ x: (point.x - centreX) * scale, z: -(point.y - centreY) * scale });
}
