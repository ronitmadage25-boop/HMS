// import { Router } from 'express';
// import { Allocation, Application, Room, RoomChange, Invoice, User, ACTIVE } from '../models/index.js';
// import { protect, allow } from '../middleware/auth.js';
// import { HttpError, getSettings } from '../utils/helpers.js';
// import { notify, idsByRole } from '../utils/notify.js';
// import { audit } from '../utils/audit.js';
// import { listRooms, compatible } from '../utils/rooms.js';
// import { allocateBed, endAllocation } from '../utils/allocate.js';
// import { firstInstallmentPaid } from '../utils/fees.js';
// import { allocationLetterPdf } from '../utils/pdf.js';

// const r = Router(); r.use(protect);
// const pop = (q) => q.populate('student', 'name username department year phone').populate('room');
// const wardenCanSee = (user, block) => user.role === 'admin' || !user.blocks?.length || user.blocks.includes(block);

// r.get('/mine', allow('student'), async (req, res) => {
//   const a = await pop(Allocation.findOne({ student: req.user._id, status: { $in: ACTIVE } }));
//   if (!a) return res.json({ allocation: null });
//   const mates = await Allocation.find({ room: a.room._id, status: { $in: ACTIVE }, student: { $ne: req.user._id } }).populate('student', 'name department year phone');
//   const invoice = await Invoice.findOne({ allocation: a._id, status: { $ne: 'Cancelled' } });
//   const change = await RoomChange.findOne({ student: req.user._id, status: 'Pending' }).populate('requestedRoom');
//   res.json({ allocation: a, roommates: mates.map((m) => m.student), invoice, pendingChange: change });
// });
// r.get('/history', allow('student', 'warden', 'admin'), async (req, res) => {
//   const sid = req.user.role === 'student' ? req.user._id : req.query.student; if (!sid) throw new HttpError(400, 'Student is required');
//   res.json(await pop(Allocation.find({ student: sid }).sort('-allocatedAt')));
// });
// r.get('/', allow('warden', 'staff', 'admin'), async (req, res) => {
//   const f = {}; if (req.query.status) f.status = req.query.status; else if (req.query.active) f.status = { $in: ACTIVE };
//   let list = await pop(Allocation.find(f).sort('-allocatedAt').limit(500));
//   if (req.query.room) list = list.filter((a) => String(a.room._id) === req.query.room);
//   res.json(list);
// });
// r.get('/unallocated', allow('warden', 'admin'), async (req, res) => {
//   res.json(await Application.find({ status: 'Approved' }).populate('student', 'name username department year').sort('submittedAt'));
// });
// r.post('/', allow('warden', 'admin'), async (req, res) => {
//   const app = await Application.findById(req.body.applicationId); if (!app) throw new HttpError(404, 'Application not found');
//   if (app.status !== 'Approved') throw new HttpError(400, 'Only approved applications can be allotted a room');
//   const room = await Room.findById(req.body.roomId); if (!room) throw new HttpError(404, 'Room not found');
//   const a = await allocateBed({ application: app, studentId: app.student, room, bed: req.body.bed ? Number(req.body.bed) : undefined, by: req.user });
//   audit(req.user, 'ROOM_ALLOCATED', 'Allocation', a._id, { room: `${room.block}-${room.number}`, bed: a.bed }, req.ip); res.status(201).json(a);
// });
// async function plan() {
//   const apps = await Application.find({ status: 'Approved' }).populate('student', 'name username').sort('submittedAt');
//   apps.sort((x, y) => (x.studentType === y.studentType ? 0 : x.studentType === 'continuing' ? -1 : 1)); // BR-3: continuing first, then by submission date (stable)
//   const rooms = await listRooms(); const free = new Map(rooms.map((x) => [String(x._id), x.available])); const out = []; const skipped = [];
//   for (const app of apps) {
//     const cands = rooms.filter((x) => x.type === app.roomTypePref && compatible(x, app.category) && free.get(String(x._id)) > 0 && x.status === 'Active');
//     cands.sort((a, b) => (b.capacity - free.get(String(b._id)) > 0) - (a.capacity - free.get(String(a._id)) > 0) || a.block.localeCompare(b.block) || a.floor - b.floor || a.number.localeCompare(b.number));
//     const pick = cands[0];
//     if (!pick) { skipped.push({ applicationId: app._id, number: app.number, student: app.student.name, reason: `No free ${app.roomTypePref} bed for ${app.category} category` }); continue; }
//     free.set(String(pick._id), free.get(String(pick._id)) - 1);
//     out.push({ applicationId: app._id, number: app.number, student: app.student.name, username: app.student.username, roomId: pick._id, room: `${pick.block}-${pick.number}`, type: pick.type });
//   }
//   return { assignments: out, skipped };
// }
// r.get('/auto/preview', allow('warden', 'admin'), async (req, res) => res.json(await plan()));
// r.post('/auto/confirm', allow('warden', 'admin'), async (req, res) => {
//   const results = [];
//   for (const x of req.body.assignments || []) {
//     try {
//       const app = await Application.findById(x.applicationId); const room = await Room.findById(x.roomId);
//       if (!app || app.status !== 'Approved') throw new HttpError(409, 'Application is no longer awaiting allocation');
//       const a = await allocateBed({ application: app, studentId: app.student, room, by: req.user });
//       audit(req.user, 'ROOM_ALLOCATED_AUTO', 'Allocation', a._id, { room: x.room }, req.ip); results.push({ ...x, ok: true });
//     } catch (e) { results.push({ ...x, ok: false, message: e.message }); }
//   }
//   res.json({ results, done: results.filter((x) => x.ok).length });
// });
// r.get('/:id/letter', async (req, res) => {
//   const a = await pop(Allocation.findById(req.params.id)); if (!a) throw new HttpError(404, 'Allocation not found');
//   if (req.user.role === 'student' && String(a.student._id) !== String(req.user._id)) throw new HttpError(403, 'Access Denied');
//   const pdf = await allocationLetterPdf(a, (await getSettings()).institution);
//   res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${a.letterNo}.pdf"` }).send(pdf);
// });
// r.post('/:id/vacate', allow('warden', 'admin'), async (req, res) => {
//   const a = await Allocation.findById(req.params.id).populate('room'); if (!a || !ACTIVE.includes(a.status)) throw new HttpError(400, 'This student does not hold an active bed');
//   if (!wardenCanSee(req.user, a.room.block)) throw new HttpError(403, 'This room belongs to another warden\'s block');
//   const reason = req.body.reason; if (!['Course completion', 'Withdrawal', 'Disciplinary action'].includes(reason)) throw new HttpError(400, 'Choose a reason for vacating');
//   await endAllocation(a, 'Vacated', reason);
//   notify(a.student, { type: 'room', title: 'Room vacated', message: `Your bed in room ${a.room.number} has been vacated (${reason}).`, link: '/my-room' });
//   audit(req.user, 'ROOM_VACATED', 'Allocation', a._id, { reason }, req.ip); res.json(a);
// });
// r.post('/:id/checkin', allow('warden', 'staff', 'admin'), async (req, res) => {
//   const a = await Allocation.findById(req.params.id).populate('student', 'name');
//   if (!a || a.status !== 'Allocated') throw new HttpError(400, 'Only allocated beds can be checked in');
//   const inv = await Invoice.findOne({ allocation: a._id, status: { $ne: 'Cancelled' } });
//   if (!inv) throw new HttpError(402, 'No fee invoice exists for this allocation yet. Ask the administrator to generate it.');
//   if (!firstInstallmentPaid(inv)) throw new HttpError(402, `${a.student.name} must pay the full fee or the first installment before check-in.`);
//   a.status = 'CheckedIn'; a.checkInAt = new Date(); await a.save();
//   notify(a.student._id, { type: 'room', title: 'Checked in', message: 'Your check-in was recorded. Welcome to the hostel.', link: '/my-room' });
//   audit(req.user, 'CHECK_IN', 'Allocation', a._id, {}, req.ip); res.json(a);
// });
// r.post('/:id/checkout', allow('warden', 'staff', 'admin'), async (req, res) => {
//   const a = await Allocation.findById(req.params.id); if (!a || a.status !== 'CheckedIn') throw new HttpError(400, 'Only checked-in students can be checked out');
//   await endAllocation(a, 'CheckedOut', 'Checked out'); audit(req.user, 'CHECK_OUT', 'Allocation', a._id, {}, req.ip); res.json(a);
// });

