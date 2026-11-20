const cron = require('node-cron');
<<<<<<< HEAD

// Scheduler is kept minimal since rounds are now admin-driven.
module.exports = (io) => {
  console.log('[Scheduler] Admin-driven mode: no auto-round creation.');
  // Reserved for future periodic cleanup tasks
=======
const Room = require('../models/Room');
const Round = require('../models/Round');
const {
  createRoundForRoom,
  syncRoundStatus,
  completeRound,
} = require('../services/roundService');

module.exports = (io) => {
  /**
   * JOB 1 — Midnight: Create new rounds for active rooms
   */
  cron.schedule('0 0 * * *', async () => {
    console.log('[Scheduler] Midnight: Creating new rounds...');
    try {
      const rooms = await Room.find({ isActive: true });
      for (const room of rooms) {
        if (!room.members || room.members.length < 2) continue;
        try {
          const round = await createRoundForRoom(room._id);
          console.log(`[Scheduler] New round #${round.roundNumber} for room ${room.name}`);
          if (io) {
            io.to(room._id.toString()).emit('phase-change', { phase: 'hunt' });
          }
        } catch (err) {
          console.error(`[Scheduler] Failed to create round for room ${room._id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error creating rounds:', err);
    }
  });

  /**
   * JOB 2 — 22:00: Open voting for rounds past huntDeadline
   */
  cron.schedule('0 22 * * *', async () => {
    console.log('[Scheduler] 22:00: Checking hunt deadlines and opening voting...');
    try {
      const activeRooms = await Room.find({ isActive: true, currentRoundId: { $ne: null } });
      for (const room of activeRooms) {
        await syncRoundStatus(room.currentRoundId, io);
      }
    } catch (err) {
      console.error('[Scheduler] Error opening voting:', err);
    }
  });

  /**
   * JOB 3 — 23:59: Tally votes and complete rounds
   */
  cron.schedule('59 23 * * *', async () => {
    console.log('[Scheduler] 23:59: Tallying votes and completing rounds...');
    try {
      const votingRounds = await Round.find({ status: 'voting' });
      for (const round of votingRounds) {
        await completeRound(round._id, io);
      }
    } catch (err) {
      console.error('[Scheduler] Error completing rounds at midnight:', err);
    }
  });

  /**
   * Periodic check (every 30 seconds):
   * Ensures seamless transition if deadline or all votes/submissions happen
   */
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const rounds = await Round.find({ status: { $in: ['hunt', 'voting'] } });
      for (const round of rounds) {
        await syncRoundStatus(round._id, io);
      }
    } catch (err) {
      // Quiet background check
    }
  });

  console.log('[Scheduler] Cron jobs registered');
>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
};
