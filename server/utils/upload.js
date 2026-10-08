import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { HttpError } from './helpers.js';

export const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const make = (types, label) => multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, f, cb) => cb(null, crypto.randomBytes(14).toString('hex') + path.extname(f.originalname).toLowerCase()),
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 3 },
  fileFilter: (req, f, cb) => types.includes(f.mimetype) ? cb(null, true) : cb(new HttpError(400, `Only ${label} files up to 2 MB are allowed`)),
});
export const uploadDocs = make(['application/pdf', 'image/jpeg'], 'PDF or JPEG');
export const uploadImages = make(['image/jpeg', 'image/png'], 'JPEG or PNG');
export const fileUrl = (f) => `/uploads/${f.filename}`;
export const removeFile = (p) => { if (p) fs.unlink(path.join(UPLOAD_DIR, path.basename(p)), () => {}); };
