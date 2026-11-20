/**
 * Socket.io event handlers for Stickerly
 * @param {import('socket.io').Server} io
 */
module.exports = (io) => {
  // Track online members per room: roomId -> Set of socketIds
  const roomOnline = {};

  io.on('connection', (socket) => {
    let currentRoomId = null;
    let currentUserId = null;

    // Join a room channel
<<<<<<< HEAD
    socket.on('join-room', (payload) => {
      const roomId = typeof payload === 'object' && payload !== null ? payload.roomId : payload;
      const userId = typeof payload === 'object' && payload !== null ? payload.userId : null;
      if (!roomId) return;

      socket.join(roomId.toString());
      currentRoomId = roomId.toString();
      currentUserId = userId;

      if (!roomOnline[currentRoomId]) roomOnline[currentRoomId] = new Set();
      roomOnline[currentRoomId].add(socket.id);

      if (userId) {
        socket.to(currentRoomId).emit('member-online', { userId, socketId: socket.id });
      }
    });

    // Leave a room channel
    socket.on('leave-room', (payload) => {
      const roomId = typeof payload === 'object' && payload !== null ? payload.roomId : payload;
      if (!roomId) return;
      socket.leave(roomId.toString());
      if (roomOnline[roomId.toString()]) {
        roomOnline[roomId.toString()].delete(socket.id);
=======
    socket.on('join-room', ({ roomId, userId }) => {
      socket.join(roomId);
      currentRoomId = roomId;
      currentUserId = userId;

      if (!roomOnline[roomId]) roomOnline[roomId] = new Set();
      roomOnline[roomId].add(socket.id);

      socket.to(roomId).emit('member-online', { userId, socketId: socket.id });
    });

    // Leave a room channel
    socket.on('leave-room', ({ roomId }) => {
      socket.leave(roomId);
      if (roomOnline[roomId]) {
        roomOnline[roomId].delete(socket.id);
>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
      }
    });

    // New sticker submission — broadcast updated count to room
    socket.on('new-submission', ({ roomId, submittedCount }) => {
      io.to(roomId).emit('submission-update', { submittedCount });
    });

    // Voting phase opened
    socket.on('voting-opened', ({ roomId }) => {
      io.to(roomId).emit('phase-change', { phase: 'voting' });
    });

    // Round completed — emit results to room
    socket.on('round-completed', ({ roomId, results }) => {
      io.to(roomId).emit('round-results', results);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (currentRoomId) {
        if (roomOnline[currentRoomId]) {
          roomOnline[currentRoomId].delete(socket.id);
        }
        socket.to(currentRoomId).emit('member-offline', {
          userId: currentUserId,
          socketId: socket.id,
        });
      }
    });
  });
};
