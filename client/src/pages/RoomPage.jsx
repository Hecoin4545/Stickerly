import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy,
  Camera,
  Sparkles,
  Upload,
  CheckCircle,
  ChevronDown,
  RefreshCw,
  Crown,
  Play,
  Copy,
  Check,
  X,
  Download,
  StopCircle,
  MessageCircle,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useRoom } from '../context/RoomContext';
import { useSocket } from '../hooks/useSocket';
import Avatar from '../components/Avatar';
import FindClickPage from './FindClickPage';
import api from '../lib/api';

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentRoom, fetchRoom, members } = useRoom();

  // Active tab: 'main' | 'voting' | 'leaderboard' | 'findclick'
  const [activeTab, setActiveTab] = useState('main');
  const [leaderboardSubTab, setLeaderboardSubTab] = useState('standings');
  const [round, setRound] = useState(null);
  const [stickers, setStickers] = useState([]);
  const [myStickers, setMyStickers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Upload state (Stickerly mode)
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [stickerTitle, setStickerTitle] = useState('');
  const fileInputRef = useRef(null);

  // Voting ballot state: { 1: stickerId, 2: stickerId, 3: stickerId }
  const [ballot, setBallot] = useState({ 1: null, 2: null, 3: null });
  const [hasVoted, setHasVoted] = useState(false);
  const [fullscreenSticker, setFullscreenSticker] = useState(null);

  // Challenges mode uploads: { [challengeIndex]: { file, preview, title } }
  const [challengeUploads, setChallengeUploads] = useState({});
  const [challengeUploadLoading, setChallengeUploadLoading] = useState({});
  const challengeFileRefs = useRef({});

  // Admin controls
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
  const loadStickers = useCallback(async (roundId) => {
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
  }, [user?._id]);

  const loadMyBallot = useCallback(async (roundId) => {
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
  }, []);

  const loadRound = useCallback(async () => {
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
  }, [roomId, loadStickers, loadMyBallot]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await api.get(`/rooms/${roomId}/leaderboard`);
      setLeaderboard(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [roomId]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.get(`/rounds/${roomId}/history`);
      setHistory(res.data.rounds || []);
    } catch (err) {
      console.error(err);
    }
  }, [roomId]);

  const loadData = useCallback(async () => {
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
  }, [roomId, fetchRoom, loadRound, loadLeaderboard, loadHistory]);

  useEffect(() => {
    if (roomId) loadData();
  }, [roomId, loadData]);

  // Real-time updates via Socket
  useSocket({
    roomId,
    userId: user?._id,
    onPhaseChange: (data) => {
      const phase = data?.phase;
      if (phase === 'voting_open') {
        toast.success('Admin closed uploads! Voting is now live 🗳️');
        setActiveTab('voting');
      } else if (phase === 'completed') {
        toast('Results are in! Check the Leaderboard 🏆');
        setActiveTab('leaderboard');
      } else if (phase === 'uploads_open') {
        toast.success('Event started! Start capturing 📸');
      }
      loadRound();
    },
    onSubmissionUpdate: () => {
      loadRound();
      if (round?._id) loadStickers(round._id);
    },
    onRoundResults: () => {
      toast('Round completed! Check results 🏆');
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

  // User must rank at least 1st place; they may optionally add more ranks up to maxPlaces
  const isBallotValid = Boolean(ballot[1]);

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
      toast.success(
        roomMode === 'challenges'
          ? `Event started! Random target selected: ${res.data.targetUserId?.username || 'member'} 🎯`
          : 'Event started! Uploads are open 🎉'
      );
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
      if (!stickerTitle) {
        setStickerTitle('Fun Sticker');
      }
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
      await api.post('/stickers/upload', formData, {
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

  // ── Stickerly: Delete Sticker ─────────────────────────────────────────────
  const handleDeleteSticker = async (stickerId) => {
    if (!window.confirm('Delete this sticker?')) return;
    try {
      await api.delete(`/stickers/${stickerId}`);
      toast.success('Sticker deleted');
      if (round?._id) loadStickers(round._id);
      loadRound();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete sticker');
    }
  };

  // ── Challenges Upload with AI Verification ─────────────────────────────────
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
    const uploadItem = challengeUploads[challengeIndex];
    if (!uploadItem?.file) {
      toast.error('Please select an image first');
      return;
    }
    const formData = new FormData();
    formData.append('image', uploadItem.file);
    formData.append('roomId', roomId);
    formData.append('challengeIndex', challengeIndex);
    formData.append('title', uploadItem.title || `Challenge #${challengeIndex} Pose`);

    try {
      setChallengeUploadLoading((prev) => ({ ...prev, [challengeIndex]: true }));
      await api.post('/stickers/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Challenge #${challengeIndex} verified by AI & completed! 🎉 +10 pts`);
      setChallengeUploads((prev) => {
        const next = { ...prev };
        delete next[challengeIndex];
        return next;
      });
      if (round?._id) loadStickers(round._id);
      loadRound();
      loadLeaderboard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
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
    // Only include ranks the user actually filled in (re-rank consecutively)
    let rankCounter = 1;
    if (ballot[1]) formatted.push({ stickerId: ballot[1], rank: rankCounter++ });
    if (ballot[2] && maxPlaces >= 2 && ballot[2]) formatted.push({ stickerId: ballot[2], rank: rankCounter++ });
    if (ballot[3] && maxPlaces >= 3 && ballot[3]) formatted.push({ stickerId: ballot[3], rank: rankCounter++ });

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

  // ── Render Loading ────────────────────────────────────────────────────────
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
              <span>{currentRoom?.name || 'Room'}</span>
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
                        {m._id === (currentRoom?.adminId?._id || currentRoom?.adminId) && (
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
          <span
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
              roomMode === 'challenges'
                ? 'bg-purple-100 text-purple-700'
                : roomMode === 'findclick'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-pink-100 text-pink-700'
            }`}
          >
            {roomMode === 'challenges'
              ? '🎯 Challenges'
              : roomMode === 'findclick'
              ? '🔍 Find & Click'
              : '🎭 Stickerly'}
          </span>
        </div>

        {/* Phase status */}
        <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full text-xs font-semibold">
          <span
            className={`w-2 h-2 rounded-full ${
              round?.status === 'uploads_open'
                ? 'bg-emerald-500 animate-pulse'
                : round?.status === 'voting_open'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-gray-400'
            }`}
          />
          <span className="uppercase tracking-wide">
            {round?.status === 'uploads_open' && 'Uploads Open'}
            {round?.status === 'voting_open' && 'Voting Live'}
            {round?.status === 'completed' && 'Round Completed'}
            {!round && 'Waiting for event'}
          </span>
        </div>

        {/* Right: user pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-semibold">
            <Trophy className="w-3.5 h-3.5 text-brand-amber" />
            <span>{myLeaderboardEntry?.totalPoints || user?.totalPoints || 0} pts</span>
          </div>
          <div onClick={() => navigate('/dashboard')} className="cursor-pointer hover:opacity-90 transition" title="Dashboard">
            <Avatar src={user?.avatar} name={user?.username} size="sm" className="ring-2 ring-brand-pink/50" />
          </div>
        </div>
      </header>

      {/* ─── NAVIGATION TABS ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto py-2">
          {roomMode !== 'findclick' && (
            <button
              onClick={() => setActiveTab('main')}
              className={`px-4 py-2 text-xs md:text-sm font-bold tracking-tight rounded-lg transition-all ${
                activeTab === 'main' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-black hover:bg-gray-100'
              }`}
            >
              {roomMode === 'challenges' ? '🎯 Challenges' : '🎭 Stickerly'}
            </button>
          )}

          {roomMode !== 'findclick' && (
            <button
              onClick={() => setActiveTab('voting')}
              className={`px-4 py-2 text-xs md:text-sm font-bold tracking-tight rounded-lg border border-dashed transition-all relative ${
                activeTab === 'voting'
                  ? 'bg-black text-white border-black shadow-sm'
                  : round?.status === 'voting_open'
                  ? 'text-amber-600 border-amber-300 bg-amber-50/50 hover:bg-amber-100/50'
                  : 'text-gray-500 border-gray-300 hover:text-black hover:border-gray-400'
              }`}
            >
              🗳️ Voting Arena
              {round?.status === 'voting_open' && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('findclick')}
            className={`px-4 py-2 text-xs md:text-sm font-bold tracking-tight rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'findclick'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-purple-600 hover:bg-purple-50 border border-purple-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" /> Find & Click
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 text-xs md:text-sm font-bold tracking-tight rounded-lg transition-all ${
              activeTab === 'leaderboard' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-black hover:bg-gray-100'
            }`}
          >
            🏆 Leaderboard
          </button>

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
        {/* TAB: MAIN (Stickerly or Challenges) */}
        {activeTab === 'main' && (
          <div className="space-y-6">
            {/* ── Admin Control Bar ── */}
            {isAdmin && (
              <div className="bg-gray-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">Admin Controls</span>
                  <div className="text-sm font-bold mt-0.5">
                    {noEvent
                      ? 'Start a new event for your group'
                      : round?.status === 'uploads_open'
                      ? 'Uploads are open — close when everyone is done'
                      : round?.status === 'voting_open'
                      ? 'Voting is live — close to reveal results'
                      : 'Event completed — start a new one!'}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {noEvent && (
                    <button
                      onClick={() => (roomMode === 'challenges' ? setShowTopicModal(true) : handleStartEvent())}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" /> Start Event
                    </button>
                  )}
                  {round?.status === 'uploads_open' && (
                    <button
                      onClick={handleCloseUploads}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      <StopCircle className="w-3.5 h-3.5" /> Close Uploads → Open Voting
                    </button>
                  )}
                  {round?.status === 'voting_open' && (
                    <button
                      onClick={handleCloseVoting}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      <StopCircle className="w-3.5 h-3.5" /> Close Voting → Reveal Results
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
                    ? 'Click "Start Event" above to kick off this round!'
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

            {/* ── AI Verification Banner (Challenges mode only) ── */}
            {round?.status === 'uploads_open' && roomMode === 'challenges' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 text-xs text-blue-800">
                <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <span className="font-bold">AI Pose & Gesture Verification Active: </span>
                  When you upload a challenge photo, Google Gemini AI checks that you completed the requested pose.
                </div>
              </div>
            )}

            {/* ── Stickerly Mode Upload Section ── */}
            {round?.status === 'uploads_open' && roomMode === 'stickerly' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2.5 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase tracking-wider">
                        UPLOADS OPEN
                      </span>
                      <span className="text-xs text-gray-500">Event #{round.roundNumber}</span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight">📸 Snap & Upload Your Sticker!</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Upload as many stickers as you like for this round!
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
                    <h3 className="font-extrabold text-base mb-4">Upload Sticker</h3>
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
                          <p className="text-xs font-bold text-gray-700">Click to select photo</p>
                          <p className="text-[11px] text-gray-400 mt-1">JPG, PNG, GIF, WebP — max 25MB</p>
                        </div>
                      )}
                    </div>

                    {uploadFile && (
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Give this sticker a caption..."
                          value={stickerTitle}
                          onChange={(e) => setStickerTitle(e.target.value)}
                          className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:border-black"
                        />
                        <button
                          onClick={handleUploadSubmit}
                          disabled={actionLoading}
                          className="w-full py-3 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {actionLoading ? 'Uploading...' : '🎯 Upload Sticker'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Squad & My Stickers */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-extrabold text-sm">Your Stickers</h4>
                      <span className="text-xs text-gray-500 font-mono">{myStickers.length} uploaded</span>
                    </div>
                    {myStickers.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-xs">
                        <Camera className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        No stickers yet — take your first snap!
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {myStickers.map((s) => (
                          <div key={s._id} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                            <img src={s.imageUrl} alt={s.title} className="w-full aspect-square object-cover" />
                            <div className="absolute top-1 left-1 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">✓ Uploaded</div>
                            <button
                              onClick={() => handleDeleteSticker(s._id)}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                              title="Delete sticker"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            {s.title && (
                              <div className="bg-white/90 text-[10px] font-semibold truncate px-1.5 py-1 text-gray-700">{s.title}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-extrabold text-sm">Squad Uploads</h4>
                      <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded-full font-bold">
                        {round.submissionCount || 0} total
                      </span>
                    </div>
                    <div className="space-y-2">
                      {members.map((m) => (
                        <div key={m._id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-none text-xs">
                          <div className="flex items-center gap-2">
                            <Avatar src={m.avatar} name={m.username} size="xs" />
                            <span className="font-semibold">{m.username} {m._id === user?._id && '(You)'}</span>
                          </div>
                          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Member
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Challenges Mode Section ── */}
            {round?.status === 'uploads_open' && roomMode === 'challenges' && (
              <div className="space-y-6">
                {/* Randomly Selected Target Card */}
                {round.targetUserId && (
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-center gap-5 justify-between">
                    <div className="flex items-center gap-4 text-center sm:text-left">
                      <Avatar
                        src={round.targetUserId?.avatar}
                        name={round.targetUserId?.username}
                        size="xl"
                        className="border-4 border-white/30 shadow-md"
                      />
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-bold mb-1">
                          <Crown className="w-3.5 h-3.5 text-amber-300" /> Randomly Selected Target
                        </div>
                        <h3 className="text-2xl font-black">{round.targetUserId?.username}</h3>
                        <p className="text-xs text-white/80 mt-0.5">
                          Randomly chosen from all group members for this challenge session!
                        </p>
                      </div>
                    </div>
                    <div className="text-center sm:text-right bg-white/10 px-4 py-2.5 rounded-xl border border-white/20">
                      <span className="text-[11px] text-white/70 block uppercase font-mono">Topic</span>
                      <span className="font-extrabold text-sm text-white">"{round.adminTopic}"</span>
                    </div>
                  </div>
                )}

                {/* Challenge Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {(round.challenges || []).map((challenge) => {
                    const completedSticker = myStickers.find(
                      (s) => s.challengeIndex === challenge.index
                    );
                    const isCompleted = !!completedSticker;
                    const uploadItem = challengeUploads[challenge.index];
                    const isUploading = challengeUploadLoading[challenge.index];

                    return (
                      <motion.div
                        key={challenge.index}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: challenge.index * 0.04 }}
                        className={`bg-white rounded-2xl border-2 p-5 shadow-sm relative ${
                          isCompleted ? 'border-emerald-400 bg-emerald-50/10' : 'border-gray-200'
                        }`}
                      >
                        {isCompleted && (
                          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[10px] font-bold shadow-sm">
                            <Check className="w-3 h-3" /> Completed (+10 pts)
                          </div>
                        )}

                        <div className="flex items-center gap-2 mb-3">
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                              isCompleted ? 'bg-emerald-500 text-white' : 'bg-gray-900 text-white'
                            }`}
                          >
                            {challenge.index}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                            Challenge #{challenge.index}
                          </span>
                        </div>

                        {/* Topic */}
                        <div className="mb-3">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-600 mb-1">
                            <MessageCircle className="w-3.5 h-3.5" /> Discussion Prompt
                          </div>
                          <p className="text-sm font-semibold text-gray-800 leading-snug">
                            {challenge.conversationTopic}
                          </p>
                        </div>

                        {/* Pose */}
                        <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-500 mb-1">
                            <Camera className="w-3.5 h-3.5" /> Required Gesture / Pose
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-2xl flex-shrink-0">{challenge.poseEmoji}</span>
                            <p className="text-xs text-gray-700 font-medium leading-snug">
                              {challenge.poseDescription}
                            </p>
                          </div>
                        </div>

                        {/* Photo capture & upload */}
                        {uploadItem?.preview ? (
                          <div className="space-y-2 p-2 bg-purple-50/50 rounded-xl border border-purple-200">
                            <img
                              src={uploadItem.preview}
                              alt="Preview"
                              className="w-full max-h-40 object-cover rounded-lg"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleChallengeUpload(challenge.index)}
                                disabled={isUploading}
                                className="flex-1 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                              >
                                {isUploading ? 'AI Checking Pose & Face...' : '🤖 Verify & Submit Pose'}
                              </button>
                              <button
                                onClick={() =>
                                  setChallengeUploads((prev) => {
                                    const n = { ...prev };
                                    delete n[challenge.index];
                                    return n;
                                  })
                                }
                                className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : isCompleted ? (
                          <div className="flex items-center justify-between gap-3 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                            <div className="flex items-center gap-2.5">
                              {completedSticker && (
                                <img
                                  src={completedSticker.imageUrl}
                                  alt="Pose"
                                  onClick={() => setFullscreenSticker(completedSticker)}
                                  className="w-12 h-12 rounded-lg object-cover border border-emerald-300 cursor-pointer"
                                />
                              )}
                              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Pose & Face Verified!
                              </span>
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
                              className="text-[11px] font-semibold text-gray-500 hover:text-black underline"
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
                            className="w-full py-2.5 border-2 border-dashed border-purple-200 hover:border-purple-500 rounded-xl text-xs font-semibold text-purple-700 transition flex items-center justify-center gap-2 bg-purple-50/30 hover:bg-purple-50"
                          >
                            <Camera className="w-4 h-4" /> Capture Pose Photo
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Voting Open Banner ── */}
            {round?.status === 'voting_open' && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6 text-center shadow-sm">
                <div className="text-3xl mb-2">🗳️</div>
                <h3 className="text-lg font-bold text-amber-900">Voting is Live!</h3>
                <p className="text-sm text-amber-800 mt-1 mb-4">Admin closed uploads. Time to cast your votes!</p>
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
                <h3 className="text-lg font-bold text-emerald-900">Round Completed!</h3>
                <p className="text-sm text-emerald-800 mt-1 mb-4">Points tallied and podiums awarded.</p>
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

        {/* TAB: VOTING ARENA */}
        {activeTab === 'voting' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold flex items-center gap-2">🗳️ Voting Arena</h2>
                <p className="text-xs text-gray-500">Pick your top stickers to award podium points</p>
              </div>
              {hasVoted && (
                <span className="text-xs px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                  ✓ Ballot Locked In
                </span>
              )}
            </div>

            {/* Ballot Podiums */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].slice(0, maxPlaces).map((rank) => {
                const assignedId = ballot[rank];
                const sticker = stickers.find((s) => s._id === assignedId);
                const medal = rank === 1 ? '🥇 1st Place (+5 pts)' : rank === 2 ? '🥈 2nd Place (+3 pts)' : '🥉 3rd Place (+1 pt)';

                return (
                  <div
                    key={rank}
                    className={`bg-white rounded-2xl border-2 p-4 text-center ${
                      assignedId ? 'border-brand-pink' : 'border-dashed border-gray-300'
                    }`}
                  >
                    <span className="text-xs font-bold text-gray-500 block mb-2">{medal}</span>
                    {sticker ? (
                      <div className="relative">
                        <img
                          src={sticker.imageUrl}
                          alt="Selected"
                          className="w-full aspect-square object-cover rounded-xl mb-2"
                        />
                        <button
                          onClick={() => removeBallotRank(rank)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <p className="text-xs font-bold truncate">{sticker.title || 'Sticker'}</p>
                      </div>
                    ) : (
                      <div className="py-8 text-gray-400 text-xs">
                        Select a sticker below to assign
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!hasVoted && (
              <button
                onClick={handleVoteSubmit}
                disabled={actionLoading || !isBallotValid}
                className="w-full py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-40"
              >
                {actionLoading ? 'Submitting Ballot...' : 'Confirm Official Ballot 🗳️'}
              </button>
            )}

            {/* Candidates Grid */}
            <h3 className="font-bold text-sm text-gray-700 mt-6">Candidate Stickers</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {votableStickers.map((sticker) => {
                const currentRank = Object.keys(ballot).find((r) => ballot[r] === sticker._id);
                return (
                  <div
                    key={sticker._id}
                    className={`bg-white rounded-2xl border p-3 flex flex-col justify-between ${
                      currentRank ? 'border-brand-pink ring-2 ring-brand-pink/20' : 'border-gray-200'
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={sticker.imageUrl}
                        alt="Candidate"
                        className="w-full aspect-square object-cover rounded-xl mb-2 cursor-pointer"
                        onClick={() => setFullscreenSticker(sticker)}
                      />
                      {currentRank && (
                        <span className="absolute top-2 left-2 bg-brand-pink text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Rank #{currentRank}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold truncate mb-2">{sticker.title || 'Untitled'}</p>
                    <div className="grid grid-cols-3 gap-1">
                      {[1, 2, 3].slice(0, maxPlaces).map((r) => (
                        <button
                          key={r}
                          onClick={() => assignBallot(r, sticker._id)}
                          className={`py-1 text-[11px] font-bold rounded-lg border transition ${
                            currentRank === String(r)
                              ? 'bg-black text-white border-black'
                              : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                          }`}
                        >
                          #{r}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: FIND & CLICK */}
        {activeTab === 'findclick' && (
          <FindClickPage roomId={roomId} isAdmin={isAdmin} />
        )}

        {/* TAB: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
              <button
                onClick={() => setLeaderboardSubTab('standings')}
                className={`text-sm font-bold pb-2 border-b-2 transition ${
                  leaderboardSubTab === 'standings' ? 'border-black text-black' : 'border-transparent text-gray-400'
                }`}
              >
                Room Standings
              </button>
              <button
                onClick={() => setLeaderboardSubTab('history')}
                className={`text-sm font-bold pb-2 border-b-2 transition ${
                  leaderboardSubTab === 'history' ? 'border-black text-black' : 'border-transparent text-gray-400'
                }`}
              >
                Round History
              </button>
            </div>

            {leaderboardSubTab === 'standings' ? (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-100">
                  {leaderboard.map((member) => (
                    <div
                      key={member._id}
                      className={`flex items-center justify-between p-4 ${
                        member._id === user?._id ? 'bg-amber-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-black text-sm w-6 text-gray-400">
                          {member.rank === 1 ? '🥇' : member.rank === 2 ? '🥈' : member.rank === 3 ? '🥉' : `${member.rank}.`}
                        </span>
                        <Avatar src={member.avatar} name={member.username} size="sm" />
                        <div>
                          <p className="font-bold text-sm text-gray-900">
                            {member.username} {member._id === user?._id && '(You)'}
                          </p>
                          <span className="text-[11px] text-gray-400">
                            🔥 {member.streak || 0} streak · 🏆 {member.podiums || 0} podiums
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-base text-gray-900">{member.totalPoints}</span>
                        <span className="text-xs text-gray-400 block">points</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-center py-10 text-gray-400 text-sm">No completed rounds yet</p>
                ) : (
                  history.map((h) => (
                    <div key={h._id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-gray-400 uppercase">Round #{h.roundNumber}</span>
                        <p className="font-bold text-sm text-gray-900">"{h.theme}"</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 rounded-lg text-gray-600">
                        {h.submissionCount || 0} stickers
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Admin: Challenges Topic Modal ── */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">🎯 Start Challenges Session</h3>
              <button onClick={() => setShowTopicModal(false)} className="p-1 text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Enter a fun topic. AI will generate 10 questions & poses around it, and a squad member will be randomly selected as today's target!
            </p>
            <input
              type="text"
              placeholder="e.g. childhood mischief, embarrassing fails, guilty pleasures"
              value={adminTopic}
              onChange={(e) => setAdminTopic(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowTopicModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleStartEvent(adminTopic)}
                disabled={actionLoading || !adminTopic.trim()}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition disabled:opacity-50"
              >
                {actionLoading ? 'Starting...' : 'Start Challenges 🎯'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fullscreen Sticker Modal ── */}
      {fullscreenSticker && (
        <div
          onClick={() => setFullscreenSticker(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <img src={fullscreenSticker.imageUrl} alt="Sticker" className="w-full max-h-[70vh] object-contain rounded-xl mb-3" />
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm text-gray-800">{fullscreenSticker.title || 'Sticker'}</p>
              <button
                onClick={() => handleDownload(fullscreenSticker.imageUrl, `${fullscreenSticker.title || 'sticker'}.png`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800"
              >
                <Download className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
