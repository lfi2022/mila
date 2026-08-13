const appUrl = requiredUrl("SMOKE_APP_URL");
const apiUrl = new URL(process.env.SMOKE_API_URL || "/api/v1/", appUrl);
const expectedOrigin = appUrl.origin;

const checks = [
  { name: "frontend", url: new URL("/", appUrl), statuses: [200] },
  { name: "robots", url: new URL("/robots.txt", appUrl), statuses: [200] },
  { name: "api", url: apiUrl, statuses: [200] },
  { name: "liveness", url: new URL("health/live", withTrailingSlash(apiUrl)), statuses: [200] },
  { name: "readiness", url: new URL("health/ready", withTrailingSlash(apiUrl)), statuses: [200] },
];

for (const check of checks) {
  const response = await fetch(check.url, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: { "user-agent": "MilaReleaseSmoke/1.0" },
  });
  if (!check.statuses.includes(response.status))
    throw new Error(`${check.name} returned HTTP ${response.status}`);
  if (check.url.origin === expectedOrigin) {
    const location = response.headers.get("location");
    if (location && new URL(location, check.url).origin !== expectedOrigin)
      throw new Error(`${check.name} redirected outside the configured application origin`);
  }
  process.stdout.write(`${check.name}: PASS (${response.status})\n`);
}

function requiredUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`${name} must use HTTP(S)`);
  return url;
}

function withTrailingSlash(url) {
  const value = new URL(url);
  if (!value.pathname.endsWith("/")) value.pathname += "/";
  return value;
}
