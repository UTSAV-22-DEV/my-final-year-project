import { AlertCircle, RotateCw } from 'lucide-react';

export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <div><strong>Connection needs attention</strong><p>{message}</p></div>
      {onRetry && <button className="button secondary small" onClick={onRetry}><RotateCw size={15} aria-hidden="true" />Try again</button>}
    </div>
  );
}
