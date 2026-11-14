import type { InsideId, JarStyleId } from '../db/types';

export interface OrbSpec { id: string; inside: InsideId; color: number; hue?: number; x?: number; y?: number; a?: number; r?: number }
export function mountJar(canvas: HTMLCanvasElement, opts: { style: JarStyleId; label?: string; orbs: OrbSpec[]; onTapOrb?: (id: string | null) => void; onTapTag?: () => void; sound?: boolean; motion?: boolean }): void;
export function unmountJar(): void;
export function dropOrb(spec: OrbSpec, done?: () => void): void;
export function shakeJar(): void;
export function setJarStyle(style: JarStyleId): void;
export function setJarLabel(text: string): void;
export function highlightOrb(id: string | null): void;
export function isBusy(): boolean;
export function snapshot(): { id: string; x: number; y: number; a: number; r: number }[];
export function orbScreenPos(id: string): { x: number; y: number; r: number } | null;
export function drawStillJar(canvas: HTMLCanvasElement, cssW: number, style: JarStyleId, orbs: OrbSpec[], label?: string): void;
export function drawOrbPreview(canvas: HTMLCanvasElement, inside: InsideId, size?: number): void;
export const JAR_STYLES: { id: JarStyleId; name: string; level: number }[];
export const INSIDES: { id: InsideId; name: string; level: number; colors: number }[];
export function orbColors(inside: InsideId, color: number): { light: string; base: string; deep: string; glow: string };
