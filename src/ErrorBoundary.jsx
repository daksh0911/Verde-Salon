import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    // You could log the error to an external service here
    console.error('ErrorBoundary caught an error', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="wrap page hint">
          Something went wrong. Please refresh the page.
        </div>
      );
    }
    return this.props.children;
  }
}

