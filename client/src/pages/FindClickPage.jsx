/**
 * FindClickPage — Find & Click challenge tab component
 * Rendered inside RoomPage when the room mode is 'findclick'
 * OR as a tab within any room (admin can start F&C events)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Camera, Upload, CheckCircle, XCircle, Clock, Trophy,
  Play, ChevronRight, Loader, Image, Video, Zap, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import Avatar from '../components/Avatar';
import api from '../lib/api';

function TimerBar({ endsAt, durationSeconds }) {
  const [pct, setPct] = useState(100);
  const [seconds, setSeconds] = useState(durationSeconds);

  useEffect(() => {
    if (!endsAt) return;
    const end = new Date(endsAt).getTime();
    const start = end - durationSeconds * 1000;

    const update = () => {
      const now = Date.now();
      const remaining = Math.max(0, end - now);
      const total = end - start;
      setPct(Math.max(0, Math.min(100, total > 0 ? (remaining / total) * 100 : 0)));
      setSeconds(Math.ceil(remaining / 1000));
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [endsAt, durationSeconds]);

  const color = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1 text-xs text-gray-500 font-medium">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Time remaining</span>
        <span className={`font-bold text-sm ${pct <= 20 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
          {seconds}s
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full transition-colors ${color}`}
          style={{ width: `${pct}%` }}
          transition={{ type: 'tween', duration: 0.5 }}
        />
      </div>
    </div>
  );
}

function SubmissionResult({ result, onClose }) {
  if (!result) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -20 }}
        className={`p-4 rounded-2xl border-2 ${result.passed ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}
      >
        <div className="flex items-start gap-3">
          {result.passed
            ? <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            : <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />}
          <div>
            <p className="font-bold text-sm">{result.message}</p>
            {result.reason && (
              <p className="text-xs text-gray-600 mt-1">{result.reason}</p>
            )}
            {result.confidence > 0 && (
              <p className="text-xs text-gray-400 mt-1">AI confidence: {result.confidence}%</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-3 text-xs font-semibold text-gray-500 hover:text-gray-700 underline"
        >
          Dismiss
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FindClickPage({ roomId, isAdmin }) {
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Admin setup state
  const [setupFile, setSetupFile] = useState(null);
  const [setupPreview, setSetupPreview] = useState(null);
  const [setupFileType, setSetupFileType] = useState('image');
  const [duration, setDuration] = useState(60);
  const [points, setPoints] = useState(10);
  const setupFileRef = useRef(null);

  // Player submission state
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const photoFileRef = useRef(null);

  // Live update state
  const [liveActivity, setLiveActivity] = useState([]);

  const loadEvent = useCallback(async () => {
    try {
      const res = await api.get(`/findclick/room/${roomId}/current`);
      setEvent(res.data.event);
      setMySubmissions(res.data.mySubmissions || []);
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error('[FindClick] Load error:', err);
      }
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const eventId = event?._id;
  const loadLeaderboard = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await api.get(`/findclick/${eventId}/leaderboard`);
      setLeaderboard(res.data);
    } catch {}
  }, [eventId]);

  useEffect(() => {
    if (roomId) loadEvent();
  }, [roomId, loadEvent]);

  useEffect(() => {
    if (eventId) loadLeaderboard();
  }, [eventId, loadLeaderboard]);

  // Socket real-time updates
  useSocket({
    roomId,
    userId: user?._id,
    onFindClickUpdate: (data) => {
      setEvent(data.event);
    },
    onFindClickChallengeStart: (data) => {
      toast.success(`🔍 Challenge ${data.challengeIndex} started! You have ${data.durationSeconds}s`, { duration: 4000 });
      loadEvent();
    },
    onFindClickSubmission: (data) => {
      const activity = data.passed
        ? `✅ ${data.username} found it!`
        : `❌ ${data.username} tried...`;
      setLiveActivity((prev) => [activity, ...prev].slice(0, 5));
    },
    onFindClickEventComplete: () => {
      toast.success('🏆 All challenges complete!', { duration: 5000 });
      loadEvent();
      loadLeaderboard();
    },
  });

  // ── Admin: Setup ─────────────────────────────────────────────────────────

  const handleSetupFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File must be under 50MB');
      return;
    }
    setSetupFile(file);
    setSetupPreview(URL.createObjectURL(file));
    setSetupFileType(file.type.startsWith('video') ? 'video' : 'image');
    toast.success('Media selected! 📁');
  };

  const handleSetupSubmit = async () => {
    if (!setupFile) {
      toast.error('Please select a video or image first');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('media', setupFile);
      formData.append('roomId', roomId);
      formData.append('challengeDurationSeconds', duration);
      formData.append('pointsPerChallenge', points);

      const res = await api.post('/findclick/setup', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(`🎯 ${res.data.itemCount} challenges extracted by AI!`, { duration: 5000 });
      setEvent(res.data.event);
      setSetupFile(null);
      setSetupPreview(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Setup failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartEvent = async () => {
    if (!event?._id) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/findclick/${event._id}/start`);
      setEvent(res.data.event);
      toast.success('Find & Click event started! 🔍');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start event');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNextChallenge = async () => {
    if (!event?._id) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/findclick/${event._id}/next`);
      setEvent(res.data.event);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not advance');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Player: Submit ─────────────────────────────────────────────────────────

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Photo must be under 25MB');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePhotoSubmit = async () => {
    if (!photoFile) {
      toast.error('Please take or select a photo first');
      return;
    }
    if (!event?._id) return;

    setActionLoading(true);
    setLastResult(null);
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);

      const res = await api.post(`/findclick/${event._id}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setLastResult(res.data);
      setPhotoFile(null);
      setPhotoPreview(null);
      await loadEvent();
      await loadLeaderboard();

      if (res.data.passed) {
        toast.success(res.data.message, { duration: 4000 });
      } else {
        toast.error(res.data.message, { duration: 4000 });
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Submission failed';
      toast.error(errMsg);
      setLastResult({ passed: false, message: errMsg, reason: err.response?.data?.verificationResult?.reason });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const currentChallenge = event?.items?.find((i) => i.index === event?.currentChallengeIndex);
  const myCurrentSubmission = mySubmissions.find((s) => s.challengeIndex === event?.currentChallengeIndex);
  const hasSubmittedCurrent = Boolean(myCurrentSubmission);

  const totalChallenges = event?.items?.length || 0;
  const completedChallenges = event?.items?.filter((i) => i.status === 'completed').length || 0;
  const myPoints = mySubmissions.reduce((sum, s) => sum + (s.pointsAwarded || 0), 0);
  const myPassedCount = mySubmissions.filter((s) => s.verificationResult?.passed).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <Search className="w-5 h-5 text-purple-600" /> Find & Click
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Decode the clue → find it in real life → photograph it!
          </p>
        </div>
        {event && (
          <div className="text-right">
            <span className="text-xs text-gray-400">Your score</span>
            <p className="text-lg font-extrabold text-purple-600">{myPoints} pts</p>
            <p className="text-xs text-gray-400">{myPassedCount}/{totalChallenges} found</p>
          </div>
        )}
      </div>

      {/* ── Progress bar ── */}
      {event && totalChallenges > 0 && (
        <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedChallenges / totalChallenges) * 100}%` }}
          />
        </div>
      )}

      {/* ── Live Activity Feed ── */}
      {liveActivity.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 space-y-1">
          <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">Live Activity</p>
          {liveActivity.map((msg, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-gray-700"
            >
              {msg}
            </motion.p>
          ))}
        </div>
      )}

      {/* ── ADMIN: Setup section (no event yet, or event in setup) ── */}
      {isAdmin && (!event || event.status === 'setup') && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Video className="w-5 h-5 text-purple-600" />
            {event?.status === 'setup' ? 'Event Ready — Start it!' : 'Set Up Find & Click'}
          </h3>

          {event?.status === 'setup' ? (
            /* Event is ready, show extracted items preview */
            <div className="space-y-4">
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-purple-800 mb-2">
                  🤖 AI found {event.items?.length} challenges:
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {event.items?.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="font-bold text-purple-600 w-5 flex-shrink-0">{item.index}.</span>
                      <span className="text-gray-700">{item.clue}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleStartEvent}
                disabled={actionLoading}
                className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Start Event Now!
              </button>
            </div>
          ) : (
            /* Upload form */
            <div className="space-y-4">
              {/* Media upload */}
              <div
                className="border-2 border-dashed border-purple-300 rounded-2xl p-6 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition"
                onClick={() => setupFileRef.current?.click()}
              >
                {setupPreview ? (
                  <div>
                    {setupFileType === 'video' ? (
                      <video src={setupPreview} className="max-h-40 mx-auto rounded-xl" controls />
                    ) : (
                      <img src={setupPreview} alt="Preview" className="max-h-40 mx-auto rounded-xl object-cover" />
                    )}
                    <p className="text-xs text-purple-600 mt-2 font-semibold">Click to change</p>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    <div className="flex justify-center gap-3 mb-3">
                      <Image className="w-8 h-8" />
                      <Video className="w-8 h-8" />
                    </div>
                    <p className="font-semibold text-gray-600">Upload a video or image</p>
                    <p className="text-xs mt-1">AI will extract items for the scavenger hunt</p>
                    <p className="text-xs text-gray-300 mt-1">Max 50MB</p>
                  </div>
                )}
                <input
                  ref={setupFileRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleSetupFileChange}
                />
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    ⏱ Time per challenge (seconds)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={300}
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    🏆 Points per challenge
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={points}
                    onChange={(e) => setPoints(parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <button
                onClick={handleSetupSubmit}
                disabled={actionLoading || !setupFile}
                className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    AI is analyzing media…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Analyze with AI & Create Challenges
                  </>
                )}
              </button>

              {actionLoading && (
                <p className="text-xs text-center text-gray-400 animate-pulse">
                  🤖 Gemini AI is identifying items in your media…
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── EVENT NOT YET STARTED (player view) ── */}
      {!event && !isAdmin && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-500">No Find & Click event yet</h3>
          <p className="text-sm text-gray-400 mt-1">Wait for the admin to set one up!</p>
        </div>
      )}

      {/* ── ACTIVE EVENT ── */}
      {event && event.status === 'active' && (
        <div className="space-y-4">
          {/* Challenge card */}
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full">
                Challenge {event.currentChallengeIndex} of {totalChallenges}
              </span>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${hasSubmittedCurrent ? 'bg-green-400 text-green-900' : 'bg-white/20'}`}>
                {hasSubmittedCurrent ? '✓ Submitted' : 'Active'}
              </span>
            </div>

            <div className="mb-4">
              <p className="text-xs text-white/70 mb-1 uppercase tracking-wider">Your clue</p>
              <p className="text-lg font-bold leading-snug">
                "{currentChallenge?.clue}"
              </p>
            </div>

            {currentChallenge?.endsAt && (
              <TimerBar endsAt={currentChallenge.endsAt} durationSeconds={currentChallenge.durationSeconds} />
            )}
          </div>

          {/* Admin controls */}
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={handleNextChallenge}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                Next Challenge
              </button>
            </div>
          )}

          {/* Player: photo submission */}
          {!isAdmin && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-600" />
                {hasSubmittedCurrent ? 'You already submitted! 🎉' : 'Take a photo of the item'}
              </h4>

              {hasSubmittedCurrent ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">
                      {myCurrentSubmission?.verificationResult?.passed ? '🎯 Correct! Points earned!' : '❌ Not quite right this time'}
                    </p>
                    <p className="text-xs text-green-600">{myCurrentSubmission?.verificationResult?.reason}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Photo preview */}
                  {photoPreview ? (
                    <div className="relative">
                      <img src={photoPreview} alt="Your photo" className="w-full max-h-56 object-cover rounded-xl" />
                      <button
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                        className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => photoFileRef.current?.click()}
                      className="w-full h-36 border-2 border-dashed border-purple-300 rounded-xl flex flex-col items-center justify-center gap-2 text-purple-500 hover:bg-purple-50 transition"
                    >
                      <Camera className="w-7 h-7" />
                      <span className="text-sm font-semibold">Take / Select Photo</span>
                      <span className="text-xs text-gray-400">AI will verify it matches the clue</span>
                    </button>
                  )}
                  <input
                    ref={photoFileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />

                  <button
                    onClick={handlePhotoSubmit}
                    disabled={actionLoading || !photoFile}
                    className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Verifying with AI…
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Submit Photo
                      </>
                    )}
                  </button>

                  {actionLoading && (
                    <div className="text-center space-y-1">
                      <p className="text-xs text-gray-400 animate-pulse">🤖 AI is checking your photo…</p>
                      <p className="text-xs text-gray-300">1. Verifying your face is in the photo</p>
                      <p className="text-xs text-gray-300">2. Verifying the item matches the clue</p>
                    </div>
                  )}
                </>
              )}

              {/* Result card */}
              <SubmissionResult result={lastResult} onClose={() => setLastResult(null)} />
            </div>
          )}
        </div>
      )}

      {/* ── COMPLETED EVENT ── */}
      {event && event.status === 'completed' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-5 text-white text-center shadow-lg">
            <Trophy className="w-10 h-10 mx-auto mb-2" />
            <h3 className="text-xl font-extrabold">Event Complete! 🎉</h3>
            <p className="text-sm text-white/80 mt-1">
              You found {myPassedCount} out of {totalChallenges} items and earned {myPoints} points!
            </p>
          </div>

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> Leaderboard
              </h4>
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div key={entry.userId} className={`flex items-center gap-3 p-2 rounded-xl ${i === 0 ? 'bg-amber-50 border border-amber-200' : ''}`}>
                    <span className="text-sm font-bold w-6 text-center text-gray-400">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <Avatar src={entry.avatar} name={entry.username} size="xs" />
                    <span className="flex-1 text-sm font-semibold">{entry.username}</span>
                    <div className="text-right">
                      <p className="text-sm font-bold">{entry.totalPoints} pts</p>
                      <p className="text-xs text-gray-400">{entry.completedCount} found</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Challenge overview grid ── */}
      {event && event.items?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-600" /> All Challenges
          </h4>
          <div className="space-y-2">
            {event.items.map((item) => {
              const mySubmission = mySubmissions.find((s) => s.challengeIndex === item.index);
              const isActive = item.index === event.currentChallengeIndex && event.status === 'active';
              const isPassed = mySubmission?.verificationResult?.passed;

              return (
                <div
                  key={item.index}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                    isActive
                      ? 'border-purple-400 bg-purple-50'
                      : item.status === 'completed'
                      ? 'border-gray-200 bg-gray-50'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <span className={`text-xs font-bold w-5 flex-shrink-0 mt-0.5 ${isActive ? 'text-purple-600' : 'text-gray-400'}`}>
                    {item.index}.
                  </span>
                  <p className="text-sm text-gray-700 flex-1 leading-snug">{item.clue}</p>
                  <div className="flex-shrink-0">
                    {mySubmission
                      ? isPassed
                        ? <CheckCircle className="w-4 h-4 text-green-500" />
                        : <XCircle className="w-4 h-4 text-red-400" />
                      : isActive
                      ? <span className="text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded font-bold">NOW</span>
                      : item.status === 'pending'
                      ? <Clock className="w-4 h-4 text-gray-300" />
                      : <span className="text-gray-300 text-xs">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Admin: start new event button ── */}
      {isAdmin && event && event.status !== 'active' && event.status !== 'setup' && (
        <button
          onClick={() => setEvent(null)}
          className="w-full py-3 border-2 border-dashed border-purple-300 text-purple-600 font-bold rounded-xl hover:bg-purple-50 transition"
        >
          + Set Up New Find & Click Event
        </button>
      )}
    </div>
  );
}
