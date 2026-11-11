import { AppError } from '../utils/AppError.js';

export function text(value, name, { required = true, max = 100 } = {}) {
  if (!required && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new AppError(400, `${name} must contain between 1 and ${max} characters.`, 'VALIDATION_ERROR');
  }
  return value.trim();
}

export function emailAddress(value) {
  const email = text(value, 'Email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, 'Enter a valid email address.', 'VALIDATION_ERROR');
  return email;
}

export function accountInput(body, role = 'student') {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, 'An account object is required.', 'VALIDATION_ERROR');
  return { name: text(body.name, 'Name'), email: emailAddress(body.email), role,
    department: text(body.department, 'Department', { required: false, max: 120 }),
    studentId: role === 'student' ? text(body.studentId, 'Student ID', { required: false, max: 50 }) : '' };
}
