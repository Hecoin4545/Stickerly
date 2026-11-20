import { createContext, useContext, useState, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const RoomContext = createContext(null);

export function RoomProvider({ children }) {
  const [currentRoom, setCurrentRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentRound, setCurrentRound] = useState(null);

  const fetchRoom = useCallback(async (roomId) => {
    try {
      const res = await api.get(`/rooms/${roomId}`);
      setCurrentRoom(res.data);
      setMembers(res.data.members || []);
      return res.data;
    } catch (err) {
      toast.error('Failed to load room');
      throw err;
    }
  }, []);

  const refreshRound = useCallback(async (roomId) => {
    if (!roomId) return;
    try {
      const res = await api.get(`/rounds/${roomId}/current`);
      setCurrentRound(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to refresh round', err);
    }
  }, []);

  const joinRoom = async (code) => {
    const res = await api.post('/rooms/join', { code });
    return res.data;
  };

  const createRoom = async (name, mode = 'stickerly') => {
    const res = await api.post('/rooms/create', { name, mode });
    return res.data;
  };

  return (
    <RoomContext.Provider
      value={{
        currentRoom,
        setCurrentRoom,
        fetchRoom,
        joinRoom,
        createRoom,
        members,
        currentRound,
        refreshRound,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within RoomProvider');
  return ctx;
}
