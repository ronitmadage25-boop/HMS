import { Router } from 'express';
import { Application, User } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { HttpError, getSettings, nextSeq, pick } from '../utils/helpers.js';
import { notify, idsByRole } from '../utils/notify.js';
import { audit } from '../utils/audit.js';
import { uploadDocs, fileUrl, removeFile } from '../utils/upload.js';
import { availableBedsFor } from '../utils/rooms.js';

const r = Router(); r.use(protect);
const ENDED = ['Withdrawn', 'Rejected', 'Forfeited'];
const mine = async (req) => {
  const a = await Application.findById(req.params.id);
  if (!a || String(a.student) !== String(req.user._id)) throw new HttpError(404, 'Application not found');
  return a;
};
const EDITABLE = ['studentType', 'personal', 'program', 'year', 'category', 'roomTypePref', 'emergency'];

r.get('/mine', allow('student'), async (req, res) => res.json(await Application.find({ student: req.user._id }).sort('-createdAt')));
r.get('/', allow('warden', 'admin'), async (req, res) => {
  const f = {}; if (req.query.status) f.status = req.query.status; else if (req.query.pending) f.status = { $in: ['Submitted', 'Under Review'] };
  if (req.query.session) f.session = req.query.session;
  let list = await Application.find({ ...f, status: f.status || { $ne: 'Draft' } }).populate('student', 'name username department year academicStanding disciplinaryHold').sort('submittedAt');
  if (req.query.q) { const q = req.query.q.toLowerCase(); list = list.filter((a) => `${a.student?.name} ${a.student?.username} ${a.number}`.toLowerCase().includes(q)); }
  res.json(list);
});
r.post('/', allow('student'), async (req, res) => {
  const s = await getSettings();
  if (req.user.disciplinaryHold) throw new HttpError(403, 'A disciplinary hold is recorded on your account. Contact the administrator before applying.');
  if (s.applicationDeadline && new Date() > s.applicationDeadline) throw new HttpError(400, `Applications for ${s.session} closed on ${s.applicationDeadline.toDateString()}`);
  const existing = await Application.findOne({ student: req.user._id, session: s.session, status: { $nin: ENDED } });
  if (existing) throw new HttpError(409, 'You already have an active application for this session', { id: existing._id });
  const a = await Application.create({ student: req.user._id, session: s.session, program: req.user.department, year: req.user.year, personal: { fullName: req.user.name, phone: req.user.phone } });
  res.status(201).json(a);
});
r.put('/:id', allow('student'), async (req, res) => {
  const a = await mine(req); if (a.status !== 'Draft') throw new HttpError(400, 'Only draft applications can be edited');
  Object.assign(a, pick(req.body, EDITABLE)); await a.save(); res.json(a);
});
r.post('/:id/documents', allow('student'), uploadDocs.single('file'), async (req, res) => {
  const a = await mine(req); if (a.status !== 'Draft') throw new HttpError(400, 'Documents can only be changed while the application is a draft');
  const kind = req.body.kind; if (!['photo', 'idProof', 'feeProof'].includes(kind)) throw new HttpError(400, 'Unknown document type');
  if (!req.file) throw new HttpError(400, 'Choose a file to upload');
  const old = a.documents.find((d) => d.kind === kind); if (old) removeFile(old.path);
  a.documents = a.documents.filter((d) => d.kind !== kind);
  a.documents.push({ kind, name: req.file.originalname, path: fileUrl(req.file), size: req.file.size });
  await a.save(); res.json(a);
});
r.delete('/:id/documents/:kind', allow('student'), async (req, res) => {
  const a = await mine(req); if (a.status !== 'Draft') throw new HttpError(400, 'Documents can only be changed while the application is a draft');
  const old = a.documents.find((d) => d.kind === req.params.kind); if (old) removeFile(old.path);
  a.documents = a.documents.filter((d) => d.kind !== req.params.kind); await a.save(); res.json(a);
});
r.post('/:id/submit', allow('student'), async (req, res) => {
  const a = await mine(req); const s = await getSettings();
  if (a.status !== 'Draft') throw new HttpError(400, 'This application has already been submitted');
  if (req.user.disciplinaryHold) throw new HttpError(403, 'A disciplinary hold is recorded on your account.');
  if (s.applicationDeadline && new Date() > s.applicationDeadline) throw new HttpError(400, `The application deadline (${s.applicationDeadline.toDateString()}) has passed`);
  const miss = [];
  const p = a.personal || {};
  if (!p.fullName) miss.push('Full name'); if (!p.dob) miss.push('Date of birth'); if (!p.gender) miss.push('Gender'); if (!p.address) miss.push('Address'); if (!p.phone) miss.push('Phone');
  if (!a.program) miss.push('Program'); if (!a.year) miss.push('Year'); if (!a.category) miss.push('Category'); if (!a.roomTypePref) miss.push('Room type preference');
  if (!a.emergency?.name || !a.emergency?.phone || !a.emergency?.relation) miss.push('Emergency contact');
  [['photo', 'Photograph'], ['idProof', 'ID proof'], ['feeProof', 'Fee-payment proof']].forEach(([k, l]) => { if (!a.documents.find((d) => d.kind === k)) miss.push(l); });
  if (miss.length) throw new HttpError(400, `Please complete: ${miss.join(', ')}`, { missing: miss });
  a.number = await nextSeq('application'); a.status = 'Submitted'; a.submittedAt = new Date(); await a.save();
  notify(req.user._id, { type: 'application', title: 'Application submitted', message: `Your hostel application #${a.number} has been submitted and is waiting for the warden's review.`, link: '/application' });
  notify(await idsByRole('warden'), { type: 'application', title: 'New application to review', message: `Application #${a.number} from ${req.user.name} is ready for review.`, link: '/approvals' });
  audit(req.user, 'APPLICATION_SUBMITTED', 'Application', a._id, { number: a.number }, req.ip); res.json(a);
});
r.post('/:id/withdraw', allow('student'), async (req, res) => {
  const a = await mine(req);
  if (!['Draft', 'Submitted', 'Under Review', 'Waitlisted', 'Approved'].includes(a.status)) throw new HttpError(400, 'A final decision has been recorded, so this application can no longer be withdrawn');
  a.status = 'Withdrawn'; await a.save(); audit(req.user, 'APPLICATION_WITHDRAWN', 'Application', a._id, {}, req.ip); res.json(a);
});

