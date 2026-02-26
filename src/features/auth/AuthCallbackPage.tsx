import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../shared/store/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        if (session) {
          navigate('/');
          return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setError(exchangeError.message);
          } else {
            navigate('/');
          }
        } else {
          const { data: { session: sessionAfterWait }, error: sessionError2 } = await supabase.auth.getSession();
          if (sessionAfterWait) {
            navigate('/');
          } else if (sessionError2) {
            setError(sessionError2.message);
          } else {
            setError('No session found');
          }
        }
      } catch (e) {
        setError('Authentication failed');
      }
    };
    
    const timer = setTimeout(handleCallback, 1000);
    handleCallback();
    
    return () => clearTimeout(timer);
  }, [navigate]);

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#e53935', marginBottom: 16 }}>{error}</p>
          <a href="/login" style={{ color: '#1a73e8', textDecoration: 'none' }}>Back to login</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <p>Signing in...</p>
    </div>
  );
}
