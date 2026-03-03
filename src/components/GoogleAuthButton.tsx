import { useEffect, useRef, useState } from 'react';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

interface Props {
  clientId: string;
  onToken: (token: string) => void;
  onSignOut: () => void;
  isSignedIn: boolean;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

export default function GoogleAuthButton({ clientId, onToken, onSignOut, isSignedIn }: Props) {
  const clientRef = useRef<{ requestAccessToken: () => void } | null>(null);
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    const initClient = () => {
      if (!window.google) return;
      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (response) => {
          setLoading(false);
          if (response.access_token) {
            onToken(response.access_token);
          }
        },
      });
      setScriptReady(true);
    };

    const existing = document.getElementById('gsi-script');
    if (existing) {
      // Script tag exists — either already loaded or still loading
      if (window.google) {
        initClient();
      } else {
        existing.addEventListener('load', initClient, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initClient;
    document.head.appendChild(script);
  }, [clientId, onToken]);

  const handleSignIn = () => {
    setLoading(true);
    clientRef.current?.requestAccessToken();
  };

  if (isSignedIn) {
    return (
      <button
        onClick={onSignOut}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <GoogleIcon />
        Sign out
      </button>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      disabled={loading || !scriptReady}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <GoogleIcon />
      {loading ? 'Signing in…' : 'Sign in with Google'}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
