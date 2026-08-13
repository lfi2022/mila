type ErrorContext = Record<string, unknown>;

/** Provider-neutral client error hook for a future monitoring adapter. */
export function reportClientError(error: unknown, context: ErrorContext = {}) {
  if (typeof window === "undefined") return;

  const normalized =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error instanceof Response
        ? { name: "Response", message: `Response ${error.status}`, url: error.url }
        : { name: "UnknownError", message: String(error) };

  window.dispatchEvent(
    new CustomEvent("mila:client-error", {
      detail: { ...normalized, route: window.location.pathname, context },
    }),
  );
}
