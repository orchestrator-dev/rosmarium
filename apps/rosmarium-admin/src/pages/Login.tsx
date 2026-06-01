import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Stack,
  Divider,
} from '@mui/material';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssoProviders, setSsoProviders] = useState<{ id: string; name: string; providerId: string; type: string }[]>([]);

  useEffect(() => {
    fetch('/api/auth/sso/providers')
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setSsoProviders(data);
      })
      .catch(console.error);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        const json = await res.json();
        setError(json.error || 'Login failed');
      }
    } catch {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 400 }} elevation={3}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: "bold" }} color="primary">
            ⬡ Rosmarium
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Sign in to Admin Console
          </Typography>
        </Box>
        
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2, textAlign: 'center' }}>
            {error}
          </Typography>
        )}

        <form onSubmit={handleLogin}>
          <Stack spacing={2}>
            <TextField
              label="Email"
              type="email"
              required
              fullWidth
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              required
              fullWidth
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <Button 
              type="submit" 
              variant="contained" 
              size="large" 
              fullWidth 
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Stack>
        </form>

        {ssoProviders.length > 0 && (
          <>
            <Divider sx={{ my: 3 }}>OR</Divider>
            <Stack spacing={1.5}>
              {ssoProviders.map(provider => (
                <Button
                  key={provider.id}
                  variant="outlined"
                  size="large"
                  fullWidth
                  href={`/api/auth/sso/login/${provider.id}`}
                >
                  Sign in with {provider.name}
                </Button>
              ))}
            </Stack>
          </>
        )}
      </Paper>
    </Box>
  );
}
