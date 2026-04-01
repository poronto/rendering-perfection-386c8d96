/**
 * WordPress entry point — mounts into #versace22-chat-root
 * Uses MemoryRouter to avoid conflicting with WordPress URLs
 */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import "./wp-index.css";

const queryClient = new QueryClient();

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
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <MemoryRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </AuthProvider>
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
