import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { HttpError } from '../utils/helpers.js';

const IDLE_MS = 20 * 60 * 1000;

export async function protect(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please sign in to continue');
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch { throw new HttpError(401, 'Your session has expired. Please sign in again.'); }
  const user = await User.findById(payload.id);
  if (!user || !user.active) throw new HttpError(401, 'Account not available');
  const now = Date.now();
  if (user.lastActive && now - user.lastActive.getTime() > IDLE_MS) throw new HttpError(401, 'Signed out after 20 minutes of inactivity', { code: 'IDLE' });
  if (!user.lastActive || now - user.lastActive.getTime() > 30000) { user.lastActive = new Date(now); await User.updateOne({ _id: user._id }, { lastActive: user.lastActive }); }
  req.user = user;
  next();
}
export const allow = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'Access Denied');
  next();
};
