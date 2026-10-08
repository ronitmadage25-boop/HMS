import { Link } from 'react-router-dom';
import { RefreshCw, Users, BedDouble, IndianRupee, ClipboardCheck, MessageSquareWarning, Wrench, DoorOpen, UserCheck, FileText, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { api, inr, fmtDate, fmtTime } from '../api';
import { useAuth } from '../auth';
import { useLoad, Loading, PageHeader, Stat, Badge, Empty } from '../components/ui';

const COLORS = ['#1D54D4', '#5A8DF7', '#8CB3FF', '#143585', '#B9D1FF'];
const Panel = ({ title, children, action }) => <div className="card p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{title}</h3>{action}</div>{children}</div>;
const Occ = ({ data }) => <ResponsiveContainer width="100%" height={220}><BarChart data={data}><CartesianGrid vertical={false} stroke="#E1E8F5" /><XAxis dataKey="block" tickLine={false} axisLine={false} fontSize={12} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} /><Tooltip cursor={{ fill: '#F6F9FF' }} /><Bar dataKey="occupied" name="Occupied" stackId="a" fill="#1D54D4" radius={[0, 0, 4, 4]} /><Bar dataKey="available" name="Available" stackId="a" fill="#B9D1FF" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>;
const Donut = ({ data }) => data.length ? <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <Empty title="No data yet" />;

