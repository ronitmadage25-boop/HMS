import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { HttpError, pick } from '../utils/helpers.js';
import { audit } from '../utils/audit.js';
import { notify, idsByRole } from '../utils/notify.js';
import { sendMail, mailEnabled } from '../utils/mailer.js';

const r = Router();
const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '12h' });
export const publicUser = (u) => ({ id: u._id, name: u.name, username: u.username, email: u.email, role: u.role, phone: u.phone, department: u.department, year: u.year, blocks: u.blocks, emailPrefs: u.emailPrefs, academicStanding: u.academicStanding, disciplinaryHold: u.disciplinaryHold });
const strong = (p) => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
const INVITES = { warden: 'WARDEN_INVITE_CODE', staff: 'STAFF_INVITE_CODE', admin: 'ADMIN_INVITE_CODE' };

r.post('/register', async (req, res) => {
  const { name, username, email, phone, password, role, department, year, code } = req.body;
  if (!name || !username || !email || !password || !role) throw new HttpError(400, 'Please fill in all required fields');
  if (!['student', 'warden', 'staff', 'admin'].includes(role)) throw new HttpError(400, 'Choose a valid role');
  if (!strong(password)) throw new HttpError(400, 'Password must be at least 8 characters and include a letter and a number');
  if (role !== 'student') {
    const expected = process.env[INVITES[role]];
    if (!expected || code !== expected) throw new HttpError(403, `The ${role} invite code is incorrect`);
  }
  if (role === 'student' && (!department || !year)) throw new HttpError(400, 'Department and year are required for students');
  if (await User.findOne({ $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] })) throw new HttpError(409, 'An account with this ID or e-mail already exists');
  const u = await User.create({ name, username, email, phone, role, department, year, password: await bcrypt.hash(password, 12), lastActive: new Date() });
  audit(u, 'REGISTER', 'User', u._id, { role }, req.ip);
  res.status(201).json({ token: sign(u), user: publicUser(u) });
});

r.post('/login', async (req, res) => {
  const { identifier, password, role } = req.body;
  const bad = () => { throw new HttpError(401, 'Invalid credentials. Check your ID, password and selected role.'); };
  if (!identifier || !password) bad();
  const id = String(identifier).toLowerCase().trim();
  const u = await User.findOne({ $or: [{ username: id }, { email: id }] }).select('+password');
  if (!u) { audit(null, 'LOGIN_FAILED', 'User', null, { identifier: id }, req.ip); bad(); }
  if (u.lockUntil && u.lockUntil > new Date()) {
    const mins = Math.ceil((u.lockUntil - Date.now()) / 60000);
    throw new HttpError(423, `Too many failed attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`);
  }
  if (!u.active) throw new HttpError(403, 'This account has been deactivated. Contact the administrator.');
  const ok = await bcrypt.compare(password, u.password);
  if (!ok || (role && role !== u.role)) {
    u.failedAttempts += 1;
    if (u.failedAttempts >= 3) {
      u.lockUntil = new Date(Date.now() + 15 * 60000); u.failedAttempts = 0;
      notify(await idsByRole('admin'), { type: 'system', title: 'Account locked after failed logins', message: `${u.name} (${u.username}) was locked for 15 minutes after 3 failed sign-in attempts.` });
    }
    await u.save(); audit(u, 'LOGIN_FAILED', 'User', u._id, {}, req.ip); bad();
  }
  u.failedAttempts = 0; u.lockUntil = undefined; u.lastActive = new Date(); await u.save();
  audit(u, 'LOGIN', 'User', u._id, {}, req.ip);
  res.json({ token: sign(u), user: publicUser(u) });
});

r.post('/forgot', async (req, res) => {
  const u = await User.findOne({ email: String(req.body.email || '').toLowerCase().trim() });
  if (u) {
    const token = crypto.randomBytes(24).toString('hex');
    u.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex'); u.resetExpires = new Date(Date.now() + 30 * 60000); await u.save();
    const link = `${process.env.CLIENT_URL}/reset-password?token=${token}&email=${encodeURIComponent(u.email)}`;
    if (mailEnabled()) await sendMail({ to: u.email, subject: 'Reset your password', html: `<p>Hi ${u.name},</p><p>Use this link within 30 minutes to set a new password:</p><p><a href="${link}">${link}</a></p>` });
    else console.log(`[password reset] SMTP not configured. Reset link for ${u.email}: ${link}`);
    audit(u, 'PASSWORD_RESET_REQUESTED', 'User', u._id, {}, req.ip);
  }
  res.json({ message: 'If that e-mail is registered, a reset link has been sent.' });
});

r.post('/reset', async (req, res) => {
  const { email, token, password } = req.body;
  if (!strong(password)) throw new HttpError(400, 'Password must be at least 8 characters and include a letter and a number');
  const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const u = await User.findOne({ email: String(email || '').toLowerCase(), resetTokenHash: hash, resetExpires: { $gt: new Date() } }).select('+password');
  if (!u) throw new HttpError(400, 'This reset link is invalid or has expired');
  u.password = await bcrypt.hash(password, 12); u.resetTokenHash = undefined; u.resetExpires = undefined; u.failedAttempts = 0; u.lockUntil = undefined; await u.save();
  audit(u, 'PASSWORD_RESET', 'User', u._id, {}, req.ip);
  res.json({ message: 'Password updated. You can sign in now.' });
});

r.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));
r.put('/me', protect, async (req, res) => {
  Object.assign(req.user, pick(req.body, ['name', 'phone', 'department', 'year']));
  if (req.body.emailPrefs) { req.user.emailPrefs = { ...req.user.emailPrefs, ...req.body.emailPrefs }; req.user.markModified('emailPrefs'); }
  await req.user.save(); res.json({ user: publicUser(req.user) });
});
r.put('/password', protect, async (req, res) => {
  const u = await User.findById(req.user._id).select('+password');
  if (!(await bcrypt.compare(req.body.current || '', u.password))) throw new HttpError(400, 'Current password is incorrect');
  if (!strong(req.body.password)) throw new HttpError(400, 'New password must be at least 8 characters and include a letter and a number');
  u.password = await bcrypt.hash(req.body.password, 12); await u.save();
  audit(u, 'PASSWORD_CHANGED', 'User', u._id, {}, req.ip); res.json({ message: 'Password changed' });
});
r.post('/logout', protect, async (req, res) => { audit(req.user, 'LOGOUT', 'User', req.user._id, {}, req.ip); res.json({ ok: true }); });
export default r;
