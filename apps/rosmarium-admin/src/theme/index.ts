import { createTheme } from '@mui/material/styles';

export const rosmariumTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366F1', // indigo
    },
    secondary: {
      main: '#22D3EE', // cyan
    },
    background: {
      default: '#0f172a',
      paper: '#1e293b',
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    h1: { fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px' },
    h2: { fontSize: '1.25rem', fontWeight: 700 },
    h3: { fontSize: '1.125rem', fontWeight: 700 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid #334155',
          backgroundImage: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#334155',
          },
        },
      },
    },
  },
});
