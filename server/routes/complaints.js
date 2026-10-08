import { Router } from 'express';
import { Complaint, Allocation, User, WorkOrder, ACTIVE } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { HttpError, nextSeq, getSettings } from '../utils/helpers.js';
import { notify, idsByRole } from '../utils/notify.js';
import { audit } from '../utils/audit.js';
import { uploadImages, fileUrl } from '../utils/upload.js';

const r = Router(); r.use(protect);
const PRIV = ['Discipline', 'Security'];
const scope = (u) => (u.role === 'student' ? { student: u._id } : u.role === 'staff' ? { category: { $nin: PRIV } } : {});
const isOwner = (c, u) => String(c.student?._id || c.student) === String(u._id);
const mask = (c, u) => {
  const o = c.toObject ? c.toObject() : c;
  const sid = String(o.student?._id || o.student);
  if (o.anonymous && u.role !== 'admin' && !isOwner(o, u)) { o.student = null; o.hidden = true; o.comments = o.comments.map((x) => (x.role === 'student' ? { ...x, name: 'Anonymous' } : x)); o.history = o.history.map((h) => ({ ...h, byName: String(h.by) === sid ? 'Anonymous' : h.byName })); }
  return o;
};
const load = async (req) => {
  const c = await Complaint.findOne({ _id: req.params.id, ...scope(req.user) }).populate('student', 'name username').populate('assignedTo', 'name').populate('room', 'block number').populate('workOrder', 'number status priority');
  if (!c) throw new HttpError(404, 'Complaint not found');
  return c;
};
const log = (c, user, status, note) => { c.status = status; c.history.push({ status, by: user._id, byName: user.name, note }); };

