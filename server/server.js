const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const roundRoutes = require('./routes/rounds');
const stickerRoutes = require('./routes/stickers');
const voteRoutes = require('./routes/votes');
const findClickRoutes = require('./routes/findclick');
const socketHandler = require('./socket/index');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rounds', roundRoutes);
app.use('/api/stickers', stickerRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/findclick', findClickRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Socket.io
socketHandler(io);

// Scheduler
require('./jobs/scheduler')(io);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
