import { useState } from 'react';
import { Download, ArrowLeftRight } from 'lucide-react';
import { api, msg, fmtDate, fmtTime, download } from '../api';
import { useLoad, Loading, PageHeader, Badge, Empty, Modal, Field, toast } from '../components/ui';

export default function MyRoom() {
  const { data, loading, reload } = useLoad(() => api.get('/allocations/mine').then((r) => r.data), []);
  const { data: hist } = useLoad(() => api.get('/allocations/history').then((r) => r.data), []);
  const { data: avail } = useLoad(() => api.get('/rooms/available').then((r) => r.data), []);
  const { data: changes, reload: rc } = useLoad(() => api.get('/allocations/room-change/list').then((r) => r.data), []);
  const [open, setOpen] = useState(false); const [f, setF] = useState({ roomId: '', reason: '' });
  if (loading) return <Loading />;
  const a = data.allocation;
  const send = async () => { try { await api.post('/allocations/room-change', f); toast.ok('Request sent to the warden'); setOpen(false); setF({ roomId: '', reason: '' }); reload(); rc(); } catch (e) { toast.err(msg(e)); } };
  return (<>
    <PageHeader title="My room" subtitle="Your allotment, roommates and room history." actions={a && <><button className="btn-outline" onClick={() => download(`/allocations/${a._id}/letter`, `${a.letterNo}.pdf`)}><Download size={16} />Allocation letter</button>{!data.pendingChange && <button className="btn-primary" onClick={() => setOpen(true)}><ArrowLeftRight size={16} />Request room change</button>}</>} />
    {!a ? <div className="card"><Empty title="No room allotted yet" hint="Once your application is approved, the warden allots a bed and you are notified here." /></div> : (<>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">Allotted bed</p><p className="mt-1 font-display text-4xl font-semibold">{a.room.block}-{a.room.number}</p><p className="mt-1 text-sm text-slate-600">Block {a.room.block} · Floor {a.room.floor} · Bed {a.bed} · {a.room.type}</p></div><Badge color={a.status === 'CheckedIn' ? 'green' : 'amber'}>{a.status === 'CheckedIn' ? 'Checked in' : 'Awaiting check-in'}</Badge></div>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-slate-500">Allotted on</dt><dd className="font-semibold">{fmtDate(a.allocatedAt)}</dd></div><div><dt className="text-slate-500">Checked in</dt><dd className="font-semibold">{a.checkInAt ? fmtTime(a.checkInAt) : 'Not yet'}</dd></div><div><dt className="text-slate-500">Letter no.</dt><dd className="font-semibold">{a.letterNo}</dd></div></dl>
          {a.status === 'Allocated' && <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">Pay the full fee or the first installment, then check in within 7 days of allotment. Otherwise the bed returns to the pool.</p>}
          {data.pendingChange && <p className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800 ring-1 ring-brand-200">Room-change request to {data.pendingChange.requestedRoom.block}-{data.pendingChange.requestedRoom.number} is waiting for the warden.</p>}</div>
        <div className="card p-6"><h3 className="mb-3 font-semibold">Roommates</h3>{data.roommates.length ? <ul className="space-y-3">{data.roommates.map((m, i) => <li key={i} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{m.name[0]}</span><div><p className="text-sm font-semibold">{m.name}</p><p className="text-xs text-slate-500">{m.department}{m.phone ? ` · ${m.phone}` : ''}</p></div></li>)}</ul> : <p className="text-sm text-slate-500">No one else is assigned to this room yet.</p>}</div>
      </div></>)}
    {changes?.length > 0 && <div className="mt-8"><h3 className="mb-3 font-semibold">Room-change requests</h3><div className="card divide-y divide-line">{changes.map((c) => <div key={c._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><span>To {c.requestedRoom.block}-{c.requestedRoom.number} · {c.reason}{c.decisionNote ? ` · Warden: ${c.decisionNote}` : ''}</span><Badge>{c.status}</Badge></div>)}</div></div>}
    {hist?.length > 0 && <div className="mt-8"><h3 className="mb-3 font-semibold">Room history</h3><div className="card divide-y divide-line">{hist.map((h) => <div key={h._id} className="flex items-center justify-between px-5 py-3 text-sm"><span>{h.session} · {h.room.block}-{h.room.number}, bed {h.bed}</span><span className="flex items-center gap-3 text-slate-500">{h.endReason || ''} {fmtDate(h.endedAt || h.allocatedAt)}<Badge>{h.status}</Badge></span></div>)}</div></div>}
    <Modal open={open} onClose={() => setOpen(false)} title="Request a room change" footer={<><button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" onClick={send}>Send request</button></>}>
      <div className="space-y-4"><Field label="Room you want" required><select className="input" value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}><option value="">Choose a room with a free bed</option>{(avail || []).filter((r) => r._id !== a?.room._id).map((r) => <option key={r._id} value={r._id}>{r.block}-{r.number} · {r.type} · floor {r.floor} · {r.available} free</option>)}</select></Field>
        <Field label="Reason" required hint="At least 10 characters."><textarea rows={3} className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field></div></Modal></>);
}
