/**
 * WordPress entry point — mounts into #versace22-chat-root
 * Uses MemoryRouter to avoid conflicting with WordPress URLs.
 * In WP mode: uses WPAuthProvider (cookie-based WP auth) instead of Supabase auth.
 * Guest users can chat without logging in; logged-in WP users get history.
 */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WPAuthProvider } from "@/hooks/useWPAuth";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import "./wp-index.css";

const queryClient = new QueryClient();

/**
 * In WordPress mode, we bypass Supabase auth entirely.
 * The WPAuthProvider gives the app access to WP user state.
 * We still wrap with Supabase AuthProvider so the useAuth hook doesn't crash,
 * but the ProtectedRoute allows all users through in WP mode (guests can chat).
 */
function WPProtectedRoute({ children }: { children: React.ReactNode }) {
  // In WP mode, always allow access — WordPress handles auth via cookies.
  // Both guests and logged-in users can use the chat widget.
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-dvh bg-background flex items-center justify-center">
      <div className="text-primary animate-pulse text-lg font-medium">Loading...</div>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const WPApp = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <WPAuthProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <MemoryRouter>
              <Routes>
                <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<WPProtectedRoute><Index /></WPProtectedRoute>} />
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        </AuthProvider>
      </WPAuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

// Mount to our scoped container
const container = document.getElementById("versace22-chat-root");
if (container) {
  createRoot(container).render(<WPApp />);
} else {
  const fallback = document.createElement("div");
  fallback.id = "versace22-chat-root";
  document.body.appendChild(fallback);
  createRoot(fallback).render(<WPApp />);
}
