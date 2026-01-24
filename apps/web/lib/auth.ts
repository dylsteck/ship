import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export function useAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();

  const signInWithGitHub = async () => {
    // Use current window location for redirect, or default to production
    const redirectTo = typeof window !== "undefined" 
      ? window.location.origin 
      : "https://ship.dylansteck.com";
    
    await signIn("github", { redirectTo });
  };

  return {
    isAuthenticated,
    isLoading,
    signIn: signInWithGitHub,
    signOut,
  };
}
