import { useEffect } from 'react';
import { socket } from '../lib/socket';

export function useSocket({ roomId, onPhaseChange, onSubmissionUpdate, onRoundResults }) {
  useEffect(() => {
    socket.connect();

    if (roomId) {
      socket.emit('join-room', { roomId });
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
