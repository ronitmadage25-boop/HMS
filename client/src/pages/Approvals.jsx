import { useState } from 'react';
import { Search, Check, X, Clock, FileText } from 'lucide-react';
import { api, msg, fmtDate, fmtTime } from '../api';
import { useAuth } from '../auth';
import { useLoad, Loading, PageHeader, Badge, Empty, Modal, Field, toast, Table, Tabs } from '../components/ui';

export default function Approvals() {
  const { user } = useAuth(); const [tab, setTab] = useState('pending'); const [q, setQ] = useState(''); const [sel, setSel] = useState({}); const [det, setDet] = useState(null); const [reject, setReject] = useState(null); const [reason, setReason] = useState('');
  const { data, loading, reload } = useLoad(() => api.get('/applications', { params: { ...(tab === 'pending' ? { pending: 1 } : tab === 'all' ? {} : { status: tab }), q } }).then((r) => r.data), [tab, q]);
  const ids = Object.keys(sel).filter((k) => sel[k]);
  const open = async (id) => { const r = await api.get(`/applications/${id}`); setDet(r.data); reload(); };
  const decide = async (id, decision, why) => { try { await api.post(`/applications/${id}/decision`, { decision, reason: why }); toast.ok(`Application ${decision.toLowerCase()}`); setDet(null); setReject(null); setReason(''); reload(); } catch (e) { toast.err(msg(e)); } };
  const bulk = async (decision, why) => { try { const r = await api.post('/applications/bulk/decision', { ids, decision, reason: why }); const bad = r.data.results.filter((x) => !x.ok); toast.ok(`${r.data.done} application(s) ${decision.toLowerCase()}`); if (bad.length) toast.err(bad[0].message); setSel({}); setReject(null); setReason(''); reload(); } catch (e) { toast.err(msg(e)); } };
  const reopen = async (id) => { try { await api.post(`/applications/${id}/reopen`); toast.ok('Reopened for reconsideration'); setDet(null); reload(); } catch (e) { toast.err(msg(e)); } };
  const decidable = (a) => ['Submitted', 'Under Review', 'Waitlisted'].includes(a.status);
  return (<>
    <PageHeader title="Applications" subtitle="Review submissions, approve, reject or waitlist." actions={ids.length > 0 && <><button className="btn-primary" onClick={() => bulk('Approved')}><Check size={16} />Approve {ids.length}</button><button className="btn-outline" onClick={() => setReject({ bulk: true })}><X size={16} />Reject {ids.length}</button></>} />
    <Tabs tabs={[{ id: 'pending', label: 'To review' }, { id: 'Waitlisted', label: 'Waitlisted' }, { id: 'Approved', label: 'Approved' }, { id: 'Rejected', label: 'Rejected' }, { id: 'all', label: 'All' }]} value={tab} onChange={(t) => { setTab(t); setSel({}); }} />
    <div className="relative mb-4 max-w-sm"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-10" placeholder="Search name, reg. no or application #" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {loading ? <Loading /> : <Table head={['', 'Applicant', 'Preference', 'Standing', 'Submitted', 'Status']} empty={data.length ? null : <Empty title="No applications here" hint="Submitted applications appear in submission order." />}>
      {data.map((a) => <tr key={a._id} className="hover:bg-mist"><td className="td w-10">{decidable(a) && a.status !== 'Waitlisted' && <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!sel[a._id]} onChange={(e) => setSel({ ...sel, [a._id]: e.target.checked })} />}</td>
        <td className="td cursor-pointer" onClick={() => open(a._id)}><p className="font-semibold">{a.student?.name} <span className="font-normal text-slate-500">#{a.number}</span></p><p className="text-xs text-slate-500">{a.student?.username?.toUpperCase()} · {a.student?.department}</p></td>
        <td className="td">{a.roomTypePref} · {a.category}</td><td className="td">{a.student?.disciplinaryHold ? <Badge color="red">Disciplinary hold</Badge> : <span className="text-slate-600">{a.student?.academicStanding}</span>}</td><td className="td">{fmtTime(a.submittedAt)}</td><td className="td"><Badge>{a.status}</Badge>{a.waitlistPosition ? <span className="ml-2 text-xs text-slate-500">#{a.waitlistPosition}</span> : null}</td></tr>)}</Table>}
    <Modal open={!!det} onClose={() => setDet(null)} wide title={det ? `Application #${det.number} · ${det.student?.name}` : ''} footer={det && <>
      {user.role === 'admin' && ['Rejected', 'Waitlisted'].includes(det.status) && <button className="btn-soft mr-auto" onClick={() => reopen(det._id)}>Reopen for reconsideration</button>}
      {decidable(det) && <><button className="btn-outline" onClick={() => decide(det._id, 'Waitlisted')}><Clock size={16} />Waitlist</button><button className="btn-outline" onClick={() => setReject({ id: det._id })}><X size={16} />Reject</button><button className="btn-primary" onClick={() => decide(det._id, 'Approved')}><Check size={16} />Approve</button></>}</>}>
      {det && <div className="space-y-5 text-sm"><div className="flex flex-wrap gap-2"><Badge>{det.status}</Badge><Badge color={det.student.academicStanding === 'Good standing' ? 'green' : 'amber'}>{det.student.academicStanding}</Badge>{det.student.disciplinaryHold && <Badge color="red">Disciplinary hold</Badge>}<Badge color="blue">{det.studentType === 'continuing' ? 'Continuing resident' : 'New resident'}</Badge></div>
        {det.student.disciplinaryNote && <p className="rounded-xl bg-red-50 p-3 text-red-800 ring-1 ring-red-200">Disciplinary note: {det.student.disciplinaryNote}</p>}
        <dl className="grid gap-3 sm:grid-cols-2">{[['Reg. no', det.student.username.toUpperCase()], ['E-mail', det.student.email], ['Date of birth', fmtDate(det.personal?.dob)], ['Gender', det.personal?.gender], ['Phone', det.personal?.phone], ['Program', `${det.program}, ${det.year}`], ['Category', det.category], ['Room preference', det.roomTypePref], ['Emergency contact', `${det.emergency?.name} (${det.emergency?.relation}) · ${det.emergency?.phone}`], ['Address', det.personal?.address]].map(([k, v]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-semibold">{v || '-'}</dd></div>)}</dl>
        <div><p className="mb-2 text-slate-500">Documents</p><div className="flex flex-wrap gap-2">{det.documents.map((d) => <a key={d.kind} href={d.path} target="_blank" rel="noreferrer" className="btn-outline !py-1.5"><FileText size={15} />{{ photo: 'Photograph', idProof: 'ID proof', feeProof: 'Fee proof' }[d.kind]}</a>)}</div></div>
        {det.rejectionReason && <p className="rounded-xl bg-red-50 p-3 text-red-800">Rejection reason: {det.rejectionReason}</p>}</div>}
    </Modal>
    <Modal open={!!reject} onClose={() => setReject(null)} title="Reject application" footer={<><button className="btn-outline" onClick={() => setReject(null)}>Cancel</button><button className="btn-danger" onClick={() => (reject.bulk ? bulk('Rejected', reason) : decide(reject.id, 'Rejected', reason))}>Reject</button></>}>
      <Field label="Reason shown to the student" required hint="At least 10 characters."><textarea rows={3} className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field></Modal>
  </>);
}
