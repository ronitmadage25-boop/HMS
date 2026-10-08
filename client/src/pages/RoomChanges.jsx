import { useState } from 'react';
import { api, msg, fmtTime } from '../api';
import { useLoad, Loading, PageHeader, Badge, Empty, Modal, Field, toast, Table, Tabs } from '../components/ui';

export default function RoomChanges() {
  const [tab, setTab] = useState('Pending'); const [sel, setSel] = useState(null); const [note, setNote] = useState('');
  const { data, loading, reload } = useLoad(() => api.get('/allocations/room-change/list', { params: { status: tab } }).then((r) => r.data), [tab]);
  const decide = async (approve) => { try { await api.post(`/allocations/room-change/${sel._id}/decide`, { approve, note }); toast.ok(approve ? 'Room change approved' : 'Request denied'); setSel(null); setNote(''); reload(); } catch (e) { toast.err(msg(e)); } };
  return (<><PageHeader title="Room changes" subtitle="Only the warden of the requested room's block can approve a move." />
    <Tabs tabs={['Pending', 'Approved', 'Denied'].map((t) => ({ id: t, label: t }))} value={tab} onChange={setTab} />
    {loading ? <Loading /> : <Table head={['Student', 'From', 'To', 'Reason', 'Requested', '']} empty={data.length ? null : <Empty title={`No ${tab.toLowerCase()} requests`} />}>
      {data.map((c) => <tr key={c._id}><td className="td font-semibold">{c.student?.name}</td><td className="td">{c.allocation.room.block}-{c.allocation.room.number}</td><td className="td">{c.requestedRoom.block}-{c.requestedRoom.number}</td><td className="td max-w-xs truncate" title={c.reason}>{c.reason}</td><td className="td">{fmtTime(c.createdAt)}</td><td className="td text-right">{c.status === 'Pending' ? <button className="btn-soft !py-1.5" onClick={() => setSel(c)}>Review</button> : <Badge>{c.status}</Badge>}</td></tr>)}</Table>}
    <Modal open={!!sel} onClose={() => setSel(null)} title="Review room-change request" footer={<><button className="btn-outline" onClick={() => decide(false)}>Deny</button><button className="btn-primary" onClick={() => decide(true)}>Approve move</button></>}>
      {sel && <div className="space-y-4 text-sm"><p><b>{sel.student?.name}</b> wants to move from <b>{sel.allocation.room.block}-{sel.allocation.room.number}</b> to <b>{sel.requestedRoom.block}-{sel.requestedRoom.number}</b>.</p><p className="rounded-xl bg-mist p-3">{sel.reason}</p><Field label="Note to the student"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>}</Modal></>);
}
