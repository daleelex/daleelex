import { SignUp } from '@clerk/react';
import './LoginPage.css';

export function SignUpPage() {
  return (
    <div className="login-page">
      <SignUp routing="path" path="/signup" signInUrl="/login" />
    </div>
  );
}
