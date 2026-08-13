import { createFileRoute } from "@tanstack/react-router";

/** Browser-facing alias; affiliation logic and click persistence live in Fastify. */
export const Route = createFileRoute("/go/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[a-f0-9]{64}$/.test(params.token)) {
          return new Response("Lien invalide", { status: 400 });
        }
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/api/v1/public/go/${params.token}`,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        });
      },
    },
  },
});
