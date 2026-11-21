/**
 * Socket.io event handlers for Stickerly
 * @param {import('socket.io').Server} io
 */
module.exports = (io) => {
  // Track online members per room: roomId -> Set of socketIds
  const roomOnline = {};

  const getRoomId = (payload) => {
    if (!payload) return null;
    if (typeof payload === 'object') {
      return (payload.roomId || payload.id || '').toString();
    }
    return payload.toString();
  };

  io.on('connection', (socket) => {
    let currentRoomId = null;
    let currentUserId = null;

    // Join a room channel
    socket.on('join-room', (payload) => {
      const roomId = typeof payload === 'object' && payload !== null ? payload.roomId : payload;
      const userId = typeof payload === 'object' && payload !== null ? payload.userId : null;
      if (!roomId) return;

      const rIdStr = roomId.toString();
      if (currentRoomId && currentRoomId !== rIdStr) {
        socket.leave(currentRoomId);
        if (roomOnline[currentRoomId]) {
          roomOnline[currentRoomId].delete(socket.id);
        }
      }

      socket.join(rIdStr);
      currentRoomId = rIdStr;
      if (userId) {
        currentUserId = userId.toString();
      }

      if (!roomOnline[currentRoomId]) roomOnline[currentRoomId] = new Set();
      roomOnline[currentRoomId].add(socket.id);

      if (currentUserId) {
        socket.to(currentRoomId).emit('member-online', { userId: currentUserId, socketId: socket.id });
      }
    });

    // Leave a room channel
    socket.on('leave-room', (payload) => {
      const roomId = getRoomId(payload);
      if (!roomId) return;
      socket.leave(roomId);
      if (roomOnline[roomId]) {
        roomOnline[roomId].delete(socket.id);
      }
      if (currentRoomId === roomId) {
        currentRoomId = null;
      }
    });

    // New sticker submission — broadcast updated count to room
    socket.on('new-submission', (payload = {}) => {
      const roomId = getRoomId(payload) || currentRoomId;
      if (roomId) {
        io.to(roomId).emit('submission-update', { submittedCount: payload?.submittedCount });
      }
    });

    // Voting phase opened
    socket.on('voting-opened', (payload = {}) => {
      const roomId = getRoomId(payload) || currentRoomId;
      if (roomId) {
        io.to(roomId).emit('phase-change', { phase: 'voting_open' });
      }
    });

    // Round completed — emit results to room
    socket.on('round-completed', (payload = {}) => {
      const roomId = getRoomId(payload) || currentRoomId;
      if (roomId) {
        io.to(roomId).emit('round-results', payload?.results || payload);
      }
    });

    // Find & Click: admin requests challenge advance (can also be timer-driven from server)
    socket.on('findclick-advance', (payload = {}) => {
      const roomId = getRoomId(payload) || currentRoomId;
      if (roomId) {
        io.to(roomId).emit('findclick-advance-requested', {});
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (currentRoomId) {
        if (roomOnline[currentRoomId]) {
          roomOnline[currentRoomId].delete(socket.id);
        }
        if (currentUserId) {
          socket.to(currentRoomId).emit('member-offline', {
            userId: currentUserId,
            socketId: socket.id,
          });
        }
      }
    });
  });
};