// r.get('/room-change/list', allow('student', 'warden', 'admin'), async (req, res) => {
//   const f = req.user.role === 'student' ? { student: req.user._id } : req.query.status ? { status: req.query.status } : {};
//   let list = await RoomChange.find(f).populate('student', 'name username').populate('requestedRoom').populate({ path: 'allocation', populate: { path: 'room' } }).sort('-createdAt');
//   if (req.user.role === 'warden') list = list.filter((c) => wardenCanSee(req.user, c.requestedRoom.block) || wardenCanSee(req.user, c.allocation.room.block));
//   res.json(list);
// });
// r.post('/room-change', allow('student'), async (req, res) => {
//   const cur = await Allocation.findOne({ student: req.user._id, status: { $in: ACTIVE } }); if (!cur) throw new HttpError(400, 'You do not have an allocated room');
//   if (await RoomChange.exists({ student: req.user._id, status: 'Pending' })) throw new HttpError(409, 'You already have a pending room-change request');
//   if (!req.body.reason || req.body.reason.trim().length < 10) throw new HttpError(400, 'Explain the reason in at least 10 characters');
//   const room = await Room.findById(req.body.roomId); if (!room || String(room._id) === String(cur.room)) throw new HttpError(400, 'Choose a different room');
//   const c = await RoomChange.create({ student: req.user._id, allocation: cur._id, requestedRoom: room._id, reason: req.body.reason.trim() });
//   notify(await idsByRole('warden'), { type: 'room', title: 'Room-change request', message: `${req.user.name} requested a move to ${room.block}-${room.number}.`, link: '/room-changes' });
//   res.status(201).json(c);
// });
// r.post('/room-change/:id/decide', allow('warden', 'admin'), async (req, res) => {
//   const c = await RoomChange.findById(req.params.id).populate('requestedRoom'); if (!c || c.status !== 'Pending') throw new HttpError(400, 'This request has already been decided');
//   if (!wardenCanSee(req.user, c.requestedRoom.block)) throw new HttpError(403, 'Only the warden of the requested room\'s block can decide this request');
//   if (req.body.approve) {
//     const cur = await Allocation.findById(c.allocation); if (!cur || !ACTIVE.includes(cur.status)) throw new HttpError(409, 'The student no longer holds the original bed');
//     const app = cur.application ? await Application.findById(cur.application) : null;
//     const room = await Room.findById(c.requestedRoom._id);
//     const nxt = await allocateBed({ application: null, studentId: c.student, room, by: req.user, session: cur.session }); // fails with 409 if no free bed, before anything is vacated
//     nxt.application = cur.application; await nxt.save();
//     if (cur.status === 'CheckedIn') { nxt.status = 'CheckedIn'; nxt.checkInAt = new Date(); await nxt.save(); }
//     await endAllocation(cur, 'Vacated', 'Room change');
//     if (app) { app.status = 'Allocated'; await app.save(); }
//   }
//   c.status = req.body.approve ? 'Approved' : 'Denied'; c.decidedBy = req.user._id; c.decisionNote = req.body.note; c.decidedAt = new Date(); await c.save();
//   notify(c.student, { type: 'room', title: `Room change ${c.status.toLowerCase()}`, message: req.body.approve ? `Your move to ${c.requestedRoom.block}-${c.requestedRoom.number} is approved.` : `Your room-change request was denied.${req.body.note ? ' ' + req.body.note : ''}`, link: '/my-room' });
//   audit(req.user, 'ROOM_CHANGE_' + c.status.toUpperCase(), 'RoomChange', c._id, {}, req.ip); res.json(c);
// });
// export default r;


