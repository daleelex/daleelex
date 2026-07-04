import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Hexagon } from 'lucide-react';
import './not-found.scss';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="nf">
      {/* Floating background shapes */}
      <div className="nf__bg">
        <div className="nf__shape nf__shape--1" />
        <div className="nf__shape nf__shape--2" />
        <div className="nf__shape nf__shape--3" />
        <div className="nf__shape nf__shape--4" />
      </div>

      <div className="nf__content">
        <div className="nf__icon">
          <Hexagon size={28} />
        </div>

        <h1 className="nf__code">
          <span className="nf__digit">4</span>
          <span className="nf__zero">
            <span className="nf__zero-ring" />
          </span>
          <span className="nf__digit">4</span>
        </h1>

        <h2 className="nf__title">Page not found</h2>
        <p className="nf__message">
          The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </p>

        <div className="nf__actions">
          <button className="nf__btn nf__btn--primary" onClick={() => navigate('/')} type="button">
            <Home size={16} />
            Go to Dashboard
          </button>
          <button className="nf__btn nf__btn--ghost" onClick={() => navigate(-1)} type="button">
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};