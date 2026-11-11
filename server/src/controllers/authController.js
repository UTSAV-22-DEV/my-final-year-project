import { User, Project } from '../models/index.js';
import { accountInput, emailAddress } from '../middleware/accountValidation.js';
import { hashPassword, verifyPassword } from '../services/passwordService.js';
import { createSession, clearSessionCookie, safeUser } from '../services/sessionService.js';
import { AppError } from '../utils/AppError.js';

const dummyHash = await hashPassword('Dummy-comparison-password-only');

export async function register(req, res) {
  if (req.body?.role && req.body.role !== 'student') {
    throw new AppError(403, 'Public registration is available to students only. Contact an administrator for a teacher account.', 'FORBIDDEN');
  }
  const input = accountInput(req.body);
  const passwordHash = await hashPassword(req.body.password);
  if (await User.exists({ email: input.email })) throw new AppError(409, 'An account with this email already exists.', 'DUPLICATE_RECORD');
  const user = await User.create({ ...input, passwordHash });
  createSession(res, user);
  res.status(201).json({ user: safeUser(user) });
}

export async function login(req, res) {
  const email = emailAddress(req.body?.email);
  const password = req.body?.password;
  if (typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) {
    throw new AppError(400, 'Enter a password of at most 72 UTF-8 bytes.', 'VALIDATION_ERROR');
  }
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  const matches = await verifyPassword(password, user?.passwordHash || dummyHash);
  if (!user || !matches) throw new AppError(401, 'The email or password is incorrect.', 'INVALID_CREDENTIALS');
  if (!user.isActive) throw new AppError(403, 'This account is inactive. Contact your administrator.', 'ACCOUNT_INACTIVE');
  createSession(res, user);
  res.json({ user: safeUser(user) });
}

export async function logout(req, res) {
  // Logout revokes all existing account JWTs, including copied bearer tokens.
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  req.app.get('io')?.in(`user:${req.user._id}`).disconnectSockets(true);
  clearSessionCookie(res);
  res.status(204).end();
}

export async function currentUser(req, res) {
  const assignedProjects = req.user.role === 'admin' ? [] : await Project.find(req.user.role === 'teacher'
    ? { supervisor: req.user._id } : { members: req.user._id }).select('_id title status').lean();
  res.set('Cache-Control', 'no-store').json({ user: { ...safeUser(req.user), assignedProjects } });
}
