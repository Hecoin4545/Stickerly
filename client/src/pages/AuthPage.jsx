import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Camera, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ mode: initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const fileInputRef = useRef(null);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const isRegister = mode === 'register';

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image must be under 10MB');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      toast.success('Profile photo set! 📸');
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ── MANDATORY PROFILE PHOTO for registration ──────────────────────────
    if (isRegister && !avatarFile) {
      toast.error('A profile photo is required to join Stickerly! 📸');
      fileInputRef.current?.click();
      return;
    }
    // ──────────────────────────────────────────────────────────────────────

    if (isRegister && form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        await register(form.username, form.email, form.password, avatarFile);
        toast.success('Account created! Welcome to Stickerly 🎭');
      } else {
        await login(form.email, form.password);
        toast.success('Welcome back! 🎭');
      }
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Something went wrong';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Back to home */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🎭</div>
            <h1 className="text-2xl font-extrabold text-gray-900">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isRegister ? 'Join the candid chaos' : 'Sign in to continue playing'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Profile Photo — MANDATORY for register only */}
            {isRegister && (
              <div
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                  !avatarFile
                    ? 'bg-red-50 border-red-300 border-dashed'
                    : avatarPreview
                    ? 'bg-green-50 border-green-300'
                    : 'bg-gray-50 border-gray-200 border-dashed'
                }`}
              >
                <div
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  title="Click to select profile photo"
                >
                  <div
                    className={`w-20 h-20 rounded-full overflow-hidden border-2 flex items-center justify-center shadow-sm transition ${
                      avatarPreview
                        ? 'border-green-400 bg-white'
                        : 'border-dashed border-red-300 bg-red-50 group-hover:border-red-500'
                    }`}
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-brand-pink transition">
                        <Camera className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Required
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 p-1.5 text-white rounded-full shadow-md group-hover:scale-110 transition ${avatarPreview ? 'bg-green-500' : 'bg-brand-pink'}`}>
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />

                <div className="mt-2 text-center">
                  <span className={`text-xs font-semibold block ${!avatarFile ? 'text-red-600' : 'text-gray-700'}`}>
                    📸 Profile Photo (Required)
                  </span>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {avatarPreview ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAvatar();
                        }}
                        className="text-red-500 font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Remove photo
                      </button>
                    ) : (
                      <span className="text-red-500 font-medium">Required — your friends need to recognize you!</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Username (register only) */}
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    required
                    placeholder="coolkid99"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password (register only) */}
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    name="confirm"
                    type={showPass ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={handleChange}
                    required
                    placeholder="Repeat password"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isRegister && !avatarFile)}
              className="w-full py-3.5 bg-brand-dark text-white font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2 shadow-md"
            >
              {loading
                ? 'Please wait…'
                : isRegister
                ? avatarFile
                  ? 'Create Account'
                  : '📸 Add a photo first'
                : 'Sign In'}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-center text-sm text-gray-500 mt-6">
            {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
            <button
              onClick={() => {
                setMode(isRegister ? 'login' : 'register');
                setForm({ username: '', email: '', password: '', confirm: '' });
                handleRemoveAvatar();
              }}
              className="font-semibold text-brand-pink hover:underline"
            >
              {isRegister ? 'Log in' : 'Register'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
