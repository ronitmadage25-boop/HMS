import { Router } from 'express';
import ExcelJS from 'exceljs';
import { Allocation, Complaint, Invoice, Payment, Visitor, ReportSchedule, Application } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { HttpError, getSettings, endOfDay, startOfDay } from '../utils/helpers.js';
import { listRooms } from '../utils/rooms.js';
import { tablePdf } from '../utils/pdf.js';
import { audit } from '../utils/audit.js';

const r = Router(); r.use(protect, allow('warden', 'admin'));
const d = (x) => (x ? new Date(x).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const inr = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');

export async function build(type, q = {}) {
  const from = q.from ? startOfDay(q.from) : null; const to = q.to ? endOfDay(q.to) : null;
  if (type === 'occupancy') {
    const asOf = to || new Date(); const rooms = await listRooms(q.block ? { block: q.block } : {});
    const ids = rooms.map((x) => x._id);
    const acts = await Allocation.find({ room: { $in: ids }, status: { $ne: 'NoShow' }, allocatedAt: { $lte: asOf }, $or: [{ endedAt: null }, { endedAt: { $gt: asOf } }] }).lean();
    const cnt = {}; acts.forEach((a) => { cnt[a.room] = (cnt[a.room] || 0) + 1; });
    const g = {};
    rooms.forEach((x) => {
      const k = `${x.block}|${x.floor}|${x.type}`; const o = Math.min(cnt[x._id] || 0, x.capacity); const blocked = x.status === 'Active' ? 0 : x.capacity - o;
      const row = (g[k] ||= { block: x.block, floor: x.floor, type: x.type, rooms: 0, beds: 0, allocated: 0, vacant: 0, blocked: 0 });
      row.rooms++; row.beds += x.capacity; row.allocated += o; row.blocked += blocked; row.vacant += x.capacity - o - blocked;
    });
    const rows = Object.values(g); const sum = (k) => rows.reduce((t, x) => t + x[k], 0);
    return { title: 'Occupancy report', columns: [['block', 'Block'], ['floor', 'Floor'], ['type', 'Room type'], ['rooms', 'Rooms'], ['beds', 'Beds'], ['allocated', 'Allocated'], ['vacant', 'Vacant'], ['blocked', 'Blocked']], rows, summary: [{ label: 'Total beds', value: sum('beds') }, { label: 'Allocated', value: sum('allocated') }, { label: 'Vacant', value: sum('vacant') }, { label: 'Blocked', value: sum('blocked') }] };
  }
  if (type === 'fees') {
    const f = {}; if (from || to) f.dueDate = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    let inv = await Invoice.find({ ...f, status: { $ne: 'Cancelled' } }).populate('student', 'name username').populate({ path: 'allocation', populate: { path: 'application', select: 'category' } }).lean();
    if (q.category) inv = inv.filter((i) => i.allocation?.application?.category === q.category);
    if (q.status === 'defaulters') inv = inv.filter((i) => i.balance > 0 && new Date(i.dueDate) < new Date());
    const pf = { status: 'Success' }; if (from || to) pf.paidAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const collected = (await Payment.find(pf)).reduce((t, p) => t + p.amount, 0);
    const rows = inv.map((i) => ({ invoice: i.invoiceNo, student: i.student?.name, regNo: i.student?.username, category: i.allocation?.application?.category || '-', total: i.total + i.lateFee, paid: i.paid, balance: i.balance, due: d(i.dueDate), status: i.status }));
    return { title: 'Fee collection report', columns: [['invoice', 'Invoice'], ['student', 'Student'], ['regNo', 'Reg. no'], ['category', 'Category'], ['total', 'Billed'], ['paid', 'Paid'], ['balance', 'Balance'], ['due', 'Due date'], ['status', 'Status']], rows,
      summary: [{ label: 'Collected', value: inr(collected) }, { label: 'Pending', value: inr(inv.filter((i) => i.status !== 'Overdue').reduce((t, i) => t + i.balance, 0)) }, { label: 'Overdue', value: inr(inv.filter((i) => i.status === 'Overdue').reduce((t, i) => t + i.balance, 0)) }, { label: 'Defaulters', value: inv.filter((i) => i.balance > 0 && new Date(i.dueDate) < new Date()).length }] };
  }
  if (type === 'complaints') {
    const f = {}; if (from || to) f.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const list = await Complaint.find(f).lean(); const g = {};
    list.forEach((c) => { const x = (g[c.category] ||= { category: c.category, total: 0, Registered: 0, Assigned: 0, 'In Progress': 0, Resolved: 0, Closed: 0, hrs: 0, n: 0 }); x.total++; x[c.status]++; const end = c.resolvedAt || c.closedAt; if (end) { x.hrs += (end - c.createdAt) / 3600000; x.n++; } });
    const rows = Object.values(g).map((x) => ({ ...x, avg: x.n ? (x.hrs / x.n).toFixed(1) + ' h' : '-' }));
    const all = list.filter((c) => c.resolvedAt || c.closedAt);
    return { title: 'Complaint summary report', columns: [['category', 'Category'], ['total', 'Total'], ['Registered', 'Registered'], ['Assigned', 'Assigned'], ['In Progress', 'In progress'], ['Resolved', 'Resolved'], ['Closed', 'Closed'], ['avg', 'Avg. resolution']], rows,
      summary: [{ label: 'Complaints', value: list.length }, { label: 'Overdue', value: list.filter((c) => c.overdue).length }, { label: 'Avg. resolution', value: all.length ? (all.reduce((t, c) => t + ((c.resolvedAt || c.closedAt) - c.createdAt) / 3600000, 0) / all.length).toFixed(1) + ' h' : '-' }] };
  }
  if (type === 'visitors') {
    const f = {}; if (from || to) f.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const list = await Visitor.find(f).populate('student', 'name username').sort('-createdAt').lean();
    const rows = list.map((v) => ({ code: v.code, visitor: v.name, phone: v.phone, student: v.student?.name, kind: v.kind, entry: d(v.entryAt), exit: d(v.exitAt), duration: v.durationMin ? `${v.durationMin} min` : '-', status: v.status }));
    return { title: 'Visitor activity report', columns: [['code', 'Code'], ['visitor', 'Visitor'], ['phone', 'Phone'], ['student', 'Visiting'], ['kind', 'Type'], ['entry', 'Entry'], ['exit', 'Exit'], ['duration', 'Duration'], ['status', 'Status']], rows,
      summary: [{ label: 'Visits', value: list.length }, { label: 'Entered', value: list.filter((v) => v.entryAt).length }, { label: 'Still inside', value: list.filter((v) => v.status === 'Inside').length }] };
  }
  throw new HttpError(400, 'Unknown report type');
}
export async function toXlsx(rep) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(rep.title.slice(0, 30));
  ws.columns = rep.columns.map(([key, header]) => ({ key, header, width: Math.max(14, header.length + 4) }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D54D4' } };
  rep.rows.forEach((x) => ws.addRow(x)); ws.addRow([]); rep.summary.forEach((s) => ws.addRow([s.label, s.value]).font = { bold: true });
  return wb.xlsx.writeBuffer();
}
r.get('/schedules', allow('admin'), async (req, res) => res.json(await ReportSchedule.find().sort('-createdAt')));
r.post('/schedules', allow('admin'), async (req, res) => {
  const { type, frequency, recipients, block, category } = req.body;
  if (!['occupancy', 'fees', 'complaints', 'visitors'].includes(type) || !['weekly', 'monthly'].includes(frequency)) throw new HttpError(400, 'Choose a report and a frequency');
  const emails = String(recipients || '').split(',').map((e) => e.trim()).filter(Boolean); if (!emails.length) throw new HttpError(400, 'Add at least one recipient e-mail');
  const next = new Date(); next.setHours(7, 0, 0, 0); next.setDate(next.getDate() + (frequency === 'weekly' ? 7 : 30));
  const s = await ReportSchedule.create({ type, frequency, recipients: emails, params: { block, category }, nextRun: next, createdBy: req.user._id });
  audit(req.user, 'REPORT_SCHEDULED', 'ReportSchedule', s._id, { type, frequency }, req.ip); res.status(201).json(s);
});
r.delete('/schedules/:id', allow('admin'), async (req, res) => { await ReportSchedule.deleteOne({ _id: req.params.id }); res.json({ ok: true }); });
r.get('/:type', async (req, res) => { const rep = await build(req.params.type, req.query); res.json({ ...rep, columns: rep.columns.map(([key, label]) => ({ key, label })) }); });
r.get('/:type/export', async (req, res) => {
  const rep = await build(req.params.type, req.query); const s = await getSettings(); const name = `${req.params.type}-report`;
  if (req.query.format === 'xlsx') { const buf = await toXlsx(rep); return res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}.xlsx"` }).send(Buffer.from(buf)); }
  const pdf = await tablePdf(rep.title, rep.columns.map(([key, label]) => ({ key, label })), rep.rows, rep.summary, s.institution);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}.pdf"` }).send(pdf);
});
export default r;
