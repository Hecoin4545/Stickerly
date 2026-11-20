const cron = require('node-cron');

// Scheduler is kept minimal since rounds are now admin-driven.
module.exports = (io) => {
  console.log('[Scheduler] Admin-driven mode: no auto-round creation.');
  // Reserved for future periodic cleanup tasks
};
