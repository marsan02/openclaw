import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const FIBONACCI = ['1', '2', '3', '5', '8', '13', '21', '?'];

export default function PlanningPoker() {
  const [socket, setSocket] = useState(null);
  const [screen, setScreen] = useState('home'); // home, lobby, room
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [roomState, setRoomState] = useState(null);
  const [selectedVote, setSelectedVote] = useState(null);
  const [taskInput, setTaskInput] = useState('');

  useEffect(() => {
    const s = io();
    setSocket(s);

    s.on('room-created', ({ roomCode }) => {
      setRoomCode(roomCode);
      setScreen('room');
    });

    s.on('room-joined', ({ roomCode }) => {
      setRoomCode(roomCode);
      setScreen('room');
    });

    s.on('room-state', (state) => {
      setRoomState(state);
      // Reset selected vote if votes were cleared
      if (!state.revealed && state.participants.every(p => !p.hasVoted)) {
        setSelectedVote(null);
      }
    });

    s.on('error', ({ message }) => {
      setError(message);
    });

    // Check URL for room code
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom) {
      setJoinCode(urlRoom.toUpperCase());
      setScreen('lobby');
    }

    return () => s.disconnect();
  }, []);

  const createRoom = useCallback(() => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setError('');
    socket?.emit('create-room', { name: name.trim() });
  }, [socket, name]);

  const joinRoom = useCallback(() => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!joinCode.trim()) {
      setError('Please enter room code');
      return;
    }
    setError('');
    socket?.emit('join-room', { roomCode: joinCode.toUpperCase(), name: name.trim() });
  }, [socket, name, joinCode]);

  const setTask = useCallback(() => {
    if (!taskInput.trim()) return;
    socket?.emit('set-task', { task: taskInput.trim() });
    setTaskInput('');
  }, [socket, taskInput]);

  const vote = useCallback((value) => {
    setSelectedVote(value);
    socket?.emit('vote', { value });
  }, [socket]);

  const reveal = useCallback(() => {
    socket?.emit('reveal');
  }, [socket]);

  const nextTask = useCallback(() => {
    socket?.emit('next-task');
    setSelectedVote(null);
  }, [socket]);

  const copyLink = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(url);
  }, [roomCode]);

  const isHost = roomState?.hostId === socket?.id;
  const myVote = roomState?.participants?.find(p => p.id === socket?.id);

  // Calculate average (excluding ?)
  const getAverage = () => {
    if (!roomState?.revealed) return null;
    const numericVotes = roomState.participants
      .map(p => p.vote)
      .filter(v => v && v !== '?')
      .map(Number);
    if (numericVotes.length === 0) return null;
    return (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1);
  };

  // Home screen
  if (screen === 'home') {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🃏</div>
            <h1 className="text-2xl font-bold text-gray-900">Planning Poker</h1>
            <p className="text-gray-600 mt-2">Real-time estimation for agile teams</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}

            <button
              onClick={createRoom}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Create New Room
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or join existing</span>
              </div>
            </div>

            <button
              onClick={() => setScreen('lobby')}
              className="w-full bg-gray-100 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Lobby screen (join room)
  if (screen === 'lobby') {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <button
            onClick={() => setScreen('home')}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-1"
          >
            ← Back
          </button>

          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🚪</div>
            <h1 className="text-xl font-bold text-gray-900">Join Room</h1>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase tracking-widest text-center text-xl font-mono"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}

            <button
              onClick={joinRoom}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Room screen
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🃏</span>
            <div>
              <div className="text-sm text-gray-500">Room Code</div>
              <div className="font-mono text-xl font-bold text-gray-900">{roomCode}</div>
            </div>
          </div>
          <button
            onClick={copyLink}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            📋 Copy Link
          </button>
        </div>
      </div>

      {/* Current Task */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
        {isHost && !roomState?.currentTask && (
          <div className="flex gap-2">
            <input
              type="text"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setTask()}
              placeholder="Enter task to estimate..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={setTask}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Start
            </button>
          </div>
        )}

        {roomState?.currentTask && (
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Estimating</div>
            <div className="text-2xl font-bold text-gray-900">{roomState.currentTask}</div>
          </div>
        )}

        {!isHost && !roomState?.currentTask && (
          <div className="text-center text-gray-500 py-4">
            Waiting for host to set a task...
          </div>
        )}
      </div>

      {/* Voting Cards */}
      {roomState?.currentTask && !roomState?.revealed && (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <div className="text-sm text-gray-600 mb-4 text-center">Select your estimate</div>
          <div className="flex flex-wrap justify-center gap-3">
            {FIBONACCI.map((value) => (
              <button
                key={value}
                onClick={() => vote(value)}
                className={`w-16 h-24 rounded-xl text-2xl font-bold transition-all ${
                  selectedVote === value
                    ? 'bg-indigo-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {roomState?.revealed && (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <div className="text-center mb-4">
            <div className="text-sm text-gray-500">Results</div>
            {getAverage() && (
              <div className="text-4xl font-bold text-indigo-600 mt-2">
                Average: {getAverage()}
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {roomState.participants.map((p) => (
              <div key={p.id} className="text-center">
                <div className={`w-16 h-24 rounded-xl text-2xl font-bold flex items-center justify-center ${
                  p.vote === '?' ? 'bg-gray-300 text-gray-600' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  {p.vote || '-'}
                </div>
                <div className="text-sm text-gray-700 mt-2 font-medium">{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Host Controls */}
      {isHost && roomState?.currentTask && (
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
          <div className="flex justify-center gap-3">
            {!roomState?.revealed && (
              <button
                onClick={reveal}
                className="px-6 py-3 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
              >
                👁️ Reveal Votes
              </button>
            )}
            <button
              onClick={nextTask}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              ▶️ Next Task
            </button>
          </div>
        </div>
      )}

      {/* Participants */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-sm text-gray-600 mb-3">
          Participants ({roomState?.participants?.length || 0})
        </div>
        <div className="flex flex-wrap gap-2">
          {roomState?.participants?.map((p) => (
            <div
              key={p.id}
              className={`px-3 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
                p.id === roomState.hostId
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {p.id === roomState.hostId && <span>👑</span>}
              <span>{p.name}</span>
              {!roomState?.revealed && p.hasVoted && (
                <span className="text-green-600">✓</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