r.get('/duplicate-check', allow('student'), async (req, res) => {
  const a = await Allocation.findOne({ student: req.user._id, status: { $in: ACTIVE } }); if (!a) return res.json({ similar: [] });
  const similar = await Complaint.find({ room: a.room, category: req.query.category, status: { $nin: ['Resolved', 'Closed'] } }).select('number description status createdAt').limit(3);
  res.json({ similar });
});
r.get('/', async (req, res) => {
  const f = scope(req.user);
  ['status', 'category', 'block'].forEach((k) => { if (req.query[k]) f[k] = req.query[k]; });
  if (req.query.overdue) f.overdue = true;
  if (req.query.room) f.room = req.query.room;
  if (req.query.from || req.query.to) f.createdAt = { ...(req.query.from && { $gte: new Date(req.query.from) }), ...(req.query.to && { $lte: new Date(new Date(req.query.to).setHours(23, 59, 59)) }) };
  const list = await Complaint.find(f).populate('student', 'name username').populate('assignedTo', 'name').populate('room', 'block number').sort('-createdAt').limit(300);
  res.json(list.map((c) => mask(c, req.user)));
});
r.get('/:id', async (req, res) => res.json(mask(await load(req), req.user)));
r.post('/', allow('student'), uploadImages.array('photos', 3), async (req, res) => {
  const { category, description, anonymous } = req.body;
  if (!['Maintenance', 'Mess/Food', 'Discipline', 'Security', 'Other'].includes(category)) throw new HttpError(400, 'Choose a complaint category');
  if (!description || description.trim().length < 10) throw new HttpError(400, 'Describe the problem in at least 10 characters');
  const alloc = await Allocation.findOne({ student: req.user._id, status: { $in: ACTIVE } }).populate('room');
  const c = await Complaint.create({
    number: await nextSeq('complaint'), student: req.user._id, category, description: description.trim(), photos: (req.files || []).map(fileUrl),
    anonymous: anonymous === 'true' && PRIV.includes(category), room: alloc?.room._id, block: alloc?.room.block,
    history: [{ status: 'Registered', by: req.user._id, byName: req.user.name }],
  });
  notify(req.user._id, { type: 'complaint', title: 'Complaint registered', message: `Your complaint #${c.number} (${category}) has been registered.`, link: `/complaints` });
  notify(await idsByRole('warden'), { type: 'complaint', title: 'New complaint', message: `Complaint #${c.number} (${category}) was registered.`, link: '/complaints' });
  audit(req.user, 'COMPLAINT_CREATED', 'Complaint', c._id, { number: c.number, category }, req.ip); res.status(201).json(c);
});
r.post('/:id/comment', async (req, res) => {
  const c = await load(req); if (c.status === 'Closed') throw new HttpError(400, 'This complaint is closed');
  if (!['student', 'staff', 'warden', 'admin'].includes(req.user.role) || !req.body.text?.trim()) throw new HttpError(400, 'Write a comment first');
  if (req.user.role === 'staff' && String(c.assignedTo?._id) !== String(req.user._id) && c.assignedTo) throw new HttpError(403, 'Only the assigned staff member can comment');
  c.comments.push({ by: req.user._id, name: req.user.name, role: req.user.role, text: req.body.text.trim() }); await c.save();
  const other = isOwner(c, req.user) ? [c.assignedTo?._id] : [c.student._id];
  notify(other, { type: 'complaint', title: `New comment on complaint #${c.number}`, message: req.body.text.trim().slice(0, 120), link: '/complaints' });
  res.json(mask(c, req.user));
});
r.post('/:id/assign', allow('warden', 'admin'), async (req, res) => {
  const c = await load(req); const st = await User.findOne({ _id: req.body.staffId, role: 'staff' }); if (!st) throw new HttpError(404, 'Staff member not found');
  if (['Resolved', 'Closed'].includes(c.status)) throw new HttpError(400, 'This complaint is already resolved');
  c.assignedTo = st._id; log(c, req.user, 'Assigned', `Assigned to ${st.name}`); await c.save();
  notify([st._id, c.student._id], { type: 'complaint', title: `Complaint #${c.number} assigned`, message: `Complaint #${c.number} is assigned to ${st.name}.`, link: '/complaints' });
  audit(req.user, 'COMPLAINT_ASSIGNED', 'Complaint', c._id, { staff: st.name }, req.ip); res.json(mask(c, req.user));
});
r.post('/:id/status', allow('staff', 'warden', 'admin'), async (req, res) => {
  const c = await load(req); if (['Resolved', 'Closed'].includes(c.status)) throw new HttpError(400, 'Use resolve or reopen flows for this complaint');
  log(c, req.user, 'In Progress', req.body.note); await c.save();
  notify(c.student._id, { type: 'complaint', title: `Complaint #${c.number} in progress`, message: 'Work has started on your complaint.', link: '/complaints' }); res.json(mask(c, req.user));
});
r.post('/:id/resolve', allow('staff', 'warden', 'admin'), async (req, res) => {
  const c = await load(req); if (['Resolved', 'Closed'].includes(c.status)) throw new HttpError(400, 'Already resolved');
  if (!req.body.remarks || req.body.remarks.trim().length < 5) throw new HttpError(400, 'Enter resolution remarks');
  c.resolution = { remarks: req.body.remarks.trim(), by: req.user._id, at: new Date() }; c.resolvedAt = new Date(); log(c, req.user, 'Resolved', req.body.remarks); await c.save();
  notify(c.student._id, { type: 'complaint', title: `Complaint #${c.number} resolved`, message: 'Please confirm the fix or dispute it within 5 days. It closes automatically after that.', link: '/complaints' });
  audit(req.user, 'COMPLAINT_RESOLVED', 'Complaint', c._id, {}, req.ip); res.json(mask(c, req.user));
});
r.post('/:id/respond', allow('student'), async (req, res) => {
  const c = await load(req); if (c.status !== 'Resolved') throw new HttpError(400, 'This complaint is not awaiting your confirmation');
  if (req.body.action === 'confirm') { c.closedAt = new Date(); log(c, req.user, 'Closed', 'Confirmed by student'); }
  else { c.reopenCount += 1; c.resolvedAt = undefined; log(c, req.user, 'In Progress', `Disputed: ${req.body.note || 'no reason given'}`); notify([...(await idsByRole('warden')), c.assignedTo?._id], { type: 'complaint', title: `Complaint #${c.number} reopened`, message: 'The student disputed the resolution.', link: '/complaints' }); }
  await c.save(); res.json(mask(c, req.user));
});
r.post('/:id/rate', allow('student'), async (req, res) => {
  const c = await load(req); const n = Number(req.body.rating);
  if (c.status !== 'Closed') throw new HttpError(400, 'You can rate a complaint after it is closed'); if (!(n >= 1 && n <= 5)) throw new HttpError(400, 'Rating must be 1 to 5');
  c.rating = n; await c.save(); res.json(mask(c, req.user));
});
export default r;
