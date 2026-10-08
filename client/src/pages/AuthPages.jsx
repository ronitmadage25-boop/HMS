import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, ShieldCheck, Wrench, KeyRound, Eye, EyeOff, Home, BedDouble, Wallet, Users } from 'lucide-react';
import { api, msg } from '../api';
import { useAuth } from '../auth';
import { Field } from '../components/ui';
import hostelImg from '../assets/hostel-building.jpg';

const ROLES = [
  { id: 'student', label: 'Student', icon: GraduationCap, hint: 'Apply for a room, pay fees, raise requests' },
  { id: 'warden', label: 'Warden', icon: ShieldCheck, hint: 'Review applications and allocate rooms' },
  { id: 'staff', label: 'Hostel staff', icon: Wrench, hint: 'Run the gate desk and work orders' },
  { id: 'admin', label: 'Administrator', icon: KeyRound, hint: 'Configure the system and manage users' },
];

const FEATURES = [
  { label: 'Room Management', icon: BedDouble },
  { label: 'Fee Payments', icon: Wallet },
  { label: 'Visitor Tracking', icon: Users },
  { label: 'Complaints & Maintenance', icon: Wrench },
];

function Shell({ title, sub, children, wide }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#081738] via-[#0E2968] to-[#06132D] p-8 xl:p-12 text-white lg:flex">
        {/* Subtle ambient lighting & abstract background curves */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-1/2 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full stroke-white/[0.05]" xmlns="http://www.w3.org/2000/svg" fill="none">
          <path d="M-100 180 C 150 100, 320 320, 650 220" strokeWidth="1.5" />
          <path d="M-60 380 C 200 280, 360 520, 720 400" strokeWidth="1.5" />
          <path d="M-80 580 C 180 480, 340 720, 680 600" strokeWidth="1.5" />
        </svg>

        {/* Top Branding */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-950/40">
            <Home size={20} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-white">
            Hostel Management System
          </span>
        </div>

        {/* Middle Content */}
        <div className="relative z-10 my-auto py-4">
          <h2 className="max-w-md font-display text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
            A Smarter Way to<br />
            <span className="bg-gradient-to-r from-brand-300 via-brand-200 to-sky-300 bg-clip-text text-transparent">
              Hostel Life.
            </span>
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-brand-100/80">
            Manage applications, room allotment, fee payments, visitors and complaints — all in one place.
          </p>

          {/* 4 Feature Cards */}
          <div className="mt-5 grid max-w-md grid-cols-2 gap-2.5">
            {FEATURES.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] p-2.5 backdrop-blur-md transition-colors hover:bg-white/[0.10]"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/15 bg-brand-500/25 text-brand-300">
                  <Icon size={16} />
                </div>
                <span className="text-xs font-medium leading-snug text-slate-100">{label}</span>
              </div>
            ))}
          </div>

          {/* Hostel Architectural Showcase Image */}
          <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/15 bg-slate-950/40 shadow-2xl shadow-slate-950/60">
            <img
              src={hostelImg}
              alt="Modern Student Hostel Building"
              className="h-44 w-full object-cover object-center transition-transform duration-700 hover:scale-[1.02] xl:h-52 2xl:h-60"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06132D]/80 via-transparent to-transparent" />
          </div>
        </div>
      </aside>
      <main className="flex items-center justify-center bg-white px-5 py-10 sm:px-10">
        <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-md'}`}>
          <div className="mb-8 flex items-center gap-2 lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white"><Home size={18} /></div><span className="font-display font-semibold">Hostel Management</span></div>
          <h1 className="text-3xl font-semibold">{title}</h1><p className="mb-7 mt-2 text-sm text-slate-500">{sub}</p>{children}
        </div>
      </main>
    </div>
  );
}
const Err = ({ children }) => children ? <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">{children}</div> : null;
const Pass = ({ value, onChange, placeholder = 'Password', id }) => {
  const [show, setShow] = useState(false);
  return <div className="relative"><input id={id} className="input pr-11" type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} required /><button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink" aria-label="Show password">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>;
};

