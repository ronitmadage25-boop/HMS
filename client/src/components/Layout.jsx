import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, BedDouble, Wallet, Users, MessageSquareWarning, Bell, UserCog, ClipboardCheck, Building2, DoorOpen, ArrowLeftRight, Wrench, BarChart3, Settings as Cog, ShieldCheck, LogOut, Menu, X, IndianRupee, Home, UserCircle } from 'lucide-react';
import { useAuth } from '../auth';
import { api } from '../api';

const NAV = {
  student: [['/', 'Dashboard', LayoutDashboard], ['/application', 'My application', FileText], ['/my-room', 'My room', BedDouble], ['/fees', 'Fees & receipts', Wallet], ['/visitors', 'Visitors', Users], ['/complaints', 'Complaints', MessageSquareWarning]],
  warden: [['/', 'Dashboard', LayoutDashboard], ['/approvals', 'Applications', ClipboardCheck], ['/allocation', 'Room allocation', BedDouble], ['/rooms', 'Room availability', Building2], ['/occupancy', 'Occupancy', DoorOpen], ['/room-changes', 'Room changes', ArrowLeftRight], ['/complaints', 'Complaints', MessageSquareWarning], ['/work-orders', 'Work orders', Wrench], ['/visitors', 'Visitor log', Users], ['/reports', 'Reports', BarChart3]],
  staff: [['/', 'Dashboard', LayoutDashboard], ['/visitors', 'Gate desk', Users], ['/occupancy', 'Check-in / out', DoorOpen], ['/work-orders', 'My work orders', Wrench], ['/complaints', 'Complaints', MessageSquareWarning]],
  admin: [['/', 'Dashboard', LayoutDashboard], ['/users', 'Users & roles', UserCog], ['/rooms', 'Rooms', Building2], ['/fee-admin', 'Fees', IndianRupee], ['/approvals', 'Applications', ClipboardCheck], ['/allocation', 'Room allocation', BedDouble], ['/occupancy', 'Occupancy', DoorOpen], ['/room-changes', 'Room changes', ArrowLeftRight], ['/complaints', 'Complaints', MessageSquareWarning], ['/work-orders', 'Work orders', Wrench], ['/visitors', 'Visitor log', Users], ['/reports', 'Reports', BarChart3], ['/settings', 'Settings', Cog], ['/audit', 'Audit log', ShieldCheck]],
};
const LABEL = { student: 'Student', warden: 'Warden', staff: 'Hostel Staff', admin: 'Administrator' };

export default function Layout({ children }) {
  const { user, logout } = useAuth(); const [open, setOpen] = useState(false); const [unread, setUnread] = useState(0); const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => { const f = () => api.get('/notifications/count').then((r) => setUnread(r.data.unread)).catch(() => {}); f(); const t = setInterval(f, 30000); return () => clearInterval(t); }, [loc.pathname]);
  const items = NAV[user.role]; const here = items.find(([p]) => p === loc.pathname)?.[1] || (loc.pathname === '/notifications' ? 'Notifications' : loc.pathname === '/profile' ? 'Profile' : '');

  const side = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white"><Home size={20} /></div>
        <div><p className="font-display text-[15px] font-semibold leading-tight">Hostel Management</p><p className="text-xs text-slate-500">{LABEL[user.role]} portal</p></div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {items.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}>
            <Icon size={18} />{label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <Link to="/profile" className="flex items-center gap-3 rounded-xl p-2 hover:bg-mist">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{LABEL[user.role].slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{LABEL[user.role]}</p><p className="truncate text-xs text-slate-500">{user.username.toUpperCase()}</p></div>
        </Link>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-white lg:block">{side}</aside>
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} /><aside className="pop absolute inset-y-0 left-0 w-72 bg-white shadow-lift">{side}</aside></div>}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3">
          <button className="rounded-lg p-2 hover:bg-mist lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X size={20} /> : <Menu size={20} />}</button>
          <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
            <Link to="/" className="text-slate-500 hover:text-brand-700">Dashboard</Link>
            {here && here !== 'Dashboard' && <><span className="text-slate-300">/</span><span className="font-semibold">{here}</span></>}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/notifications" className="relative rounded-xl p-2.5 text-slate-600 hover:bg-brand-50" aria-label="Notifications"><Bell size={19} />{unread > 0 && <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}</Link>
          <div className="hidden text-right sm:block"><p className="text-sm font-semibold leading-tight text-slate-900">{LABEL[user.role]}</p></div>
          <button onClick={() => logout()} className="btn-outline !px-3 !py-2" title="Log out"><LogOut size={16} /><span className="hidden sm:inline">Log out</span></button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
