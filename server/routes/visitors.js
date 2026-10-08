import { Router } from 'express';
import crypto from 'crypto';
import { Visitor, Allocation, User, ACTIVE } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { HttpError, getSettings, hoursFor, hhmm, endOfDay, startOfDay } from '../utils/helpers.js';
import { notify, idsByRole } from '../utils/notify.js';
import { audit } from '../utils/audit.js';
import { uploadImages, fileUrl } from '../utils/upload.js';

const r = Router(); r.use(protect);
const code = () => 'V-' + crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
const view = (v) => { const o = v.toObject ? v.toObject() : v; o.expired = o.status === 'Registered' && o.kind === 'PreRegistered' && o.expectedDate && endOfDay(o.expectedDate) < new Date(); return o; };
const blockOf = async (studentId) => (await Allocation.findOne({ student: studentId, status: { $in: ACTIVE } }).populate('room'))?.room?.block;
const POP = [['student', 'name username'], ['registeredBy', 'name']];
const withPop = (q) => POP.reduce((x, [p, s]) => x.populate(p, s), q);

r.get('/', async (req, res) => {
  const f = {};
  if (req.user.role === 'student') f.student = req.user._id;
  if (req.query.status) f.status = req.query.status;
  if (req.query.student) f.student = req.query.student;
  if (req.query.from || req.query.to) f.createdAt = { ...(req.query.from && { $gte: startOfDay(req.query.from) }), ...(req.query.to && { $lte: endOfDay(req.query.to) }) };
  if (req.query.today) f.$or = [{ expectedDate: { $gte: startOfDay(), $lte: endOfDay() } }, { status: 'Inside' }];
  if (req.query.approval) f.approvalRequested = true, f.wardenApproved = false, f.status = 'Registered';
  let list = await withPop(Visitor.find(f).sort('-createdAt').limit(400));
  if (req.query.q) { const q = req.query.q.toLowerCase(); list = list.filter((v) => `${v.name} ${v.student?.name} ${v.code} ${v.idNumber}`.toLowerCase().includes(q)); }
  const s = await getSettings(); const out = list.map(view);
  if (req.query.alerts) { const now = new Date(); return res.json(out.filter((v) => v.status === 'Inside' && v.entryAt && hhmm(now) > hoursFor(s, v.block).end)); }
  res.json(out);
});
r.post('/', allow('student'), async (req, res) => {
  const { name, phone, relationship, expectedDate, purpose } = req.body;
  if (!name || !phone || !relationship || !expectedDate) throw new HttpError(400, 'Name, phone, relationship and expected visit date are required');
  if (endOfDay(expectedDate) < new Date()) throw new HttpError(400, 'Expected visit date cannot be in the past');
  const v = await Visitor.create({ student: req.user._id, name, phone, relationship, purpose, expectedDate, kind: 'PreRegistered', code: code(), registeredBy: req.user._id });
  audit(req.user, 'VISITOR_PREREGISTERED', 'Visitor', v._id, { code: v.code }, req.ip); res.status(201).json(v);
});
r.delete('/:id', allow('student'), async (req, res) => {
  const v = await Visitor.findOne({ _id: req.params.id, student: req.user._id, status: 'Registered' }); if (!v) throw new HttpError(404, 'Registration not found or the visitor is already inside');
  await v.deleteOne(); res.json({ ok: true });
});
r.post('/walkin', allow('staff', 'warden', 'admin'), uploadImages.single('photo'), async (req, res) => {
  const { name, phone, idType, idNumber, studentId, purpose, relationship, force, enter } = req.body;
  if (!name || !phone || !idType || !idNumber || !studentId) throw new HttpError(400, 'Name, phone, ID type, ID number and the student being visited are required');
  const dup = await Visitor.findOne({ idNumber, status: 'Inside' });
  if (dup && force !== 'true') throw new HttpError(409, `A visitor with this ID is already inside (checked in ${dup.entryAt.toLocaleTimeString()}) and has not exited.`, { code: 'DUPLICATE_INSIDE' });
  const st = await User.findOne({ _id: studentId, role: 'student' }); if (!st) throw new HttpError(404, 'Student not found');
  const v = await Visitor.create({ student: st._id, name, phone, idType, idNumber, purpose, relationship, expectedDate: new Date(), kind: 'WalkIn', code: code(), photo: req.file ? fileUrl(req.file) : undefined, registeredBy: req.user._id });
  audit(req.user, 'VISITOR_WALKIN', 'Visitor', v._id, { code: v.code }, req.ip);
  if (enter === 'true') return enterVisitor(req, res, v, true);
  res.status(201).json(v);
});
async function enterVisitor(req, res, v, created = false) {
  const s = await getSettings(); const block = await blockOf(v.student); const now = new Date(); const h = hoursFor(s, block);
  if (v.status !== 'Registered') throw new HttpError(400, v.status === 'Inside' ? 'This visitor is already inside' : 'This visit has already ended');
  if (v.kind === 'PreRegistered' && endOfDay(v.expectedDate) < now && !v.wardenApproved) throw new HttpError(409, 'This pre-registration has expired. Verify the visitor manually and request warden approval.', { code: 'EXPIRED', visitorId: v._id });
  if ((hhmm(now) < h.start || hhmm(now) > h.end) && !v.wardenApproved) throw new HttpError(409, `Visiting hours are ${h.start}-${h.end}${block ? ' for Block ' + block : ''}. Entry outside these hours needs warden approval.`, { code: 'OUT_OF_HOURS', visitorId: v._id });
  const inside = await Visitor.countDocuments({ student: v.student, status: 'Inside' });
  if (inside >= s.maxVisitors && req.body.force !== 'true' && req.body.force !== true) throw new HttpError(409, `${inside} visitors are already inside for this student (limit ${s.maxVisitors}).`, { code: 'LIMIT', visitorId: v._id });
  v.status = 'Inside'; v.entryAt = now; v.block = block; await v.save();
  notify(v.student, { type: 'visitor', title: 'Visitor arrived', message: `${v.name} has entered the hostel to meet you.` });
  audit(req.user, 'VISITOR_ENTRY', 'Visitor', v._id, {}, req.ip);
  res.status(created ? 201 : 200).json(view(await withPop(Visitor.findById(v._id))));
}
r.post('/entry', allow('staff', 'warden', 'admin'), async (req, res) => {
  const v = req.body.id ? await Visitor.findById(req.body.id) : await Visitor.findOne({ code: String(req.body.code || '').toUpperCase().trim() });
  if (!v) throw new HttpError(404, 'No visitor found for that code');
  await enterVisitor(req, res, v);
});
r.post('/:id/request-approval', allow('staff'), async (req, res) => {
  const v = await Visitor.findById(req.params.id); if (!v) throw new HttpError(404, 'Visitor not found');
  v.approvalRequested = true; await v.save();
  notify(await idsByRole('warden'), { type: 'visitor', title: 'Visitor entry needs approval', message: `${v.name} is at the gate outside visiting hours or with an expired pass.`, link: '/visitors' });
  res.json({ ok: true });
});
r.post('/:id/approve', allow('warden', 'admin'), async (req, res) => {
  const v = await Visitor.findById(req.params.id); if (!v) throw new HttpError(404, 'Visitor not found');
  v.wardenApproved = true; await v.save();
  notify(await idsByRole('staff'), { type: 'visitor', title: 'Visitor entry approved', message: `${v.name} (${v.code}) is approved for entry.`, link: '/visitors' });
  audit(req.user, 'VISITOR_APPROVED', 'Visitor', v._id, {}, req.ip); res.json({ ok: true });
});
r.post('/:id/exit', allow('staff', 'warden', 'admin'), async (req, res) => {
  const v = await Visitor.findById(req.params.id); if (!v || v.status !== 'Inside') throw new HttpError(400, 'This visitor is not inside the premises');
  v.exitAt = new Date(); v.durationMin = Math.max(1, Math.round((v.exitAt - v.entryAt) / 60000)); v.status = 'Exited'; await v.save();
  audit(req.user, 'VISITOR_EXIT', 'Visitor', v._id, { minutes: v.durationMin }, req.ip); res.json(view(v));
});
export default r;
