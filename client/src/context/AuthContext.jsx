import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(() => !!localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      api
        .get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: t, user: u } = res.data;
    localStorage.setItem('token', t);
    setToken(t);
    setUser(u);
    return u;
  };

  const register = async (username, email, password, avatar = null) => {
    let res;
    if (avatar instanceof File || avatar instanceof Blob) {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('avatar', avatar);
      res = await api.post('/auth/register', formData);
    } else if (typeof avatar === 'string' && avatar.trim()) {
      res = await api.post('/auth/register', { username, email, password, avatar: avatar.trim() });
    } else {
      res = await api.post('/auth/register', { username, email, password });
    }
    const { token: t, user: u } = res.data;
    localStorage.setItem('token', t);
    setToken(t);
    setUser(u);
    return u;
  };

  const updateProfile = async ({ avatar, username }) => {
    let res;
    if (avatar instanceof File || avatar instanceof Blob) {
      const formData = new FormData();
      if (username) formData.append('username', username);
      formData.append('avatar', avatar);
      res = await api.put('/auth/profile', formData);
    } else {
      res = await api.put('/auth/profile', { avatar, username });
    }
    setUser(res.data);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    toast.success('Logged out!');
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, updateProfile, setUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
