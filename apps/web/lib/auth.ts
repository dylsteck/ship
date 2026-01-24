import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export function useAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();

  const signInWithGitHub = async () => {
    await signIn("github");
  };

  return {
    isAuthenticated,
    isLoading,
    signIn: signInWithGitHub,
    signOut,
  };
}
