import { Counter, Settings } from '../models/index.js';

export class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
export async function nextSeq(name) {
  const c = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return c.seq;
}
export const pad = (n, w = 5) => String(n).padStart(w, '0');
export async function getSettings() {
  let s = await Settings.findOne();
  if (!s) s = await Settings.create({});
  return s;
}
export const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
export const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
export const need = (cond, status, msg, extra) => { if (!cond) throw new HttpError(status, msg, extra); };
export const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export function hoursFor(settings, block) {
  const b = settings.blockHours?.[block];
  return { start: b?.start || settings.visitingHours.start, end: b?.end || settings.visitingHours.end };
}
