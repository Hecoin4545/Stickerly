import { useEffect } from 'react';
import { socket } from '../lib/socket';

export function useSocket({ roomId, onPhaseChange, onSubmissionUpdate, onRoundResults }) {
  useEffect(() => {
    socket.connect();

    if (roomId) {
<<<<<<< HEAD
      socket.emit('join-room', { roomId });
=======
      socket.emit('join-room', roomId);
>>>>>>> 14a570bf930b6710cbade25b5a2454cb15847d82
    }

    if (onPhaseChange) socket.on('phase-change', onPhaseChange);
    if (onSubmissionUpdate) socket.on('submission-update', onSubmissionUpdate);
    if (onRoundResults) socket.on('round-results', onRoundResults);

    return () => {
      if (onPhaseChange) socket.off('phase-change', onPhaseChange);
      if (onSubmissionUpdate) socket.off('submission-update', onSubmissionUpdate);
      if (onRoundResults) socket.off('round-results', onRoundResults);
      socket.disconnect();
    };
  }, [roomId, onPhaseChange, onSubmissionUpdate, onRoundResults]);

  return socket;
}
