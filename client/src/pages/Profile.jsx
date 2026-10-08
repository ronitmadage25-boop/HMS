import { useState } from 'react';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { PageHeader, Field, toast } from '../components/ui';

const CATS = [['application', 'Application decisions'], ['payment', 'Payments and receipts'], ['complaint', 'Complaint updates'], ['maintenance', 'Maintenance updates'], ['room', 'Room allocation'], ['visitor', 'Visitor entries'], ['system', 'Announcements and alerts']];
export default function Profile() {
  const { user, setUser } = useAuth(); const [f, setF] = useState({ name: user.name, phone: user.phone || '', department: user.department || '', year: user.year || '' }); const [prefs, setPrefs] = useState(user.emailPrefs || {}); const [pw, setPw] = useState({ current: '', password: '' });
  const save = async () => { try { const r = await api.put('/auth/me', { ...f, emailPrefs: prefs }); setUser(r.data.user); toast.ok('Profile saved'); } catch (e) { toast.err(msg(e)); } };
  const change = async () => { try { await api.put('/auth/password', pw); toast.ok('Password changed'); setPw({ current: '', password: '' }); } catch (e) { toast.err(msg(e)); } };
  return (<>
    <PageHeader title="Profile" subtitle={`${user.username.toUpperCase()} · ${user.email}`} />
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-4 p-6"><h3 className="font-semibold">Your details</h3>
        <Field label="Full name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        {user.role === 'student' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Department"><input className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></Field><Field label="Year"><input className="input" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></Field></div>}
        <h3 className="pt-2 font-semibold">E-mail me about</h3>
        <div className="space-y-2">{CATS.map(([k, l]) => <label key={k} className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5 text-sm"><span>{l}</span><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={prefs[k] !== false && (k !== 'visitor' || prefs.visitor === true)} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} /></label>)}</div>
        <p className="text-xs text-slate-500">In-app notifications are always delivered.</p>
        <button className="btn-primary" onClick={save}>Save changes</button></div>
      <div className="card h-fit space-y-4 p-6"><h3 className="font-semibold">Change password</h3>
        <Field label="Current password"><input type="password" className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
        <Field label="New password" hint="At least 8 characters with a letter and a number."><input type="password" className="input" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></Field>
        <button className="btn-soft" onClick={change}>Update password</button></div>
    </div></>);
}
