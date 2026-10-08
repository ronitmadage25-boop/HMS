import axios from 'axios';
export const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((c) => { const t = localStorage.getItem('hms_token'); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use((r) => r, (e) => {
  if (e.response?.status === 401 && localStorage.getItem('hms_token') && !e.config.url.includes('/auth/login')) {
    localStorage.removeItem('hms_token'); sessionStorage.setItem('hms_notice', e.response.data?.message || 'Please sign in again'); window.location.href = '/login';
  }
  return Promise.reject(e);
});
export const msg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
export const fmtTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '-');
export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const download = async (url, name) => {
  const r = await api.get(url, { responseType: 'blob' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = name; a.click(); URL.revokeObjectURL(a.href);
};
