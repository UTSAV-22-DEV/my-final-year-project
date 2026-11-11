import { Server } from 'socket.io';
import { config } from '../config/env.js';
import { userFromToken } from '../middleware/auth.js';

export function initializeSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: config.clientOrigin, methods: ['GET', 'POST'] } });
  io.use(async (socket, next) => {
    try {
      socket.data.user = await userFromToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('Authentication required.'));
    }
  });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.user._id}`);
    // Notification persistence and authorized project events belong to a later phase.
  });
  return io;
}
