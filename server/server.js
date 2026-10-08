import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { User } from './models/index.js';
import { getSettings } from './utils/helpers.js';
import { UPLOAD_DIR } from './utils/upload.js';
import { startJobs } from './jobs.js';
import auth from './routes/auth.js';
import users from './routes/users.js';
import settings from './routes/settings.js';
import rooms from './routes/rooms.js';
import applications from './routes/applications.js';
import allocations from './routes/allocations.js';
import fees from './routes/fees.js';
import visitors from './routes/visitors.js';
import complaints from './routes/complaints.js';
import workorders from './routes/workorders.js';
import notifications from './routes/notifications.js';
import dashboard from './routes/dashboard.js';
import reports from './routes/reports.js';
import audit from './routes/audit.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const uri = process.env.MONGODB_URI;
if (!uri || uri.includes('PASTE_YOUR')) { console.error('\n✖ MONGODB_URI is not set. Open server/.env and paste your MongoDB connection link.\n'); process.exit(1); }
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('change-this')) console.warn('⚠ Set a long random JWT_SECRET in server/.env before going live.');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', (req, res) => res.json({ ok: true, database: 'mongodb' }));
app.use('/api/auth', auth);
app.use('/api/users', users);
app.use('/api/settings', settings);
app.use('/api/rooms', rooms);
app.use('/api/applications', applications);
app.use('/api/allocations', allocations);
app.use('/api/fees', fees);
app.use('/api/visitors', visitors);
app.use('/api/complaints', complaints);
app.use('/api/workorders', workorders);
app.use('/api/notifications', notifications);
app.use('/api/dashboard', dashboard);
app.use('/api/reports', reports);
app.use('/api/audit', audit);
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

const dist = path.join(here, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(', ') });
  if (err.code === 11000) return res.status(409).json({ message: 'That record already exists' });
  if (err.name === 'MulterError') return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 2 MB' : err.message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid reference' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Something went wrong on the server' : err.message, ...(err.extra || {}) });
});

async function bootstrap() {
  await getSettings();
  if (!(await User.exists({ role: 'admin' }))) {
    const { ADMIN_NAME, ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    if (ADMIN_USERNAME && ADMIN_EMAIL && ADMIN_PASSWORD) {
      await User.create({ name: ADMIN_NAME || 'Administrator', username: ADMIN_USERNAME, email: ADMIN_EMAIL, role: 'admin', password: await bcrypt.hash(ADMIN_PASSWORD, 12) });
      console.log(`✔ First administrator created. Sign in as "${ADMIN_USERNAME}" and change the password.`);
    }
  }
}
mongoose.connect(uri).then(async () => {
  console.log('✔ MongoDB connected: Atlas');
  await mongoose.syncIndexes();
  await bootstrap(); startJobs();
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`✔ API running on http://localhost:${port}`));
}).catch((e) => { console.error('✖ Could not connect to MongoDB:', e.message); process.exit(1); });
