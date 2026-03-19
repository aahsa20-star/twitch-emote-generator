import { handlers } from "@/auth";

// This catch-all handles /api/auth/callback/*, /api/auth/signin, /api/auth/signout, etc.
// The existing /api/auth/route.ts (passphrase auth) handles exact POST /api/auth — no conflict.
export const { GET, POST } = handlers;
