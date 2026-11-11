import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <main className="fatal-error"><h1>The workspace could not load.</h1><p>Reload the page to try again.</p><button className="button primary" onClick={() => window.location.reload()}>Reload workspace</button></main>;
    }
    return this.props.children;
  }
}
