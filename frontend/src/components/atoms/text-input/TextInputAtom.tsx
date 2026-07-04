/* eslint-disable prettier/prettier */
import React from 'react';
import './TextInputAtom.scss';

interface TextInputProps {
    id: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    error?: string | boolean;
    type?: string;
}

export const TextInputAtom: React.FC<TextInputProps> = ({
    id,
    label,
    value,
    onChange,
    placeholder,
    error,
    type = 'text'
}) => {
    return (
        <div className="text-atom-container">
            <label htmlFor={id} className="text-atom-label">
                {label}
            </label>
            <input
                id={id}
                name={id}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`text-atom-field ${error ? 'has-error' : ''}`}
            />
            {error && <small className="text-atom-error">{String(error)}</small>}
        </div>
    );
};