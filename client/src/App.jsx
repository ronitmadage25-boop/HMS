import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import { Login, Register, Forgot, Reset } from './pages/AuthPages';
import Dashboard from './pages/Dashboard';
import Application from './pages/Application';
import MyRoom from './pages/MyRoom';
import Fees from './pages/Fees';
import Visitors from './pages/Visitors';
import Complaints from './pages/Complaints';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Approvals from './pages/Approvals';
import Allocation from './pages/Allocation';
import Rooms from './pages/Rooms';
import Occupancy from './pages/Occupancy';
import RoomChanges from './pages/RoomChanges';
import WorkOrders from './pages/WorkOrders';
import Reports from './pages/Reports';
import Users from './pages/Users';
import FeeAdmin from './pages/FeeAdmin';
import Settings from './pages/Settings';
import Audit from './pages/Audit';

const R = { student: ['application', 'my-room', 'fees', 'visitors', 'complaints'], warden: ['approvals', 'allocation', 'rooms', 'occupancy', 'room-changes', 'complaints', 'work-orders', 'visitors', 'reports'], staff: ['visitors', 'occupancy', 'work-orders', 'complaints'], admin: ['users', 'rooms', 'fee-admin', 'approvals', 'allocation', 'occupancy', 'room-changes', 'complaints', 'work-orders', 'visitors', 'reports', 'settings', 'audit'] };
const pages = { application: Application, 'my-room': MyRoom, fees: Fees, visitors: Visitors, complaints: Complaints, approvals: Approvals, allocation: Allocation, rooms: Rooms, occupancy: Occupancy, 'room-changes': RoomChanges, 'work-orders': WorkOrders, reports: Reports, users: Users, 'fee-admin': FeeAdmin, settings: Settings, audit: Audit };

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return (
    <Routes>
      <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<Forgot />} /><Route path="/reset-password" element={<Reset />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        {R[user.role].map((p) => { const C = pages[p]; return <Route key={p} path={`/${p}`} element={<C />} />; })}
        <Route path="/login" element={<Navigate to="/" replace />} /><Route path="/register" element={<Navigate to="/" replace />} />
        <Route path="*" element={<div className="card p-10 text-center"><p className="font-semibold">Access Denied</p><p className="mt-1 text-sm text-slate-500">This page is not available for your role.</p></div>} />
      </Routes>
    </Layout>
  );
}
