import React, { useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Eye, EyeOff, Loader2, Hexagon } from 'lucide-react';
import { handleLogin } from './login.service';
import { useConnection } from '../../providers/connection-provider';
import { ServiceUnavailable } from '../services/services';
import './login.scss';

const loginSchema = Yup.object({
  username: Yup.string().required('Username is required'),
  password: Yup.string().required('Password is required'),
});

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string | false;
  autoComplete?: string;
}

const Field = memo<FieldProps>(
  ({ id, label, type = 'text', placeholder, value, onChange, onBlur, error, autoComplete }) => {
    const [showPwd, setShowPwd] = useState(false);
    const isPwd = type === 'password';
    const inputType = isPwd ? (showPwd ? 'text' : 'password') : type;

    return (
      <div className={`lf ${error ? 'lf--error' : ''}`}>
        <label className="lf__label" htmlFor={id}>{label}</label>
        <div className="lf__wrap">
          <input
            id={id}
            name={id}
            type={inputType}
            className="lf__input"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            autoComplete={autoComplete}
            aria-invalid={!!error}
          />
          {isPwd && (
            <button
              type="button"
              className="lf__eye"
              onClick={() => setShowPwd((p) => !p)}
              tabIndex={-1}
              aria-label={showPwd ? 'Hide password' : 'Show password'}
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error && <p className="lf__error">{error}</p>}
      </div>
    );
  },
);
Field.displayName = 'Field';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);
  const { status } = useConnection();

  const formik = useFormik({
    initialValues: { username: '', password: '' },
    validationSchema: loginSchema,
    onSubmit: async (values) => {
      setLoginError(null);
      try {
        await handleLogin(values.username, values.password, navigate);
      } catch {
        setLoginError('Invalid credentials. Please try again.');
      }
    },
  });

  // Backend down → show service unavailable instead of login form
  if (status === 'disconnected') {
    return <ServiceUnavailable />;
  }

  return (
    <div className="login">
      <div className="login__brand">
        <div className="login__circle login__circle--1" />
        <div className="login__circle login__circle--2" />
        <div className="login__circle login__circle--3" />

        <div className="login__brand-inner">
          <div className="login__logo">
            <div className="login__logo-icon"><Hexagon size={22} /></div>
            <span className="login__wordmark">DaleelEx</span>
          </div>
          <h1 className="login__headline">Infrastructure monitoring,<br />simplified.</h1>
          <p className="login__tagline">
            Real-time visibility across your entire cloud ecosystem.
            Alarms, incidents, and resources — all in one place.
          </p>
          <div className="login__dots">
            {Array.from({ length: 12 }, (_, i) => <span key={i} className="login__dot" />)}
          </div>
        </div>
      </div>

      <div className="login__form-side">
        <form className="login__form" onSubmit={formik.handleSubmit} noValidate>
          <div className="login__form-head">
            <div className="login__form-logo"><Hexagon size={20} /></div>
            <h2 className="login__form-title">Welcome back</h2>
            <p className="login__form-sub">Sign in to your DaleelEx account</p>
          </div>

          {loginError && <div className="login__alert" role="alert">{loginError}</div>}

          <div className="login__fields">
            <Field
              id="username" label="Username" placeholder="Enter your username"
              value={formik.values.username} onChange={formik.handleChange}
              onBlur={formik.handleBlur} error={formik.touched.username && formik.errors.username}
              autoComplete="username"
            />
            <Field
              id="password" label="Password" type="password" placeholder="Enter your password"
              value={formik.values.password} onChange={formik.handleChange}
              onBlur={formik.handleBlur} error={formik.touched.password && formik.errors.password}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login__submit" disabled={formik.isSubmitting}>
            {formik.isSubmitting ? (
              <><Loader2 size={16} className="login__spinner" /> Signing in...</>
            ) : 'Sign in'}
          </button>

        </form>
      </div>
    </div>
  );
};