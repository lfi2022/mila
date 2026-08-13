import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy public URL: permanently forwards /liste/:slug to the new /l/:slug page. */
export const Route = createFileRoute("/liste/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/l/$slug", params: { slug: params.slug }, statusCode: 301 });
  },
});
