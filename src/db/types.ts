// Dear Me, data model (Bible › Promises, Jar, Shelf). Everything lives on the device first (IndexedDB via Dexie).

export type JarStyleId = 'classic' | 'rose' | 'moon' | 'pearl' | 'stardust' | 'frost';
export type InsideId = 'pearl' | 'heart' | 'star' | 'moon' | 'fly' | 'flake';
export type PromiseStatus = 'active' | 'kept' | 'released';

/** One line in a promise's story: Made → Refined → Kept. Never how long it sat. */
export interface StoryStep {
  at: string;
  kind: 'made' | 'edited' | 'refined' | 'kept' | 'released';
  text?: string; // the wording at that moment (edited / refined)
  note?: string; // optional "why" on release
}

export interface DMPromise {
  id: string;
  text: string;
  status: PromiseStatus;
  createdAt: string;
  updatedAt: string;
  keptAt?: string;
  releasedAt?: string;
  /** The original wording when it was made smaller (Refine). */
  refinedFrom?: string;
  story: StoryStep[];
  /** Set when kept: the jar its orb went into. */
  jarId?: string;
  /** Sandbox (Beta test mode) promises never mix with real ones. */
  sandbox?: boolean;
  /** Last time a gentle check-in was shown or set aside (never shown to the user as days). */
  checkinAt?: string;
}

/** An orb keeps the look it had when it dropped in: changing the theme never touches it. */
export interface Orb {
  id: string;
  promiseId: string;
  jarId: string;
  inside: InsideId;
  color: number; // index into the inside's palette
  hue: number; // sheen angle, so no two orbs look identical
  keptAt: string;
  /** Resting place (jar units), saved when the jar is sealed so the shelf shows it exactly as it was. */
  x?: number;
  y?: number;
  a?: number;
  sandbox?: boolean;
}

export interface Jar {
  id: string;
  label: string; // the tag; rename anytime (max 24)
  style: JarStyleId; // frozen once sealed
  startedAt: string;
  sealedAt?: string;
  updatedAt: string;
  sandbox?: boolean;
}

export interface Settings {
  id: 'settings';
  onboarded: boolean;
  name: string;
  useName: boolean; // "Dear Chanel," instead of "Dear Me,"
  style: JarStyleId; // current jar glass
  inside: InsideId; // what new orbs look like
  gentleHelp: boolean;
  checkins: boolean;
  sound: boolean; // soft glass clinks when orbs touch
  motion: boolean; // tilt and shake the phone to move the orbs
  reminder: string | null; // "21:00" or null
  beta: boolean; // Beta test mode section visible
  sandbox: boolean; // Beta: use the separate test jar
  unlockAll: boolean; // Beta: every jar and inside unlocked
  lastLevel: number; // highest level already celebrated
  seenUnlocks: string[]; // 'jar:rose', 'in:heart' … (no NEW badge once seen)
  homeToast?: string; // one gentle line shown next time Home opens
  hard: string[]; // onboarding: promises that are hard to keep (for Gentle Help)
  blocks: string[]; // onboarding: what usually gets in the way
  country?: string; // hotline country picked by the user (else guessed)
  updatedAt: string;
}

export interface Meta {
  id: 'meta';
  schema: number;
  deviceId: string;
  createdAt: string;
}
