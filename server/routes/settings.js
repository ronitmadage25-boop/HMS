import { Router } from 'express';
import { protect, allow } from '../middleware/auth.js';
import { getSettings, pick } from '../utils/helpers.js';
import { audit } from '../utils/audit.js';
const r = Router(); r.use(protect);
r.get('/', async (req, res) => res.json(await getSettings()));
r.put('/', allow('admin'), async (req, res) => {
  const s = await getSettings();
  Object.assign(s, pick(req.body, ['institution', 'session', 'applicationDeadline', 'visitingHours', 'blockHours', 'maxVisitors', 'resolutionHours', 'maintenanceSla', 'lateFeeAmount']));
  ['blockHours', 'resolutionHours', 'maintenanceSla'].forEach((k) => s.markModified(k));
  await s.save(); audit(req.user, 'SETTINGS_UPDATED', 'Settings', s._id, req.body, req.ip); res.json(s);
});
export default r;
