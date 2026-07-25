import { SignIn } from '@clerk/react';
import './LoginPage.css';

export function LoginPage() {
  return (
    <div className="login-page">
      <SignIn routing="path" path="/login" signUpUrl="/signup" />
    </div>
  );
}
