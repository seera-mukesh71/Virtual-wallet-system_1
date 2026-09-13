import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const STEPS = { EMAIL: 1, OTP: 2, PASSWORD: 3, DONE: 4 };

export default function Signup() {
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const requestOtp = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const res = await api.post('/auth/signup/request-otp', { email });
      setMessage(res.data.message);
      setStep(STEPS.OTP);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const res = await api.post('/auth/signup/verify-otp', { email, otp });
      setMessage(res.data.message);
      setStep(STEPS.PASSWORD);
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect or expired OTP');
    }
  };

  const setPasswordAndFinish = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/signup/set-password', { email, otp, password });
      setStep(STEPS.DONE);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not set password');
    }
  };

  const stepLabel = { 1: 'Step 1 of 3', 2: 'Step 2 of 3', 3: 'Step 3 of 3', 4: 'Done' }[step];

  return (
    <div className="theme-neutral auth-page">
      <div className="auth-card">
        <div className="brand">Virtual Wallet — {stepLabel}</div>
        <h1>Create account</h1>

        {step === STEPS.EMAIL && (
          <>
            <p className="lede">Enter your registered college or vendor email.</p>
            <form onSubmit={requestOtp}>
              <input
                type="email" placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field" required
              />
              <button type="submit" className="btn btn-primary btn-block">Send code</button>
            </form>
          </>
        )}

        {step === STEPS.OTP && (
          <>
            <p className="lede">Enter the 6-digit code sent to {email}.</p>
            <form onSubmit={verifyOtp}>
              <input
                type="text" placeholder="6-digit code" value={otp} maxLength={6}
                onChange={(e) => setOtp(e.target.value)}
                className="field" required
              />
              <button type="submit" className="btn btn-primary btn-block">Verify</button>
            </form>
          </>
        )}

        {step === STEPS.PASSWORD && (
          <>
            <p className="lede">Create a password (minimum 8 characters).</p>
            <form onSubmit={setPasswordAndFinish}>
              <input
                type="password" placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field" required minLength={8}
              />
              <button type="submit" className="btn btn-primary btn-block">Create account</button>
            </form>
          </>
        )}

        {step === STEPS.DONE && <p className="success-text">Account created. Redirecting to login...</p>}

        {message && step !== STEPS.DONE && <p className="success-text">{message}</p>}
        {error && <p className="error-text">{error}</p>}

        <p className="auth-footer">
          Already have an account? <a href="/login">Log in</a>
        </p>
      </div>
    </div>
  );
}