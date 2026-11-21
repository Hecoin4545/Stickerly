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
 * Challenges mode: ALL members (everyone shoots their own poses).
 * Stickerly mode: all members (everyone can capture the target).
 */
function getEligibleHunters(room, round) {
  const members = (room.members || []).map((m) => (m._id || m).toString());
  return [...new Set(members)];
}

/**
 * Returns array of member ID strings eligible to vote.
 */
async function getEligibleVoters(room, round) {
  const members = (room.members || []).map((m) => (m._id || m).toString());
  const uniqueMembers = [...new Set(members)];
  const isSoloRoom = uniqueMembers.length <= 1;

  const stickers = await Sticker.find({ roundId: round._id });
  if (stickers.length === 0) return [];

  if (isSoloRoom) {
    return uniqueMembers;
  }

  return uniqueMembers.filter((memberId) =>
    stickers.some((s) => s.creatorId.toString() !== memberId)
  );
}

/**
 * Complete a round: tally points, award to users, update streaks, set status to completed.
 */
async function completeRound(roundId, io) {
  const round = await Round.findById(roundId);
  if (!round || round.status === 'completed') return round;

  const votes = await Vote.find({ roundId: round._id });
  const pointsMap = {}; // stickerId -> { first, second, third, total }

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
      await User.findByIdAndUpdate(memberId, { streak: 0 });
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
 * Sync round status based on admin-driven phases (admin controls when to close uploads/voting).
 */
async function syncRoundStatus(roundId, io) {
  let round = await Round.findById(roundId);
  if (!round) return null;
  if (round.status === 'completed') return round;
  // Admin-driven — do not auto-transition; return as-is
  return round;
}

/**
 * Start a new round for a room.
 * For challenges mode, randomly picks target from members.
 */
async function createRoundForRoom(roomId, options = {}) {
  const room = await Room.findById(roomId).populate('members');
  if (!room) throw new Error('Room not found');
  if (!room.members || room.members.length < 1) {
    throw new Error('Need at least 1 member to start a round');
  }

  const usedRounds = await Round.find({ roomId: room._id }).select('theme');
  const usedThemes = usedRounds.map((r) => r.theme);
  const availableThemes = Round.THEMES.filter((t) => !usedThemes.includes(t));
  const themePool = availableThemes.length > 0 ? availableThemes : Round.THEMES;
  const theme = randomFrom(themePool);

  const roundNumber = (room.totalRounds || 0) + 1;
  const mode = room.mode || 'stickerly';

  const roundData = {
    roomId: room._id,
    mode,
    roundNumber,
    theme,
    status: 'uploads_open',
    participantCount: room.members.length,
    huntStart: new Date(),
  };

  // For challenges mode, randomly pick a target from members
  if (mode === 'challenges' || options.pickTarget) {
    const target = randomFrom(room.members);
    roundData.targetUserId = target._id;
    if (options.topic) {
      roundData.adminTopic = options.topic;
    }
    if (options.challenges) {
      roundData.challenges = options.challenges;
    }
    await User.findByIdAndUpdate(target._id, { $inc: { timesTargeted: 1 } });
  }

  const round = await Round.create(roundData);

  await Room.findByIdAndUpdate(room._id, {
    currentRoundId: round._id,
    $inc: { totalRounds: 1 },
  });

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
