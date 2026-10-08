import { Allocation, Application, Complaint, Invoice, Notification, Visitor, ReportSchedule, ACTIVE } from './models/index.js';
import { getSettings, hoursFor, hhmm } from './utils/helpers.js';
import { notify, idsByRole } from './utils/notify.js';
import { endAllocation } from './utils/allocate.js';
import { sendMail } from './utils/mailer.js';
import { build, toXlsx } from './routes/reports.js';

const DAY = 86400000;
const safe = (name, fn) => fn().catch((e) => console.error(`[job:${name}]`, e.message));

async function noShows() {
  const list = await Allocation.find({ status: 'Allocated', allocatedAt: { $lt: new Date(Date.now() - 7 * DAY) } }).populate('student', 'name').populate('room');
  for (const a of list) {
    await endAllocation(a, 'NoShow', 'Did not check in within 7 days');
    if (a.application) await Application.updateOne({ _id: a.application }, { status: 'Forfeited' });
    notify(await idsByRole('warden'), { type: 'room', title: 'No-show flagged', message: `${a.student.name} did not check in to ${a.room.block}-${a.room.number} within 7 days. The bed is available again.`, link: '/occupancy' });
    notify(a.student._id, { type: 'room', title: 'Allocation forfeited', message: 'You did not check in within 7 days, so your allocation was cancelled.', link: '/my-room' });
  }
}
async function overstays() {
  const s = await getSettings(); const now = new Date();
  const list = await Visitor.find({ status: 'Inside', overstayNotified: false }).populate('student', 'name');
  for (const v of list) {
    const h = hoursFor(s, v.block); const sameDay = v.entryAt.toDateString() === now.toDateString();
    if (!sameDay || hhmm(now) > h.end) {
      v.overstayNotified = true; await v.save();
      notify([...(await idsByRole('warden')), ...(await idsByRole('staff'))], { type: 'visitor', title: 'Visitor overstay', message: `${v.name} (visiting ${v.student?.name}) is still inside after visiting hours.`, link: '/visitors' });
    }
  }
}
async function complaintSweep() {
  const s = await getSettings();
  const open = await Complaint.find({ status: { $nin: ['Resolved', 'Closed'] }, overdue: false });
  for (const c of open) {
    const hrs = s.resolutionHours?.[c.category] || 72;
    if (Date.now() - c.createdAt > hrs * 3600000) { c.overdue = true; await c.save(); notify(await idsByRole('warden'), { type: 'complaint', title: 'Complaint overdue', message: `Complaint #${c.number} (${c.category}) passed its ${hrs}-hour resolution target.`, link: '/complaints' }); }
  }
  const stale = await Complaint.find({ status: 'Resolved', resolvedAt: { $lt: new Date(Date.now() - 5 * DAY) } });
  for (const c of stale) { c.status = 'Closed'; c.closedAt = new Date(); c.history.push({ status: 'Closed', byName: 'System', note: 'Auto-closed after 5 days without a response' }); await c.save(); notify(c.student, { type: 'complaint', title: `Complaint #${c.number} closed`, message: 'It was closed automatically after 5 days.', link: '/complaints' }); }
}
async function fees() {
  const s = await getSettings(); const now = Date.now();
  const list = await Invoice.find({ status: { $in: ['Pending', 'Partial', 'Overdue'] }, balance: { $gt: 0 } });
  for (const i of list) {
    const left = (i.dueDate - now) / DAY;
    if (left <= 7 && left > 1 && !i.reminders.d7) { i.reminders.d7 = true; await i.save(); notify(i.student, { type: 'payment', title: 'Hostel fee due in 7 days', message: `Rs. ${i.balance} is due on ${i.dueDate.toDateString()}.`, link: '/fees' }); }
    else if (left <= 1 && left > 0 && !i.reminders.d1) { i.reminders.d1 = true; i.reminders.d7 = true; await i.save(); notify(i.student, { type: 'payment', title: 'Hostel fee due tomorrow', message: `Rs. ${i.balance} is due on ${i.dueDate.toDateString()}.`, link: '/fees' }); }
    if (left < 0 && !i.lateFeeApplied && s.lateFeeAmount > 0) { i.lateFee = s.lateFeeAmount; i.lateFeeApplied = true; await i.save(); notify(i.student, { type: 'payment', title: 'Late fee applied', message: `A late fee of Rs. ${s.lateFeeAmount} was added to ${i.invoiceNo}.`, link: '/fees' }); }
    else if (left < 0 && i.status !== 'Overdue') await i.save();
  }
}
async function housekeeping() { await Notification.updateMany({ archived: false, createdAt: { $lt: new Date(Date.now() - 90 * DAY) } }, { archived: true }); }
async function schedules() {
  const due = await ReportSchedule.find({ active: true, nextRun: { $lte: new Date() } });
  for (const sc of due) {
    try {
      const rep = await build(sc.type, sc.params || {}); const buf = await toXlsx(rep);
      await sendMail({ to: sc.recipients.join(','), subject: `${rep.title} (${sc.frequency})`, html: `<p>Your scheduled ${rep.title.toLowerCase()} is attached.</p>`, attachments: [{ filename: `${sc.type}-report.xlsx`, content: Buffer.from(buf) }] });
    } catch (e) { console.error('[job:schedule]', e.message); }
    const n = new Date(sc.nextRun); n.setDate(n.getDate() + (sc.frequency === 'weekly' ? 7 : 30)); sc.nextRun = n; await sc.save();
  }
}
let _jobsInterval = null;
export function startJobs() {
  if (_jobsInterval) return;
  const run = () => { safe('noshow', noShows); safe('overstay', overstays); safe('complaints', complaintSweep); safe('fees', fees); safe('housekeeping', housekeeping); safe('schedules', schedules); };
  setTimeout(run, 5000);
  _jobsInterval = setInterval(run, 60 * 1000);
}
