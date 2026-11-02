import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
    children: ReactNode;
    title?: string;
    onReset?: () => void;
};

type State = {
    error: Error | undefined;
};

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: undefined };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (this.state.error) {
            return (
                <div className="card error-boundary" role="alert">
                    <h3>{this.props.title ?? 'Something went wrong'}</h3>
                    <p className="error-boundary__msg">{this.state.error.message}</p>
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                            this.setState({ error: undefined });
                            this.props.onReset?.();
                        }}
                    >
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
