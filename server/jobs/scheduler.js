const cron = require('node-cron');
const Room = require('../models/Room');
const Round = require('../models/Round');
const { syncRoundStatus } = require('../services/roundService');

module.exports = (io) => {
  console.log('[Scheduler] Initializing background tasks...');

  // Periodic check (every 30 seconds) for any time-based phase transitions if enabled
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const activeRounds = await Round.find({ status: { $in: ['uploads_open', 'voting_open'] } });
      for (const round of activeRounds) {
        await syncRoundStatus(round._id, io);
      }
    } catch (err) {
      // Quiet background check
    }
  });

  console.log('[Scheduler] Cron jobs active');
};
