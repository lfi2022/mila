import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      {loading || !user ? (
        <div className="mx-auto max-w-6xl px-4 py-20 text-sm text-muted-foreground">
          Chargement de votre espace…
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
