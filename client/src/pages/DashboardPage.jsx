import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Hash, Users, ChevronRight, X, LogOut, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useRoom } from '../context/RoomContext';
import api from '../lib/api';

function PhaseChip({ status }) {
  const map = {
    hunt: { label: 'HUNT PHASE', color: 'bg-brand-green text-white', dot: 'bg-green-300' },
    voting: { label: 'VOTING', color: 'bg-brand-amber text-white', dot: 'bg-yellow-300' },
    completed: { label: 'COMPLETED', color: 'bg-gray-200 text-gray-600', dot: 'bg-gray-400' },
  };
  const cfg = map[status] || map.hunt;
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
  const { user, logout } = useAuth();
  const { createRoom, joinRoom } = useRoom();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [modal, setModal] = useState(null); // 'create' | 'join' | null
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get('/rooms/my')
      .then((r) => setRooms(r.data))
      .catch(() => {
        // Silently fail — user may have no rooms yet
        setRooms([]);
      })
      .finally(() => setLoadingRooms(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setSubmitting(true);
    try {
      const room = await createRoom(roomName.trim());
      toast.success(`Room "${room.name}" created!`);
      setRooms((prev) => [...prev, room]);
      setModal(null);
      setRoomName('');
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

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl">
          <span>🎭</span>
          <span>Stickerly</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            Hey, <span className="font-semibold text-gray-900">@{user?.username}</span>
          </div>
          <div className="flex items-center gap-1 text-sm font-bold text-brand-amber">
            <Zap className="w-4 h-4" /> {user?.totalPoints || 0} pts
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
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
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎭</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">No rooms yet</h2>
            <p className="text-gray-400 text-sm mb-6">Create a room and invite your squad to start playing</p>
            <button
              onClick={() => setModal('create')}
              className="px-6 py-3 bg-brand-pink text-white font-semibold rounded-xl hover:bg-pink-600 transition"
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
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-brand-pink/40 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{room.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-gray-100 text-gray-600 font-mono text-xs px-2 py-0.5 rounded-lg font-bold tracking-widest">
                        {room.code}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Users className="w-3 h-3" /> {room.members?.length || 0} members
                      </span>
                    </div>
                  </div>
                  <PhaseChip status={room.currentRoundStatus || 'hunt'} />
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  Round {room.totalRounds || 0} · Season {room.season || 1}
                </p>
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
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-brand-pink text-white font-semibold rounded-xl hover:bg-pink-600 transition disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create Room 🎭'}
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