import { Router } from 'express';

import {
  Allocation,
  Application,
  Room,
  RoomChange,
  Invoice,
  ACTIVE,
} from '../models/index.js';

import { protect, allow } from '../middleware/auth.js';
import { HttpError, getSettings } from '../utils/helpers.js';
import { notify, idsByRole } from '../utils/notify.js';
import { audit } from '../utils/audit.js';
import { listRooms, compatible } from '../utils/rooms.js';
import { allocateBed, endAllocation } from '../utils/allocate.js';
import { firstInstallmentPaid } from '../utils/fees.js';
import { allocationLetterPdf } from '../utils/pdf.js';

const r = Router();
r.use(protect);

const pop = (query) =>
  query.populate('student', 'name username department year phone')
    .populate('room');

const wardenCanSee = (user, block) =>
  user.role === 'admin' ||
  !user.blocks?.length ||
  user.blocks.includes(block);


// =====================================================
// STUDENT: CURRENT ROOM, ROOMMATES, INVOICE
// =====================================================

r.get('/mine', allow('student'), async (req, res) => {
  const allocation = await pop(
    Allocation.findOne({
      student: req.user._id,
      status: { $in: ACTIVE },
    }),
  );

  if (!allocation) {
    return res.json({ allocation: null });
  }

  const roommates = await Allocation.find({
    room: allocation.room._id,
    status: { $in: ACTIVE },
    student: { $ne: req.user._id },
  }).populate('student', 'name department year phone');

  const invoice = await Invoice.findOne({
    allocation: allocation._id,
    status: { $ne: 'Cancelled' },
  });

  const pendingChange = await RoomChange.findOne({
    student: req.user._id,
    status: 'Pending',
  }).populate('requestedRoom');

  res.json({
    allocation,
    roommates: roommates.map((mate) => mate.student),
    invoice,
    pendingChange,
  });
});


