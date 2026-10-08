import { useState } from 'react';
import { Plus, Layers, Pencil, Trash2 } from 'lucide-react';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { useLoad, Loading, PageHeader, Badge, Empty, Modal, Field, toast, Confirm, Stat } from '../components/ui';
import { BedDouble, DoorOpen, Ban } from 'lucide-react';

const stateStyle = { Vacant: 'border-emerald-200 bg-emerald-50', Partial: 'border-amber-200 bg-amber-50', Full: 'border-brand-200 bg-brand-50', 'Under Maintenance': 'border-slate-300 bg-slate-100', Blocked: 'border-red-200 bg-red-50' };
const dot = { Vacant: 'bg-emerald-500', Partial: 'bg-amber-500', Full: 'bg-brand-600', 'Under Maintenance': 'bg-slate-500', Blocked: 'bg-red-500' };

export default function Rooms() {
  const { user } = useAuth(); const admin = user.role === 'admin';
  const [flt, setFlt] = useState({ block: '', floor: '', type: '' });
  const params = Object.fromEntries(Object.entries(flt).filter(([, v]) => v));
  const rooms = useLoad(() => api.get('/rooms', { params }).then((r) => r.data), [JSON.stringify(flt)], 5000);
  const sum = useLoad(() => api.get('/rooms/summary').then((r) => r.data), [], 5000);
  const [edit, setEdit] = useState(null); const [bulk, setBulk] = useState(false); const [del, setDel] = useState(null); const [f, setF] = useState({}); const [b, setB] = useState({ block: '', floors: 4, perFloor: 10, type: 'Double', capacity: 2, categoryQuota: 'Any' });
  if (!rooms.data || !sum.data) return <Loading />;
  const blocks = sum.data.blocks.map((x) => x.block); const types = sum.data.types.map((x) => x.type); const floors = [...new Set(rooms.data.map((r) => r.floor))].sort((a, c) => a - c);
  const grouped = rooms.data.reduce((m, r) => { ((m[r.block] ||= {})[r.floor] ||= []).push(r); return m; }, {});
  const reload = () => { rooms.reload(); sum.reload(); };
  const save = async () => { try { if (edit._id) await api.put(`/rooms/${edit._id}`, f); else await api.post('/rooms', f); toast.ok('Room saved'); setEdit(null); reload(); } catch (e) { toast.err(msg(e)); } };
  const addBulk = async () => { try { const r = await api.post('/rooms/bulk', b); toast.ok(`${r.data.created} rooms created${r.data.skipped ? `, ${r.data.skipped} already existed` : ''}`); setBulk(false); reload(); } catch (e) { toast.err(msg(e)); } };
  const remove = async () => { try { await api.delete(`/rooms/${del._id}`); toast.ok('Room deleted'); setDel(null); reload(); } catch (e) { toast.err(msg(e)); setDel(null); } };
  const setStatus = async (r, status) => { try { await api.put(`/rooms/${r._id}`, { status }); toast.ok(`Room ${r.number} is now ${status}`); reload(); } catch (e) { toast.err(msg(e)); } };
  const S = sum.data;
  return (<>
    <PageHeader title={admin ? 'Rooms' : 'Room availability'} subtitle="Live bed status, refreshed every few seconds." actions={admin && <><button className="btn-outline" onClick={() => setBulk(true)}><Layers size={16} />Add a block</button><button className="btn-primary" onClick={() => { setF({ block: '', floor: 1, number: '', type: 'Double', capacity: 2, categoryQuota: 'Any' }); setEdit({}); }}><Plus size={16} />Add room</button></>} />
    <div className="grid gap-4 sm:grid-cols-4"><Stat icon={BedDouble} label="Total beds" value={S.total} /><Stat icon={DoorOpen} label="Occupied" value={S.occupied} /><Stat icon={BedDouble} label="Available" value={S.available} /><Stat icon={Ban} label="Blocked or in maintenance" value={S.blocked} /></div>
    <div className="my-5 flex flex-wrap items-center gap-3">
      <select className="input !w-auto" value={flt.block} onChange={(e) => setFlt({ ...flt, block: e.target.value })}><option value="">All blocks</option>{blocks.map((x) => <option key={x}>{x}</option>)}</select>
      <select className="input !w-auto" value={flt.floor} onChange={(e) => setFlt({ ...flt, floor: e.target.value })}><option value="">All floors</option>{(flt.floor || !floors.length ? [...new Set([...floors, Number(flt.floor)].filter(Boolean))] : floors).map((x) => <option key={x}>{x}</option>)}</select>
      <select className="input !w-auto" value={flt.type} onChange={(e) => setFlt({ ...flt, type: e.target.value })}><option value="">All room types</option>{types.map((x) => <option key={x}>{x}</option>)}</select>
      <div className="ml-auto flex flex-wrap gap-3 text-xs">{['Vacant', 'Partial', 'Full', 'Under Maintenance', 'Blocked'].map((s) => <span key={s} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${dot[s]}`} />{s === 'Partial' ? 'Partially occupied' : s}</span>)}</div></div>
    {!rooms.data.length ? <div className="card"><Empty title="No rooms found" hint={admin ? 'Use Add a block to create rooms in bulk.' : 'The administrator has not added rooms yet.'} /></div> :
      Object.entries(grouped).map(([block, fl]) => (<section key={block} className="mb-6"><h3 className="mb-3 flex items-center gap-3 font-semibold">Block {block}<span className="text-sm font-normal text-slate-500">{S.blocks.find((x) => x.block === block)?.available} beds free</span></h3>
        {Object.entries(fl).map(([floor, rs]) => (<div key={floor} className="mb-3 flex gap-4"><div className="w-14 shrink-0 pt-3 text-xs font-semibold text-slate-500">Floor {floor}</div><div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {rs.map((r) => <div key={r._id} className={`group relative rounded-xl border p-2.5 ${stateStyle[r.state]}`} title={r.occupants.map((o) => o.student?.name).join(', ') || 'Vacant'}>
            <div className="flex items-center justify-between"><span className="font-display text-sm font-semibold">{r.number}</span><span className={`h-2 w-2 rounded-full ${dot[r.state]}`} /></div>
            <p className="mt-0.5 text-[11px] text-slate-600">{r.type} · {r.occupied}/{r.capacity}</p>
            {admin && <div className="absolute inset-0 hidden items-center justify-center gap-1 rounded-xl bg-white/95 group-hover:flex group-focus-within:flex">
              <button className="rounded-lg p-1.5 hover:bg-brand-50" aria-label="Edit" onClick={() => { setF({ block: r.block, floor: r.floor, number: r.number, type: r.type, capacity: r.capacity, categoryQuota: r.categoryQuota }); setEdit(r); }}><Pencil size={14} /></button>
              <button className="rounded-lg p-1.5 text-xs font-semibold hover:bg-brand-50" onClick={() => setStatus(r, r.status === 'Active' ? 'Under Maintenance' : 'Active')}>{r.status === 'Active' ? 'Maint.' : 'Open'}</button>
              <button className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" aria-label="Delete" onClick={() => setDel(r)}><Trash2 size={14} /></button></div>}</div>)}</div></div>))}</section>))}
    <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? `Edit room ${edit.number}` : 'Add room'} footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Block" required><input className="input" value={f.block || ''} onChange={(e) => setF({ ...f, block: e.target.value })} /></Field><Field label="Floor" required><input type="number" className="input" value={f.floor ?? ''} onChange={(e) => setF({ ...f, floor: e.target.value })} /></Field><Field label="Room number" required><input className="input" value={f.number || ''} onChange={(e) => setF({ ...f, number: e.target.value })} /></Field><Field label="Room type" required><input className="input" placeholder="Single, Double, Triple" value={f.type || ''} onChange={(e) => setF({ ...f, type: e.target.value })} /></Field><Field label="Beds" required><input type="number" min="1" className="input" value={f.capacity ?? ''} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></Field><Field label="Category quota"><select className="input" value={f.categoryQuota || 'Any'} onChange={(e) => setF({ ...f, categoryQuota: e.target.value })}><option>Any</option><option>General</option><option>Reserved</option></select></Field></div></Modal>
    <Modal open={bulk} onClose={() => setBulk(false)} title="Add a block" footer={<><button className="btn-outline" onClick={() => setBulk(false)}>Cancel</button><button className="btn-primary" onClick={addBulk}>Create rooms</button></>}>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Block name" required><input className="input" value={b.block} onChange={(e) => setB({ ...b, block: e.target.value })} /></Field><Field label="Floors" required><input type="number" min="1" className="input" value={b.floors} onChange={(e) => setB({ ...b, floors: e.target.value })} /></Field><Field label="Rooms per floor" required><input type="number" min="1" className="input" value={b.perFloor} onChange={(e) => setB({ ...b, perFloor: e.target.value })} /></Field><Field label="Room type" required><input className="input" value={b.type} onChange={(e) => setB({ ...b, type: e.target.value })} /></Field><Field label="Beds per room" required><input type="number" min="1" className="input" value={b.capacity} onChange={(e) => setB({ ...b, capacity: e.target.value })} /></Field><Field label="Category quota"><select className="input" value={b.categoryQuota} onChange={(e) => setB({ ...b, categoryQuota: e.target.value })}><option>Any</option><option>General</option><option>Reserved</option></select></Field></div>
      <p className="mt-3 text-xs text-slate-500">Rooms are numbered by floor, e.g. 101, 102 … 210.</p></Modal>
    <Confirm open={!!del} danger title="Delete room?" text={`Room ${del?.block}-${del?.number} will be removed. Rooms with allocation history cannot be deleted.`} yes="Delete" onNo={() => setDel(null)} onYes={remove} /></>);
}
