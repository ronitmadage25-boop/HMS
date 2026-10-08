import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Allocation } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { HttpError, pick } from '../utils/helpers.js';
import { audit } from '../utils/audit.js';

const r = Router(); r.use(protect);
r.get('/lookup', allow('staff', 'warden', 'admin'), async (req, res) => {
  const q = String(req.query.q || '').trim(); if (q.length < 2) return res.json([]);
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  res.json(await User.find({ role: 'student', active: true, $or: [{ name: rx }, { username: rx }] }).select('name username department year').limit(8));
});
r.get('/staff', allow('warden', 'admin'), async (req, res) => res.json(await User.find({ role: 'staff', active: true }).select('name username phone').sort('name')));
r.use(allow('admin'));
r.get('/', async (req, res) => {
  const f = {}; if (req.query.role) f.role = req.query.role; if (req.query.active) f.active = req.query.active === 'true';
  if (req.query.q) { const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); f.$or = [{ name: rx }, { username: rx }, { email: rx }]; }
  res.json(await User.find(f).sort('-createdAt').limit(300));
});
r.post('/', async (req, res) => {
  const { name, username, email, password, role } = req.body;
  if (!name || !username || !email || !password || !role) throw new HttpError(400, 'Name, ID, e-mail, password and role are required');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const u = await User.create({ ...pick(req.body, ['name', 'username', 'email', 'role', 'phone', 'department', 'year', 'blocks']), password: await bcrypt.hash(password, 12) });
  audit(req.user, 'USER_CREATED', 'User', u._id, { role }, req.ip); res.status(201).json(u);
});
r.put('/:id', async (req, res) => {
  const u = await User.findById(req.params.id); if (!u) throw new HttpError(404, 'User not found');
  if (String(u._id) === String(req.user._id) && (req.body.active === false || (req.body.role && req.body.role !== 'admin'))) throw new HttpError(400, 'You cannot deactivate or demote your own account');
  Object.assign(u, pick(req.body, ['name', 'email', 'phone', 'department', 'year', 'role', 'blocks', 'active', 'disciplinaryHold', 'disciplinaryNote', 'academicStanding']));
  await u.save(); audit(req.user, 'USER_UPDATED', 'User', u._id, pick(req.body, ['role', 'active', 'disciplinaryHold', 'blocks']), req.ip); res.json(u);
});
r.post('/:id/password', async (req, res) => {
  if (!req.body.password || req.body.password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  await User.updateOne({ _id: req.params.id }, { password: await bcrypt.hash(req.body.password, 12), failedAttempts: 0, lockUntil: null });
  audit(req.user, 'USER_PASSWORD_SET', 'User', req.params.id, {}, req.ip); res.json({ ok: true });
});
export default r;
