import { useState, useEffect } from 'react';
import { Upload, FileCheck2, Trash2, Send, Undo2, Info } from 'lucide-react';
import { api, msg, fmtDate, fmtTime } from '../api';
import { useAuth } from '../auth';
import { useLoad, Loading, PageHeader, Field, Badge, toast, Confirm, Empty } from '../components/ui';

const DOCS = [['photo', 'Passport photograph'], ['idProof', 'Government ID proof'], ['feeProof', 'Fee-payment proof']];
const STEPS = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Allocated'];

export default function Application() {
  const { user } = useAuth();
  const { data, loading, reload } = useLoad(() => Promise.all([api.get('/applications/mine'), api.get('/rooms/availability'), api.get('/settings')]).then(([a, r, s]) => ({ apps: a.data, avail: r.data, settings: s.data })), []);
  const [app, setApp] = useState(null); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false); const [errs, setErrs] = useState([]);
  useEffect(() => { if (data) setApp(data.apps.find((a) => !['Withdrawn', 'Rejected', 'Forfeited'].includes(a.status)) || null); }, [data]);
  if (loading || !data) return <Loading />;
  const { apps, avail, settings } = data; const past = apps.filter((a) => a !== app && ['Withdrawn', 'Rejected', 'Forfeited'].includes(a.status));
  const closed = settings.applicationDeadline && new Date() > new Date(settings.applicationDeadline);

  const start = async () => { try { await api.post('/applications'); reload(); } catch (e) { toast.err(msg(e)); } };
  if (!app) return (<><PageHeader title="Hostel application" subtitle={`Session ${settings.session}`} />
    <div className="card p-8"><Empty title={closed ? 'Applications are closed' : 'Start your application'} hint={closed ? `The deadline was ${fmtDate(settings.applicationDeadline)}.` : `${settings.applicationDeadline ? `Apply before ${fmtDate(settings.applicationDeadline)}. ` : ''}Your details are pre-filled and you can save a draft at any time.`} action={!closed && <button className="btn-primary" onClick={start}>Start application</button>} /></div>
    {past.length > 0 && <History list={past} />}</>);

  const draft = app.status === 'Draft'; const set = (path, v) => { const a = structuredClone(app); const [k, s] = path.split('.'); if (s) { a[k] = a[k] || {}; a[k][s] = v; } else a[k] = v; setApp(a); };
  const payload = () => ({ studentType: app.studentType, personal: app.personal, program: app.program, year: app.year, category: app.category, roomTypePref: app.roomTypePref, emergency: app.emergency });
  const save = async (quiet) => { setBusy(true); try { const r = await api.put(`/applications/${app._id}`, payload()); setApp(r.data); if (!quiet) toast.ok('Draft saved'); return true; } catch (e) { toast.err(msg(e)); return false; } finally { setBusy(false); } };
  const upload = async (kind, file) => { if (!file) return; const fd = new FormData(); fd.append('kind', kind); fd.append('file', file); try { await save(true); const r = await api.post(`/applications/${app._id}/documents`, fd); setApp(r.data); toast.ok('File uploaded'); } catch (e) { toast.err(msg(e)); } };
  const drop = async (kind) => { const r = await api.delete(`/applications/${app._id}/documents/${kind}`); setApp(r.data); };
  const submit = async () => { setErrs([]); if (!(await save(true))) return; try { await api.post(`/applications/${app._id}/submit`); toast.ok('Application submitted'); reload(); } catch (e) { setErrs(e.response?.data?.missing || [msg(e)]); } };
  const withdraw = async () => { try { await api.post(`/applications/${app._id}/withdraw`); setConfirm(false); toast.ok('Application withdrawn'); reload(); } catch (e) { toast.err(msg(e)); } };
  const types = [...new Set(avail.types.map((t) => t.type))];
  const idx = STEPS.indexOf(app.status);

  return (<>
    <PageHeader title="Hostel application" subtitle={`Session ${settings.session}${settings.applicationDeadline ? ` · deadline ${fmtDate(settings.applicationDeadline)}` : ''}`}
      actions={<>{app.number && <span className="rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-line">Application #{app.number}</span>}<Badge>{app.status}</Badge></>} />
    {!['Rejected'].includes(app.status) && <div className="card mb-6 px-6 py-5"><ol className="flex items-center">{STEPS.map((s, i) => <li key={s} className="flex flex-1 items-center last:flex-none"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i <= idx ? 'bg-brand-600 text-white' : 'bg-mist text-slate-400 ring-1 ring-line'}`}>{i + 1}</span><span className={`ml-2 hidden text-xs font-semibold sm:block ${i <= idx ? 'text-ink' : 'text-slate-400'}`}>{s}</span>{i < STEPS.length - 1 && <span className={`mx-3 h-0.5 flex-1 rounded ${i < idx ? 'bg-brand-600' : 'bg-line'}`} />}</li>)}</ol></div>}
    {app.status === 'Rejected' && <div className="mb-6 rounded-2xl bg-red-50 p-5 text-sm text-red-800 ring-1 ring-red-200"><b>Rejected.</b> {app.rejectionReason}</div>}
    {app.status === 'Waitlisted' && <div className="mb-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-800 ring-1 ring-amber-200">You are on the waitlist at position <b>{app.waitlistPosition}</b>. You will be notified when a bed opens.</div>}
    {errs.length > 0 && <div role="alert" className="mb-6 rounded-2xl bg-red-50 p-5 text-sm text-red-800 ring-1 ring-red-200"><p className="font-semibold">Please fix before submitting</p><ul className="mt-1 list-disc pl-5">{errs.map((e) => <li key={e}>{e}</li>)}</ul></div>}

    <fieldset disabled={!draft} className="space-y-6">
      <section className="card p-6"><h3 className="mb-4 font-semibold">Personal details</h3><div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required><input className="input" value={app.personal?.fullName || ''} onChange={(e) => set('personal.fullName', e.target.value)} /></Field>
        <Field label="Date of birth" required><input type="date" className="input" value={app.personal?.dob?.slice(0, 10) || ''} onChange={(e) => set('personal.dob', e.target.value)} /></Field>
        <Field label="Gender" required><select className="input" value={app.personal?.gender || ''} onChange={(e) => set('personal.gender', e.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></Field>
        <Field label="Phone" required><input className="input" value={app.personal?.phone || ''} onChange={(e) => set('personal.phone', e.target.value)} /></Field>
        <Field label="Home address" required className="sm:col-span-2"><textarea rows={2} className="input" value={app.personal?.address || ''} onChange={(e) => set('personal.address', e.target.value)} /></Field></div></section>
      <section className="card p-6"><h3 className="mb-4 font-semibold">Academic and room preference</h3><div className="grid gap-4 sm:grid-cols-2">
        <Field label="Program" required><input className="input" value={app.program || ''} onChange={(e) => set('program', e.target.value)} /></Field>
        <Field label="Year" required><select className="input" value={app.year || ''} onChange={(e) => set('year', e.target.value)}><option value="">Select</option>{['First year', 'Second year', 'Third year', 'Final year'].map((y) => <option key={y}>{y}</option>)}</select></Field>
        <Field label="Category" required><select className="input" value={app.category || ''} onChange={(e) => set('category', e.target.value)}><option value="">Select</option><option>General</option><option>Reserved</option></select></Field>
        <Field label="Residence status" required hint="Continuing students are considered first."><select className="input" value={app.studentType} onChange={(e) => set('studentType', e.target.value)}><option value="new">New to the hostel</option><option value="continuing">Continuing resident</option></select></Field>
        <Field label="Room type preference" required className="sm:col-span-2"><select className="input" value={app.roomTypePref || ''} onChange={(e) => set('roomTypePref', e.target.value)}><option value="">Select</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <span className="mt-2 flex flex-wrap gap-2">{avail.types.map((t) => <span key={t.type} className="inline-flex items-center gap-1.5 rounded-lg bg-mist px-2.5 py-1 text-xs ring-1 ring-line"><Info size={12} />{t.type}: <b>{t.available}</b> of {t.total} beds free</span>)}</span></Field></div></section>
      <section className="card p-6"><h3 className="mb-4 font-semibold">Emergency contact</h3><div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" required><input className="input" value={app.emergency?.name || ''} onChange={(e) => set('emergency.name', e.target.value)} /></Field>
        <Field label="Relation" required><input className="input" value={app.emergency?.relation || ''} onChange={(e) => set('emergency.relation', e.target.value)} /></Field>
        <Field label="Phone" required><input className="input" value={app.emergency?.phone || ''} onChange={(e) => set('emergency.phone', e.target.value)} /></Field></div></section>
      <section className="card p-6"><h3 className="mb-1 font-semibold">Documents</h3><p className="mb-4 text-sm text-slate-500">PDF or JPEG, up to 2 MB each.</p><div className="grid gap-3 sm:grid-cols-3">
        {DOCS.map(([k, l]) => { const d = app.documents?.find((x) => x.kind === k); return (
          <div key={k} className={`rounded-2xl border border-dashed p-4 ${d ? 'border-emerald-300 bg-emerald-50/50' : 'border-brand-300 bg-brand-50/40'}`}><p className="text-sm font-semibold">{l}</p>
            {d ? <div className="mt-2 flex items-center justify-between gap-2"><a href={d.path} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-emerald-700"><FileCheck2 size={15} /><span className="truncate">{d.name}</span></a>{draft && <button type="button" onClick={() => drop(k)} className="text-slate-400 hover:text-red-600" aria-label="Remove"><Trash2 size={15} /></button>}</div>
              : <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-brand-600"><Upload size={15} />Choose file<input type="file" accept="application/pdf,image/jpeg" className="sr-only" onChange={(e) => upload(k, e.target.files[0])} /></label>}</div>); })}</div></section>
    </fieldset>
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      {!['Rejected', 'Allocated', 'Withdrawn'].includes(app.status) && <button className="btn-outline" onClick={() => setConfirm(true)}><Undo2 size={16} />Withdraw</button>}
      {draft && <><button className="btn-soft" disabled={busy} onClick={() => save()}>Save draft</button><button className="btn-primary" disabled={busy} onClick={submit}><Send size={16} />Submit application</button></>}
    </div>
    {past.length > 0 && <History list={past} />}
    <Confirm open={confirm} danger title="Withdraw application?" text="This cancels your application for the session. You can start a new one while applications are open." yes="Withdraw" onNo={() => setConfirm(false)} onYes={withdraw} /></>);
}
const History = ({ list }) => <div className="mt-8"><h3 className="mb-3 font-semibold">Earlier applications</h3><div className="card divide-y divide-line">{list.map((a) => <div key={a._id} className="flex items-center justify-between px-5 py-3 text-sm"><span>{a.session}{a.number ? ` · #${a.number}` : ''} · {fmtTime(a.updatedAt)}</span><Badge>{a.status}</Badge></div>)}</div></div>;
