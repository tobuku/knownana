import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: '360px', margin: '80px auto', padding: '0 16px' }}>
      <img src="/logo.png" alt="KnowNana" style={{ width: '120px', marginBottom: '12px' }} />
      <h1 style={{ fontSize: '1.2em', marginBottom: '4px' }}>KnowNana</h1>
      <p style={{ color: '#888', marginBottom: '24px', fontSize: '0.9em' }}>Parental domain monitor</p>

      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ color: '#cc0000', marginBottom: '12px', fontSize: '0.9em' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '2px' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #ccc',
              background: '#fff',
            }}
            placeholder="you@example.com"
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '2px' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #ccc',
              background: '#fff',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '6px 16px',
            border: '1px solid #111',
            background: '#111',
            color: '#fff',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Wait...' : isSignUp ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <div style={{ marginTop: '16px' }}>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); setIsSignUp(!isSignUp); setError(''); }}
          style={{ fontSize: '0.9em' }}
        >
          {isSignUp ? 'Have an account? Sign in' : 'Create an account'}
        </a>
      </div>
    </div>
  );
}