export function Login() {
  const { login } = useAuth(); const nav = useNavigate();
  const [role, setRole] = useState('student'); const [identifier, setId] = useState(''); const [password, setPw] = useState(''); const [err, setErr] = useState(sessionStorage.getItem('hms_notice') || ''); const [busy, setBusy] = useState(false);
  sessionStorage.removeItem('hms_notice');
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await api.post('/auth/login', { identifier, password, role }); login(r.data.token, r.data.user); nav('/'); } catch (x) { setErr(msg(x)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Welcome back" sub="Choose your role and sign in to continue.">
      <form onSubmit={submit} className="space-y-5">
        <div role="tablist" className="grid grid-cols-4 gap-1 rounded-2xl bg-mist p-1 ring-1 ring-line">
          {ROLES.map((r) => <button key={r.id} type="button" role="tab" aria-selected={role === r.id} onClick={() => setRole(r.id)} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-xs font-semibold transition ${role === r.id ? 'bg-white text-brand-700 shadow-soft ring-1 ring-brand-200' : 'text-slate-500 hover:text-ink'}`}><r.icon size={18} /><span className="truncate">{r.label.split(' ')[0]}</span></button>)}
        </div>
        <p className="-mt-2 text-xs text-slate-500">{ROLES.find((r) => r.id === role).hint}</p>
        <Err>{err}</Err>
        <Field label={role === 'student' ? 'Registration number or e-mail' : role === 'admin' ? 'Username or e-mail' : 'Employee ID or e-mail'}><input className="input" value={identifier} onChange={(e) => setId(e.target.value)} autoComplete="username" required /></Field>
        <Field label="Password"><Pass value={password} onChange={(e) => setPw(e.target.value)} /></Field>
        <div className="flex justify-end -mt-2"><Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Forgot password?</Link></div>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-center text-sm text-slate-500">New here? <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">Create an account</Link></p>
      </form>
    </Shell>
  );
}
export function Register() {
  const { login } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ role: 'student', name: '', username: '', email: '', phone: '', department: '', year: '', password: '', code: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { const r = await api.post('/auth/register', f); login(r.data.token, r.data.user); nav('/'); } catch (x) { setErr(msg(x)); } finally { setBusy(false); } };
  const stu = f.role === 'student';
  return (
    <Shell wide title="Create your account" sub="Pick the role you will use the system in." >
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map((r) => <button key={r.id} type="button" onClick={() => setF({ ...f, role: r.id })} className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${f.role === r.id ? 'border-brand-500 bg-brand-50 ring-4 ring-brand-100' : 'border-line hover:border-brand-300'}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${f.role === r.id ? 'bg-brand-600 text-white' : 'bg-mist text-slate-500'}`}><r.icon size={18} /></span>
            <span><span className="block text-sm font-semibold">{r.label}</span><span className="block text-xs leading-snug text-slate-500">{r.hint}</span></span></button>)}
        </div>
        <Err>{err}</Err>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required className="sm:col-span-2"><input className="input" value={f.name} onChange={set('name')} required /></Field>
          <Field label={stu ? 'Registration number' : 'Employee / login ID'} required><input className="input" value={f.username} onChange={set('username')} required /></Field>
          <Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} inputMode="tel" /></Field>
          <Field label="E-mail" required className="sm:col-span-2"><input className="input" type="email" value={f.email} onChange={set('email')} required /></Field>
          {stu && <><Field label="Department" required><input className="input" value={f.department} onChange={set('department')} placeholder="Computer Engineering" required /></Field>
            <Field label="Year of study" required><select className="input" value={f.year} onChange={set('year')} required><option value="">Select</option>{['First year', 'Second year', 'Third year', 'Final year'].map((y) => <option key={y}>{y}</option>)}</select></Field></>}
          {!stu && <Field label={`${ROLES.find((r) => r.id === f.role).label} invite code`} required hint="Ask the hostel administrator for this code." className="sm:col-span-2"><input className="input" value={f.code} onChange={set('code')} required /></Field>}
          <Field label="Password" required hint="At least 8 characters with a letter and a number." className="sm:col-span-2"><Pass value={f.password} onChange={set('password')} /></Field>
        </div>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="text-center text-sm text-slate-500">Already registered? <Link to="/login" className="font-semibold text-brand-600">Sign in</Link></p>
      </form>
    </Shell>
  );
}
export function Forgot() {
  const [email, setEmail] = useState(''); const [done, setDone] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { const r = await api.post('/auth/forgot', { email }); setDone(r.data.message); } catch (x) { setErr(msg(x)); } finally { setBusy(false); } };
  return (
    <Shell title="Reset your password" sub="Enter your registered e-mail and we will send a reset link.">
      {done ? <div className="space-y-4"><div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">{done}</div><Link to="/login" className="btn-outline w-full">Back to sign in</Link></div> :
        <form onSubmit={submit} className="space-y-5"><Err>{err}</Err><Field label="E-mail"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field><button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button><p className="text-center text-sm"><Link to="/login" className="font-semibold text-brand-600">Back to sign in</Link></p></form>}
    </Shell>
  );
}
export function Reset() {
  const [q] = useSearchParams(); const nav = useNavigate(); const [password, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await api.post('/auth/reset', { email: q.get('email'), token: q.get('token'), password }); sessionStorage.setItem('hms_notice', 'Password updated. Sign in with your new password.'); nav('/login'); } catch (x) { setErr(msg(x)); } finally { setBusy(false); } };
  return <Shell title="Choose a new password" sub="Use at least 8 characters with a letter and a number."><form onSubmit={submit} className="space-y-5"><Err>{err}</Err><Field label="New password"><Pass value={password} onChange={(e) => setPw(e.target.value)} /></Field><button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button></form></Shell>;
}
