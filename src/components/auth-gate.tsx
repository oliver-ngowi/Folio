"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

/** Renders its children only for a signed-in user; otherwise sends them to /login. */
export function AuthGate({ children }: { children: (userId: string | null) => React.ReactNode }) {
  const { enabled, loading, session } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (enabled && !loading && !session) router.replace("/login");
  }, [enabled, loading, session, router]);

  if (!enabled) return <>{children(null)}</>;
  if (loading || !session) {
    return (
      <div className="flex h-svh gap-4 p-4">
        <Skeleton className="hidden h-full w-64 md:block" />
        <Skeleton className="h-full w-full md:w-96" />
        <Skeleton className="hidden h-full flex-1 md:block" />
      </div>
    );
  }
  return <>{children(session.user.id)}</>;
}
