const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Load app registry
const registryPath = path.join(__dirname, '..', 'registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API: Get all apps
app.get('/api/apps', (req, res) => {
  res.json(registry.apps);
});

// API: Get single app
app.get('/api/apps/:id', (req, res) => {
  const appDef = registry.apps.find(a => a.id === req.params.id);
  if (!appDef) return res.status(404).json({ error: 'App not found' });
  res.json(appDef);
});

// Dynamically load app API routes
registry.apps.forEach(appDef => {
  const apiPath = path.join(__dirname, '..', 'apps', appDef.id, 'server', 'index.js');
  if (fs.existsSync(apiPath)) {
    try {
      const appRouter = require(apiPath);
      app.use(`/api/${appDef.id}`, appRouter);
      console.log(`✓ Loaded API routes for: ${appDef.id}`);
    } catch (err) {
      console.error(`✗ Failed to load API for ${appDef.id}:`, err.message);
    }
  }
});

// Planning Poker WebSocket handling
const pokerRooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastRoomState(roomCode) {
  const room = pokerRooms.get(roomCode);
  if (!room) return;
  
  const state = {
    roomCode,
    hostId: room.hostId,
    currentTask: room.currentTask,
    revealed: room.revealed,
    participants: Array.from(room.participants.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      hasVoted: p.vote !== null,
      vote: room.revealed ? p.vote : null
    }))
  };
  
  io.to(roomCode).emit('room-state', state);
}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  
  // Create room
  socket.on('create-room', ({ name }) => {
    const roomCode = generateRoomCode();
    pokerRooms.set(roomCode, {
      hostId: socket.id,
      currentTask: '',
      revealed: false,
      participants: new Map([[socket.id, { name, vote: null }]])
    });
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.emit('room-created', { roomCode });
    broadcastRoomState(roomCode);
  });
  
  // Join room
  socket.on('join-room', ({ roomCode, name }) => {
    const room = pokerRooms.get(roomCode);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    room.participants.set(socket.id, { name, vote: null });
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.emit('room-joined', { roomCode });
    broadcastRoomState(roomCode);
  });
  
  // Set task (host only)
  socket.on('set-task', ({ task }) => {
    const room = pokerRooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id) return;
    room.currentTask = task;
    room.revealed = false;
    // Clear all votes
    room.participants.forEach((p) => { p.vote = null; });
    broadcastRoomState(socket.roomCode);
  });
  
  // Vote
  socket.on('vote', ({ value }) => {
    const room = pokerRooms.get(socket.roomCode);
    if (!room || room.revealed) return;
    const participant = room.participants.get(socket.id);
    if (participant) {
      participant.vote = value;
      broadcastRoomState(socket.roomCode);
      
      // Auto-reveal if everyone voted
      const allVoted = Array.from(room.participants.values()).every(p => p.vote !== null);
      if (allVoted) {
        room.revealed = true;
        broadcastRoomState(socket.roomCode);
      }
    }
  });
  
  // Reveal (host only)
  socket.on('reveal', () => {
    const room = pokerRooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id) return;
    room.revealed = true;
    broadcastRoomState(socket.roomCode);
  });
  
  // Next task (host only)
  socket.on('next-task', () => {
    const room = pokerRooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id) return;
    room.currentTask = '';
    room.revealed = false;
    room.participants.forEach((p) => { p.vote = null; });
    broadcastRoomState(socket.roomCode);
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    const room = pokerRooms.get(socket.roomCode);
    if (room) {
      room.participants.delete(socket.id);
      if (room.participants.size === 0) {
        pokerRooms.delete(socket.roomCode);
      } else {
        // If host left, assign new host
        if (room.hostId === socket.id) {
          room.hostId = room.participants.keys().next().value;
        }
        broadcastRoomState(socket.roomCode);
      }
    }
  });
});

// Serve static React app
const staticPath = path.join(__dirname, '..', 'apps', 'marketplace', 'dist');
app.use(express.static(staticPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`🚀 Marsan Apps running on port ${PORT}`);
  console.log(`📦 ${registry.apps.length} apps registered`);
});
