import { Router } from 'express';
import { WorkOrder, Complaint, User } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { HttpError, nextSeq, getSettings } from '../utils/helpers.js';
import { notify } from '../utils/notify.js';
import { audit } from '../utils/audit.js';
import { uploadImages, fileUrl } from '../utils/upload.js';

const r = Router(); r.use(protect, allow('warden', 'staff', 'admin'));
export const woOverdue = (w, s) => w.status !== 'Completed' && new Date(w.createdAt).getTime() + (s.maintenanceSla?.[w.priority] || 72) * 3600000 < Date.now();
const pop = (q) => q.populate('assignedTo', 'name').populate('complaint', 'number category').populate('createdBy', 'name');

r.get('/', async (req, res) => {
  const f = req.user.role === 'staff' ? { assignedTo: req.user._id } : {}; if (req.query.status) f.status = req.query.status;
  const s = await getSettings(); const list = await pop(WorkOrder.find(f).sort('-createdAt').limit(300));
  res.json(list.map((w) => ({ ...w.toObject(), overdue: woOverdue(w, s) })));
});
r.get('/convertible', allow('warden', 'admin'), async (req, res) => res.json(await Complaint.find({ category: 'Maintenance', workOrder: null, status: { $in: ['Registered', 'Assigned', 'In Progress'] } }).select('number description block').populate('room', 'block number')));
r.post('/', allow('warden', 'admin'), async (req, res) => {
  let { complaintId, title, description, location, priority, assignedTo } = req.body; let c = null;
  if (complaintId) {
    c = await Complaint.findById(complaintId); if (!c || c.category !== 'Maintenance') throw new HttpError(400, 'Only Maintenance complaints can be converted');
    if (c.workOrder) throw new HttpError(409, 'A work order already exists for this complaint');
    title ||= `Complaint #${c.number}`; description ||= c.description;
  }
  if (!title) throw new HttpError(400, 'A title is required');
  const st = assignedTo ? await User.findOne({ _id: assignedTo, role: 'staff' }) : null; if (assignedTo && !st) throw new HttpError(404, 'Staff member not found');
  const w = await WorkOrder.create({ number: await nextSeq('workorder'), title, description, location, priority: priority || 'Medium', assignedTo: st?._id, createdBy: req.user._id, complaint: c?._id });
  if (c) { c.workOrder = w._id; if (st) { c.assignedTo = st._id; c.status = 'Assigned'; c.history.push({ status: 'Assigned', by: req.user._id, byName: req.user.name, note: `Work order #${w.number} assigned to ${st.name}` }); } await c.save(); }
  if (st) notify(st._id, { type: 'maintenance', title: 'New work order', message: `Work order #${w.number}: ${title} (${w.priority})`, link: '/work-orders' });
  audit(req.user, 'WORKORDER_CREATED', 'WorkOrder', w._id, { number: w.number }, req.ip); res.status(201).json(w);
});
r.put('/:id', allow('warden', 'admin'), async (req, res) => {
  const w = await WorkOrder.findById(req.params.id); if (!w) throw new HttpError(404, 'Work order not found');
  if (w.status === 'Completed') throw new HttpError(400, 'Completed work orders cannot be changed');
  if (req.body.priority) w.priority = req.body.priority;
  if (req.body.assignedTo) { const st = await User.findOne({ _id: req.body.assignedTo, role: 'staff' }); if (!st) throw new HttpError(404, 'Staff member not found'); w.assignedTo = st._id; notify(st._id, { type: 'maintenance', title: 'Work order assigned', message: `Work order #${w.number}: ${w.title}`, link: '/work-orders' }); if (w.complaint) await Complaint.updateOne({ _id: w.complaint }, { assignedTo: st._id }); }
  await w.save(); res.json(w);
});
r.post('/:id/update', allow('staff', 'warden', 'admin'), uploadImages.array('photos', 3), async (req, res) => {
  const w = await WorkOrder.findById(req.params.id); if (!w) throw new HttpError(404, 'Work order not found');
  if (req.user.role === 'staff' && String(w.assignedTo) !== String(req.user._id)) throw new HttpError(403, 'This work order is assigned to someone else');
  if (w.status === 'Completed') throw new HttpError(400, 'Already completed');
  const status = req.body.status; if (!['In Progress', 'Completed'].includes(status)) throw new HttpError(400, 'Status must be In Progress or Completed');
  w.status = status;
  if (status === 'Completed') {
    if (!req.body.remarks || req.body.remarks.trim().length < 3) throw new HttpError(400, 'Add completion remarks');
    w.remarks = req.body.remarks.trim(); w.photos = (req.files || []).map(fileUrl); w.completedAt = new Date();
    if (w.complaint) {
      const c = await Complaint.findById(w.complaint);
      if (c && !['Resolved', 'Closed'].includes(c.status)) { c.resolution = { remarks: w.remarks, by: req.user._id, at: new Date() }; c.resolvedAt = new Date(); c.status = 'Resolved'; c.history.push({ status: 'Resolved', by: req.user._id, byName: req.user.name, note: `Work order #${w.number} completed: ${w.remarks}` }); await c.save();
        notify(c.student, { type: 'maintenance', title: 'Maintenance completed', message: `Work on complaint #${c.number} is complete. Please confirm the fix.`, link: '/complaints' }); }
    }
  } else if (w.complaint) { await Complaint.updateOne({ _id: w.complaint, status: { $in: ['Registered', 'Assigned'] } }, { status: 'In Progress', $push: { history: { status: 'In Progress', by: req.user._id, byName: req.user.name, note: `Work order #${w.number} started` } } }); }
  await w.save(); audit(req.user, 'WORKORDER_' + status.toUpperCase().replace(' ', '_'), 'WorkOrder', w._id, {}, req.ip); res.json(w);
});
export default r;
