import { createContext, useContext, useEffect, useState } from 'react';
import { get, post } from './api';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking
  useEffect(() => { get('/auth/me').then(setUser).catch(() => setUser(null)); }, []);
  const logout = async () => { await post('/auth/logout').catch(() => {}); setUser(null); };
  return <Ctx.Provider value={{ user, setUser, logout, refresh: () => get('/auth/me').then(setUser) }}>{children}</Ctx.Provider>;
}
export const home = (u) => ({ admin: '/desk', staff: '/staff', customer: '/visits' })[u?.role] || '/login';
