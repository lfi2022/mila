import { createFileRoute, redirect } from "@tanstack/react-router";

/** "Voir une liste de démonstration" points at the real public list engine. */
export const Route = createFileRoute("/demo")({
  beforeLoad: () => {
    throw redirect({ to: "/l/$slug", params: { slug: "demo-mila" } });
  },
});
