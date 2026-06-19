import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { CurrentUser } from '../types';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAppContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.post(`/auth/login`, { email, password });

      const authData = response.data;

      // Build CurrentUser object from auth response
      const user: CurrentUser = {
        id: authData.id,
        email: authData.email,
        is_admin: authData.is_admin,
        created_at: authData.created_at,
        profile: authData.profile || null,
        user_id: authData.id,
        first_name: authData.profile?.first_name || '',
        last_name: authData.profile?.last_name || ''
      };

      login(user);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>🎓 Class Reunion</h1>
          <p style={styles.subtitle}>Connect with Your Class</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.formGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="Enter your email"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Enter your password"
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              ...styles.button,
              backgroundColor: loading || !email || !password ? '#ccc' : '#4CAF50',
              cursor: loading || !email || !password ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Logging In...' : 'Log In'}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Demo Credentials:
            <br />
            Email: test@example.com
            <br />
            Password: password123
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  pageContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  container: {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e0e0e0'
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '30px'
  },
  title: {
    fontSize: '32px',
    color: '#4CAF50',
    margin: '0 0 10px 0'
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    margin: 0
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  label: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333'
  },
  input: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit'
  },
  button: {
    padding: '12px 20px',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '16px',
    transition: 'opacity 0.2s'
  },
  footer: {
    marginTop: '30px',
    paddingTop: '20px',
    borderTop: '1px solid #eee',
    textAlign: 'center' as const
  },
  footerText: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
    lineHeight: '1.6'
  },
  error: {
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '4px',
    border: '1px solid #ef5350',
    fontSize: '14px'
  }
};

export default Login;