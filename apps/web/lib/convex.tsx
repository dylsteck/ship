"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(() => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error(
        "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` in packages/convex to get the URL."
      );
    }
    return new ConvexReactClient(convexUrl);
  }, []);

  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
