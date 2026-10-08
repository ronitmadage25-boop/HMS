import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });
const T = { timestamps: true };
export const ACTIVE = ['Allocated', 'CheckedIn'];

const defaultSession = () => {
  const d = new Date();
  const y = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
};

export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'warden', 'staff', 'admin'], required: true },
  phone: String,
  department: String,
  year: String,
  blocks: [String],
  disciplinaryHold: { type: Boolean, default: false },
  disciplinaryNote: String,
  academicStanding: { type: String, default: 'Good standing' },
  active: { type: Boolean, default: true },
  failedAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  resetTokenHash: String,
  resetExpires: Date,
  lastActive: Date,
  emailPrefs: { type: Schema.Types.Mixed, default: () => ({ application: true, payment: true, complaint: true, maintenance: true, room: true, visitor: false, system: true }) },
}, { ...T, minimize: false }));

export const Counter = model('Counter', new Schema({ _id: String, seq: { type: Number, default: 0 } }));

export const Settings = model('Settings', new Schema({
  institution: { type: String, default: 'Sardar Patel Institute of Technology' },
  session: { type: String, default: defaultSession },
  applicationDeadline: Date,
  visitingHours: { start: { type: String, default: '09:00' }, end: { type: String, default: '19:00' } },
  blockHours: { type: Schema.Types.Mixed, default: {} },
  maxVisitors: { type: Number, default: 3 },
  resolutionHours: { type: Schema.Types.Mixed, default: () => ({ Maintenance: 72, 'Mess/Food': 48, Discipline: 96, Security: 24, Other: 96 }) },
  maintenanceSla: { type: Schema.Types.Mixed, default: () => ({ Low: 120, Medium: 72, High: 48, Urgent: 24 }) },
  lateFeeAmount: { type: Number, default: 0 },
}, { ...T, minimize: false }));

const roomSchema = new Schema({
  block: { type: String, required: true, trim: true },
  floor: { type: Number, required: true },
  number: { type: String, required: true, trim: true },
  type: { type: String, required: true, trim: true },
  capacity: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['Active', 'Under Maintenance', 'Blocked'], default: 'Active' },
  categoryQuota: { type: String, enum: ['Any', 'General', 'Reserved'], default: 'Any' },
}, T);
roomSchema.index({ block: 1, number: 1 }, { unique: true });
export const Room = model('Room', roomSchema);

