import { Room, Allocation, ACTIVE } from '../models/index.js';
export async function listRooms(filter = {}) {
  const rooms = await Room.find(filter).sort({ block: 1, floor: 1, number: 1 }).lean();
  const acts = await Allocation.find({ status: { $in: ACTIVE } }).populate('student', 'name username department year').lean();
  const map = new Map();
  acts.forEach((a) => { const k = String(a.room); (map.get(k) || map.set(k, []).get(k)).push(a); });
  return rooms.map((r) => {
    const occ = map.get(String(r._id)) || [];
    const available = r.status === 'Active' ? Math.max(0, r.capacity - occ.length) : 0;
    const state = r.status !== 'Active' ? r.status : occ.length === 0 ? 'Vacant' : occ.length >= r.capacity ? 'Full' : 'Partial';
    return { ...r, occupants: occ, occupied: occ.length, available, state };
  });
}
export const compatible = (room, category) => room.categoryQuota === 'Any' || !category || room.categoryQuota === category;
export async function availableBedsFor(type, category) {
  const rooms = await listRooms(type ? { type } : {});
  return rooms.filter((r) => compatible(r, category)).reduce((s, r) => s + r.available, 0);
}
