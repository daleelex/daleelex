import React from 'react';
import { Hexagon, WifiOff } from 'lucide-react';
import './service-unavailable.scss';


export const ServiceUnavailable: React.FC = () => (
    <div className="su">
        <div className="su__bg">
            <div className="su__shape su__shape--1" />
            <div className="su__shape su__shape--2" />
            <div className="su__shape su__shape--3" />
        </div>

        <div className="su__content">
            <div className="su__icon">
                <Hexagon size={28} />
            </div>

            <div className="su__signal">
                <WifiOff size={40} className="su__wifi-off" />
                <div className="su__pulse-ring su__pulse-ring--1" />
                <div className="su__pulse-ring su__pulse-ring--2" />
                <div className="su__pulse-ring su__pulse-ring--3" />
            </div>

            <h1 className="su__title">We're experiencing difficulties</h1>
            <p className="su__message">
                Our servers are temporarily unreachable. This is usually brief.
                Please sit tight while we work on restoring the connection.
            </p>

            <div className="su__status">
                <div className="su__status-dot" />
                <span>Grab a snack, we're fixing it...</span>
            </div>

            <p className="su__footnote">
                If this persists, contact your system administrator.
            </p>
        </div>
    </div>
);