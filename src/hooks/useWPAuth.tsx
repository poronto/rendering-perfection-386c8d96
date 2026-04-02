import { useState, createContext, useContext, ReactNode } from 'react';
import { getWPUserInfo } from '@/lib/wp-api';

/**
 * Lightweight auth context for WordPress mode.
 * WordPress handles authentication via cookies — we just read the state.
 * The versace22-enqueue.php should pass user_logged_in + user_display_name.
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

export function WPAuthProvider({ children }: { children: ReactNode }) {
  const wpUser = getWPUserInfo();

  // In WP mode, if user is logged in via WP cookies, treat them as authenticated
  const [user] = useState<WPAuthContextType['user']>(
    wpUser.isLoggedIn
      ? { id: 'wp-user', email: undefined, created_at: undefined }
      : null
  );

  const [profile] = useState<WPAuthContextType['profile']>(
    wpUser.isLoggedIn
      ? { display_name: wpUser.displayName, avatar_url: null }
      : { display_name: wpUser.displayName, avatar_url: null }
  );

  const signOut = async () => {
    // In WP, sign out by redirecting to WP logout URL
    const w = window as any;
    if (w.versace22_chat?.logout_url) {
      window.location.href = w.versace22_chat.logout_url;
    }
  };

  return (
    <WPAuthContext.Provider value={{ user, session: null, loading: false, signOut, profile }}>
      {children}
    </WPAuthContext.Provider>
  );
}

export const useWPAuth = () => useContext(WPAuthContext);
