import * as THREE from 'three';

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function damp(a: number, b: number, lambda: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function wrapDistance(s: number, length: number): number {
  const r = s % length;
  return r < 0 ? r + length : r;
}

/** Shortest signed distance from sA to sB along a circular track of length L */
export function signedTrackDelta(sFrom: number, sTo: number, length: number): number {
  let d = wrapDistance(sTo - sFrom, length);
  if (d > length * 0.5) d -= length;
  return d;
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const hundredths = Math.floor((safe - Math.floor(safe)) * 100);
  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  const hh = hundredths.toString().padStart(2, '0');
  return `${mm}:${ss}.${hh}`;
}

export function ordinalSuffix(rank: number): string {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const WORLD_UP = new THREE.Vector3(0, 1, 0);
