import crypto from 'crypto';
import { AuditLog } from '../models/index.js';

let chain = Promise.resolve();
export function audit(actor, action, entity, entityId, detail = {}, ip) {
  chain = chain.then(async () => {
    const last = await AuditLog.findOne().sort({ seq: -1 }).lean();
    const seq = (last?.seq || 0) + 1;
    const prevHash = last?.hash || 'GENESIS';
    const at = new Date();
    const actorId = actor?._id || undefined;
    const payload = JSON.stringify({ seq, actor: actorId ? String(actorId) : null, action, entity, entityId: entityId ? String(entityId) : null, detail, at });
    const hash = crypto.createHash('sha256').update(prevHash + payload).digest('hex');
    await AuditLog.create({ seq, actor: actorId, actorName: actor?.name, action, entity, entityId: entityId ? String(entityId) : undefined, detail, ip, at, prevHash, hash, payload });
  }).catch((e) => console.error('audit failed:', e.message));
  return chain;
}
export async function verifyChain() {
  const logs = await AuditLog.find().sort({ seq: 1 }).lean();
  let prev = 'GENESIS';
  for (const l of logs) {
    const h = crypto.createHash('sha256').update(prev + l.payload).digest('hex');
    if (l.prevHash !== prev || l.hash !== h) return { ok: false, brokenAt: l.seq, total: logs.length };
    prev = l.hash;
  }
  return { ok: true, total: logs.length };
}
