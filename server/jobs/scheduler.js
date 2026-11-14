const cron = require('node-cron');
const Room = require('../models/Room');
const Round = require('../models/Round');
const Sticker = require('../models/Sticker');
const Vote = require('../models/Vote');
const User = require('../models/User');

// Helper: pick a random element from array
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper: set time on a date object (returns new Date)
const setTime = (date, h, m, s) => {
  const d = new Date(date);
  d.setHours(h, m, s, 0);
  return d;
};

/**
 * JOB 1 — Midnight: Create new rounds for active rooms
 */
cron.schedule('0 0 * * *', async () => {
  console.log('[Scheduler] Creating new rounds...');
  try {
    const rooms = await Room.find({ isActive: true }).populate('members');

    for (const room of rooms) {
      if (room.members.length < 2) continue;

      // Pick target (excluding recentTargets if fairnessLock)
      let eligibleMembers = room.members;
      if (room.fairnessLock && room.recentTargets.length > 0) {
        const recentIds = room.recentTargets.map((id) => id.toString());
        const filtered = room.members.filter((m) => !recentIds.includes(m._id.toString()));
        if (filtered.length > 0) eligibleMembers = filtered;
      }
      const target = randomFrom(eligibleMembers);

      // Pick unused theme
      const usedRounds = await Round.find({ roomId: room._id }).select('theme');
      const usedThemes = usedRounds.map((r) => r.theme);
      const availableThemes = Round.THEMES.filter((t) => !usedThemes.includes(t));
      const themePool = availableThemes.length > 0 ? availableThemes : Round.THEMES;
      const theme = randomFrom(themePool);

      const now = new Date();
      const huntStart = now;
      const huntDeadline = setTime(now, 22, 0, 0);
      const votingStart = setTime(now, 22, 0, 0);
      const votingEnd = setTime(now, 23, 59, 59);

      const roundNumber = room.totalRounds + 1;

      const round = await Round.create({
        roomId: room._id,
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

      // Update recentTargets (keep last 3)
      let recentTargets = [...room.recentTargets.map((id) => id.toString())];
      recentTargets.push(target._id.toString());
      if (recentTargets.length > 3) recentTargets = recentTargets.slice(-3);

      await Room.findByIdAndUpdate(room._id, {
        currentRoundId: round._id,
        recentTargets,
        $inc: { totalRounds: 1 },
      });

      await User.findByIdAndUpdate(target._id, { $inc: { timesTargeted: 1 } });

      console.log(`[Scheduler] New round for room ${room.name}: target=${target.username}, theme="${theme}"`);
    }
  } catch (err) {
    console.error('[Scheduler] Error creating rounds:', err);
  }
});

/**
 * JOB 2 — 22:00: Open voting for rounds past huntDeadline
 */
cron.schedule('0 22 * * *', async () => {
  console.log('[Scheduler] Opening voting phase...');
  try {
    const now = new Date();
    const result = await Round.updateMany(
      { status: 'hunt', huntDeadline: { $lte: now } },
      { $set: { status: 'voting' } }
    );
    console.log(`[Scheduler] Voting opened for ${result.modifiedCount} round(s)`);
  } catch (err) {
    console.error('[Scheduler] Error opening voting:', err);
  }
});

/**
 * JOB 3 — 23:59: Tally votes and complete rounds
 */
cron.schedule('59 23 * * *', async () => {
  console.log('[Scheduler] Tallying votes...');
  try {
    const rounds = await Round.find({ status: 'voting' });

    for (const round of rounds) {
      // Aggregate vote points per sticker
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

      // Update stickers with vote counts
      const stickers = await Sticker.find({ roundId: round._id });
      const sortedStickers = stickers
        .map((s) => {
          const pts = pointsMap[s._id.toString()] || { first: 0, second: 0, third: 0, total: 0 };
          return { sticker: s, ...pts };
        })
        .sort((a, b) => b.total - a.total);

      // Get submitters (creatorIds who uploaded)
      const submitterIds = new Set(stickers.map((s) => s.creatorId.toString()));

      // Get all room members for streak reset
      const room = await Room.findById(round.roomId).populate('members', '_id');
      const allMemberIds = room ? room.members.map((m) => m._id.toString()) : [];

      for (let i = 0; i < sortedStickers.length; i++) {
        const { sticker, first, second, third, total } = sortedStickers[i];
        const finalRank = i + 1;
        const isEarlyBird = sticker.isEarlyBird;

        const submissionBonus = 2;
        const pointsAwarded = total + submissionBonus;

        await Sticker.findByIdAndUpdate(sticker._id, {
          firstPlaceVotes: first,
          secondPlaceVotes: second,
          thirdPlaceVotes: third,
          totalPoints: total,
          finalRank,
        });

        // Award points to creator
        await User.findByIdAndUpdate(sticker.creatorId, {
          $inc: { totalPoints: pointsAwarded },
        });

        // Podium for top 3
        if (finalRank <= 3) {
          await User.findByIdAndUpdate(sticker.creatorId, { $inc: { podiums: 1 } });
        }
      }

      // Update streaks
      for (const memberId of allMemberIds) {
        if (submitterIds.has(memberId)) {
          // Increment streak
          const user = await User.findById(memberId);
          const newStreak = (user.streak || 0) + 1;
          const newLongest = Math.max(newStreak, user.longestStreak || 0);
          await User.findByIdAndUpdate(memberId, {
            streak: newStreak,
            longestStreak: newLongest,
          });
        } else {
          // Reset streak for non-submitters (excluding target)
          const isTarget = round.targetUserId.toString() === memberId;
          if (!isTarget) {
            await User.findByIdAndUpdate(memberId, { streak: 0 });
          }
        }
      }

      await Round.findByIdAndUpdate(round._id, { status: 'completed' });
      console.log(`[Scheduler] Round ${round._id} completed`);
    }
  } catch (err) {
    console.error('[Scheduler] Error tallying votes:', err);
  }
});

console.log('[Scheduler] Cron jobs registered');
