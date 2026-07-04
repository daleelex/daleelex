/* eslint-disable prettier/prettier */
import React, { useState } from 'react';
import './PasswordInputAtom.scss';

// Simple Eye Icons (SVGs) to avoid external icon dependencies
const EyeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

const EyeOffIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
);

interface PasswordInputProps {
    id: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    error?: string | boolean;
}

export const PasswordInputAtom: React.FC<PasswordInputProps> = ({
    id,
    label,
    value,
    onChange,
    placeholder,
    error
}) => {
    const [showPassword, setShowPassword] = useState(false);

    const togglePassword = () => {
        setShowPassword(!showPassword);
    };

    return (
        <div className="password-atom-container">
            <label htmlFor={id} className="password-atom-label">
                {label}
            </label>

            <div className={`password-input-wrapper ${error ? 'has-error' : ''}`}>
                <input
                    id={id}
                    name={id}
                    type={showPassword ? 'text' : 'password'}
                    className="password-atom-field"
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                />

                {/* Toggle Button */}
                <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={togglePassword}
                    aria-label="Toggle password visibility"
                    tabIndex={-1} // Prevents tabbing to the eye icon
                >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
            </div>

            {error && <small className="password-atom-error">{String(error)}</small>}
        </div>
    );
};