// =====================================================
// STUDENT: ACCEPT ALLOCATED ROOM
// POST /:id/confirm-room
// =====================================================

r.post('/:id/confirm-room', allow('student'), async (req, res) => {
  const allocation = await Allocation.findById(req.params.id)
    .populate('room');

  if (!allocation || !ACTIVE.includes(allocation.status)) {
    throw new HttpError(404, 'Active room allocation not found');
  }

  if (String(allocation.student) !== String(req.user._id)) {
    throw new HttpError(403, 'You can only confirm your own room');
  }

  if (allocation.roomConfirmationStatus === 'Accepted') {
    return res.json({
      message: 'You have already accepted this room.',
      allocation,
    });
  }

  const pendingChange = await RoomChange.exists({
    allocation: allocation._id,
    student: req.user._id,
    status: 'Pending',
  });

  if (
    pendingChange ||
    allocation.roomConfirmationStatus === 'ChangeRequested'
  ) {
    throw new HttpError(
      409,
      'Your room-change request is pending. You can confirm your room after the request is resolved.',
    );
  }

  allocation.roomConfirmationStatus = 'Accepted';
  allocation.roomConfirmationAt = new Date();
  allocation.roomChangeReason = '';

  await allocation.save();

  notify(req.user._id, {
    type: 'room',
    title: 'Room confirmed',
    message: `You accepted room ${allocation.room.block}-${allocation.room.number}. The warden can now generate your invoice.`,
    link: '/my-room',
  });

  notify(await idsByRole('warden'), {
    type: 'room',
    title: 'Room accepted by student',
    message: `${req.user.name} accepted room ${allocation.room.block}-${allocation.room.number}. An invoice can now be generated.`,
    link: '/allocations',
  });

  audit(
    req.user,
    'ROOM_ACCEPTED',
    'Allocation',
    allocation._id,
    {
      room: `${allocation.room.block}-${allocation.room.number}`,
    },
    req.ip,
  );

  res.json({
    message: 'Room accepted. The warden can now generate your invoice.',
    allocation,
  });
});


// =====================================================
// ALLOCATION HISTORY
// =====================================================

r.get('/history', allow('student', 'warden', 'admin'), async (req, res) => {
  const studentId =
    req.user.role === 'student'
      ? req.user._id
      : req.query.student;

  if (!studentId) {
    throw new HttpError(400, 'Student is required');
  }

  res.json(
    await pop(
      Allocation.find({ student: studentId }).sort('-allocatedAt'),
    ),
  );
});


// =====================================================
// LIST ALLOCATIONS
// =====================================================

