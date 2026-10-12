
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { HttpError } from '../utils/helpers.js';

export async function protect(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;

  if (!token) {
    throw new HttpError(401, 'Please sign in to continue');
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(
      401,
      'Your session has expired. Please sign in again.'
    );
  }

  const user = await User.findById(payload.id);

  if (!user || !user.active) {
    throw new HttpError(401, 'Account not available');
  }

  req.user = user;
  next();
}

export const allow = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    throw new HttpError(403, 'Access Denied');
  }

  next();
};
