const Room = require('../models/Room');
const Round = require('../models/Round');
const Sticker = require('../models/Sticker');
const Vote = require('../models/Vote');
const User = require('../models/User');

const setTime = (date, h, m, s, ms = 0) => {
  const d = new Date(date);
  d.setHours(h, m, s, ms);
  return d;
};

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Returns array of member ID strings eligible to submit stickers.
<<<<<<< HEAD
 */
function getEligibleHunters(room, round) {
  const members = (room.members || []).map((m) => (m._id || m).toString());
  return [...new Set(members)];
=======
 * Solo room: the single member.
 * Multi-member room: all members except target.
 */
function getEligibleHunters(room, round) {
  const targetIdStr = (round.targetUserId?._id || round.targetUserId)?.toString();
  const members = (room.members || []).map((m) => (m._id || m).toString());
  const uniqueMembers = [...new Set(members)];

  if (uniqueMembers.length <= 1) {
    return uniqueMembers;
  }
  return uniqueMembers.filter((id) => id !== targetIdStr);
>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
}

/**
 * Returns array of member ID strings eligible to vote.
<<<<<<< HEAD
=======
 * Multi-member room: any member who has at least one candidate sticker not created by themselves.
 * Solo room: the solo member if at least one sticker exists.
>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
 */
async function getEligibleVoters(room, round) {
  const members = (room.members || []).map((m) => (m._id || m).toString());
  const uniqueMembers = [...new Set(members)];
<<<<<<< HEAD
  const stickers = await Sticker.find({ roundId: round._id });
  if (stickers.length === 0) return [];
  if (uniqueMembers.length <= 1) return uniqueMembers;
=======
  const isSoloRoom = uniqueMembers.length <= 1;

  const stickers = await Sticker.find({ roundId: round._id });
  if (stickers.length === 0) return [];

  if (isSoloRoom) {
    return uniqueMembers;
  }

>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
  return uniqueMembers.filter((memberId) =>
    stickers.some((s) => s.creatorId.toString() !== memberId)
  );
}

/**
<<<<<<< HEAD
 * Complete a round: tally points, award to users, set status to completed.
=======
 * Complete a round: tally points, award to users, update streaks, set status to completed.
>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
 */
async function completeRound(roundId, io) {
  const round = await Round.findById(roundId);
  if (!round || round.status === 'completed') return round;

  const votes = await Vote.find({ roundId: round._id });
<<<<<<< HEAD
  const pointsMap = {};
=======
  const pointsMap = {}; // stickerId -> { first, second, third, total }
>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82

  for (const vote of votes) {
    for (const entry of vote.ballot) {
      const sid = entry.stickerId.toString();
      if (!pointsMap[sid]) {
        pointsMap[sid] = { first: 0, second: 0, third: 0, total: 0 };
      }
      if (entry.rank === 1) {
        pointsMap[sid].first += 1;
        pointsMap[sid].total += 5;
      } else if (entry.rank === 2) {
        pointsMap[sid].second += 1;
        pointsMap[sid].total += 3;
      } else if (entry.rank === 3) {
        pointsMap[sid].third += 1;
        pointsMap[sid].total += 1;
      }
    }
  }

  const stickers = await Sticker.find({ roundId: round._id });
  const sortedStickers = stickers
    .map((s) => {
      const pts = pointsMap[s._id.toString()] || { first: 0, second: 0, third: 0, total: 0 };
      return { sticker: s, ...pts };
    })
    .sort((a, b) => b.total - a.total);

  const submitterIds = new Set(stickers.map((s) => s.creatorId.toString()));
  const room = await Room.findById(round.roomId).populate('members', '_id');
  const allMemberIds = room ? room.members.map((m) => m._id.toString()) : [];

  for (let i = 0; i < sortedStickers.length; i++) {
    const { sticker, first, second, third, total } = sortedStickers[i];
    const finalRank = i + 1;
    const submissionBonus = 2;
    const pointsAwarded = total + submissionBonus;

    await Sticker.findByIdAndUpdate(sticker._id, {
      firstPlaceVotes: first,
      secondPlaceVotes: second,
      thirdPlaceVotes: third,
      totalPoints: total,
      finalRank,
    });

    await User.findByIdAndUpdate(sticker.creatorId, {
      $inc: { totalPoints: pointsAwarded, ...(finalRank <= 3 ? { podiums: 1 } : {}) },
    });
  }

  // Update streaks
  for (const memberId of allMemberIds) {
    if (submitterIds.has(memberId)) {
      const user = await User.findById(memberId);
      const newStreak = (user?.streak || 0) + 1;
      const newLongest = Math.max(newStreak, user?.longestStreak || 0);
      await User.findByIdAndUpdate(memberId, {
        streak: newStreak,
        longestStreak: newLongest,
      });
    } else {
<<<<<<< HEAD
      await User.findByIdAndUpdate(memberId, { streak: 0 });
=======
      const targetIdStr = (round.targetUserId?._id || round.targetUserId)?.toString();
      const isTarget = targetIdStr === memberId;
      if (!isTarget) {
        await User.findByIdAndUpdate(memberId, { streak: 0 });
      }
>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
    }
  }

  round.status = 'completed';
  await round.save();

  if (io) {
    io.to(round.roomId.toString()).emit('round-results', {
      roundId: round._id,
      roomId: round.roomId,
    });
    io.to(round.roomId.toString()).emit('phase-change', { phase: 'completed' });
  }

  return round;
}

/**
<<<<<<< HEAD
 * Sync round status - kept for backward compatibility but mainly admin-driven now.
=======
 * Checks round deadlines and participant actions to transition phases:
 * - Hunt -> Voting (if all eligible hunters submitted before 10 PM OR regular time reached >= 10 PM)
 * - Voting -> Completed (if all eligible voters submitted ballots OR regular time reached >= votingEnd)
>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
 */
async function syncRoundStatus(roundId, io) {
  let round = await Round.findById(roundId);
  if (!round) return null;
  if (round.status === 'completed') return round;
<<<<<<< HEAD
  // Admin-driven phases don't auto-transition, return as-is
=======

  const room = await Room.findById(round.roomId);
  if (!room) return round;

  const now = new Date();

  if (round.status === 'hunt') {
    const eligibleHunters = getEligibleHunters(room, round);
    const stickers = await Sticker.find({ roundId: round._id });
    const uploaderIds = new Set(stickers.map((s) => s.creatorId.toString()));

    const allUploaded =
      eligibleHunters.length > 0 &&
      eligibleHunters.every((id) => uploaderIds.has(id));

    const isPast10PM = round.huntDeadline && now >= new Date(round.huntDeadline);

    if (allUploaded || isPast10PM) {
      round.status = 'voting';
      round.votingStart = now;
      await round.save();

      if (io) {
        io.to(room._id.toString()).emit('phase-change', { phase: 'voting' });
      }
    }
  }

  if (round.status === 'voting') {
    const eligibleVoters = await getEligibleVoters(room, round);
    const votes = await Vote.find({ roundId: round._id });
    const voterIds = new Set(votes.map((v) => v.voterId.toString()));

    const allVoted =
      eligibleVoters.length > 0 &&
      eligibleVoters.every((id) => voterIds.has(id));

    const isPastVotingEnd = round.votingEnd && now >= new Date(round.votingEnd);

    if (allVoted || isPastVotingEnd) {
      round = await completeRound(round._id, io);
    }
  }

>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
  return round;
}

/**
<<<<<<< HEAD
 * Start a new round for a room (legacy helper).
=======
 * Start a new round for a room.
>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
 */
async function createRoundForRoom(roomId) {
  const room = await Room.findById(roomId).populate('members');
  if (!room) throw new Error('Room not found');
  if (!room.members || room.members.length < 1) {
    throw new Error('Need at least 1 member to start a round');
  }

<<<<<<< HEAD
=======
  // Pick target (excluding recentTargets if fairnessLock is on and members > 1)
  let eligible = room.members;
  if (room.fairnessLock && room.recentTargets.length > 0 && room.members.length > 1) {
    const recentIds = room.recentTargets.map((id) => id.toString());
    const filtered = room.members.filter((m) => !recentIds.includes(m._id.toString()));
    if (filtered.length > 0) eligible = filtered;
  }
  const target = randomFrom(eligible);

  // Pick unused theme
>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
  const usedRounds = await Round.find({ roomId: room._id }).select('theme');
  const usedThemes = usedRounds.map((r) => r.theme);
  const availableThemes = Round.THEMES.filter((t) => !usedThemes.includes(t));
  const themePool = availableThemes.length > 0 ? availableThemes : Round.THEMES;
  const theme = randomFrom(themePool);

<<<<<<< HEAD
=======
  const now = new Date();
  const huntStart = now;
  let huntDeadline = setTime(now, 22, 0, 0);
  if (huntDeadline <= now) {
    huntDeadline.setDate(huntDeadline.getDate() + 1);
  }
  const votingStart = new Date(huntDeadline);
  const votingEnd = new Date(huntDeadline);
  votingEnd.setHours(23, 59, 59, 999);

>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
  const roundNumber = (room.totalRounds || 0) + 1;

  const round = await Round.create({
    roomId: room._id,
<<<<<<< HEAD
    mode: room.mode || 'stickerly',
    roundNumber,
    theme,
    status: 'uploads_open',
    participantCount: room.members.length,
    huntStart: new Date(),
  });

  await Room.findByIdAndUpdate(room._id, {
    currentRoundId: round._id,
    $inc: { totalRounds: 1 },
  });

=======
    roundNumber,
    theme,
    targetUserId: target._id,
    huntStart,
    huntDeadline,
    votingStart,
    votingEnd,
    status: 'hunt',
    participantCount: room.members.length,
  });

  let recentTargets = [...room.recentTargets.map((id) => id.toString())];
  recentTargets.push(target._id.toString());
  if (recentTargets.length > 3) recentTargets = recentTargets.slice(-3);

  await Room.findByIdAndUpdate(room._id, {
    currentRoundId: round._id,
    recentTargets,
    $inc: { totalRounds: 1 },
  });

  await User.findByIdAndUpdate(target._id, { $inc: { timesTargeted: 1 } });

>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
  return round;
}

module.exports = {
  setTime,
  getEligibleHunters,
  getEligibleVoters,
  completeRound,
  syncRoundStatus,
  createRoundForRoom,
};
