import { LoaderCircle } from 'lucide-react';

export function LoadingState({ label = 'Loading workspace…' }) {
  return <div className="loading-state" role="status"><LoaderCircle size={19} className="spin" aria-hidden="true" /><span>{label}</span></div>;
}
