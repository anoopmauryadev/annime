import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error);
  const digest = typeof error === "object" && error !== null && "digest" in error
    ? String(error.digest)
    : undefined;

  console.error(JSON.stringify({
    time: new Date().toISOString(),
    level: "error",
    service: "anime-zone-web",
    message,
    digest,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
  }));
};
