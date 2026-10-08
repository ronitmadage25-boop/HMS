import { Router } from 'express';
import { Application, Allocation, Complaint, Invoice, Payment, User, WorkOrder, Visitor, ACTIVE } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { getSettings, startOfDay, endOfDay } from '../utils/helpers.js';
import { listRooms } from '../utils/rooms.js';
import { woOverdue } from './workorders.js';
import { verifyChain } from '../utils/audit.js';

const r = Router(); r.use(protect);
const OPEN = { $nin: ['Resolved', 'Closed'] };
const occupancy = async () => {
  const rooms = await listRooms(); const byBlock = {};
  let total = 0, occupied = 0, available = 0;
  rooms.forEach((x) => { total += x.capacity; occupied += x.occupied; available += x.available; const b = (byBlock[x.block] ||= { block: x.block, occupied: 0, available: 0 }); b.occupied += x.occupied; b.available += x.available; });
  return { total, occupied, available, rate: total ? Math.round((occupied / total) * 100) : 0, byBlock: Object.values(byBlock) };
};
const complaintsByStatus = async (f = {}) => (await Complaint.aggregate([{ $match: f }, { $group: { _id: '$status', value: { $sum: 1 } } }])).map((x) => ({ name: x._id, value: x.value }));

r.get('/', async (req, res) => {
  const u = req.user; const s = await getSettings();
  if (u.role === 'student') {
    const app = await Application.findOne({ student: u._id, status: { $ne: 'Withdrawn' } }).sort('-createdAt');
    const alloc = await Allocation.findOne({ student: u._id, status: { $in: ACTIVE } }).populate('room');
    const mates = alloc ? await Allocation.find({ room: alloc.room._id, status: { $in: ACTIVE }, student: { $ne: u._id } }).populate('student', 'name department') : [];
    const invs = await Invoice.find({ student: u._id, status: { $ne: 'Cancelled' } });
    const complaints = await Complaint.find({ student: u._id, status: OPEN }).sort('-createdAt').limit(5).select('number category status createdAt');
    return res.json({ role: 'student', session: s.session, deadline: s.applicationDeadline, application: app && { id: app._id, number: app.number, status: app.status, waitlistPosition: app.waitlistPosition }, room: alloc && { block: alloc.room.block, floor: alloc.room.floor, number: alloc.room.number, bed: alloc.bed, status: alloc.status }, roommates: mates.map((m) => m.student), outstanding: invs.reduce((t, i) => t + i.balance, 0), nextDue: invs.filter((i) => i.balance > 0).map((i) => i.dueDate).sort()[0], openComplaints: complaints });
  }
  if (u.role === 'warden') {
    const [pending, openComplaints, wos, occ, byStatus, noShow] = await Promise.all([
      Application.countDocuments({ status: { $in: ['Submitted', 'Under Review'] } }), Complaint.countDocuments({ status: OPEN }), WorkOrder.find({ status: { $ne: 'Completed' } }), occupancy(), complaintsByStatus(), Allocation.countDocuments({ status: 'NoShow', endedAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
    ]);
    return res.json({ role: 'warden', pending, approved: await Application.countDocuments({ status: 'Approved' }), openComplaints, overdueWorkOrders: wos.filter((w) => woOverdue(w, s)).length, overdueComplaints: await Complaint.countDocuments({ overdue: true, status: OPEN }), occupancy: occ, complaintsByStatus: byStatus, noShows: noShow, insideVisitors: await Visitor.countDocuments({ status: 'Inside' }) });
  }
  if (u.role === 'staff') {
    const orders = await WorkOrder.find({ assignedTo: u._id, status: { $ne: 'Completed' } }).sort('-createdAt').limit(8).populate('complaint', 'number');
    const expected = await Visitor.find({ $or: [{ status: 'Registered', expectedDate: { $gte: startOfDay(), $lte: endOfDay() } }] }).populate('student', 'name').limit(20);
    return res.json({ role: 'staff', orders: orders.map((w) => ({ ...w.toObject(), overdue: woOverdue(w, s) })), expectedVisitors: expected, inside: await Visitor.countDocuments({ status: 'Inside' }), toCheckIn: await Allocation.countDocuments({ status: 'Allocated' }) });
  }
  const months = []; for (let i = 5; i >= 0; i--) { const a = new Date(); a.setDate(1); a.setHours(0, 0, 0, 0); a.setMonth(a.getMonth() - i); const b = new Date(a); b.setMonth(b.getMonth() + 1); months.push([a, b]); }
  const collections = await Promise.all(months.map(async ([a, b]) => ({ name: a.toLocaleString('en-IN', { month: 'short' }), value: (await Payment.find({ status: 'Success', paidAt: { $gte: a, $lt: b } })).reduce((t, p) => t + p.amount, 0) })));
  const invs = await Invoice.find({ status: { $ne: 'Cancelled' } }); const occ = await occupancy();
  const byCategory = (await Complaint.aggregate([{ $group: { _id: '$category', value: { $sum: 1 } } }])).map((x) => ({ name: x._id, value: x.value }));
  res.json({ role: 'admin', students: await User.countDocuments({ role: 'student', active: true }), occupancy: occ, fees: { collected: invs.reduce((t, i) => t + i.paid, 0), pending: invs.filter((i) => i.status !== 'Overdue').reduce((t, i) => t + i.balance, 0), overdue: invs.filter((i) => i.status === 'Overdue').reduce((t, i) => t + i.balance, 0) }, activeUsers: { total: await User.countDocuments({ active: true }), online: await User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 20 * 60000) } }) }, collections, complaintsByCategory: byCategory, pendingApplications: await Application.countDocuments({ status: { $in: ['Submitted', 'Under Review'] } }), openComplaints: await Complaint.countDocuments({ status: OPEN }), audit: await verifyChain() });
});
export default r;
