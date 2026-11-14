import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Camera,
  Vote,
  Sparkles,
  Clock,
  Flame,
  Shield,
  Upload,
  CheckCircle,
  AlertCircle,
  Eye,
  Lock,
  ChevronDown,
  RefreshCw,
  Award,
  Crown,
  Play,
  FastForward,
  Copy,
  Users,
  Image as ImageIcon,
  Check,
  X,
  Shuffle,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useRoom } from '../context/RoomContext';
import { useCountdown } from '../hooks/useCountdown';
import { useSocket } from '../hooks/useSocket';
import api from '../lib/api';

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentRoom, fetchRoom, members } = useRoom();

  const [activeTab, setActiveTab] = useState('daily-drop'); // 'daily-drop' | 'studio' | 'voting' | 'leaderboard'
  const [leaderboardSubTab, setLeaderboardSubTab] = useState('standings'); // 'standings' | 'hall-of-fame' | 'roster'
  const [round, setRound] = useState(null);
  const [stickers, setStickers] = useState([]);
  const [mySticker, setMySticker] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [stickerTitle, setStickerTitle] = useState('');
  const [stickerBorder, setStickerBorder] = useState(8);
  const [stickerStyle, setStickerStyle] = useState('vinyl'); // 'vinyl' | 'matte' | 'holo'
  const fileInputRef = useRef(null);

  // Voting ballot state: { 1: stickerId, 2: stickerId, 3: stickerId }
  const [ballot, setBallot] = useState({ 1: null, 2: null, 3: null });
  const [hasVoted, setHasVoted] = useState(false);

  // Dropdowns
  const [showRoomMenu, setShowRoomMenu] = useState(false);

  // Load Room and Round Data
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
        if (res.data.status === 'voting') {
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
      setStickers(res.data);
      // Look for my uploaded sticker
      const mine = res.data.find(
        (s) => s.creatorId?._id === user?._id || s.creatorId === user?._id
      );
      if (mine) setMySticker(mine);
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
    onPhaseChange: () => {
      toast.success('Round phase updated!');
      loadRound();
    },
    onSubmissionUpdate: () => {
      loadRound();
      if (round?._id) loadStickers(round._id);
    },
    onRoundResults: () => {
      toast('Results are in! Check the Leaderboard 🏆');
      loadRound();
      loadLeaderboard();
      loadHistory();
    },
  });

  // Countdown timer for Hunt or Voting
  const deadline =
    round?.status === 'hunt'
      ? round?.huntDeadline
      : round?.status === 'voting'
      ? round?.votingEnd
      : null;

  const { hours, minutes, seconds, percentElapsed } = useCountdown(deadline);

  // Handlers for Admin testing
  const handleStartRound = async () => {
    try {
      setActionLoading(true);
      const res = await api.post(`/rounds/${roomId}/start`);
      setRound(res.data);
      toast.success(`Round #${res.data.roundNumber} started! Target chosen 🎯`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start round');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvanceRound = async () => {
    try {
      setActionLoading(true);
      const res = await api.post(`/rounds/${roomId}/advance`);
      toast.success(res.data.message);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not advance phase');
    } finally {
      setActionLoading(false);
    }
  };

  // Image Selection & Upload
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
        setStickerTitle(`${round?.targetUserId?.username || 'Target'} In The Wild`);
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
    formData.append('title', stickerTitle);

    try {
      setActionLoading(true);
      const res = await api.post('/stickers/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Sticker uploaded! 🎯 Waiting for 10 PM reveal.');
      setMySticker(res.data);
      setUploadFile(null);
      setUploadPreview(null);
      loadRound();
      if (round?._id) loadStickers(round._id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Assign Sticker to Ballot
  const assignBallot = (rank, stickerId) => {
    // Check if sticker is already placed in another rank
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
    if (!ballot[1] || !ballot[2] || !ballot[3]) {
      toast.error('Please select your 1st, 2nd, and 3rd place stickers!');
      return;
    }
    const formatted = [
      { stickerId: ballot[1], rank: 1 },
      { stickerId: ballot[2], rank: 2 },
      { stickerId: ballot[3], rank: 3 },
    ];
    try {
      setActionLoading(true);
      await api.post('/api/votes/submit', {
        roundId: round._id,
        roomId,
        ballot: formatted,
      });
      toast.success('Official ballot confirmed! 🗳️ Points locked in.');
      setHasVoted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit ballot');
    } finally {
      setActionLoading(false);
    }
  };

  // User Stats
  const myLeaderboardEntry = leaderboard.find(
    (m) => m._id === user?._id || m.username === user?.username
  );

  const isTarget = round?.targetUserId?._id === user?._id;

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1A1A1A] flex flex-col font-sans pb-16">
      {/* TOP NAVBAR */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 px-4 md:px-8 py-3 flex items-center justify-between">
        {/* Left: Brand + Room selector */}
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
              <span>{currentRoom?.name || 'Loading Room...'}</span>
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
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center font-bold text-[10px]">
                          {m.username[0].toUpperCase()}
                        </div>
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
        </div>

        {/* Center: Phase status pill with timer */}
        <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full text-xs font-semibold">
          <span
            className={`w-2 h-2 rounded-full ${
              round?.status === 'hunt'
                ? 'bg-emerald-500 animate-pulse'
                : round?.status === 'voting'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-gray-400'
            }`}
          />
          <span className="uppercase tracking-wide">
            {round?.status === 'hunt' && `Hunt Phase: ${hours}h ${minutes}m remaining`}
            {round?.status === 'voting' && `Voting Arena: ${hours}h ${minutes}m remaining`}
            {round?.status === 'completed' && 'Round Completed • New drop at 12 AM'}
            {!round && 'Waiting for round start'}
          </span>
        </div>

        {/* Right: User stats pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-semibold">
            <Trophy className="w-3.5 h-3.5 text-brand-amber" />
            <span>{myLeaderboardEntry?.totalPoints || 0} pts</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">#{myLeaderboardEntry?.rank || '-'} Rank</span>
          </div>

          <div
            onClick={() => navigate('/dashboard')}
            className="w-8 h-8 rounded-full bg-brand-pink text-white font-bold flex items-center justify-center text-xs cursor-pointer hover:opacity-90"
            title="Profile / Dashboard"
          >
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      {/* 4 PRIMARY NAVIGATION TABS */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('daily-drop')}
            className={`px-4 py-2 text-xs md:text-sm font-bold tracking-tight rounded-lg transition-all ${
              activeTab === 'daily-drop'
                ? 'bg-black text-white shadow-sm'
                : 'text-gray-500 hover:text-black hover:bg-gray-100'
            }`}
          >
            Daily Drop
          </button>

          <button
            onClick={() => setActiveTab('studio')}
            className={`px-4 py-2 text-xs md:text-sm font-bold tracking-tight rounded-lg border border-dashed transition-all ${
              activeTab === 'studio'
                ? 'bg-black text-white border-black shadow-sm'
                : 'text-gray-500 border-gray-300 hover:text-black hover:border-gray-400'
            }`}
          >
            Sticker Studio
          </button>

          <button
            onClick={() => setActiveTab('voting')}
            className={`px-4 py-2 text-xs md:text-sm font-bold tracking-tight rounded-lg border border-dashed transition-all relative ${
              activeTab === 'voting'
                ? 'bg-black text-white border-black shadow-sm'
                : round?.status === 'voting'
                ? 'text-amber-600 border-amber-300 bg-amber-50/50 hover:bg-amber-100/50'
                : 'text-gray-500 border-gray-300 hover:text-black hover:border-gray-400'
            }`}
          >
            10 PM Voting Arena
            {round?.status === 'voting' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 text-xs md:text-sm font-bold tracking-tight rounded-lg transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-black text-white shadow-sm'
                : 'text-gray-500 hover:text-black hover:bg-gray-100'
            }`}
          >
            Leaderboard & Hall of Fame
          </button>

          {/* Admin Tools for Demoing & Testing */}
          <div className="ml-auto flex items-center gap-2 pl-4">
            {!round ? (
              <button
                onClick={handleStartRound}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-green text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition"
              >
                <Play className="w-3.5 h-3.5" /> Start Round #1
              </button>
            ) : (
              <button
                onClick={handleAdvanceRound}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-black transition"
                title="Advance phase: Hunt -> Voting -> Completed"
              >
                <FastForward className="w-3.5 h-3.5" /> Next Phase ({round.status})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ROUND NOTICE SUB-BAR */}
      <div className="bg-[#FFF4E5] border-b border-[#FFE0B2] px-4 md:px-8 py-2 flex flex-wrap items-center justify-between text-xs text-[#8A5300] font-medium">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-bold">SEASON 01 • THE MIDNIGHT HUNT</span>
          <span>•</span>
          <span>Room #{currentRoom?.code} Active</span>
          {round?.theme && (
            <>
              <span>•</span>
              <span className="font-semibold text-black">Mandatory Theme: "{round.theme}"</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>⚡ Double XP for stickers uploaded before 18:00</span>
          <button onClick={loadData} className="hover:text-black">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto w-full px-4 md:px-8 pt-6 flex-1">
        {/* ======================================================== */}
        {/* TAB 1: DAILY DROP */}
        {/* ======================================================== */}
        {activeTab === 'daily-drop' && (
          <div className="space-y-6">
            {!round ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-xl mx-auto shadow-sm">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  🎯
                </div>
                <h3 className="text-xl font-bold mb-2">No Active Round</h3>
                <p className="text-gray-500 text-sm mb-6">
                  Rounds auto-generate every day at midnight (12:00 AM). As room admin, you can also kickstart round 1 right now!
                </p>
                <button
                  onClick={handleStartRound}
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-black text-white rounded-full font-bold text-sm hover:bg-gray-800 transition"
                >
                  Start Round Now
                </button>
              </div>
            ) : (
              <>
                {/* 2-COLUMN GRID (Top cards) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* LEFT COLUMN (~60%): Target Card + Theme */}
                  <div className="lg:col-span-7 space-y-6">
                    {/* Target Card */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm relative overflow-hidden">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-black text-white text-[10px] font-bold tracking-wider rounded uppercase">
                            ROUND #{round.roundNumber}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> LOCKED TARGET
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-gray-400">RNG SEED: #0x{round._id?.slice(-5)}</span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                        <div className="relative">
                          <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-brand-pink to-rose-400 flex items-center justify-center text-white text-3xl font-extrabold shadow-md border-4 border-white">
                            {round.targetUserId?.avatar ? (
                              <img
                                src={round.targetUserId.avatar}
                                alt="target"
                                className="w-full h-full object-cover rounded-2xl"
                              />
                            ) : (
                              round.targetUserId?.username?.[0]?.toUpperCase() || '?'
                            )}
                          </div>
                          <span className="absolute -bottom-2 -right-2 px-2 py-0.5 bg-rose-600 text-white text-[9px] font-black rounded uppercase tracking-wider shadow">
                            TODAY'S TARGET
                          </span>
                        </div>

                        <div className="flex-1">
                          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            {round.targetUserId?.username}
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                              @{round.targetUserId?.username?.toLowerCase()}
                            </span>
                          </h2>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            Selected by midnight room lottery. {round.targetUserId?.username} has zero clue who is observing them today. Stay subtle.
                          </p>
                        </div>
                      </div>

                      {/* Theme Section */}
                      <div className="mt-6 pt-5 border-t border-gray-100">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                          <AlertCircle className="w-3.5 h-3.5 text-brand-pink" /> Mandatory Theme
                        </div>
                        <div className="text-lg font-black text-[#1A1A1A] tracking-tight">
                          "{round.theme}"
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-pink" /> Must be taken today
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-pink" /> Zero posed archives
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-pink" /> Raw crop or die-cut cutout
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Upload / Submission Section */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                            Fast Track Upload
                          </span>
                          <h3 className="text-base font-extrabold">
                            Snap, Peel, or Drop Today's {round.targetUserId?.username} Cutout
                          </h3>
                        </div>
                        <span className="text-[11px] font-mono text-gray-400">PNG, JPG up to 25MB</span>
                      </div>

                      {isTarget ? (
                        <div className="bg-gray-50 rounded-xl p-8 text-center border border-dashed border-gray-300">
                          <Shield className="w-10 h-10 text-brand-amber mx-auto mb-2" />
                          <h4 className="font-bold text-sm">You are today's target! 🎯</h4>
                          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                            You are exempt from hunting today. Sit back, be candid, and await the 10 PM voting arena to see what your friends snapped!
                          </p>
                        </div>
                      ) : mySticker ? (
                        <div className="bg-emerald-50/50 rounded-xl p-5 border border-emerald-200 flex flex-col sm:flex-row items-center gap-5">
                          <div className="relative group">
                            <img
                              src={mySticker.imageUrl}
                              alt="My sticker"
                              className="w-28 h-28 object-contain rounded-xl bg-white border-2 border-emerald-400 shadow-md p-1"
                            />
                            <span className="absolute top-1 right-1 bg-black text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                              YOUR PEEL
                            </span>
                          </div>
                          <div className="flex-1 text-center sm:text-left">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full mb-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Slapped & Ready
                            </div>
                            <h4 className="font-bold text-sm text-gray-800">
                              "{mySticker.title || 'Untitled Candid'}"
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Uploaded at {new Date(mySticker.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Locked in the vault until 10 PM.
                            </p>
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="mt-3 text-xs text-rose-600 font-bold hover:underline"
                            >
                              Replace sticker
                            </button>
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              accept="image/*"
                              className="hidden"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 hover:border-black rounded-xl p-8 text-center cursor-pointer transition bg-gray-50/50 hover:bg-gray-100/50"
                          >
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              accept="image/*"
                              className="hidden"
                            />
                            {uploadPreview ? (
                              <div className="space-y-3">
                                <img
                                  src={uploadPreview}
                                  alt="Preview"
                                  className="w-32 h-32 object-contain mx-auto rounded-lg shadow-sm bg-white p-1 border"
                                />
                                <span className="text-xs font-semibold text-brand-pink block">
                                  Click to change image
                                </span>
                              </div>
                            ) : (
                              <div>
                                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-xs font-bold text-gray-700">
                                  Drag snapshot of {round.targetUserId?.username} directly here, or <span className="underline">browse folder</span>
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1">
                                  Die-cut contour detector & white border shadow applied automatically
                                </p>
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
                                className="w-full px-4 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-black"
                              />

                              <div className="flex gap-2">
                                <button
                                  onClick={handleUploadSubmit}
                                  disabled={actionLoading}
                                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition"
                                >
                                  {actionLoading ? 'Uploading...' : 'Submit & Slap To Vault'}
                                </button>
                                <button
                                  onClick={() => setActiveTab('studio')}
                                  className="px-4 py-2.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition"
                                >
                                  Open Studio
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN (~40%): Countdown Box + Squad Tracker */}
                  <div className="lg:col-span-5 space-y-6">
                    {/* Countdown Box */}
                    <div className="bg-[#1A1A1A] text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">
                          LOCKOUT SEQUENCE
                        </span>
                        <span className="text-xs font-mono text-emerald-400">22:00:00 LOCK</span>
                      </div>

                      <div className="text-[11px] text-gray-400 uppercase font-semibold">
                        TIME REMAINING TO HUNT & SLAP
                      </div>

                      <div className="text-4xl font-mono font-black tracking-tight my-2">
                        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-gray-800 rounded-full h-2 my-3 overflow-hidden">
                        <div
                          className="bg-emerald-400 h-2 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(100, percentElapsed)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span>Window: 00:00 - 22:00</span>
                        <span className="text-emerald-400 font-bold">100 XP / Drop</span>
                      </div>
                    </div>

                    {/* Squad Tracker */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                            Squad Tracker
                          </span>
                          <h4 className="text-sm font-extrabold">{currentRoom?.name}</h4>
                        </div>
                        <span className="text-xs font-mono font-bold bg-gray-100 px-2.5 py-1 rounded-full">
                          {round.submissionCount || 0} / {Math.max(0, (round.participantCount || members.length) - 1)} In
                        </span>
                      </div>

                      <div className="space-y-3">
                        {members.map((member) => {
                          const isTargetUser = member._id === round.targetUserId?._id;
                          const isMe = member._id === user?._id;
                          const hasUploaded = isMe ? !!mySticker : false; // Other members' uploaded state is anonymous during hunt

                          return (
                            <div
                              key={member._id}
                              className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-none text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-[11px]">
                                  {member.username[0].toUpperCase()}
                                </div>
                                <span className="font-semibold text-gray-800">
                                  {member.username} {isMe && '(You)'}
                                </span>
                              </div>

                              <div>
                                {isTargetUser ? (
                                  <span className="text-[11px] text-gray-400 font-medium italic">
                                    Target (Exempt)
                                  </span>
                                ) : hasUploaded ? (
                                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                    <Check className="w-3.5 h-3.5" /> In Vault
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    Hunting...
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTTOM VAULT LOCKED STREAM SECTION */}
                <div className="mt-10">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">
                        VAULT LOCKED STREAM
                      </span>
                      <h3 className="text-lg font-black tracking-tight">
                        Live Drops Pending 10 PM Unveil
                      </h3>
                    </div>
                    <span className="text-xs text-gray-500">
                      Voting arena doors unlock at 22:00
                    </span>
                  </div>

                  {/* Grid of blurred locked drops */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* If user uploaded their own */}
                    {mySticker && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm relative group overflow-hidden">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                          <span className="font-semibold">{user?.username} (You)</span>
                          <span className="font-mono text-[10px]">
                            {new Date(mySticker.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="relative aspect-square rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden border">
                          <img
                            src={mySticker.imageUrl}
                            alt="Sticker"
                            className="w-full h-full object-contain p-2"
                          />
                          <span className="absolute top-2 left-2 px-2 py-0.5 bg-black text-white text-[9px] font-bold rounded">
                            YOUR PEEL
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Slapped & Ready
                          </span>
                          <span className="text-gray-400 text-[10px]">Vinyl Gloss</span>
                        </div>
                      </div>
                    )}

                    {/* Anonymous locked drops for the other submissions */}
                    {Array.from({ length: Math.max(0, (round.submissionCount || 0) - (mySticker ? 1 : 0)) }).map(
                      (_, i) => (
                        <div
                          key={i}
                          className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <span className="font-semibold">@anonymous-hunter</span>
                            <span className="font-mono text-[10px]">Locked</span>
                          </div>
                          <div className="aspect-square rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center p-4 relative backdrop-blur-md">
                            <Lock className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-xs font-bold text-gray-600">Locked Drop</span>
                            <span className="text-[10px] text-gray-400 mt-1">Unlocks at 10 PM</span>
                            <span className="mt-3 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-full">
                              CERTIFIED CANDID
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                            <span className="text-[10px]">Die-cut Cutout</span>
                            <span className="text-[10px]">Encrypted</span>
                          </div>
                        </div>
                      )
                    )}

                    {/* Placeholder empty slots */}
                    {Array.from({
                      length: Math.max(
                        0,
                        (round.participantCount || members.length) - 1 - (round.submissionCount || 0)
                      ),
                    }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 p-4 flex flex-col items-center justify-center text-center aspect-square"
                      >
                        <Camera className="w-6 h-6 text-gray-300 mb-2" />
                        <span className="text-xs font-semibold text-gray-400">Hunt in progress</span>
                        <span className="text-[10px] text-gray-300 mt-0.5">Waiting for hunter</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: STICKER STUDIO */}
        {/* ======================================================== */}
        {activeTab === 'studio' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                <div>
                  <h3 className="text-lg font-black tracking-tight">Sticker Die-Cut Studio</h3>
                  <p className="text-xs text-gray-500">
                    Adjust border thickness, finish style, and preview physical vinyl peel before slapping.
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-gray-100 text-xs font-bold rounded-lg hover:bg-gray-200"
                >
                  Choose Image
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Visual Preview with white die-cut border */}
                <div className="bg-[#EFEFEF] rounded-2xl p-8 flex items-center justify-center min-h-[300px] relative overflow-hidden border border-gray-200">
                  <div
                    className="relative transition-all duration-300"
                    style={{
                      filter:
                        stickerStyle === 'holo'
                          ? 'drop-shadow(0 8px 16px rgba(232, 67, 147, 0.4))'
                          : 'drop-shadow(0 10px 15px rgba(0, 0, 0, 0.15))',
                    }}
                  >
                    {uploadPreview || mySticker?.imageUrl ? (
                      <div
                        className="relative bg-white rounded-2xl overflow-hidden"
                        style={{ padding: `${stickerBorder}px` }}
                      >
                        <img
                          src={uploadPreview || mySticker?.imageUrl}
                          alt="Sticker Die-cut"
                          className="max-h-56 object-contain rounded-xl"
                        />
                        {stickerStyle === 'holo' && (
                          <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/20 via-transparent to-cyan-500/20 pointer-events-none" />
                        )}
                      </div>
                    ) : (
                      <div className="text-center p-8 bg-white/60 rounded-2xl border border-dashed border-gray-300">
                        <ImageIcon className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <span className="text-xs font-bold text-gray-500">No image loaded yet</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-2">
                      Die-cut White Border Thickness: {stickerBorder}px
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="20"
                      value={stickerBorder}
                      onChange={(e) => setStickerBorder(Number(e.target.value))}
                      className="w-full accent-black cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-2">
                      Finish Texture Preset
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'vinyl', label: 'Vinyl Gloss' },
                        { id: 'matte', label: 'Matte Paper' },
                        { id: 'holo', label: 'Holo Trim v1' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setStickerStyle(item.id)}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition ${
                            stickerStyle === item.id
                              ? 'bg-black text-white border-black'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={() => {
                        toast.success('Style applied to your sticker!');
                        setActiveTab('daily-drop');
                      }}
                      className="w-full py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition"
                    >
                      Apply & Continue
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: 10 PM VOTING ARENA */}
        {/* ======================================================== */}
        {activeTab === 'voting' && (
          <div className="space-y-6">
            {round?.status !== 'voting' && round?.status !== 'completed' ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-lg mx-auto shadow-sm">
                <Clock className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold mb-1">Voting Arena Locked</h3>
                <p className="text-gray-500 text-sm mb-4">
                  The voting arena opens promptly at 10:00 PM once the 22-hour hunt window closes.
                </p>
                <button
                  onClick={handleAdvanceRound}
                  className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition"
                >
                  ⚡ Open Arena Now (Demo Advance)
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Arena Header Bar */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">
                      NIGHTLY DELIBERATION • 2 HOURS TOTAL WINDOW
                    </span>
                    <h2 className="text-2xl font-black tracking-tight">10:00 PM Voting Arena</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Rank your Top 3 favorite stickers of {round.targetUserId?.username} today. 🥇 1st = 5 pts • 🥈 2nd = 3 pts • 🥉 3rd = 1 pt
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-center">
                      <div className="text-[10px] text-amber-800 font-bold uppercase">Closes In</div>
                      <div className="text-lg font-mono font-bold text-amber-900">
                        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                      </div>
                    </div>
                    <span className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-gray-500" /> Self-voting blocked
                    </span>
                  </div>
                </div>

                {/* 2-COLUMN VOTING LAYOUT */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* LEFT: Official Ballot (Rank 1, 2, 3) */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black tracking-tight">Your Official Ballot</h3>
                      <span className="text-xs font-bold text-gray-500">
                        {Object.values(ballot).filter(Boolean).length} of 3 Placed
                      </span>
                    </div>

                    {/* 3 Ballot Slots */}
                    {[
                      { rank: 1, title: '1st Place', points: '+5 Points', medal: '🥇' },
                      { rank: 2, title: '2nd Place', points: '+3 Points', medal: '🥈' },
                      { rank: 3, title: '3rd Place', points: '+1 Point', medal: '🥉' },
                    ].map((slot) => {
                      const assignedId = ballot[slot.rank];
                      const assignedSticker = stickers.find((s) => s._id === assignedId);

                      return (
                        <div
                          key={slot.rank}
                          className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                              <span>{slot.medal}</span>
                              <span>{slot.title}</span>
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                                {slot.points}
                              </span>
                            </span>
                            {assignedSticker && (
                              <button
                                onClick={() => removeBallotRank(slot.rank)}
                                className="text-gray-400 hover:text-rose-500 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {assignedSticker ? (
                            <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                              <img
                                src={assignedSticker.imageUrl}
                                alt="Pick"
                                className="w-16 h-16 object-contain rounded-lg bg-white border p-1"
                              />
                              <div>
                                <span className="text-[10px] font-mono text-gray-400">
                                  STK-{assignedSticker._id?.slice(-4)}
                                </span>
                                <h4 className="text-sm font-bold text-gray-900">
                                  "{assignedSticker.title || 'Untitled Candidate'}"
                                </h4>
                                <span className="text-xs text-gray-500">
                                  {round.status === 'completed'
                                    ? `by @${assignedSticker.creatorId?.username || 'Hunter'}`
                                    : 'by @anonymous-lens'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center text-xs text-gray-400 bg-gray-50/50">
                              Drop your {slot.title} pick here
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                Click "Assign #{slot.rank}" on any sticker from the tray on the right
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Bottom Submit Ballot Bar */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between shadow-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setBallot({ 1: null, 2: null, 3: null })}
                          className="px-3 py-1.5 bg-gray-100 text-xs font-semibold rounded-lg hover:bg-gray-200"
                        >
                          Reset
                        </button>
                      </div>

                      <button
                        onClick={handleVoteSubmit}
                        disabled={
                          !ballot[1] || !ballot[2] || !ballot[3] || actionLoading || hasVoted
                        }
                        className={`px-6 py-2 rounded-xl text-xs font-bold transition ${
                          hasVoted
                            ? 'bg-emerald-600 text-white'
                            : ballot[1] && ballot[2] && ballot[3]
                            ? 'bg-black text-white hover:bg-gray-800'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {hasVoted ? '✓ Official Ballot Submitted' : 'Submit Official Ballot'}
                      </button>
                    </div>
                  </div>

                  {/* RIGHT: Sticker Submissions Tray */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black tracking-tight">Sticker Submissions</h3>
                      <span className="text-xs text-gray-500 font-medium">
                        {stickers.length} Total Today
                      </span>
                    </div>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                      {stickers.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 text-gray-400 text-xs">
                          No candidate stickers submitted for this round yet.
                        </div>
                      ) : (
                        stickers.map((sticker) => {
                          const isOwnSticker = mySticker?._id === sticker._id;
                          const assignedRank = Object.keys(ballot).find(
                            (r) => ballot[r] === sticker._id
                          );

                          // Find next unassigned rank
                          const nextRank = [1, 2, 3].find((r) => !ballot[r]);

                          return (
                            <div
                              key={sticker._id}
                              className={`bg-white rounded-2xl border p-4 shadow-sm flex items-center justify-between gap-4 ${
                                isOwnSticker ? 'border-dashed border-gray-300 opacity-60' : 'border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <img
                                  src={sticker.imageUrl}
                                  alt="Candidate"
                                  className="w-16 h-16 object-contain rounded-lg bg-gray-50 border p-1"
                                />
                                <div>
                                  <h4 className="text-xs font-bold text-gray-900">
                                    "{sticker.title || 'Untitled'}"
                                  </h4>
                                  <span className="text-[11px] text-gray-400 block">
                                    {round.status === 'completed'
                                      ? `by @${sticker.creatorId?.username || 'Hunter'}`
                                      : 'by @anonymous-hunter'}
                                  </span>
                                  {round.status === 'completed' && (
                                    <span className="text-[10px] font-bold text-brand-pink">
                                      {sticker.totalPoints} pts ({sticker.firstPlaceVotes} 🥇, {sticker.secondPlaceVotes} 🥈, {sticker.thirdPlaceVotes} 🥉)
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div>
                                {isOwnSticker ? (
                                  <span className="text-[11px] font-bold text-gray-400 italic">
                                    Your Sticker (Locked)
                                  </span>
                                ) : assignedRank ? (
                                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Assigned #{assignedRank}
                                  </span>
                                ) : nextRank ? (
                                  <button
                                    onClick={() => assignBallot(nextRank, sticker._id)}
                                    className="px-3 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition"
                                  >
                                    Assign #{nextRank}
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">Ballot Full</span>
                                )}
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

        {/* ======================================================== */}
        {/* TAB 4: LEADERBOARD & HALL OF FAME */}
        {/* ======================================================== */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            {/* Sub-nav */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <div className="flex gap-2">
                {[
                  { id: 'standings', label: 'Season Standings' },
                  { id: 'hall-of-fame', label: 'Hall of Fame' },
                  { id: 'roster', label: 'Room & Fair Hunt Roster' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setLeaderboardSubTab(st.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      leaderboardSubTab === st.id
                        ? 'bg-black text-white'
                        : 'text-gray-500 hover:text-black hover:bg-gray-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
              <span className="text-xs font-mono text-gray-400">Auto-syncs every 60s</span>
            </div>

            {/* Sub-tab 1: Season Standings */}
            {leaderboardSubTab === 'standings' && (
              <div className="space-y-6">
                {/* 3 Top Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      TOTAL OUTPUT
                    </span>
                    <div className="text-3xl font-black tracking-tight">
                      {history.reduce((acc, r) => acc + (r.submissionCount || 0), 0) + (round?.submissionCount || 0)}
                      <span className="text-xs font-bold text-emerald-600 ml-2">
                        +{round?.submissionCount || 0} today
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 mt-1 block">
                      Die-cut vinyl stickers snapped & voted
                    </span>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      CURRENT LEADER
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-400 text-white font-bold flex items-center justify-center text-sm shadow">
                        👑
                      </div>
                      <div>
                        <div className="font-extrabold text-base">
                          {leaderboard[0]?.username || 'No leader yet'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {leaderboard[0]?.totalPoints || 0} pts • {leaderboard[0]?.streak || 0}-day streak
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      NEXT TARGET DROP
                    </span>
                    <div className="text-2xl font-black tracking-tight">12:00 AM JST</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">Midnight Random Draw</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase">
                        Fairness Lock: ON
                      </span>
                    </div>
                  </div>
                </div>

                {/* Leaderboard Table */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-extrabold">Club Leaderboard</h3>
                      <p className="text-xs text-gray-500">
                        Daily drops won, candid photo ratings, and active streaks.
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 rounded-full text-gray-600">
                      Season 01 • Week 1
                    </span>
                  </div>

                  <div className="space-y-2">
                    {leaderboard.map((member, idx) => {
                      const isMe = member._id === user?._id || member.username === user?.username;
                      const medals = ['🥇', '🥈', '🥉'];

                      return (
                        <div
                          key={member._id}
                          className={`flex items-center justify-between p-3.5 rounded-xl transition ${
                            isMe
                              ? 'bg-amber-50/50 border-l-4 border-l-black border border-amber-200 shadow-sm'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="w-6 text-center font-bold text-sm">
                              {idx < 3 ? medals[idx] : String(idx + 1).padStart(2, '0')}
                            </span>

                            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-700 text-xs">
                              {member.avatar ? (
                                <img
                                  src={member.avatar}
                                  alt="avatar"
                                  className="w-full h-full object-cover rounded-full"
                                />
                              ) : (
                                member.username[0].toUpperCase()
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 font-extrabold text-sm text-[#1A1A1A]">
                                {member.username}
                                {isMe && (
                                  <span className="px-1.5 py-0.5 bg-black text-white text-[9px] font-black rounded uppercase">
                                    YOU
                                  </span>
                                )}
                                <span className="text-xs text-gray-400 font-normal">
                                  @{member.username.toLowerCase()}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                <span>{member.podiums || 0} Podiums</span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-amber-600 font-semibold">
                                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                                  {member.streak || 0} days streak
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-base font-black tracking-tight">
                              {member.totalPoints || 0}{' '}
                              <span className="text-xs font-normal text-gray-400">pts</span>
                            </div>
                            <span className="text-[11px] text-gray-400 block font-mono">
                              Rank #{member.rank || idx + 1}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 2: Hall of Fame */}
            {leaderboardSubTab === 'hall-of-fame' && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-base font-extrabold mb-1">Past Round Winners</h3>
                <p className="text-xs text-gray-500 mb-6">
                  Winning candid stickers immortalized into the club archive.
                </p>

                {history.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-xs">
                    No completed rounds in this room yet. Finish today's round to crown the first winner!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {history.map((h) => (
                      <div
                        key={h._id}
                        className="bg-gray-50 rounded-xl p-4 border border-gray-200 relative"
                      >
                        <span className="text-[10px] font-mono text-gray-400">
                          ROUND #{h.roundNumber}
                        </span>
                        <h4 className="text-sm font-bold mt-1">"{h.theme}"</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Target: @{h.targetUserId?.username}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 3: Fair Hunt Roster */}
            {leaderboardSubTab === 'roster' && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-base font-extrabold mb-1">Room & Fair Hunt Roster</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Fairness lock tracks target history so no friend is targeted twice before everyone has had their turn.
                </p>

                <div className="space-y-3">
                  {members.map((m) => (
                    <div
                      key={m._id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold">
                          {m.username[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-gray-800">{m.username}</span>
                          <span className="text-gray-400 text-[11px] block">
                            @{m.username.toLowerCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-gray-600 font-semibold">
                          Targeted {m.timesTargeted || 0} times
                        </span>
                        <span className="font-bold text-gray-800">{m.totalPoints || 0} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="mt-12 text-center text-xs text-gray-400 flex flex-wrap items-center justify-center gap-4 px-4">
        <span>STICKR v2.4 • Ephemeral Physicality Engine</span>
        <span>•</span>
        <span>Sync Active: Room #{currentRoom?.code}</span>
        <span>•</span>
        <span>Daily Drop resets at 12:00 AM</span>
      </footer>
    </div>
  );
}
