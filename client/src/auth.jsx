import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
const IDLE = 20 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const timer = useRef();

  const logout = useCallback(async (notice) => {
    try { await api.post('/auth/logout'); } catch { /* already signed out */ }
    localStorage.removeItem('hms_token'); setUser(null);
    if (notice) sessionStorage.setItem('hms_notice', notice);
  }, []);
  const login = (token, u) => { localStorage.setItem('hms_token', token); setUser(u); };

  useEffect(() => {
    if (!localStorage.getItem('hms_token')) { setReady(true); return; }
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => localStorage.removeItem('hms_token')).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    const reset = () => { clearTimeout(timer.current); timer.current = setTimeout(() => logout('You were signed out after 20 minutes of inactivity.'), IDLE); };
    const evs = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true })); reset();
    return () => { evs.forEach((e) => window.removeEventListener(e, reset)); clearTimeout(timer.current); };
  }, [user, logout]);

  return <Ctx.Provider value={{ user, setUser, login, logout, ready }}>{children}</Ctx.Provider>;
}
