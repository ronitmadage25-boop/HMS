import { Allocation, Room, Application, ACTIVE } from '../models/index.js';
import { HttpError, getSettings, nextSeq, pad } from './helpers.js';
import { notify } from './notify.js';
import { generateInvoice } from './fees.js';

export async function allocateBed({ application, studentId, room, bed, by, session }) {
  if (room.status !== 'Active') throw new HttpError(409, `Room ${room.block}-${room.number} is ${room.status.toLowerCase()} and cannot be allocated`);
  const taken = new Set((await Allocation.find({ room: room._id, status: { $in: ACTIVE } })).map((a) => a.bed));
  let b = bed;
  if (b) { if (b > room.capacity || b < 1) throw new HttpError(400, 'That bed does not exist in this room'); if (taken.has(b)) throw new HttpError(409, `Bed ${b} in room ${room.number} is already occupied or reserved`); }
  else { for (let i = 1; i <= room.capacity; i++) if (!taken.has(i)) { b = i; break; } if (!b) throw new HttpError(409, `Room ${room.block}-${room.number} has no free bed`); }
  const s = session || (await getSettings()).session;
  let alloc;
  try {
    alloc = await Allocation.create({ student: studentId, application: application?._id, room: room._id, bed: b, bedKey: `${room._id}:${b}`, session: s, allocatedBy: by?._id, letterNo: `ALT-${new Date().getFullYear()}-${pad(await nextSeq('allocation'))}` });
  } catch (e) { if (e.code === 11000) throw new HttpError(409, `Bed ${b} in room ${room.number} is already occupied or reserved`); throw e; }
  if (application) { application.status = 'Allocated'; await application.save(); }
  notify(studentId, { type: 'room', title: 'Room allotted', message: `You have been allotted Block ${room.block}, floor ${room.floor}, room ${room.number}, bed ${b}.`, link: '/my-room' });
  await generateInvoice(alloc);
  return alloc;
}
export async function endAllocation(a, status, reason) {
  a.status = status; a.bedKey = undefined; a.endedAt = new Date(); a.endReason = reason; if (status === 'CheckedOut') a.checkOutAt = a.endedAt; await a.save();
}