export const Application = model('Application', new Schema({
  number: { type: Number, index: true },
  student: oid('User', { required: true, index: true }),
  session: { type: String, required: true },
  studentType: { type: String, enum: ['new', 'continuing'], default: 'new' },
  personal: { fullName: String, dob: Date, gender: String, address: String, phone: String },
  program: String,
  year: String,
  category: { type: String, enum: ['General', 'Reserved'] },
  roomTypePref: String,
  emergency: { name: String, relation: String, phone: String },
  documents: [{ kind: String, name: String, path: String, size: Number }],
  status: { type: String, enum: ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Waitlisted', 'Allocated', 'Withdrawn', 'Forfeited'], default: 'Draft' },
  rejectionReason: String,
  waitlistPosition: Number,
  submittedAt: Date,
  decidedBy: oid('User'),
  decidedAt: Date,
}, T));

const allocSchema = new Schema({
  student: oid('User', { required: true, index: true }),
  application: oid('Application'),
  room: oid('Room', { required: true, index: true }),
  bed: { type: Number, required: true },
  session: String,
  status: { type: String, enum: ['Allocated', 'CheckedIn', 'CheckedOut', 'Vacated', 'NoShow'], default: 'Allocated' },
  bedKey: String,
  letterNo: String,
  allocatedBy: oid('User'),
  allocatedAt: { type: Date, default: Date.now },
  checkInAt: Date,
  checkOutAt: Date,
  endedAt: Date,
  endReason: String,
}, T);
allocSchema.index({ bedKey: 1 }, { unique: true, sparse: true });
export const Allocation = model('Allocation', allocSchema);

export const RoomChange = model('RoomChange', new Schema({
  student: oid('User', { required: true }),
  allocation: oid('Allocation', { required: true }),
  requestedRoom: oid('Room', { required: true }),
  reason: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Denied'], default: 'Pending' },
  decidedBy: oid('User'),
  decisionNote: String,
  decidedAt: Date,
}, T));

export const FeeStructure = model('FeeStructure', (() => {
  const s = new Schema({
    session: { type: String, required: true },
    roomType: { type: String, required: true },
    category: { type: String, enum: ['All', 'General', 'Reserved'], default: 'All' },
    amount: { type: Number, required: true, min: 0 },
    installments: { type: Number, default: 1, min: 1, max: 3 },
    dueDate: { type: Date, required: true },
    sessionStart: { type: Date, required: true },
  }, T);
  s.index({ session: 1, roomType: 1, category: 1 }, { unique: true });
  return s;
})());

const invoiceSchema = new Schema({
  invoiceNo: String,
  student: oid('User', { required: true, index: true }),
  allocation: oid('Allocation'),
  session: String,
  items: [{ label: String, amount: Number }],
  total: { type: Number, required: true },
  lateFee: { type: Number, default: 0 },
  lateFeeApplied: { type: Boolean, default: false },
  paid: { type: Number, default: 0 },
  balance: Number,
  dueDate: Date,
  installments: [Number],
  status: { type: String, enum: ['Pending', 'Partial', 'Paid', 'Overdue', 'Cancelled'], default: 'Pending' },
  reminders: { d7: { type: Boolean, default: false }, d1: { type: Boolean, default: false } },
}, T);
invoiceSchema.pre('save', function (next) {
  this.balance = Math.round((this.total + this.lateFee - this.paid) * 100) / 100;
  if (this.status !== 'Cancelled') {
    if (this.balance <= 0) this.status = 'Paid';
    else if (this.dueDate && this.dueDate < new Date()) this.status = 'Overdue';
    else if (this.paid > 0) this.status = 'Partial';
    else this.status = 'Pending';
  }
  next();
});
export const Invoice = model('Invoice', invoiceSchema);

export const Payment = model('Payment', new Schema({
  invoice: oid('Invoice', { required: true, index: true }),
  student: oid('User', { required: true }),
  amount: { type: Number, required: true },
  method: String,
  txnRef: String,
  gatewayOrderId: String,
  status: { type: String, enum: ['Created', 'Success', 'Failed'], default: 'Created' },
  failureReason: String,
  paidAt: Date,
}, T));

export const Receipt = model('Receipt', new Schema({
  number: { type: String, required: true, unique: true },
  payment: oid('Payment'),
  invoice: oid('Invoice'),
  student: oid('User', { required: true, index: true }),
  amount: Number,
  isDuplicate: { type: Boolean, default: false },
  duplicateOf: oid('Receipt'),
  issuedBy: oid('User'),
}, T));

export const Refund = model('Refund', new Schema({
  invoice: oid('Invoice', { required: true }),
  student: oid('User', { required: true }),
  amount: { type: Number, required: true },
  reason: String,
  txnRef: String,
  by: oid('User'),
}, T));

export const Visitor = model('Visitor', new Schema({
  code: { type: String, unique: true, index: true },
  student: oid('User', { required: true, index: true }),
  name: { type: String, required: true },
  phone: String,
  relationship: String,
  idType: String,
  idNumber: String,
  purpose: String,
  expectedDate: Date,
  kind: { type: String, enum: ['PreRegistered', 'WalkIn'], default: 'PreRegistered' },
  photo: String,
  status: { type: String, enum: ['Registered', 'Inside', 'Exited'], default: 'Registered' },
  entryAt: Date,
  exitAt: Date,
  durationMin: Number,
  block: String,
  approvalRequested: { type: Boolean, default: false },
  wardenApproved: { type: Boolean, default: false },
  overstayNotified: { type: Boolean, default: false },
  registeredBy: oid('User'),
}, T));

export const Complaint = model('Complaint', new Schema({
  number: { type: Number, index: true },
  student: oid('User', { required: true, index: true }),
  category: { type: String, enum: ['Maintenance', 'Mess/Food', 'Discipline', 'Security', 'Other'], required: true },
  description: { type: String, required: true },
  photos: [String],
  anonymous: { type: Boolean, default: false },
  room: oid('Room'),
  block: String,
  status: { type: String, enum: ['Registered', 'Assigned', 'In Progress', 'Resolved', 'Closed'], default: 'Registered' },
  overdue: { type: Boolean, default: false },
  assignedTo: oid('User'),
  workOrder: oid('WorkOrder'),
  history: [{ status: String, by: oid('User'), byName: String, note: String, at: { type: Date, default: Date.now } }],
  comments: [{ by: oid('User'), name: String, role: String, text: String, at: { type: Date, default: Date.now } }],
  resolution: { remarks: String, by: oid('User'), at: Date },
  resolvedAt: Date,
  closedAt: Date,
  rating: Number,
  reopenCount: { type: Number, default: 0 },
}, T));

export const WorkOrder = model('WorkOrder', new Schema({
  number: Number,
  title: { type: String, required: true },
  description: String,
  complaint: oid('Complaint'),
  location: String,
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  assignedTo: oid('User'),
  createdBy: oid('User'),
  status: { type: String, enum: ['Open', 'In Progress', 'Completed'], default: 'Open' },
  remarks: String,
  photos: [String],
  completedAt: Date,
}, T));

export const Notification = model('Notification', new Schema({
  user: oid('User', { required: true, index: true }),
  type: { type: String, default: 'system' },
  title: String,
  message: String,
  link: String,
  read: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
}, T));

export const AuditLog = model('AuditLog', new Schema({
  seq: { type: Number, unique: true },
  actor: oid('User'),
  actorName: String,
  action: String,
  entity: String,
  entityId: String,
  detail: Schema.Types.Mixed,
  ip: String,
  at: Date,
  prevHash: String,
  hash: String,
  payload: String,
}, { minimize: false }));

export const ReportSchedule = model('ReportSchedule', new Schema({
  type: { type: String, required: true },
  frequency: { type: String, enum: ['weekly', 'monthly'], required: true },
  params: Schema.Types.Mixed,
  recipients: [String],
  nextRun: Date,
  active: { type: Boolean, default: true },
  createdBy: oid('User'),
}, T));
