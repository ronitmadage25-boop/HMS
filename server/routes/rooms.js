import { Router } from 'express';
import { Room, Allocation } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { HttpError, pick } from '../utils/helpers.js';
import { audit } from '../utils/audit.js';
import { listRooms } from '../utils/rooms.js';

const r = Router(); r.use(protect);
const summarize = (rooms) => {
  const t = { total: 0, occupied: 0, available: 0, blocked: 0 }; const blocks = {}; const types = {};
  rooms.forEach((x) => {
    const beds = x.capacity; const blockedBeds = x.status === 'Active' ? 0 : Math.max(0, beds - x.occupied);
    t.total += beds; t.occupied += x.occupied; t.available += x.available; t.blocked += blockedBeds;
    const b = (blocks[x.block] ||= { block: x.block, total: 0, occupied: 0, available: 0, blocked: 0 });
    b.total += beds; b.occupied += x.occupied; b.available += x.available; b.blocked += blockedBeds;
    const ty = (types[x.type] ||= { type: x.type, total: 0, available: 0 }); ty.total += beds; ty.available += x.available;
  });
  return { ...t, blocks: Object.values(blocks), types: Object.values(types) };
};
r.get('/availability', async (req, res) => { const s = summarize(await listRooms()); res.json({ types: s.types, available: s.available, total: s.total }); });
r.get('/available', allow('student'), async (req, res) => {
  const rooms = await listRooms(); res.json(rooms.filter((x) => x.available > 0).map(({ _id, block, floor, number, type, available }) => ({ _id, block, floor, number, type, available })));
});
r.get('/summary', allow('warden', 'staff', 'admin'), async (req, res) => res.json(summarize(await listRooms())));
r.get('/', allow('warden', 'staff', 'admin'), async (req, res) => {
  const f = {}; ['block', 'floor', 'type'].forEach((k) => { if (req.query[k]) f[k] = k === 'floor' ? Number(req.query[k]) : req.query[k]; });
  let rooms = await listRooms(f);
  if (req.query.state) rooms = rooms.filter((x) => x.state === req.query.state);
  res.json(rooms);
});
r.post('/', allow('admin'), async (req, res) => {
  const room = await Room.create(pick(req.body, ['block', 'floor', 'number', 'type', 'capacity', 'categoryQuota']));
  audit(req.user, 'ROOM_CREATED', 'Room', room._id, { block: room.block, number: room.number }, req.ip); res.status(201).json(room);
});
r.post('/bulk', allow('admin'), async (req, res) => {
  const { block, floors, perFloor, type, capacity, categoryQuota } = req.body;
  if (!block || !floors || !perFloor || !type || !capacity) throw new HttpError(400, 'Block, floors, rooms per floor, type and capacity are required');
  const docs = [];
  for (let f = 1; f <= Number(floors); f++) for (let n = 1; n <= Number(perFloor); n++) docs.push({ block, floor: f, number: `${f}${String(n).padStart(2, '0')}`, type, capacity: Number(capacity), categoryQuota: categoryQuota || 'Any' });
  let created = 0;
  for (const d of docs) { try { await Room.create(d); created++; } catch (e) { if (e.code !== 11000) throw e; } }
  audit(req.user, 'ROOMS_BULK_CREATED', 'Room', null, { block, created }, req.ip); res.status(201).json({ created, skipped: docs.length - created });
});
r.put('/:id', allow('admin'), async (req, res) => {
  const room = await Room.findById(req.params.id); if (!room) throw new HttpError(404, 'Room not found');
  const occ = await Allocation.countDocuments({ room: room._id, status: { $in: ['Allocated', 'CheckedIn'] } });
  if (req.body.capacity !== undefined && Number(req.body.capacity) < occ) throw new HttpError(409, `${occ} students currently occupy this room. Capacity cannot be lower.`);
  Object.assign(room, pick(req.body, ['block', 'floor', 'number', 'type', 'capacity', 'status', 'categoryQuota']));
  await room.save(); audit(req.user, 'ROOM_UPDATED', 'Room', room._id, pick(req.body, ['status', 'capacity']), req.ip); res.json(room);
});
r.delete('/:id', allow('admin'), async (req, res) => {
  if (await Allocation.exists({ room: req.params.id })) throw new HttpError(409, 'This room has allocation history and cannot be deleted. Mark it Blocked instead.');
  await Room.deleteOne({ _id: req.params.id }); audit(req.user, 'ROOM_DELETED', 'Room', req.params.id, {}, req.ip); res.json({ ok: true });
});
export default r;
