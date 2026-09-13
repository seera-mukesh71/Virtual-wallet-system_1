import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';

// Confirms the request carries a valid JWT cookie and attaches req.user
export async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated', code: 'NO_TOKEN' });
    }
    const payload = verifyToken(token);
    const user = await User.findById(payload.id);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Invalid session', code: 'INVALID_SESSION' });
    }
    req.user = user; // full, fresh DB record — never trust the JWT payload for balance/role-sensitive logic
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token', code: 'BAD_TOKEN' });
  }
}

// Restricts a route to specific roles, e.g. authorize('HEAD')
export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden for your role', code: 'FORBIDDEN' });
    }
    next();
  };
}
