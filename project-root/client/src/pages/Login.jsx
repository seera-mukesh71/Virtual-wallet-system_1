import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(user.role === 'HEAD' ? '/head/dashboard' : '/app/dashboard', { replace: true });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="theme-neutral auth-page">
      <div className="auth-card">
        <div className="brand">Virtual Wallet</div>
        <h1>Log in</h1>
        <p className="lede">Enter your event credentials to continue.</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            required
          />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block">Log in</button>
        </form>

        <p className="auth-footer">
          New here? <a href="/signup">Create an account</a>
        </p>
      </div>
    </div>
  );
}