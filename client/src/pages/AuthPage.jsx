import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, Eye, EyeOff, GraduationCap, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { LoadingState } from '../components/LoadingState.jsx';

export function AuthPage({ registration = false }) {
  const { user, login, register, loading, error: sessionError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (loading) return <div className="session-screen"><LoadingState label="Restoring your session…" /></div>;
  if (user) return <Navigate to={`/${user.role}/dashboard`} replace />;
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try { await (registration ? register(values) : login(values)); }
    catch (failure) { setError(failure.message || 'We could not reach the server. Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell"><section className="auth-story"><Link to="/login" className="brand auth-brand"><span className="brand-mark"><GraduationCap size={28} aria-hidden="true" /></span><span>FYP<span className="brand-subtitle">WORKSPACE</span></span></Link><div className="auth-story-copy"><span className="hero-kicker">YOUR FINAL YEAR. A SHARED DIRECTION.</span><h1>Good ideas deserve<br />a great workspace.</h1><p>Bring your team, your supervisor, and your next big idea together.</p><div className="auth-story-card"><span className="auth-story-icon"><BookOpen size={29} aria-hidden="true" /></span><div><strong>Every milestone, connected.</strong><span>From proposal to the final review.</span></div></div><div className="auth-benefits">{['A clear home for academic projects', 'Supervision with shared context', 'AI support, with teachers in control'].map((item) => <div key={item}><Check size={15} aria-hidden="true" />{item}</div>)}</div></div><p className="auth-story-footer"><ShieldCheck size={16} aria-hidden="true" />Built around people. Protected by role.</p></section><section className="auth-form-side"><div className="auth-form-wrap"><span className="eyebrow">AI-ASSISTED PROJECT MANAGEMENT</span><h2>{registration ? 'Start your next chapter.' : 'Welcome back.'}</h2><p className="auth-subtitle">{registration ? 'Create your student account and join your academic workspace.' : 'Sign in to your academic workspace.'}</p><form onSubmit={submit} className="auth-form">
    {registration && <label>Full name<input name="name" autoComplete="name" required maxLength={100} placeholder="Your full name" disabled={busy} /></label>}
    <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@university.edu" disabled={busy} /></label>
    <label>Password<span className="password-input"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={registration ? 'new-password' : 'current-password'} required minLength={registration ? 12 : 1} maxLength={72} placeholder={registration ? 'At least 12 characters' : 'Enter your password'} disabled={busy} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
    {registration && <><label>Department <span className="field-optional">(optional)</span><input name="department" maxLength={120} placeholder="Computer Science" disabled={busy} /></label><label>Student ID <span className="field-optional">(optional)</span><input name="studentId" maxLength={50} placeholder="Your institutional ID" disabled={busy} /></label></>}
    {(error || sessionError) && <div className="form-error" role="alert">{error || sessionError}</div>}
    <button type="submit" className="button primary auth-submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}{busy ? 'Please wait…' : registration ? 'Create student account' : 'Sign in'}</button>
  </form><p className="auth-switch">{registration ? 'Already have an account?' : 'New to the workspace?'} <Link to={registration ? '/login' : '/register'}>{registration ? 'Sign in' : 'Create a student account'}</Link></p><div className="auth-trust"><ShieldCheck size={16} aria-hidden="true" /><span>{registration ? 'Teacher accounts are provided by your administrator.' : 'Your access is tailored to your academic role.'}</span></div></div><span className="auth-bottom">AI-Assisted Final Year Project Management System</span></section></main>;
}
