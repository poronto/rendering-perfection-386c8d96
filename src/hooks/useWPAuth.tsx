import { useState, createContext, useContext, ReactNode } from 'react';

/**
 * Lightweight auth context for WordPress mode.
 * WordPress handles authentication via cookies — we read state from
 * versace22_chat localized data injected by versace22-enqueue.php.
 */

interface WPAuthContextType {
  user: { id: string; email?: string; created_at?: string } | null;
  session: null;
  loading: boolean;
  signOut: () => Promise<void>;
  profile: { display_name: string | null; avatar_url: string | null } | null;
}

const WPAuthContext = createContext<WPAuthContextType>({
  user: null,
  session: null,
  loading: false,
  signOut: async () => {},
  profile: null,
});

function getWPUserData() {
  const w = window as any;
  const cfg = w.versace22_chat;
  if (!cfg) return null;

  const isLoggedIn = !!cfg.user_logged_in;
  return {
    isLoggedIn,
    displayName: cfg.user_display_name || (isLoggedIn ? 'User' : 'Guest'),
    email: cfg.user_email || '',
    avatar: cfg.user_avatar || '',
    logoutUrl: cfg.logout_url || '',
  };
}

export function WPAuthProvider({ children }: { children: ReactNode }) {
  const wpData = getWPUserData();

  const [user] = useState<WPAuthContextType['user']>(
    wpData?.isLoggedIn
      ? { id: 'wp-user', email: wpData.email || undefined, created_at: undefined }
      : null
  );

  const [profile] = useState<WPAuthContextType['profile']>(
    wpData
      ? {
          display_name: wpData.displayName,
          avatar_url: wpData.avatar || null,
        }
      : null
  );

  const signOut = async () => {
    if (wpData?.logoutUrl) {
      window.location.href = wpData.logoutUrl;
    }
  };

  return (
    <WPAuthContext.Provider value={{ user, session: null, loading: false, signOut, profile }}>
      {children}
    </WPAuthContext.Provider>
  );
}

export const useWPAuth = () => useContext(WPAuthContext);
