import { useEffect, useRef } from 'react';
import { socket } from '../lib/socket';

let activeSubscribers = 0;

export function useSocket({
  roomId,
  userId,
  onPhaseChange,
  onSubmissionUpdate,
  onRoundResults,
  // Find & Click events
  onFindClickUpdate,
  onFindClickChallengeStart,
  onFindClickSubmission,
  onFindClickEventComplete,
}) {
  const callbacksRef = useRef({});

  useEffect(() => {
    callbacksRef.current = {
      onPhaseChange,
      onSubmissionUpdate,
      onRoundResults,
      onFindClickUpdate,
      onFindClickChallengeStart,
      onFindClickSubmission,
      onFindClickEventComplete,
    };
  });

  useEffect(() => {
    activeSubscribers += 1;
    if (!socket.connected) {
      socket.connect();
    }

    if (roomId) {
      socket.emit('join-room', { roomId, userId });
    }

    const handlePhaseChange = (...args) => callbacksRef.current.onPhaseChange?.(...args);
    const handleSubmissionUpdate = (...args) => callbacksRef.current.onSubmissionUpdate?.(...args);
    const handleRoundResults = (...args) => callbacksRef.current.onRoundResults?.(...args);
    const handleFindClickUpdate = (...args) => callbacksRef.current.onFindClickUpdate?.(...args);
    const handleFindClickChallengeStart = (...args) => callbacksRef.current.onFindClickChallengeStart?.(...args);
    const handleFindClickSubmission = (...args) => callbacksRef.current.onFindClickSubmission?.(...args);
    const handleFindClickEventComplete = (...args) => callbacksRef.current.onFindClickEventComplete?.(...args);

    socket.on('phase-change', handlePhaseChange);
    socket.on('submission-update', handleSubmissionUpdate);
    socket.on('round-results', handleRoundResults);
    socket.on('findclick-update', handleFindClickUpdate);
    socket.on('findclick-challenge-start', handleFindClickChallengeStart);
    socket.on('findclick-submission', handleFindClickSubmission);
    socket.on('findclick-event-complete', handleFindClickEventComplete);

    return () => {
      activeSubscribers = Math.max(0, activeSubscribers - 1);

      socket.off('phase-change', handlePhaseChange);
      socket.off('submission-update', handleSubmissionUpdate);
      socket.off('round-results', handleRoundResults);
      socket.off('findclick-update', handleFindClickUpdate);
      socket.off('findclick-challenge-start', handleFindClickChallengeStart);
      socket.off('findclick-submission', handleFindClickSubmission);
      socket.off('findclick-event-complete', handleFindClickEventComplete);

      if (roomId) {
        socket.emit('leave-room', { roomId });
      }

      if (activeSubscribers === 0) {
        socket.disconnect();
      }
    };
  }, [roomId, userId]);

  return socket;
}
