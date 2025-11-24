import { Component, ReactNode } from 'react';
import { toast } from 'react-hot-toast';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    toast.error(message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
          <div className="rounded-xl border border-slate-800 px-6 py-4 text-center">
            <p className="font-semibold">Something went wrong.</p>
            <p className="text-sm text-slate-400">Reload to continue.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
