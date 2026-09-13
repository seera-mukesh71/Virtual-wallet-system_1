import { verifyToken } from '../utils/jwt.js';
import cookie from 'cookie';
import User from '../models/User.js';

/**
 * Socket.IO auth: reads the same httpOnly JWT cookie used by REST auth.
 * A vendor only ever joins their OWN room — never trust a client-sent userId.
 */
export function initSockets(io) {
  io.use(async (socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      if (!rawCookie) return next(new Error('No cookie'));

      const parsed = cookie.parse(rawCookie);
      const token = parsed.token;
      if (!token) return next(new Error('No token'));

      const payload = verifyToken(token);
      const user = await User.findById(payload.id);
      if (!user || user.status !== 'ACTIVE') return next(new Error('Invalid user'));

      socket.userId = String(user._id);
      socket.userRole = user.role;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    // Only vendors need a private notification room; students/heads don't need real-time push here.
    if (socket.userRole === 'VENDOR') {
      socket.join(`vendor:${socket.userId}`);
      console.log(`Vendor ${socket.userId} connected and joined their room`);
    }

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.userId}`);
    });
  });
}
