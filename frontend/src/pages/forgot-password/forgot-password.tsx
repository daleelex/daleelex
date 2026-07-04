/* Styles */
import './forgot-password.scss';
import 'react-toastify/dist/ReactToastify.css';
/* Hooks */
import { useNavigate } from 'react-router-dom';
/* Components */
import { Button } from 'primereact/button';
/* Utils */
import { useState } from 'react';
import { handleForgotPassword } from './forgot-password.service';

export const ForgotPassword = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');

  return (
    <>
      <div className="auth-page-title-container">
        <p className="auth-page-title">Forgot Password</p>
        <p className="auth-page-description">Please enter the OTP sent in the field below </p>
      </div>

      <div className="auth-page-primary-button-container">
        <Button id="login" label="Verify" type="submit" disabled={false} />
      </div>

      <div className="auth-page-secondary-button-container">
        <span className="auth-page-secondary-button" id="forgot-password" onClick={(e) => handleForgotPassword(e, navigate)}>
          Resend OTP
        </span>
      </div>
    </>
  );
};