r.get('/', allow('warden', 'staff', 'admin'), async (req, res) => {
  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  } else if (req.query.active) {
    filter.status = { $in: ACTIVE };
  }

  let allocations = await pop(
    Allocation.find(filter).sort('-allocatedAt').limit(500),
  );

  if (req.user.role === 'warden') {
    allocations = allocations.filter((allocation) =>
      wardenCanSee(req.user, allocation.room.block),
    );
  }

  if (req.query.room) {
    allocations = allocations.filter(
      (allocation) =>
        String(allocation.room._id) === String(req.query.room),
    );
  }

  res.json(allocations);
});


// =====================================================
// APPLICATIONS AWAITING ALLOCATION
// =====================================================

r.get('/unallocated', allow('warden', 'admin'), async (_req, res) => {
  res.json(
    await Application.find({ status: 'Approved' })
      .populate('student', 'name username department year')
      .sort('submittedAt'),
  );
});


// =====================================================
// MANUAL ROOM ALLOCATION
// =====================================================

r.post('/', allow('warden', 'admin'), async (req, res) => {
  const application = await Application.findById(
    req.body.applicationId,
  );

  if (!application) {
    throw new HttpError(404, 'Application not found');
  }

  if (application.status !== 'Approved') {
    throw new HttpError(
      400,
      'Only approved applications can be allotted a room',
    );
  }

  const room = await Room.findById(req.body.roomId);

  if (!room) {
    throw new HttpError(404, 'Room not found');
  }

  if (!wardenCanSee(req.user, room.block)) {
    throw new HttpError(
      403,
      "This room belongs to another warden's block",
    );
  }

  const allocation = await allocateBed({
    application,
    studentId: application.student,
    room,
    bed: req.body.bed
      ? Number(req.body.bed)
      : undefined,
    by: req.user,
  });

  // A newly allocated room must be accepted by the student.
  allocation.roomConfirmationStatus = 'Pending';
  allocation.roomConfirmationAt = null;
  allocation.roomChangeReason = '';

  await allocation.save();

  notify(allocation.student, {
    type: 'room',
    title: 'Room allocated',
    message: `You have been allocated room ${room.block}-${room.number}. Please review your room and accept it or request a change.`,
    link: '/my-room',
  });

  audit(
    req.user,
    'ROOM_ALLOCATED',
    'Allocation',
    allocation._id,
    {
      room: `${room.block}-${room.number}`,
      bed: allocation.bed,
    },
    req.ip,
  );

  res.status(201).json(allocation);
});


// =====================================================
// AUTO-ALLOCATION PREVIEW
// =====================================================

async function plan() {
  const applications = await Application.find({
    status: 'Approved',
  })
    .populate('student', 'name username')
    .sort('submittedAt');

  applications.sort((a, b) =>
    a.studentType === b.studentType
      ? 0
      : a.studentType === 'continuing'
        ? -1
        : 1,
  );

  const rooms = await listRooms();

  const free = new Map(
    rooms.map((room) => [
      String(room._id),
      room.available,
    ]),
  );

  const assignments = [];
  const skipped = [];

  for (const application of applications) {
    const candidates = rooms.filter(
      (room) =>
        room.type === application.roomTypePref &&
        compatible(room, application.category) &&
        free.get(String(room._id)) > 0 &&
        room.status === 'Active',
    );

    candidates.sort(
      (a, b) =>
        (b.capacity - free.get(String(b._id)) > 0) -
          (a.capacity - free.get(String(a._id)) > 0) ||
        a.block.localeCompare(b.block) ||
        a.floor - b.floor ||
        a.number.localeCompare(b.number),
    );

    const selectedRoom = candidates[0];

    if (!selectedRoom) {
      skipped.push({
        applicationId: application._id,
        number: application.number,
        student: application.student.name,
        reason: `No free ${application.roomTypePref} bed for ${application.category} category`,
      });

      continue;
    }

    free.set(
      String(selectedRoom._id),
      free.get(String(selectedRoom._id)) - 1,
    );

    assignments.push({
      applicationId: application._id,
      number: application.number,
      student: application.student.name,
      username: application.student.username,
      roomId: selectedRoom._id,
      room: `${selectedRoom.block}-${selectedRoom.number}`,
      type: selectedRoom.type,
    });
  }

  return { assignments, skipped };
}

r.get('/auto/preview', allow('warden', 'admin'), async (_req, res) => {
  res.json(await plan());
});


