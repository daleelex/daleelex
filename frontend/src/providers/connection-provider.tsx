import React, {
    createContext,
    useContext,
    useCallback,
    useState,
    useEffect,
    useRef,
    useSyncExternalStore,
} from 'react';
import { connectionState, ConnectionStatus } from './connection-state';
import { api } from './api-client';

const AUTO_RETRY_MS = 15_000;

interface ConnectionContextValue {
    status: ConnectionStatus;
    consecutiveFailures: number;
    dismiss: () => void;
    isDismissed: boolean;
}

const ConnectionContext = createContext<ConnectionContextValue>({
    status: 'connected',
    consecutiveFailures: 0,
    dismiss: () => { },
    isDismissed: false,
});

export const useConnection = () => useContext(ConnectionContext);

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const snapshot = useSyncExternalStore(
        connectionState.subscribe,
        connectionState.getSnapshot,
    );

    const [isDismissed, setIsDismissed] = useState(false);
    const initialCheckDone = useRef(false);
    const retryInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── One-time health check on mount ──────────────────────────────────────
    useEffect(() => {
        if (initialCheckDone.current) return;
        initialCheckDone.current = true;

        api.get('/health').catch(() => {
            const quickChecks = Array.from({ length: 4 }, () =>
                api.get('/health').catch(() => { }),
            );
            Promise.all(quickChecks);
        });
    }, []);

    // ── Auto-retry when disconnected ────────────────────────────────────────
    // Polls /health every 15s ONLY while disconnected.
    // When a request succeeds, the interceptor resets the state → connected,
    // which stops the interval on the next render.
    useEffect(() => {
        if (snapshot.status === 'disconnected') {
            retryInterval.current = setInterval(() => {
                api.get('/health').catch(() => { });
            }, AUTO_RETRY_MS);

            return () => {
                if (retryInterval.current) clearInterval(retryInterval.current);
            };
        }

        // Not disconnected → clear any running interval
        if (retryInterval.current) {
            clearInterval(retryInterval.current);
            retryInterval.current = null;
        }
    }, [snapshot.status]);

    // ── Browser online/offline detection ──────────────────────────────────────
    useEffect(() => {
        const handleOffline = () => {
            for (let i = 0; i < 5; i++) connectionState.onFailure();
        };

        const handleOnline = () => {
            api.get('/health').catch(() => { });
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    // ── Banner dismiss logic ────────────────────────────────────────────────
    const dismiss = useCallback(() => setIsDismissed(true), []);

    const effectiveIsDismissed = isDismissed && snapshot.status === 'degraded';

    if (isDismissed && snapshot.status !== 'degraded') {
        setIsDismissed(false);
    }

    return (
        <ConnectionContext.Provider
            value={{
                status: snapshot.status,
                consecutiveFailures: snapshot.consecutiveFailures,
                dismiss,
                isDismissed: effectiveIsDismissed,
            }}
        >
            {children}
        </ConnectionContext.Provider>
    );
};