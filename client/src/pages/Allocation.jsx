import { useState } from 'react';
import { Wand2, Download } from 'lucide-react';
import { api, msg, fmtDate, download } from '../api';
import { useLoad, Loading, PageHeader, Badge, Empty, Modal, Field, toast, Table, Tabs } from '../components/ui';

export default function Allocation() {
  const [tab, setTab] = useState('queue');
  const apps = useLoad(() => api.get('/allocations/unallocated').then((r) => r.data), []);
  const rooms = useLoad(() => api.get('/rooms').then((r) => r.data), []);
  const list = useLoad(() => api.get('/allocations', { params: { active: 1 } }).then((r) => r.data), []);
  const [manual, setManual] = useState(null); const [roomId, setRoomId] = useState(''); const [bed, setBed] = useState(''); const [plan, setPlan] = useState(null); const [busy, setBusy] = useState(false);
  const all = () => { apps.reload(); rooms.reload(); list.reload(); };
  const assign = async () => { try { await api.post('/allocations', { applicationId: manual._id, roomId, bed: bed || undefined }); toast.ok('Room allotted and student notified'); setManual(null); setRoomId(''); setBed(''); all(); } catch (e) { toast.err(msg(e)); } };
  const preview = async () => { setBusy(true); try { setPlan((await api.get('/allocations/auto/preview')).data); } catch (e) { toast.err(msg(e)); } finally { setBusy(false); } };
  const confirm = async () => { setBusy(true); try { const r = await api.post('/allocations/auto/confirm', { assignments: plan.assignments }); toast.ok(`${r.data.done} room(s) allotted`); const bad = r.data.results.find((x) => !x.ok); if (bad) toast.err(`${bad.student}: ${bad.message}`); setPlan(null); all(); } catch (e) { toast.err(msg(e)); } finally { setBusy(false); } };
  if (apps.loading || rooms.loading || !list.data) return <Loading />;
  const fit = manual ? (rooms.data || []).filter((r) => r.available > 0 && r.status === 'Active') : [];
  const chosen = (rooms.data || []).find((r) => r._id === roomId);
  return (<>
    <PageHeader title="Room allocation" subtitle="Allot beds to approved applicants. Continuing residents come first, then by submission date." actions={<button className="btn-primary" disabled={busy || !apps.data?.length} onClick={preview}><Wand2 size={16} />Auto-allocate</button>} />
    <Tabs tabs={[{ id: 'queue', label: 'Awaiting a room', count: apps.data?.length }, { id: 'done', label: 'Allotted' }]} value={tab} onChange={setTab} />
    {tab === 'queue' ? <Table head={['Applicant', 'Preference', 'Type', 'Approved', '']} empty={apps.data.length ? null : <Empty title="Nobody is waiting" hint="Approved applications appear here until a room is allotted." />}>
      {apps.data.map((a) => <tr key={a._id}><td className="td"><p className="font-semibold">{a.student.name} <span className="font-normal text-slate-500">#{a.number}</span></p><p className="text-xs text-slate-500">{a.student.username.toUpperCase()}</p></td><td className="td">{a.roomTypePref} · {a.category}</td><td className="td">{a.studentType === 'continuing' ? 'Continuing' : 'New'}</td><td className="td">{fmtDate(a.decidedAt)}</td><td className="td text-right"><button className="btn-soft !py-1.5" onClick={() => setManual(a)}>Choose room</button></td></tr>)}</Table> :
      <Table head={['Student', 'Room', 'Bed', 'Allotted', 'Status', '']} empty={list.data.length ? null : <Empty title="No active allocations" />}>
        {list.data.map((a) => <tr key={a._id}><td className="td font-semibold">{a.student.name}<p className="text-xs font-normal text-slate-500">{a.student.username.toUpperCase()}</p></td><td className="td">{a.room.block}-{a.room.number} · floor {a.room.floor}</td><td className="td">{a.bed}</td><td className="td">{fmtDate(a.allocatedAt)}</td><td className="td"><Badge>{a.status}</Badge></td><td className="td text-right"><button className="btn-outline !py-1.5" onClick={() => download(`/allocations/${a._id}/letter`, `${a.letterNo}.pdf`)}><Download size={15} />Letter</button></td></tr>)}</Table>}
    <Modal open={!!manual} onClose={() => setManual(null)} title={manual ? `Allot a bed to ${manual.student.name}` : ''} footer={<><button className="btn-outline" onClick={() => setManual(null)}>Cancel</button><button className="btn-primary" disabled={!roomId} onClick={assign}>Allot bed</button></>}>
      {manual && <div className="space-y-4"><p className="text-sm text-slate-600">Prefers <b>{manual.roomTypePref}</b> · {manual.category} category.</p>
        <Field label="Room" required><select className="input" value={roomId} onChange={(e) => { setRoomId(e.target.value); setBed(''); }}><option value="">Select a room</option>{fit.sort((a, b) => (b.type === manual.roomTypePref) - (a.type === manual.roomTypePref)).map((r) => <option key={r._id} value={r._id}>{r.block}-{r.number} · {r.type} · floor {r.floor} · {r.available} free{r.type === manual.roomTypePref ? ' · matches' : ''}</option>)}</select></Field>
        {chosen && <Field label="Bed" hint="Leave blank to use the first free bed."><select className="input" value={bed} onChange={(e) => setBed(e.target.value)}><option value="">First free bed</option>{Array.from({ length: chosen.capacity }, (_, i) => i + 1).map((n) => <option key={n} value={n} disabled={chosen.occupants.some((o) => o.bed === n)}>Bed {n}{chosen.occupants.some((o) => o.bed === n) ? ' (occupied)' : ''}</option>)}</select></Field>}</div>}</Modal>
    <Modal open={!!plan} onClose={() => setPlan(null)} wide title="Proposed allocation" footer={<><button className="btn-outline" onClick={() => setPlan(null)}>Cancel</button><button className="btn-primary" disabled={busy || !plan?.assignments.length} onClick={confirm}>Confirm {plan?.assignments.length} allotment(s)</button></>}>
      {plan && <div className="space-y-4">{plan.assignments.length ? <Table head={['Applicant', 'Room', 'Type']}>{plan.assignments.map((a) => <tr key={a.applicationId}><td className="td font-semibold">{a.student} <span className="font-normal text-slate-500">#{a.number}</span></td><td className="td">{a.room}</td><td className="td">{a.type}</td></tr>)}</Table> : <Empty title="No matches found" hint="No free beds match the approved applicants' preferences." />}
        {plan.skipped.length > 0 && <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200"><p className="font-semibold">Could not place {plan.skipped.length}</p><ul className="mt-1 list-disc pl-5">{plan.skipped.map((s) => <li key={s.applicationId}>{s.student} (#{s.number}): {s.reason}</li>)}</ul></div>}</div>}</Modal>
  </>);
}