// =====================================================
// CONFIRM AUTO-ALLOCATION
// =====================================================

r.post('/auto/confirm', allow('warden', 'admin'), async (req, res) => {
  const results = [];

  for (const assignment of req.body.assignments || []) {
    try {
      const application = await Application.findById(
        assignment.applicationId,
      );

      const room = await Room.findById(assignment.roomId);

      if (!application || application.status !== 'Approved') {
        throw new HttpError(
          409,
          'Application is no longer awaiting allocation',
        );
      }

      if (!room) {
        throw new HttpError(404, 'Room not found');
      }

      if (!wardenCanSee(req.user, room.block)) {
        throw new HttpError(
          403,
          "This room belongs to another warden's block",
        );
      }

      const allocation = await allocateBed({
        application,
        studentId: application.student,
        room,
        by: req.user,
      });

      allocation.roomConfirmationStatus = 'Pending';
      allocation.roomConfirmationAt = null;
      allocation.roomChangeReason = '';

      await allocation.save();

      notify(allocation.student, {
        type: 'room',
        title: 'Room allocated',
        message: `You have been allocated room ${room.block}-${room.number}. Please review and accept it or request a change.`,
        link: '/my-room',
      });

      audit(
        req.user,
        'ROOM_ALLOCATED_AUTO',
        'Allocation',
        allocation._id,
        { room: assignment.room },
        req.ip,
      );

      results.push({
        ...assignment,
        ok: true,
      });
    } catch (error) {
      results.push({
        ...assignment,
        ok: false,
        message: error.message,
      });
    }
  }

  res.json({
    results,
    done: results.filter((result) => result.ok).length,
  });
});


// =====================================================
// DOWNLOAD ALLOCATION LETTER
// =====================================================

r.get('/:id/letter', async (req, res) => {
  const allocation = await pop(
    Allocation.findById(req.params.id),
  );

  if (!allocation) {
    throw new HttpError(404, 'Allocation not found');
  }

  if (
    req.user.role === 'student' &&
    String(allocation.student._id) !== String(req.user._id)
  ) {
    throw new HttpError(403, 'Access Denied');
  }

  if (
    req.user.role === 'warden' &&
    !wardenCanSee(req.user, allocation.room.block)
  ) {
    throw new HttpError(
      403,
      "This room belongs to another warden's block",
    );
  }

  const pdf = await allocationLetterPdf(
    allocation,
    (await getSettings()).institution,
  );

  res
    .set({
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        `attachment; filename="${allocation.letterNo}.pdf"`,
    })
    .send(pdf);
});


// =====================================================
// VACATE ROOM
// =====================================================

r.post('/:id/vacate', allow('warden', 'admin'), async (req, res) => {
  const allocation = await Allocation.findById(req.params.id)
    .populate('room');

  if (!allocation || !ACTIVE.includes(allocation.status)) {
    throw new HttpError(
      400,
      'This student does not hold an active bed',
    );
  }

  if (!wardenCanSee(req.user, allocation.room.block)) {
    throw new HttpError(
      403,
      "This room belongs to another warden's block",
    );
  }

  const reason = req.body.reason;

  if (
    ![
      'Course completion',
      'Withdrawal',
      'Disciplinary action',
    ].includes(reason)
  ) {
    throw new HttpError(
      400,
      'Choose a reason for vacating',
    );
  }

  await endAllocation(allocation, 'Vacated', reason);

  notify(allocation.student, {
    type: 'room',
    title: 'Room vacated',
    message: `Your bed in room ${allocation.room.number} has been vacated (${reason}).`,
    link: '/my-room',
  });

  audit(
    req.user,
    'ROOM_VACATED',
    'Allocation',
    allocation._id,
    { reason },
    req.ip,
  );

  res.json(allocation);
});


// =====================================================
// CHECK-IN
// Room acceptance + invoice + first installment required
// =====================================================

