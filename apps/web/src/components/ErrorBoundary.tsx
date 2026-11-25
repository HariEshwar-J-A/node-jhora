import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useI18n } from '../i18n';

function ErrorFallback({
    title,
    message,
    onRetry,
}: {
    title?: string;
    message: string;
    onRetry: () => void;
}) {
    const { t } = useI18n();
    return (
        <div className="card error-boundary" role="alert">
            <h3>{title ?? t('common.somethingWrong')}</h3>
            <p className="error-boundary__msg">{message}</p>
            <button type="button" className="btn btn-outline" onClick={onRetry}>
                {t('common.tryAgain')}
            </button>
        </div>
    );
}

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
                <ErrorFallback
                    title={this.props.title}
                    message={this.state.error.message}
                    onRetry={() => {
                        this.setState({ error: undefined });
                        this.props.onReset?.();
                    }}
                />
            );
        }
        return this.props.children;
    }
}
