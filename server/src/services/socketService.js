import { Server } from 'socket.io';
import { config } from '../config/env.js';
import { userFromToken } from '../middleware/auth.js';

export function initializeSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.trustedOrigins, credentials: true, methods: ['GET', 'POST'] },
    allowRequest: (req, callback) => callback(null, !req.headers.origin || config.trustedOrigins.includes(req.headers.origin)),
  });
  io.use(async (socket, next) => {
    try {
      const cookie = (socket.handshake.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${config.cookieName}=`));
      socket.data.user = await userFromToken(socket.handshake.auth?.token || (cookie && decodeURIComponent(cookie.slice(config.cookieName.length + 1))));
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