r.post('/:id/checkin', allow('warden', 'staff', 'admin'), async (req, res) => {
  const allocation = await Allocation.findById(req.params.id)
    .populate('student', 'name')
    .populate('room');

  if (!allocation || allocation.status !== 'Allocated') {
    throw new HttpError(
      400,
      'Only allocated beds can be checked in',
    );
  }

  if (
    req.user.role === 'warden' &&
    !wardenCanSee(req.user, allocation.room.block)
  ) {
    throw new HttpError(
      403,
      "This room belongs to another warden's block",
    );
  }

  if (allocation.roomConfirmationStatus !== 'Accepted') {
    throw new HttpError(
      402,
      'The student must accept the allocated room before check-in.',
    );
  }

  const invoice = await Invoice.findOne({
    allocation: allocation._id,
    status: { $ne: 'Cancelled' },
  });

  if (!invoice) {
    throw new HttpError(
      402,
      'No fee invoice exists for this allocation yet. Ask the warden to generate it.',
    );
  }

  if (!firstInstallmentPaid(invoice)) {
    throw new HttpError(
      402,
      `${allocation.student.name} must pay the full fee or the first installment before check-in.`,
    );
  }

  allocation.status = 'CheckedIn';
  allocation.checkInAt = new Date();

  await allocation.save();

  notify(allocation.student._id, {
    type: 'room',
    title: 'Checked in',
    message: 'Your check-in was recorded. Welcome to the hostel.',
    link: '/my-room',
  });

  audit(
    req.user,
    'CHECK_IN',
    'Allocation',
    allocation._id,
    {},
    req.ip,
  );

  res.json(allocation);
});


// =====================================================
// CHECKOUT
// =====================================================

r.post('/:id/checkout', allow('warden', 'staff', 'admin'), async (req, res) => {
  const allocation = await Allocation.findById(req.params.id)
    .populate('room');

  if (!allocation || allocation.status !== 'CheckedIn') {
    throw new HttpError(
      400,
      'Only checked-in students can be checked out',
    );
  }

  if (
    req.user.role === 'warden' &&
    !wardenCanSee(req.user, allocation.room.block)
  ) {
    throw new HttpError(
      403,
      "This room belongs to another warden's block",
    );
  }

  await endAllocation(
    allocation,
    'CheckedOut',
    'Checked out',
  );

  audit(
    req.user,
    'CHECK_OUT',
    'Allocation',
    allocation._id,
    {},
    req.ip,
  );

  res.json(allocation);
});


// =====================================================
// LIST ROOM-CHANGE REQUESTS
// =====================================================

r.get(
  '/room-change/list',
  allow('student', 'warden', 'admin'),
  async (req, res) => {
    const filter =
      req.user.role === 'student'
        ? { student: req.user._id }
        : req.query.status
          ? { status: req.query.status }
          : {};

    let changes = await RoomChange.find(filter)
      .populate('student', 'name username')
      .populate('requestedRoom')
      .populate({
        path: 'allocation',
        populate: { path: 'room' },
      })
      .sort('-createdAt');

    if (req.user.role === 'warden') {
      changes = changes.filter(
        (change) =>
          (
            change.requestedRoom &&
            wardenCanSee(
              req.user,
              change.requestedRoom.block,
            )
          ) ||
          (
            change.allocation?.room &&
            wardenCanSee(
              req.user,
              change.allocation.room.block,
            )
          ),
      );
    }

    res.json(changes);
  },
);


// =====================================================
// STUDENT: REQUEST ROOM CHANGE
// =====================================================

r.post('/room-change', allow('student'), async (req, res) => {
  const allocation = await Allocation.findOne({
    student: req.user._id,
    status: { $in: ACTIVE },
  }).populate('room');

  if (!allocation) {
    throw new HttpError(
      400,
      'You do not have an allocated room',
    );
  }

  const existingRequest = await RoomChange.exists({
    student: req.user._id,
    status: 'Pending',
  });

  if (existingRequest) {
    throw new HttpError(
      409,
      'You already have a pending room-change request',
    );
  }

  if (
    !req.body.reason ||
    req.body.reason.trim().length < 10
  ) {
    throw new HttpError(
      400,
      'Explain the reason in at least 10 characters',
    );
  }

  const room = await Room.findById(req.body.roomId);

  if (
    !room ||
    String(room._id) === String(allocation.room._id)
  ) {
    throw new HttpError(
      400,
      'Choose a different room',
    );
  }

  if (room.status !== 'Active') {
    throw new HttpError(
      400,
      'The selected room is not currently available',
    );
  }

  const roomChange = await RoomChange.create({
    student: req.user._id,
    allocation: allocation._id,
    requestedRoom: room._id,
    reason: req.body.reason.trim(),
  });

  allocation.roomConfirmationStatus = 'ChangeRequested';
  allocation.roomChangeReason = req.body.reason.trim();

  await allocation.save();

  notify(await idsByRole('warden'), {
    type: 'room',
    title: 'Room-change request',
    message: `${req.user.name} requested a move from ${allocation.room.block}-${allocation.room.number} to ${room.block}-${room.number}.`,
    link: '/room-changes',
  });

  audit(
    req.user,
    'ROOM_CHANGE_REQUESTED',
    'RoomChange',
    roomChange._id,
    {
      from: `${allocation.room.block}-${allocation.room.number}`,
      to: `${room.block}-${room.number}`,
    },
    req.ip,
  );

  res.status(201).json(roomChange);
});


