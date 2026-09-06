/**
 * CSRF hardening for mutating API routes (実装設計 §3.3).
 *
 * Browsers always attach `Origin` to cross-site POST/DELETE. We accept a
 * request when:
 *  - `Origin` is present and matches an allowed origin, or
 *  - `Origin` is absent and `Sec-Fetch-Site` is absent / "same-origin" / "none"
 *    (non-browser clients, direct navigations).
 *
 * Allowed origins: `APP_ORIGIN` (comma-separated, optional) plus the origin of
 * the request URL itself. The request URL origin is derived by Next.js from the
 * platform-controlled host; an attacker's browser cannot set it for a
 * cross-site request, so it is safe to use here (an attacker who controls the
 * Host header is already same-site).
 */

export type OriginCheck = { ok: true } | { ok: false; reason: "origin-mismatch" | "cross-site" };

export function checkRequestOrigin(req: Request, env: NodeJS.ProcessEnv = process.env): OriginCheck {
  const allowed = new Set<string>();
  for (const o of (env.APP_ORIGIN ?? "").split(",")) {
    const t = o.trim().replace(/\/$/, "");
    if (t) allowed.add(t);
  }
  try {
    allowed.add(new URL(req.url).origin);
  } catch {
    // ignore — fall through to header checks
  }

  const origin = req.headers.get("origin");
  if (origin) {
    return allowed.has(origin.replace(/\/$/, "")) ? { ok: true } : { ok: false, reason: "origin-mismatch" };
  }
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return { ok: false, reason: "cross-site" };
  }
  return { ok: true };
}

/** Read a JSON body with a byte cap. Returns undefined on any failure. */
export async function readJsonBody(req: Request, maxBytes: number): Promise<unknown | undefined> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) return undefined;
  const len = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(len) && len > maxBytes) return undefined;
  let text: string;
  try {
    text = await req.text();
  } catch {
    return undefined;
  }
  if (Buffer.byteLength(text, "utf8") > maxBytes) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
