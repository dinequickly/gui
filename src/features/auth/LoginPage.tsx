import { useAuthStore } from '../../shared/store/authStore';

export function LoginPage() {
  const { signInWithGoogle, loading } = useAuthStore();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f7f7f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        background: '#fff',
        padding: '48px 40px',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        textAlign: 'center',
        maxWidth: 400,
        width: '100%',
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: 24,
          margin: '0 auto 24px',
        }}>
          N
        </div>

        <h1 style={{
          fontSize: 24,
          fontWeight: 600,
          color: '#1a1a1a',
          margin: '0 0 8px',
        }}>
          Welcome to Notion App
        </h1>

        <p style={{
          color: '#666',
          fontSize: 14,
          margin: '0 0 32px',
        }}>
          Sign in to access your workspace
        </p>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            width: '100%',
            padding: '12px 16px',
            background: '#fff',
            border: '1px solid #e2e2e0',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            color: '#333',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#f5f5f3'; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#fff'; }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}