// =====================================================
// WARDEN: APPROVE OR DENY ROOM CHANGE
// =====================================================

r.post(
  '/room-change/:id/decide',
  allow('warden', 'admin'),
  async (req, res) => {
    const roomChange = await RoomChange.findById(
      req.params.id,
    )
      .populate('requestedRoom')
      .populate('student', 'name username');

    if (!roomChange || roomChange.status !== 'Pending') {
      throw new HttpError(
        400,
        'This request has already been decided',
      );
    }

    const currentAllocation = await Allocation.findById(
      roomChange.allocation,
    ).populate('room');

    if (!currentAllocation) {
      throw new HttpError(
        404,
        'Original allocation not found',
      );
    }

    if (
      !wardenCanSee(req.user, roomChange.requestedRoom.block) ||
      !wardenCanSee(req.user, currentAllocation.room.block)
    ) {
      throw new HttpError(
        403,
        'You are not authorized to decide this room-change request',
      );
    }

    if (req.body.approve) {
      if (!ACTIVE.includes(currentAllocation.status)) {
        throw new HttpError(
          409,
          'The student no longer holds the original bed',
        );
      }

      const application = currentAllocation.application
        ? await Application.findById(
            currentAllocation.application,
          )
        : null;

      // Allocate the new bed first. If allocation fails,
      // the original bed remains untouched.
      const nextAllocation = await allocateBed({
        application: null,
        studentId: roomChange.student._id,
        room: roomChange.requestedRoom,
        by: req.user,
        session: currentAllocation.session,
      });

      nextAllocation.application = currentAllocation.application;
      nextAllocation.roomConfirmationStatus = 'Pending';
      nextAllocation.roomConfirmationAt = null;
      nextAllocation.roomChangeReason = '';

      if (currentAllocation.status === 'CheckedIn') {
        nextAllocation.status = 'CheckedIn';
        nextAllocation.checkInAt = new Date();
      }

      await nextAllocation.save();

      await endAllocation(
        currentAllocation,
        'Vacated',
        'Room change',
      );

      if (application) {
        application.status = 'Allocated';
        await application.save();
      }

      notify(roomChange.student._id, {
        type: 'room',
        title: 'Room change approved',
        message: `Your room change to ${roomChange.requestedRoom.block}-${roomChange.requestedRoom.number} is approved. Please review and accept your new room.`,
        link: '/my-room',
      });
    } else {
      // The original room can be accepted after denial.
      currentAllocation.roomConfirmationStatus = 'Pending';
      currentAllocation.roomChangeReason = '';

      await currentAllocation.save();

      notify(roomChange.student._id, {
        type: 'room',
        title: 'Room change denied',
        message: `Your room-change request was denied.${req.body.note ? ` ${req.body.note}` : ''} You can accept your current room or submit another request.`,
        link: '/my-room',
      });
    }

    roomChange.status = req.body.approve
      ? 'Approved'
      : 'Denied';

    roomChange.decidedBy = req.user._id;
    roomChange.decisionNote = req.body.note;
    roomChange.decidedAt = new Date();

    await roomChange.save();

    audit(
      req.user,
      `ROOM_CHANGE_${roomChange.status.toUpperCase()}`,
      'RoomChange',
      roomChange._id,
      {},
      req.ip,
    );

    res.json(roomChange);
  },
);

export default r;