export default function Dashboard() {
  const { user } = useAuth();
  const { data: d, loading, reload } = useLoad(() => api.get('/dashboard').then((r) => r.data), [], 5 * 60 * 1000);
  if (loading || !d) return <Loading />;
  const roleLabel = { student: 'Student', warden: 'Warden', staff: 'Hostel Staff', admin: 'Administrator' }[user.role] || 'User';
  const hello = `Welcome, ${roleLabel}`;
  const refresh = <button className="btn-outline" onClick={reload}><RefreshCw size={15} />Refresh</button>;

  if (d.role === 'student') return (<>
    <PageHeader title={hello} subtitle={`Session ${d.session}${d.deadline ? ` · applications close ${fmtDate(d.deadline)}` : ''}`} actions={refresh} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={FileText} label="Application" value={d.application ? d.application.status : 'Not started'} sub={d.application?.number ? `Application #${d.application.number}` : d.application?.waitlistPosition ? `Waitlist position ${d.application.waitlistPosition}` : 'Start from My application'} />
      <Stat icon={BedDouble} label="Room" value={d.room ? `${d.room.block}-${d.room.number}` : 'Not allotted'} sub={d.room ? `Floor ${d.room.floor} · Bed ${d.room.bed}` : 'Allotted after approval'} />
      <Stat icon={Wallet} label="Outstanding fee" value={inr(d.outstanding)} sub={d.nextDue ? `Next due ${fmtDate(d.nextDue)}` : 'Nothing due'} />
      <Stat icon={MessageSquareWarning} label="Open complaints" value={d.openComplaints.length} sub="Awaiting resolution" />
    </div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Panel title="Roommates">{d.roommates.length ? <ul className="divide-y divide-line">{d.roommates.map((m, i) => <li key={i} className="flex items-center gap-3 py-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{m.name[0]}</span><div><p className="text-sm font-semibold">{m.name}</p><p className="text-xs text-slate-500">{m.department}</p></div></li>)}</ul> : <Empty title={d.room ? 'No roommates yet' : 'No room yet'} hint={d.room ? 'Anyone sharing your room will appear here.' : 'Roommates appear once you are allotted a room.'} />}</Panel>
      <Panel title="Open complaints" action={<Link to="/complaints" className="text-sm font-semibold text-brand-600">View all</Link>}>{d.openComplaints.length ? <ul className="divide-y divide-line">{d.openComplaints.map((c) => <li key={c._id} className="flex items-center justify-between py-2.5"><span className="text-sm">#{c.number} · {c.category}</span><Badge>{c.status}</Badge></li>)}</ul> : <Empty title="Nothing open" hint="Raise a complaint from the Complaints page." />}</Panel>
    </div></>);

  if (d.role === 'warden') return (<>
    <PageHeader title={hello} subtitle="Here is what needs your attention today." actions={refresh} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Link to="/approvals"><Stat icon={ClipboardCheck} label="Pending applications" value={d.pending} sub={`${d.approved} approved, awaiting a room`} /></Link>
      <Stat icon={BedDouble} label="Occupancy" value={`${d.occupancy.rate}%`} sub={`${d.occupancy.occupied} of ${d.occupancy.total} beds · ${d.occupancy.available} free`} />
      <Link to="/complaints"><Stat icon={MessageSquareWarning} label="Open complaints" value={d.openComplaints} sub={`${d.overdueComplaints} overdue`} /></Link>
      <Link to="/work-orders"><Stat icon={Wrench} label="Overdue work orders" value={d.overdueWorkOrders} sub={`${d.insideVisitors} visitors inside now`} /></Link>
    </div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2"><Panel title="Occupancy by block">{d.occupancy.byBlock.length ? <Occ data={d.occupancy.byBlock} /> : <Empty title="No rooms yet" hint="The administrator adds blocks and rooms." />}</Panel><Panel title="Complaints by status"><Donut data={d.complaintsByStatus} /></Panel></div></>);

  if (d.role === 'staff') return (<>
    <PageHeader title={hello} subtitle="Your work for today." actions={refresh} />
    <div className="grid gap-4 sm:grid-cols-3"><Stat icon={Wrench} label="Assigned work orders" value={d.orders.length} /><Stat icon={Users} label="Visitors inside" value={d.inside} /><Stat icon={DoorOpen} label="Awaiting check-in" value={d.toCheckIn} /></div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Panel title="My work orders" action={<Link to="/work-orders" className="text-sm font-semibold text-brand-600">Open</Link>}>{d.orders.length ? <ul className="divide-y divide-line">{d.orders.map((w) => <li key={w._id} className="flex items-center justify-between gap-3 py-2.5"><div><p className="text-sm font-semibold">#{w.number} {w.title}</p><p className="text-xs text-slate-500">{w.location}</p></div><div className="flex gap-1.5">{w.overdue && <Badge color="red">Overdue</Badge>}<Badge>{w.priority}</Badge></div></li>)}</ul> : <Empty title="No open work orders" />}</Panel>
      <Panel title="Expected visitors today" action={<Link to="/visitors" className="text-sm font-semibold text-brand-600">Gate desk</Link>}>{d.expectedVisitors.length ? <ul className="divide-y divide-line">{d.expectedVisitors.map((v) => <li key={v._id} className="flex items-center justify-between py-2.5"><div><p className="text-sm font-semibold">{v.name}</p><p className="text-xs text-slate-500">for {v.student?.name}</p></div><span className="rounded-lg bg-mist px-2 py-1 font-mono text-xs">{v.code}</span></li>)}</ul> : <Empty title="No pre-registered visitors today" />}</Panel>
    </div></>);

  return (<>
    <PageHeader title={hello} subtitle="Hostel overview" actions={refresh} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={UserCheck} label="Students" value={d.students} sub={`${d.pendingApplications} applications pending`} />
      <Stat icon={BedDouble} label="Occupancy rate" value={`${d.occupancy.rate}%`} sub={`${d.occupancy.occupied}/${d.occupancy.total} beds`} />
      <Stat icon={IndianRupee} label="Fees collected" value={inr(d.fees.collected)} sub={`${inr(d.fees.pending)} pending · ${inr(d.fees.overdue)} overdue`} />
      <Stat icon={Users} label="Active users" value={d.activeUsers.total} sub={`${d.activeUsers.online} online in the last 20 min`} />
    </div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Panel title="Fee collection, last 6 months"><ResponsiveContainer width="100%" height={220}><BarChart data={d.collections}><CartesianGrid vertical={false} stroke="#E1E8F5" /><XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} /><YAxis tickLine={false} axisLine={false} fontSize={12} width={56} /><Tooltip formatter={(v) => inr(v)} cursor={{ fill: '#F6F9FF' }} /><Bar dataKey="value" name="Collected" fill="#1D54D4" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></Panel>
      <Panel title="Occupancy by block">{d.occupancy.byBlock.length ? <Occ data={d.occupancy.byBlock} /> : <Empty title="No rooms yet" hint="Add blocks and rooms under Rooms." action={<Link to="/rooms" className="btn-primary">Add rooms</Link>} />}</Panel>
      <Panel title="Complaints by category"><Donut data={d.complaintsByCategory} /></Panel>
      <Panel title="Integrity"><p className="text-sm text-slate-600">{d.audit.ok ? `Audit log verified: ${d.audit.total} entries, no tampering detected.` : `Audit log check failed at entry ${d.audit.brokenAt}.`}</p><Link to="/audit" className="mt-3 inline-block text-sm font-semibold text-brand-600">Open audit log</Link></Panel>
    </div></>);
}
