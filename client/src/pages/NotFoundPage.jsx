import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return <section className="panel module-preview"><span className="eyebrow">404 · PAGE NOT FOUND</span><h1>This path is still unwritten.</h1><p>The page you are looking for does not exist in this workspace.</p><Link to="/" className="button primary"><ArrowLeft size={16} aria-hidden="true" />Return to overview</Link></section>;
}
