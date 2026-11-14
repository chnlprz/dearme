import type { Jar, Meta, Settings } from './types';
import { nowISO, uid } from '../lib/util';

export const defaultSettings = (): Settings => ({
  id: 'settings', onboarded: false, name: '', useName: false,
  style: 'classic', inside: 'pearl', gentleHelp: false, checkins: true, reminder: '21:00',
  beta: false, sandbox: false, unlockAll: false, lastLevel: 1, seenUnlocks: ['jar:classic', 'in:pearl'], hard: [], blocks: [], updatedAt: nowISO(),
});

export const newMeta = (schema: number): Meta => ({ id: 'meta', schema, deviceId: uid(), createdAt: nowISO() });

export const newJar = (n: number, style: Jar['style'], sandbox = false): Jar => ({
  id: uid(), label: `chapter ${n}`, style, startedAt: nowISO(), updatedAt: nowISO(), ...(sandbox ? { sandbox } : {}),
});
