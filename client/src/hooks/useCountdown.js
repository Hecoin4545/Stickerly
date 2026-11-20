import { useState, useEffect } from 'react';

export function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(targetDate));

  function calcTimeLeft(target) {
    if (!target) return { hours: 0, minutes: 0, seconds: 0, isExpired: true, percentElapsed: 100 };
    const now = Date.now();
    const end = new Date(target).getTime();
    const diff = end - now;
    if (diff <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, isExpired: true, percentElapsed: 100 };
    }
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { hours, minutes, seconds, isExpired: false, percentElapsed: 0 };
  }

  useEffect(() => {
    if (!targetDate) return;
    // Calculate total duration from now for percent
    const startMs = Date.now();
    const endMs = new Date(targetDate).getTime();
    const totalMs = endMs - startMs;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = endMs - now;
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true, percentElapsed: 100 });
        clearInterval(interval);
        return;
      }
      const elapsed = now - startMs;
      const percentElapsed = totalMs > 0 ? Math.min(100, (elapsed / totalMs) * 100) : 0;
      setTimeLeft({
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        isExpired: false,
        percentElapsed,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}
