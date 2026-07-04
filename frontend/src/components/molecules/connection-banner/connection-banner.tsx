import React, { memo, useState, useCallback } from 'react';
import { WifiOff, X, RefreshCw } from 'lucide-react';
import { useConnection } from '../../../providers/connection-provider';
import { api } from '../../../providers/api-client';
import './connection-banner.scss';

/**
 * ConnectionBanner
 *
 * Shows in "degraded" state (1-4 consecutive failures).
 * Dismissible — reappears on the next failure.
 * Retry is handled locally (hits /health through the shared api client).
 */
export const ConnectionBanner = memo(() => {
    const { status, consecutiveFailures, dismiss, isDismissed } = useConnection();
    const [isRetrying, setIsRetrying] = useState(false);

    const handleRetry = useCallback(async () => {
        setIsRetrying(true);
        try {
            await api.get('/health');
        } catch {
            // Interceptor tracks the failure
        } finally {
            setIsRetrying(false);
        }
    }, []);

    if (status !== 'degraded' || isDismissed) return null;

    return (
        <div className="cb" role="alert">
            <div className="cb__inner">
                <div className="cb__left">
                    <WifiOff size={15} className="cb__icon" />
                    <span className="cb__text">
                        Connection issues detected — some features may be temporarily unavailable
                        {consecutiveFailures > 1 && (
                            <span className="cb__count"> ({consecutiveFailures} failed requests)</span>
                        )}
                    </span>
                </div>
                <div className="cb__right">
                    <button className="cb__retry" onClick={handleRetry} disabled={isRetrying} type="button">
                        <RefreshCw size={13} className={isRetrying ? 'cb__spin' : ''} />
                        {isRetrying ? 'Retrying' : 'Retry'}
                    </button>
                    <button className="cb__dismiss" onClick={dismiss} type="button" aria-label="Dismiss">
                        <X size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
});
ConnectionBanner.displayName = 'ConnectionBanner';