import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface AgentSurfaceBoundaryProps {
  children: ReactNode;
  onRetry(): void;
}

interface AgentSurfaceBoundaryState {
  failed: boolean;
}

export class AgentSurfaceBoundary extends Component<
  AgentSurfaceBoundaryProps,
  AgentSurfaceBoundaryState
> {
  override state: AgentSurfaceBoundaryState = { failed: false };

  static getDerivedStateFromError(): AgentSurfaceBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The Agent surface could not load.', error, info.componentStack);
  }

  private readonly retry = () => {
    this.props.onRetry();
    this.setState({ failed: false });
  };

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center bg-surface-2 p-4 text-center">
        <div>
          <p className="text-caption text-muted-foreground">The Agent view could not load.</p>
          <Button className="mt-2" onClick={this.retry} size="compact" variant="secondary">
            Retry
          </Button>
        </div>
      </div>
    );
  }
}
