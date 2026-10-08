import { Router } from 'express';
import { AuditLog } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { verifyChain } from '../utils/audit.js';
const r = Router(); r.use(protect, allow('admin'));
r.get('/', async (req, res) => {
  const f = {}; if (req.query.action) f.action = new RegExp(req.query.action, 'i'); if (req.query.q) f.actorName = new RegExp(req.query.q, 'i');
  const page = Math.max(1, Number(req.query.page) || 1); const per = 50;
  res.json({ items: await AuditLog.find(f).sort('-seq').skip((page - 1) * per).limit(per).select('-payload -prevHash'), total: await AuditLog.countDocuments(f), page, per });
});
r.get('/verify', async (req, res) => res.json(await verifyChain()));
export default r;
