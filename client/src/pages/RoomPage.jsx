import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Camera,
  Sparkles,
  Flame,
  Shield,
  Upload,
  CheckCircle,
  Eye,
  Lock,
  ChevronDown,
  RefreshCw,
  Award,
  Crown,
  Play,
  Copy,
  Users,
  Check,
  X,
  Info,
  Download,
  Maximize2,
  StopCircle,
  MessageCircle,
  Image,
  Star,
  Zap,
  Plus,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useRoom } from '../context/RoomContext';
import { useSocket } from '../hooks/useSocket';
import Avatar from '../components/Avatar';
import api from '../lib/api';

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentRoom, fetchRoom, members } = useRoom();

  // Active tab: 'main' | 'voting' | 'leaderboard' | 'challenges'
  const [activeTab, setActiveTab] = useState('main');
  const [leaderboardSubTab, setLeaderboardSubTab] = useState('standings');
  const [round, setRound] = useState(null);
  const [stickers, setStickers] = useState([]);
  const [myStickers, setMyStickers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Upload state - supports multiple stickers
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [stickerTitle, setStickerTitle] = useState('');
  const fileInputRef = useRef(null);

  // Voting ballot state
  const [ballot, setBallot] = useState({ 1: null, 2: null, 3: null });
  const [hasVoted, setHasVoted] = useState(false);
  const [fullscreenSticker, setFullscreenSticker] = useState(null);

  // Challenges mode
  const [challengeUploads, setChallengeUploads] = useState({}); // { challengeIndex: { file, preview, title } }
  const [challengeUploadLoading, setChallengeUploadLoading] = useState({});
  const challengeFileRefs = useRef({});

  // Admin panel
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [adminTopic, setAdminTopic] = useState('');
  const [showRoomMenu, setShowRoomMenu] = useState(false);

  // Close fullscreen sticker on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setFullscreenSticker(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Download sticker helper
  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'sticker.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Download started! 💾');
    } catch {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = filename || 'sticker.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // ── Data Loading ──────────────────────────────────────────────────────────

  const loadData = async () => {
    try {
      setLoading(true);
      await fetchRoom(roomId);
      await loadRound();
      await loadLeaderboard();
      await loadHistory();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRound = async () => {
    try {
      const res = await api.get(`/rounds/${roomId}/current`);
      setRound(res.data);
      if (res.data?._id) {
        loadStickers(res.data._id);
        if (res.data.status === 'voting_open') {
          loadMyBallot(res.data._id);
        }
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setRound(null);
      }
    }
  };

  const loadStickers = async (roundId) => {
    try {
      const res = await api.get(`/stickers/${roundId}`);
      const all = res.data;
      setStickers(all);
      const mine = all.filter(
        (s) => s.creatorId?._id === user?._id || s.creatorId === user?._id
      );
      setMyStickers(mine);
    } catch (err) {
      console.error(err);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await api.get(`/rooms/${roomId}/leaderboard`);
      setLeaderboard(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.get(`/rounds/${roomId}/history`);
      setHistory(res.data.rounds || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMyBallot = async (roundId) => {
    try {
      const res = await api.get(`/votes/${roundId}/my-ballot`);
      if (res.data?.ballot) {
        const bObj = { 1: null, 2: null, 3: null };
        res.data.ballot.forEach((b) => {
          bObj[b.rank] = b.stickerId;
        });
        setBallot(bObj);
        setHasVoted(true);
      }
    } catch {
      setHasVoted(false);
    }
  };

  useEffect(() => {
    if (roomId) loadData();
  }, [roomId]);

  // Real-time updates via Socket
  useSocket({
    roomId,
    onPhaseChange: (data) => {
      const phase = data?.phase;
      if (phase === 'voting_open') {
        toast.success('Admin closed uploads! Voting is now live 🗳️');
        setActiveTab('voting');
      } else if (phase === 'completed') {
        toast('Results are in! Check the Leaderboard 🏆');
        setActiveTab('leaderboard');
      } else if (phase === 'uploads_open') {
        toast.success('Event started! Start uploading 📸');
      }
      loadRound();
    },
    onSubmissionUpdate: () => {
      loadRound();
      if (round?._id) loadStickers(round._id);
    },
    onRoundResults: () => {
      loadRound();
      loadLeaderboard();
      loadHistory();
    },
  });

  // ── Computed ──────────────────────────────────────────────────────────────

  const isAdmin = (currentRoom?.adminId?._id || currentRoom?.adminId)?.toString() === user?._id?.toString();
  const roomMode = currentRoom?.mode || 'stickerly';

  const isSoloRoom = (members?.length || currentRoom?.members?.length || 0) <= 1;
  const votableStickers = stickers.filter((s) => {
    if (isSoloRoom) return true;
    const cid = s.creatorId?._id || s.creatorId;
    return cid !== user?._id;
  });
  const maxPlaces = Math.min(3, Math.max(1, votableStickers.length));

  const isBallotValid =
    maxPlaces === 1 ? Boolean(ballot[1])
    : maxPlaces === 2 ? Boolean(ballot[1] && ballot[2])
    : Boolean(ballot[1] && ballot[2] && ballot[3]);

  const myLeaderboardEntry = leaderboard.find(
    (m) => m._id === user?._id || m.username === user?.username
  );

  // ── Admin Actions ─────────────────────────────────────────────────────────

  const handleStartEvent = async (topic) => {
    try {
      setActionLoading(true);
      const payload = roomMode === 'challenges' ? { topic } : {};
      const res = await api.post(`/rounds/${roomId}/start-event`, payload);
      setRound(res.data);
      toast.success('Event started! 🎉');
      setShowTopicModal(false);
      setAdminTopic('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start event');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseUploads = async () => {
    if (!window.confirm('Close uploads now? Everyone will move to voting.')) return;
    try {
      setActionLoading(true);
      await api.post(`/rounds/${roomId}/close-uploads`);
      toast.success('Uploads closed! Voting is now open 🗳️');
      loadRound();
      setActiveTab('voting');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not close uploads');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseVoting = async () => {
    if (!window.confirm('Close voting and reveal the leaderboard?')) return;
    try {
      setActionLoading(true);
      await api.post(`/rounds/${roomId}/close-voting`);
      toast.success('Voting closed! Check the leaderboard 🏆');
      loadRound();
      loadLeaderboard();
      setActiveTab('leaderboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not close voting');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Stickerly Upload ──────────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error('File size must be under 25MB');
        return;
      }
      setUploadFile(file);
      setUploadPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) {
      toast.error('Please select an image first');
      return;
    }
    const formData = new FormData();
    formData.append('image', uploadFile);
    formData.append('roomId', roomId);
    formData.append('title', stickerTitle || 'Fun Sticker');

    try {
      setActionLoading(true);
      const res = await api.post('/stickers/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Sticker uploaded! 🎯');
      setUploadFile(null);
      setUploadPreview(null);
      setStickerTitle('');
      if (round?._id) loadStickers(round._id);
      loadRound();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Challenges Upload ─────────────────────────────────────────────────────

  const handleChallengeFileChange = (challengeIndex, e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error('File size must be under 25MB');
        return;
      }
      setChallengeUploads((prev) => ({
        ...prev,
        [challengeIndex]: { file, preview: URL.createObjectURL(file), title: '' },
      }));
    }
  };

  const handleChallengeUpload = async (challengeIndex) => {
    const upload = challengeUploads[challengeIndex];
    if (!upload?.file) {
      toast.error('Please select an image first');
      return;
    }
    const formData = new FormData();
    formData.append('image', upload.file);
    formData.append('roomId', roomId);
    formData.append('challengeIndex', challengeIndex);
    formData.append('title', upload.title || `Challenge #${challengeIndex} Pose`);

    try {
      setChallengeUploadLoading((prev) => ({ ...prev, [challengeIndex]: true }));
      await api.post('/stickers/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Challenge #${challengeIndex} completed! 🎉`);
      setChallengeUploads((prev) => {
        const next = { ...prev };
        delete next[challengeIndex];
        return next;
      });
      if (round?._id) loadStickers(round._id);
      loadRound();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setChallengeUploadLoading((prev) => ({ ...prev, [challengeIndex]: false }));
    }
  };

  // ── Voting ────────────────────────────────────────────────────────────────

  const assignBallot = (rank, stickerId) => {
    const next = { ...ballot };
    Object.keys(next).forEach((r) => {
      if (next[r] === stickerId) next[r] = null;
    });
    next[rank] = stickerId;
    setBallot(next);
  };

  const removeBallotRank = (rank) => {
    setBallot((prev) => ({ ...prev, [rank]: null }));
  };

  const handleVoteSubmit = async () => {
    if (!isBallotValid) {
      toast.error('Please complete your ballot first!');
      return;
    }
    const formatted = [];
    if (ballot[1]) formatted.push({ stickerId: ballot[1], rank: 1 });
    if (ballot[2] && maxPlaces >= 2) formatted.push({ stickerId: ballot[2], rank: 2 });
    if (ballot[3] && maxPlaces >= 3) formatted.push({ stickerId: ballot[3], rank: 3 });

    try {
      setActionLoading(true);
      await api.post('/votes/submit', {
        roundId: round._id,
        roomId,
        ballot: formatted,
      });
      toast.success('Vote submitted! 🗳️');
      setHasVoted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit ballot');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading room...</p>
        </div>
      </div>
    );
  }

  const hasActiveEvent = round && round.status !== 'completed';
  const noEvent = !round || round.status === 'completed';

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1A1A1A] flex flex-col font-sans pb-20">
      {/* ─── TOP NAVBAR ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 cursor-pointer font-extrabold tracking-tight text-xl"
          >
            <span className="p-1.5 bg-black text-white rounded-lg text-sm">STICKR</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowRoomMenu(!showRoomMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-semibold tracking-wide transition"
            >
              <span>{currentRoom?.name || 'Loading...'}</span>
              <span className="text-gray-500 font-mono">#{currentRoom?.code}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {showRoomMenu && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Room Members</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentRoom?.code || '');
                      toast.success('Room code copied!');
                    }}
                    className="flex items-center gap-1 text-[11px] text-brand-pink font-semibold hover:underline"
                  >
                    <Copy className="w-3 h-3" /> #{currentRoom?.code}
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {members.map((m) => (
                    <div key={m._id} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2">
                        <Avatar src={m.avatar} name={m.username} size="xs" />
                        <span className="font-medium">{m.username}</span>
                        {m._id === currentRoom?.adminId && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">Admin</span>
                        )}
                      </div>
                      <span className="text-gray-400 font-mono">{m.totalPoints || 0} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mode badge */}
          <span className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
            roomMode === 'challenges'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-pink-100 text-pink-700'
          }`}>
            {roomMode === 'challenges' ? '🎯 Challenges' : '🎭 Stickerly'}
          </span>
        </div>

        {/* Phase status */}
        <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full text-xs font-semibold">
          <span className={`w-2 h-2 rounded-full ${
            round?.status === 'uploads_open' ? 'bg-emerald-500 animate-pulse'
            : round?.status === 'voting_open' ? 'bg-amber-500 animate-pulse'
            : 'bg-gray-400'
          }`} />
          <span className="uppercase tracking-wide">
            {round?.status === 'uploads_open' && 'Uploads Open'}
            {round?.status === 'voting_open' && 'Voting Live'}
            {round?.status === 'completed' && 'Round Completed'}
            {!round && 'Waiting for event'}
          </span>
        </div>

        {/* Right: points pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-semibold">
            <Trophy className="w-3.5 h-3.5 text-brand-amber" />
            <span>{myLeaderboardEntry?.totalPoints || 0} pts</span>
          </div>
          <div onClick={() => navigate('/dashboard')} className="cursor-pointer hover:opacity-90 transition" title="Dashboard">
            <Avatar src={user?.avatar} name={user?.username} size="sm" className="ring-2 ring-brand-pink/50" />
          </div>
        </div>
      </header>

      {/* ─── NAVIGATION TABS ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('main')}
            className={`px-4 py-2 text-xs md:text-sm font-bold tracking-tight rounded-lg transition-all ${
              activeTab === 'main' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-black hover:bg-gray-100'
            }`}
          >
            {roomMode === 'challenges' ? '🎯 Challenges' : '🎭 Stickerly'}
          </button>

          <button
            onClick={() => setActiveTab('voting')}
            className={`px-4 py-2 text-xs md:text-sm font-bold tracking-tight rounded-lg border border-dashed transition-all relative ${
              activeTab === 'voting' ? 'bg-black text-white border-black shadow-sm'
              : round?.status === 'voting_open' ? 'text-amber-600 border-amber-300 bg-amber-50/50 hover:bg-amber-100/50'
              : 'text-gray-500 border-gray-300 hover:text-black hover:border-gray-400'
            }`}
          >
            🗳️ Voting Arena
            {round?.status === 'voting_open' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 text-xs md:text-sm font-bold tracking-tight rounded-lg transition-all ${
              activeTab === 'leaderboard' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-black hover:bg-gray-100'
            }`}
          >
            🏆 Leaderboard
          </button>

          {/* Admin controls in nav */}
          <div className="ml-auto flex items-center gap-2 pl-4">
            <button
              onClick={loadData}
              className="p-1.5 text-gray-400 hover:text-black rounded-lg hover:bg-gray-100 transition"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto w-full px-4 md:px-8 pt-6 flex-1">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* TAB: MAIN (Stickerly or Challenges) */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'main' && (
          <div className="space-y-6">

            {/* ── Admin Control Bar ── */}
            {isAdmin && (
              <div className="bg-gray-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">Admin Controls</span>
                  <div className="text-sm font-bold mt-0.5">
                    {noEvent ? 'Start a new event for your group'
                    : round?.status === 'uploads_open' ? 'Uploads are open — close when everyone\'s done'
                    : round?.status === 'voting_open' ? 'Voting is live — close to reveal leaderboard'
                    : 'Event completed — start a new one!'}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {noEvent && (
                    <button
                      onClick={() => roomMode === 'challenges' ? setShowTopicModal(true) : handleStartEvent()}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start Event
                    </button>
                  )}
                  {round?.status === 'uploads_open' && (
                    <button
                      onClick={handleCloseUploads}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      Close Uploads → Open Voting
                    </button>
                  )}
                  {round?.status === 'voting_open' && (
                    <button
                      onClick={handleCloseVoting}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      Close Voting → Reveal Results
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── No Active Event ── */}
            {noEvent && (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-xl mx-auto shadow-sm">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  {roomMode === 'challenges' ? '🎯' : '🎭'}
                </div>
                <h3 className="text-xl font-bold mb-2">No Active Event</h3>
                <p className="text-gray-500 text-sm mb-6">
                  {isAdmin
                    ? `Click "Start Event" in the admin controls above to kick things off!`
                    : 'Waiting for the admin to start the event. Hang tight!'}
                </p>
                {round?.status === 'completed' && (
                  <button
                    onClick={() => setActiveTab('leaderboard')}
                    className="px-6 py-2.5 bg-black text-white rounded-full font-bold text-sm hover:bg-gray-800 transition"
                  >
                    View Last Event Results →
                  </button>
                )}
              </div>
            )}

            {/* ── Stickerly Mode: Upload Section ── */}
            {round?.status === 'uploads_open' && roomMode === 'stickerly' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Upload area */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Event info banner */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2.5 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase tracking-wider">
                        UPLOADS OPEN
                      </span>
                      <span className="text-xs text-gray-500">Event #{round.roundNumber}</span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight">📸 Snap & Upload Your Sticker!</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Click fun photos, make them into stickers, and upload as many as you want. Admin will close uploads when everyone's ready.
                    </p>
                    {round.theme && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Theme</span>
                        <div className="font-bold text-sm mt-0.5">"{round.theme}"</div>
                      </div>
                    )}
                  </div>

                  {/* Upload form */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <h3 className="font-extrabold text-base mb-4">Upload a Sticker</h3>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 hover:border-black rounded-xl p-8 text-center cursor-pointer transition bg-gray-50/50 hover:bg-gray-100/50 mb-4"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      {uploadPreview ? (
                        <div className="space-y-2">
                          <img src={uploadPreview} alt="Preview" className="w-32 h-32 object-contain mx-auto rounded-lg shadow-sm bg-white p-1 border" />
                          <span className="text-xs font-semibold text-brand-pink block">Click to change</span>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-xs font-bold text-gray-700">Click to select a photo</p>
                          <p className="text-[11px] text-gray-400 mt-1">PNG, JPG up to 25MB</p>
                        </div>
                      )}
                    </div>

                    {uploadFile && (
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Give this sticker a funny title..."
                          value={stickerTitle}
                          onChange={(e) => setStickerTitle(e.target.value)}
                          className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:border-black"
                        />
                        <button
                          onClick={handleUploadSubmit}
                          disabled={actionLoading}
                          className="w-full py-3 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50"
                        >
                          {actionLoading ? 'Uploading...' : '🎯 Upload Sticker'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: My stickers + squad tracker */}
                <div className="lg:col-span-5 space-y-6">
                  {/* My uploads */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-extrabold text-sm">Your Stickers</h4>
                      <span className="text-xs text-gray-500 font-mono">{myStickers.length} uploaded</span>
                    </div>
                    {myStickers.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-xs">
                        <Camera className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        No stickers yet — upload your first one!
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {myStickers.map((s) => (
                          <div key={s._id} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                            <img src={s.imageUrl} alt={s.title} className="w-full aspect-square object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                              <span className="text-white text-[10px] font-bold text-center px-1">{s.title || 'Sticker'}</span>
                            </div>
                            <div className="absolute top-1 right-1 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">✓</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Squad tracker */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-extrabold text-sm">Squad Uploads</h4>
                      <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded-full font-bold">
                        {round.submissionCount || 0} stickers total
                      </span>
                    </div>
                    <div className="space-y-2">
                      {members.map((m) => (
                        <div key={m._id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-none text-xs">
                          <div className="flex items-center gap-2">
                            <Avatar src={m.avatar} name={m.username} size="xs" />
                            <span className="font-semibold">{m.username} {m._id === user?._id && '(You)'}</span>
                          </div>
                          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Challenges Mode: Challenge Cards ── */}
            {round?.status === 'uploads_open' && roomMode === 'challenges' && (
              <div className="space-y-6">
                {/* Event info */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded uppercase tracking-wider">
                      CHALLENGES OPEN
                    </span>
                  </div>
                  <h2 className="text-xl font-black">🎯 Complete the Challenges!</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Topic: <strong className="text-gray-800">"{round.adminTopic}"</strong>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Find people to talk to and do the poses. Upload a photo for each challenge you complete!
                  </p>
                </div>

                {/* Challenge cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {(round.challenges || []).map((challenge) => {
                    const completedSticker = myStickers.find(
                      (s) => s.challengeIndex === challenge.index
                    );
                    const isCompleted = !!completedSticker;
                    const upload = challengeUploads[challenge.index];
                    const isLoading = challengeUploadLoading[challenge.index];

                    return (
                      <motion.div
                        key={challenge.index}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: challenge.index * 0.05 }}
                        className={`bg-white rounded-2xl border-2 p-5 shadow-sm relative ${
                          isCompleted ? 'border-emerald-400 bg-emerald-50/10' : 'border-gray-200'
                        }`}
                      >
                        {isCompleted && (
                          <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}

                        {/* Challenge number */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                            isCompleted ? 'bg-emerald-500 text-white' : 'bg-gray-900 text-white'
                          }`}>
                            {challenge.index}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                            Challenge #{challenge.index}
                          </span>
                        </div>

                        {/* Conversation topic */}
                        <div className="mb-3">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-600 mb-1">
                            <MessageCircle className="w-3.5 h-3.5" /> Talk About It
                          </div>
                          <p className="text-sm font-semibold text-gray-800 leading-snug">
                            {challenge.conversationTopic}
                          </p>
                        </div>

                        {/* Pose */}
                        <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-500 mb-1">
                            <Camera className="w-3.5 h-3.5" /> Strike the Pose
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-2xl flex-shrink-0">{challenge.poseEmoji}</span>
                            <p className="text-xs text-gray-700 font-medium leading-snug">{challenge.poseDescription}</p>
                          </div>
                        </div>

                        {/* Upload / Completed section */}
                        {upload?.preview ? (
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl border border-gray-200">
                            <img src={upload.preview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-gray-300" />
                            <div className="flex-1 space-y-1.5">
                              <input
                                type="text"
                                placeholder="Add a funny caption..."
                                value={upload.title || ''}
                                onChange={(e) => setChallengeUploads((prev) => ({
                                  ...prev,
                                  [challenge.index]: { ...prev[challenge.index], title: e.target.value },
                                }))}
                                className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-black"
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleChallengeUpload(challenge.index)}
                                  disabled={isLoading}
                                  className="flex-1 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                                >
                                  {isLoading ? 'Uploading...' : '✓ Submit Pose Photo!'}
                                </button>
                                <button
                                  onClick={() => setChallengeUploads((prev) => { const n = {...prev}; delete n[challenge.index]; return n; })}
                                  className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-gray-100 transition"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : isCompleted ? (
                          <div className="flex items-center justify-between gap-3 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {completedSticker && (
                                <img
                                  src={completedSticker.imageUrl}
                                  alt="Pose"
                                  onClick={() => setFullscreenSticker(completedSticker)}
                                  className="w-12 h-12 rounded-lg object-cover border border-emerald-300 cursor-pointer hover:opacity-80 transition flex-shrink-0"
                                  title="Click to view full photo"
                                />
                              )}
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Challenge Completed!
                                </span>
                                <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                  "{completedSticker?.title || 'Completed Pose'}"
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                if (!challengeFileRefs.current[challenge.index]) {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = (e) => handleChallengeFileChange(challenge.index, e);
                                  challengeFileRefs.current[challenge.index] = input;
                                }
                                challengeFileRefs.current[challenge.index].click();
                              }}
                              className="text-[11px] font-semibold text-gray-500 hover:text-black underline px-2 py-1 flex-shrink-0"
                            >
                              Retake
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (!challengeFileRefs.current[challenge.index]) {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => handleChallengeFileChange(challenge.index, e);
                                challengeFileRefs.current[challenge.index] = input;
                              }
                              challengeFileRefs.current[challenge.index].click();
                            }}
                            className="w-full py-2.5 border-2 border-dashed border-gray-300 hover:border-black rounded-xl text-xs font-semibold text-gray-500 hover:text-black transition flex items-center justify-center gap-2 bg-gray-50/50 hover:bg-gray-100/50"
                          >
                            <Camera className="w-4 h-4" /> Upload Pose Photo
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Voting Open Banner ── */}
            {round?.status === 'voting_open' && activeTab === 'main' && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6 text-center shadow-sm">
                <div className="text-3xl mb-2">🗳️</div>
                <h3 className="text-lg font-bold text-amber-900">Voting is Live!</h3>
                <p className="text-sm text-amber-800 mt-1 mb-4">Admin closed uploads. Time to vote for the best stickers!</p>
                <button
                  onClick={() => setActiveTab('voting')}
                  className="px-6 py-2.5 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition"
                >
                  Go to Voting Arena →
                </button>
              </div>
            )}

            {/* ── Completed Banner ── */}
            {round?.status === 'completed' && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 text-center shadow-sm">
                <div className="text-3xl mb-2">🏆</div>
                <h3 className="text-lg font-bold text-emerald-900">Event Complete!</h3>
                <p className="text-sm text-emerald-800 mt-1 mb-4">Check out the results and leaderboard.</p>
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className="px-6 py-2.5 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition"
                >
                  View Leaderboard →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* TAB: VOTING ARENA */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'voting' && (
          <div className="space-y-6">
            {round?.status !== 'voting_open' && round?.status !== 'completed' ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-lg mx-auto shadow-sm">
                <Lock className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold mb-1">Voting Not Open Yet</h3>
                <p className="text-gray-500 text-sm">
                  Admin will open voting when everyone has uploaded their stickers.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Voting header */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">
                      {round.status === 'completed' ? 'VOTING RESULTS' : 'VOTE NOW'}
                    </span>
                    <h2 className="text-2xl font-black tracking-tight">
                      {round.status === 'completed' ? '🏆 Final Results' : '🗳️ Voting Arena'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      {round.status === 'completed'
                        ? 'Results are in! See who won.'
                        : 'Rank your favorite stickers. 🥇 1st = 5 pts • 🥈 2nd = 3 pts • 🥉 3rd = 1 pt'}
                    </p>
                  </div>
                  {isAdmin && round.status === 'voting_open' && (
                    <button
                      onClick={handleCloseVoting}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      <StopCircle className="w-3.5 h-3.5" /> Close Voting & Reveal Results
                    </button>
                  )}
                </div>

                {/* 2-col voting layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Ballot */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black tracking-tight">Your Ballot</h3>
                      <span className="text-xs font-bold text-gray-500">
                        {Object.values(ballot).filter(Boolean).length} of {maxPlaces} Placed
                      </span>
                    </div>

                    {[
                      { rank: 1, title: '1st Place', points: '+5 Points', medal: '🥇' },
                      { rank: 2, title: '2nd Place', points: '+3 Points', medal: '🥈' },
                      { rank: 3, title: '3rd Place', points: '+1 Point', medal: '🥉' },
                    ]
                      .filter((slot) => slot.rank <= maxPlaces)
                      .map((slot) => {
                        const assignedId = ballot[slot.rank];
                        const assignedSticker = stickers.find((s) => s._id === assignedId);
                        return (
                          <div key={slot.rank} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold flex items-center gap-1.5">
                                <span>{slot.medal}</span> <span>{slot.title}</span>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">{slot.points}</span>
                              </span>
                              {assignedSticker && (
                                <button onClick={() => removeBallotRank(slot.rank)} className="text-gray-400 hover:text-rose-500 p-1">
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            {assignedSticker ? (
                              <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                <div
                                  onClick={() => setFullscreenSticker(assignedSticker)}
                                  className="relative cursor-pointer group flex-shrink-0"
                                >
                                  <img src={assignedSticker.imageUrl} alt="Pick" className="w-16 h-16 object-contain rounded-lg bg-white border p-1 group-hover:opacity-85 transition" />
                                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition">
                                    <Maximize2 className="w-4 h-4 text-white drop-shadow" />
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm font-bold text-gray-900 truncate">"{assignedSticker.title || 'Untitled'}"</h4>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {round.status === 'completed' ? (
                                      <span>by @{assignedSticker.creatorId?.username || 'Hunter'}</span>
                                    ) : (
                                      <span>by @anonymous</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="border border-dashed border-gray-300 rounded-xl p-5 text-center text-xs text-gray-400 bg-gray-50/50">
                                Pick your {slot.title} from the stickers →
                              </div>
                            )}
                          </div>
                        );
                      })}

                    {/* Submit */}
                    {round.status === 'voting_open' && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between shadow-sm">
                        <button
                          onClick={() => setBallot({ 1: null, 2: null, 3: null })}
                          className="px-3 py-1.5 bg-gray-100 text-xs font-semibold rounded-lg hover:bg-gray-200"
                        >
                          Reset
                        </button>
                        <button
                          onClick={handleVoteSubmit}
                          disabled={!isBallotValid || actionLoading || hasVoted}
                          className={`px-6 py-2 rounded-xl text-xs font-bold transition ${
                            hasVoted ? 'bg-emerald-600 text-white'
                            : isBallotValid ? 'bg-black text-white hover:bg-gray-800'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {hasVoted ? '✓ Ballot Submitted' : 'Submit Ballot'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right: Sticker tray */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black tracking-tight">All Stickers</h3>
                      <span className="text-xs text-gray-500 font-medium">{stickers.length} Total</span>
                    </div>
                    <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                      {stickers.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 text-gray-400 text-xs">
                          No stickers submitted for this event yet.
                        </div>
                      ) : (
                        stickers.map((sticker) => {
                          const isOwnSticker = myStickers.some((s) => s._id === sticker._id);
                          const assignedRank = Object.keys(ballot).find((r) => ballot[r] === sticker._id);
                          const nextRank = [1, 2, 3].slice(0, maxPlaces).find((r) => !ballot[r]);

                          return (
                            <div
                              key={sticker._id}
                              className={`bg-white rounded-2xl border p-4 shadow-sm flex items-center justify-between gap-4 ${
                                isOwnSticker && !isSoloRoom ? 'border-dashed border-gray-300 opacity-60' : 'border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div onClick={() => setFullscreenSticker(sticker)} className="relative cursor-pointer group flex-shrink-0">
                                  <img src={sticker.imageUrl} alt="Sticker" className="w-16 h-16 object-contain rounded-lg bg-gray-50 border p-1 group-hover:opacity-85 transition" />
                                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition">
                                    <Maximize2 className="w-4 h-4 text-white drop-shadow" />
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-gray-900 truncate">"{sticker.title || 'Untitled'}"</h4>
                                  <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                                    {round.status === 'completed' ? (
                                      <>
                                        <Avatar src={sticker.creatorId?.avatar} name={sticker.creatorId?.username} size="xs" />
                                        <span>@{sticker.creatorId?.username || 'Hunter'}</span>
                                      </>
                                    ) : (
                                      <span>@anonymous</span>
                                    )}
                                  </div>
                                  {round.status === 'completed' && (
                                    <span className="text-[10px] font-bold text-brand-pink">
                                      {sticker.totalPoints} pts ({sticker.firstPlaceVotes}🥇 {sticker.secondPlaceVotes}🥈 {sticker.thirdPlaceVotes}🥉)
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                {isOwnSticker && !isSoloRoom ? (
                                  <span className="text-[11px] font-bold text-gray-400 italic">Your Sticker</span>
                                ) : round.status === 'voting_open' ? (
                                  assignedRank ? (
                                    <button
                                      onClick={() => removeBallotRank(assignedRank)}
                                      className="px-3 py-1 bg-emerald-100 hover:bg-rose-100 text-emerald-800 hover:text-rose-700 text-xs font-bold rounded-lg flex items-center gap-1 transition group"
                                    >
                                      <Check className="w-3 h-3 group-hover:hidden" />
                                      <X className="w-3 h-3 hidden group-hover:inline" />
                                      <span>#{assignedRank}</span>
                                    </button>
                                  ) : nextRank ? (
                                    <button
                                      onClick={() => assignBallot(nextRank, sticker._id)}
                                      className="px-3 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition"
                                    >
                                      Assign #{nextRank}
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-400">Ballot Full</span>
                                  )
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* TAB: LEADERBOARD */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <div className="flex gap-2">
                {[
                  { id: 'standings', label: 'Standings' },
                  { id: 'hall-of-fame', label: 'Hall of Fame' },
                  { id: 'roster', label: 'Members' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setLeaderboardSubTab(st.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      leaderboardSubTab === st.id ? 'bg-black text-white' : 'text-gray-500 hover:text-black hover:bg-gray-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Standings */}
            {leaderboardSubTab === 'standings' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">CURRENT LEADER</span>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar src={leaderboard[0]?.avatar} name={leaderboard[0]?.username} size="md" className="ring-2 ring-amber-400 shadow" />
                        <span className="absolute -top-1 -right-1 text-xs">👑</span>
                      </div>
                      <div>
                        <div className="font-extrabold text-base">{leaderboard[0]?.username || 'No leader yet'}</div>
                        <div className="text-xs text-gray-500">{leaderboard[0]?.totalPoints || 0} pts</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">TOTAL EVENTS</span>
                    <div className="text-3xl font-black">{history.length + (round?.status !== 'completed' ? 0 : 1)}</div>
                    <span className="text-xs text-gray-500">Events played in this room</span>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">ROOM MODE</span>
                    <div className="text-2xl font-black">{roomMode === 'challenges' ? '🎯' : '🎭'}</div>
                    <span className="text-xs text-gray-500 capitalize">{roomMode} Room</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-base font-extrabold mb-4">Leaderboard</h3>
                  <div className="space-y-2">
                    {leaderboard.map((member, idx) => {
                      const isMe = member._id === user?._id || member.username === user?.username;
                      const medals = ['🥇', '🥈', '🥉'];
                      return (
                        <div
                          key={member._id}
                          className={`flex items-center justify-between p-3.5 rounded-xl transition ${
                            isMe ? 'bg-amber-50/50 border-l-4 border-l-black border border-amber-200 shadow-sm' : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="w-6 text-center font-bold text-sm">
                              {idx < 3 ? medals[idx] : String(idx + 1).padStart(2, '0')}
                            </span>
                            <Avatar src={member.avatar} name={member.username} size="md" />
                            <div>
                              <div className="flex items-center gap-2 font-extrabold text-sm">
                                {member.username}
                                {isMe && <span className="px-1.5 py-0.5 bg-black text-white text-[9px] font-black rounded uppercase">YOU</span>}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                <span>{member.podiums || 0} Podiums</span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-amber-600 font-semibold">
                                  <Flame className="w-3.5 h-3.5" /> {member.streak || 0}d streak
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-black">{member.totalPoints || 0} <span className="text-xs font-normal text-gray-400">pts</span></div>
                            <span className="text-[11px] text-gray-400 font-mono">Rank #{member.rank || idx + 1}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Hall of Fame */}
            {leaderboardSubTab === 'hall-of-fame' && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-base font-extrabold mb-1">Past Event Winners</h3>
                <p className="text-xs text-gray-500 mb-6">Winning stickers from all past events.</p>
                {history.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-xs">No completed events yet. Finish your first event!</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {history.map((h) => (
                      <div key={h._id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <span className="text-[10px] font-mono text-gray-400">EVENT #{h.roundNumber}</span>
                        <h4 className="text-sm font-bold mt-1">"{h.theme}"</h4>
                        <span className="text-xs text-gray-400 mt-1 block">{new Date(h.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Members */}
            {leaderboardSubTab === 'roster' && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-base font-extrabold mb-1">Room Members</h3>
                <p className="text-xs text-gray-500 mb-4">Everyone in this room.</p>
                <div className="space-y-3">
                  {members.map((m) => (
                    <div key={m._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-xs">
                      <div className="flex items-center gap-3">
                        <Avatar src={m.avatar} name={m.username} size="sm" />
                        <div>
                          <span className="font-bold text-gray-800">{m.username}</span>
                          {(m._id === currentRoom?.adminId || m._id?.toString() === currentRoom?.adminId?.toString()) && (
                            <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">Admin</span>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-gray-800">{m.totalPoints || 0} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ─── TOPIC MODAL (Challenges mode) ────────────────────────────────────── */}
      <AnimatePresence>
        {showTopicModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTopicModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold">Start Challenges Event</h3>
                  <p className="text-xs text-gray-500 mt-0.5">What topic should the 10 challenges be about?</p>
                </div>
                <button onClick={() => setShowTopicModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Topic / Theme
                  </label>
                  <input
                    value={adminTopic}
                    onChange={(e) => setAdminTopic(e.target.value)}
                    placeholder="e.g. Travel stories, Childhood memories, Embarrassing moments..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black focus:ring-2 focus:ring-gray-100"
                    autoFocus
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    10 unique challenges will be generated based on this topic. Each challenge has a conversation starter and a fun pose.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowTopicModal(false)}
                    className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleStartEvent(adminTopic)}
                    disabled={!adminTopic.trim() || actionLoading}
                    className="flex-1 py-2.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition disabled:opacity-50 text-sm"
                  >
                    {actionLoading ? 'Starting...' : '🎯 Generate & Start!'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FULLSCREEN STICKER MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {fullscreenSticker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 md:p-8"
            onClick={() => setFullscreenSticker(null)}
          >
            <div
              className="flex items-center justify-between w-full max-w-5xl mx-auto z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-white min-w-0 pr-4">
                <h3 className="text-lg md:text-xl font-black tracking-tight truncate">
                  "{fullscreenSticker.title || 'Untitled Sticker'}"
                </h3>
                <div className="text-xs text-gray-400 mt-1">
                  {round?.status === 'completed' ? (
                    <span>by @{fullscreenSticker.creatorId?.username || 'Hunter'}</span>
                  ) : (
                    <span>by @anonymous</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => handleDownload(fullscreenSticker.imageUrl, `sticker-${fullscreenSticker._id?.slice(-4)}.png`)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition"
                >
                  <Download className="w-4 h-4" /> Download
                </button>
                <button
                  onClick={() => setFullscreenSticker(null)}
                  className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center py-4" onClick={(e) => e.stopPropagation()}>
              <img
                src={fullscreenSticker.imageUrl}
                alt={fullscreenSticker.title || 'Sticker'}
                className="max-h-[62vh] max-w-[88vw] object-contain rounded-2xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.7)] border-2 border-white/10 p-2 bg-white/5"
              />
            </div>

            {/* Voting controls in fullscreen */}
            {round?.status === 'voting_open' && !hasVoted && (
              <div
                className="w-full max-w-2xl mx-auto bg-gray-950/95 border border-white/15 rounded-2xl p-4 text-white shadow-2xl backdrop-blur-md z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Assign to Ballot</div>
                    <div className="text-xs text-gray-300">Pick a rank for this sticker</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    {[
                      { rank: 1, label: '🥇 1st' },
                      { rank: 2, label: '🥈 2nd' },
                      { rank: 3, label: '🥉 3rd' },
                    ]
                      .filter((s) => s.rank <= maxPlaces)
                      .map((slot) => {
                        const isAssigned = ballot[slot.rank] === fullscreenSticker._id;
                        const isOwnSticker = myStickers.some((s) => s._id === fullscreenSticker._id);
                        if (isOwnSticker && !isSoloRoom) return null;
                        return (
                          <button
                            key={slot.rank}
                            onClick={() => {
                              if (isAssigned) {
                                removeBallotRank(slot.rank);
                              } else {
                                assignBallot(slot.rank, fullscreenSticker._id);
                                toast.success(`Assigned as ${slot.label}!`);
                              }
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                              isAssigned
                                ? 'bg-emerald-500 text-white ring-2 ring-emerald-300'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                          >
                            {isAssigned ? <Check className="w-3.5 h-3.5" /> : null}
                            {isAssigned ? `✓ Ranked ${slot.label}` : slot.label}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