async function decide(a, decision, reason, user, ip) {
  if (!['Submitted', 'Under Review', 'Waitlisted'].includes(a.status)) throw new HttpError(409, `Application #${a.number} is already ${a.status}`);
  if (decision === 'Rejected' && (!reason || reason.trim().length < 10)) throw new HttpError(400, 'Enter a rejection reason of at least 10 characters');
  if (decision === 'Waitlisted') {
    if (await availableBedsFor(a.roomTypePref, a.category) > 0) throw new HttpError(400, 'Rooms are still available for this preference. Approve the application instead.');
    if (a.status !== 'Waitlisted') a.waitlistPosition = (await Application.countDocuments({ status: 'Waitlisted' })) + 1;
  } else a.waitlistPosition = undefined;
  a.status = decision; a.rejectionReason = decision === 'Rejected' ? reason.trim() : undefined; a.decidedBy = user._id; a.decidedAt = new Date(); await a.save();
  audit(user, `APPLICATION_${decision.toUpperCase()}`, 'Application', a._id, { number: a.number, reason }, ip);
  const msg = { Approved: 'has been approved. A room will be allotted shortly.', Rejected: `was rejected. Reason: ${reason}`, Waitlisted: `is waitlisted at position ${a.waitlistPosition}.` }[decision];
  notify(a.student, { type: 'application', title: `Application ${decision.toLowerCase()}`, message: `Your hostel application #${a.number} ${msg}`, link: '/application' });
}
r.post('/bulk/decision', allow('warden', 'admin'), async (req, res) => {
  const { ids = [], decision, reason } = req.body;
  if (!['Approved', 'Rejected'].includes(decision)) throw new HttpError(400, 'Bulk actions support approve or reject only');
  const results = [];
  for (const id of ids) {
    const a = await Application.findById(id);
    try { if (!a) throw new HttpError(404, 'Not found'); await decide(a, decision, reason, req.user, req.ip); results.push({ id, ok: true }); } catch (e) { results.push({ id, ok: false, message: e.message }); }
  }
  res.json({ results, done: results.filter((x) => x.ok).length });
});
r.get('/:id', allow('warden', 'admin'), async (req, res) => {
  const a = await Application.findById(req.params.id).populate('student', 'name username email phone department year academicStanding disciplinaryHold disciplinaryNote');
  if (!a) throw new HttpError(404, 'Application not found');
  if (a.status === 'Submitted') { a.status = 'Under Review'; await a.save(); }
  res.json(a);
});
r.post('/:id/decision', allow('warden', 'admin'), async (req, res) => {
  const a = await Application.findById(req.params.id); if (!a) throw new HttpError(404, 'Application not found');
  if (!['Approved', 'Rejected', 'Waitlisted'].includes(req.body.decision)) throw new HttpError(400, 'Invalid decision');
  await decide(a, req.body.decision, req.body.reason, req.user, req.ip); res.json(a);
});
r.post('/:id/reopen', allow('admin'), async (req, res) => {
  const a = await Application.findById(req.params.id); if (!a) throw new HttpError(404, 'Application not found');
  if (!['Rejected', 'Waitlisted'].includes(a.status)) throw new HttpError(400, 'Only rejected or waitlisted applications can be reopened');
  a.status = 'Under Review'; a.rejectionReason = undefined; a.waitlistPosition = undefined; await a.save();
  notify(a.student, { type: 'application', title: 'Application reopened', message: `Your application #${a.number} was reopened for reconsideration.`, link: '/application' });
  audit(req.user, 'APPLICATION_REOPENED', 'Application', a._id, {}, req.ip); res.json(a);
});
export default r;
