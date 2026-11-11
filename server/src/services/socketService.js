import { Server } from 'socket.io';
import { config } from '../config/env.js';
import { userFromToken } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

export function initializeSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.trustedOrigins, credentials: true, methods: ['GET', 'POST'] },
    allowRequest: (req, callback) => callback(null, !req.headers.origin || config.trustedOrigins.includes(req.headers.origin)),
  });
  io.use(async (socket, next) => {
    try {
      const cookie = (socket.handshake.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${config.cookieName}=`));
      const token = socket.handshake.auth?.token || (cookie && decodeURIComponent(cookie.slice(config.cookieName.length + 1)));
      socket.data.user = await userFromToken(token);
      socket.data.expiresAt = jwt.decode(token).exp * 1000;
      next();
    } catch (failure) {
      const error = new Error(failure.status === 503 ? 'Real-time service unavailable.' : 'Authentication required.');
      error.data = { code: failure.code || 'UNAUTHENTICATED' }; next(error);
    }
  });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.user._id}`);
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, socket.data.expiresAt - Date.now()));
    expiry.unref();
    socket.on('disconnect', () => clearTimeout(expiry));
    // No client-controlled join/subscribe events are registered.
  });
  return io;
}
