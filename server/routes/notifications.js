import { Router } from 'express';
import { Notification, User, Allocation, Room, ACTIVE } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { HttpError } from '../utils/helpers.js';
import { notify } from '../utils/notify.js';
import { audit } from '../utils/audit.js';
const r = Router(); r.use(protect);
r.get('/', async (req, res) => {
  const f = { user: req.user._id, archived: req.query.archived === 'true' }; if (req.query.unread) f.read = false;
  res.json({ items: await Notification.find(f).sort('-createdAt').limit(100), unread: await Notification.countDocuments({ user: req.user._id, read: false, archived: false }) });
});
r.get('/count', async (req, res) => res.json({ unread: await Notification.countDocuments({ user: req.user._id, read: false, archived: false }) }));
r.post('/read-all', async (req, res) => { await Notification.updateMany({ user: req.user._id, read: false }, { read: true }); res.json({ ok: true }); });
r.post('/:id/read', async (req, res) => { await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true }); res.json({ ok: true }); });
r.post('/broadcast', allow('admin'), async (req, res) => {
  const { title, message, block } = req.body; if (!title || !message) throw new HttpError(400, 'Title and message are required');
  let ids;
  if (block) { const rooms = await Room.find({ block }).select('_id'); ids = (await Allocation.find({ room: { $in: rooms.map((x) => x._id) }, status: { $in: ACTIVE } })).map((a) => a.student); }
  else ids = (await User.find({ role: 'student', active: true }).select('_id')).map((u) => u._id);
  await notify(ids, { type: 'system', title, message });
  audit(req.user, 'BROADCAST', 'Notification', null, { block: block || 'All', count: ids.length }, req.ip); res.json({ sent: ids.length });
});
export default r;
