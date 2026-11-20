import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Hash, Users, ChevronRight, X, LogOut, Zap, Camera, Trophy, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useRoom } from '../context/RoomContext';
import Avatar from '../components/Avatar';
import api from '../lib/api';

function PhaseChip({ status }) {
  const map = {
    uploads_open: { label: 'UPLOADS OPEN', color: 'bg-emerald-600 text-white', dot: 'bg-emerald-300' },
    voting_open: { label: 'VOTING LIVE', color: 'bg-amber-500 text-white', dot: 'bg-yellow-200' },
    completed: { label: 'COMPLETED', color: 'bg-gray-200 text-gray-700', dot: 'bg-gray-400' },
    waiting: { label: 'WAITING TO START', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
    hunt: { label: 'UPLOADS OPEN', color: 'bg-emerald-600 text-white', dot: 'bg-emerald-300' },
    voting: { label: 'VOTING LIVE', color: 'bg-amber-500 text-white', dot: 'bg-yellow-200' },
  };
  const cfg = map[status] || map.waiting;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
      {cfg.label}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold">{title}</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          {children}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default function DashboardPage() {
  const { user, logout, updateProfile } = useAuth();
  const { createRoom, joinRoom } = useRoom();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [modal, setModal] = useState(null); // 'create' | 'join' | 'profile' | null
  const [roomName, setRoomName] = useState('');
  const [roomMode, setRoomMode] = useState('stickerly');
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Profile modal photo state
  const [newAvatarFile, setNewAvatarFile] = useState(null);
  const [newAvatarPreview, setNewAvatarPreview] = useState(null);
  const profileFileRef = useRef(null);

  useEffect(() => {
    api
      .get('/rooms/my')
      .then((r) => setRooms(r.data))
      .catch(() => {
        setRooms([]);
      })
      .finally(() => setLoadingRooms(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setSubmitting(true);
    try {
      const room = await createRoom(roomName.trim(), roomMode);
      toast.success(`Room "${room.name}" created!`);
      setRooms((prev) => [...prev, room]);
      setModal(null);
      setRoomName('');
      setRoomMode('stickerly');
      navigate(`/room/${room._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (joinCode.length !== 6) {
      toast.error('Code must be 6 characters');
      return;
    }
    setSubmitting(true);
    try {
      const room = await joinRoom(joinCode.toUpperCase());
      toast.success(`Joined room "${room.name}"!`);
      setRooms((prev) => [...prev, room]);
      setModal(null);
      setJoinCode('');
      navigate(`/room/${room._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAvatarFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image must be under 10MB');
        return;
      }
      setNewAvatarFile(file);
      setNewAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProfilePhoto = async (e) => {
    e.preventDefault();
    if (!newAvatarFile) {
      toast.error('Please choose a new photo');
      return;
    }
    setSubmitting(true);
    try {
      await updateProfile({ avatar: newAvatarFile });
      toast.success('Profile photo updated! ✨');
      setModal(null);
      setNewAvatarFile(null);
      setNewAvatarPreview(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update photo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl cursor-pointer" onClick={() => navigate('/dashboard')}>
          <span>🎭</span>
          <span className="font-extrabold tracking-tight">Stickerly</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => setModal('profile')}
            className="flex items-center gap-2.5 p-1 pr-2 rounded-full hover:bg-gray-100 transition group text-left"
            title="Edit profile photo"
          >
            <Avatar
              src={user?.avatar}
              name={user?.username}
              size="md"
              className="ring-2 ring-brand-pink/50 group-hover:ring-brand-pink shadow-sm"
            />
            <div className="text-sm text-gray-600 hidden sm:block">
              <span className="font-semibold text-gray-900 group-hover:text-brand-pink transition">
                @{user?.username}
              </span>
            </div>
          </button>
          <div className="flex items-center gap-1 text-xs sm:text-sm font-bold text-brand-amber bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
            <Zap className="w-4 h-4" /> {user?.totalPoints || 0} pts
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 hover:text-gray-700 transition"
          >
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* User Profile Banner */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 mb-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div
              className="relative group cursor-pointer"
              onClick={() => setModal('profile')}
              title="Click to update profile photo"
            >
              <Avatar
                src={user?.avatar}
                name={user?.username}
                size="xl"
                className="ring-4 ring-brand-pink/20 shadow-md group-hover:ring-brand-pink transition"
              />
              <div className="absolute -bottom-1 -right-1 p-1.5 bg-brand-pink text-white rounded-full shadow hover:scale-110 transition">
                <Camera className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h2 className="text-xl font-black text-gray-900">{user?.username}</h2>
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-mono">
                  @{user?.username?.toLowerCase()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Your profile photo is live across all squads, voter ballots & winner podiums.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-4 py-2.5 bg-amber-50 rounded-2xl border border-amber-100 min-w-[70px]">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Points</span>
              <span className="text-lg font-black text-brand-amber">{user?.totalPoints || 0}</span>
            </div>
            <div className="text-center px-4 py-2.5 bg-pink-50 rounded-2xl border border-pink-100 min-w-[70px]">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Streak</span>
              <span className="text-lg font-black text-brand-pink flex items-center justify-center gap-0.5">
                <Flame className="w-4 h-4 fill-brand-pink" /> {user?.streak || 0}d
              </span>
            </div>
            <div className="text-center px-4 py-2.5 bg-purple-50 rounded-2xl border border-purple-100 min-w-[70px]">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Podiums</span>
              <span className="text-lg font-black text-purple-600 flex items-center justify-center gap-0.5">
                <Trophy className="w-4 h-4 text-purple-600" /> {user?.podiums || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Your Rooms</h1>
            <p className="text-gray-500 text-sm mt-1">Jump into the chaos or start a new one</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setModal('join')}
              className="flex items-center gap-2 px-5 py-2.5 border-2 border-brand-dark text-brand-dark font-semibold rounded-xl hover:bg-brand-dark hover:text-white transition-all text-sm"
            >
              <Hash className="w-4 h-4" /> Join Room
            </button>
            <button
              onClick={() => setModal('create')}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-pink text-white font-semibold rounded-xl hover:bg-pink-600 transition-all text-sm shadow-md shadow-pink-200"
            >
              <Plus className="w-4 h-4" /> Create Room
            </button>
          </div>
        </div>

        {/* Room cards */}
        {loadingRooms ? (
          <div className="grid md:grid-cols-2 gap-5">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-44 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <div className="text-6xl mb-4">🎭</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">No rooms yet</h2>
            <p className="text-gray-400 text-sm mb-6">Create a room and invite your squad to start playing</p>
            <button
              onClick={() => setModal('create')}
              className="px-6 py-3 bg-brand-pink text-white font-semibold rounded-xl hover:bg-pink-600 transition shadow-md shadow-pink-200"
            >
              Create Your First Room
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {rooms.map((room) => (
              <motion.div
                key={room._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-brand-pink/40 hover:shadow-md transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-gray-900">{room.name}</h3>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          room.mode === 'challenges' ? 'bg-purple-100 text-purple-700' : 'bg-pink-100 text-pink-700'
                        }`}>
                          {room.mode === 'challenges' ? '🎯 Challenges' : '🎭 Stickerly'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="bg-gray-100 text-gray-600 font-mono text-xs px-2 py-0.5 rounded-lg font-bold tracking-widest">
                          {room.code}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Users className="w-3 h-3" /> {room.members?.length || 0} members
                        </span>
                      </div>
                    </div>
                    <PhaseChip status={room.currentRoundId?.status || room.currentRoundStatus || 'waiting'} />
                  </div>

                  {/* Member avatars preview */}
                  {room.members && room.members.length > 0 && (
                    <div className="flex items-center gap-1 mb-4">
                      <div className="flex -space-x-2 overflow-hidden">
                        {room.members.slice(0, 5).map((m) => (
                          <Avatar
                            key={m._id}
                            src={m.avatar}
                            name={m.username}
                            size="xs"
                            className="ring-2 ring-white"
                          />
                        ))}
                      </div>
                      {room.members.length > 5 && (
                        <span className="text-[11px] text-gray-400 pl-1 font-semibold">
                          +{room.members.length - 5}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-gray-400 mb-4">
                    Round {room.totalRounds || 0} · Season {room.season || 1}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/room/${room._id}`)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-dark text-white text-sm font-semibold rounded-xl group-hover:bg-gray-800 transition"
                >
                  Enter Room <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Photo Modal */}
      {modal === 'profile' && (
        <Modal title="Update Profile Photo" onClose={() => setModal(null)}>
          <form onSubmit={handleSaveProfilePhoto} className="space-y-5 text-center">
            <div className="flex flex-col items-center justify-center">
              <div
                className="relative group cursor-pointer"
                onClick={() => profileFileRef.current?.click()}
                title="Select photo"
              >
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl ring-2 ring-brand-pink/30 flex items-center justify-center bg-gray-100">
                  {newAvatarPreview ? (
                    <img src={newAvatarPreview} alt="New Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Avatar src={user?.avatar} name={user?.username} size="2xl" />
                  )}
                </div>
                <div className="absolute bottom-1 right-1 p-2 bg-brand-pink text-white rounded-full shadow-lg hover:scale-110 transition">
                  <Camera className="w-4 h-4" />
                </div>
              </div>
              <input
                ref={profileFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileSelected}
              />
              <p className="text-xs text-gray-500 mt-3">
                Click the circle above to upload a new profile picture.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setModal(null);
                  setNewAvatarFile(null);
                  setNewAvatarPreview(null);
                }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !newAvatarFile}
                className="flex-1 py-2.5 bg-brand-pink text-white font-semibold rounded-xl hover:bg-pink-600 transition disabled:opacity-50 text-sm shadow-md shadow-pink-200"
              >
                {submitting ? 'Saving…' : 'Save Photo'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Room Modal */}
      {modal === 'create' && (
        <Modal title="Create a New Room" onClose={() => setModal(null)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Room Name
              </label>
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. The Squad 🔥"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-pink focus:ring-2 focus:ring-pink-100"
              />
            </div>

            {/* Mode Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Room Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRoomMode('stickerly')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left ${
                    roomMode === 'stickerly'
                      ? 'border-brand-pink bg-pink-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">🎭</span>
                  <div>
                    <div className="font-bold text-sm">Stickerly</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Click photos, make fun stickers, vote on the best ones
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRoomMode('challenges')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left ${
                    roomMode === 'challenges'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">🎯</span>
                  <div>
                    <div className="font-bold text-sm">Challenges</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      10 fun challenges with conversation topics and silly poses
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-brand-pink text-white font-semibold rounded-xl hover:bg-pink-600 transition disabled:opacity-60"
            >
              {submitting ? 'Creating…' : `Create ${roomMode === 'challenges' ? '🎯 Challenges' : '🎭 Stickerly'} Room`}
            </button>
          </form>
        </Modal>
      )}

      {/* Join Room Modal */}
      {modal === 'join' && (
        <Modal title="Join a Room" onClose={() => setModal(null)}>
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                6-Character Room Code
              </label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCDEF"
                maxLength={6}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono tracking-widest text-center uppercase focus:outline-none focus:border-brand-pink focus:ring-2 focus:ring-pink-100"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || joinCode.length !== 6}
              className="w-full py-3 bg-brand-dark text-white font-semibold rounded-xl hover:bg-gray-800 transition disabled:opacity-60"
            >
              {submitting ? 'Joining…' : 'Join Room →'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
