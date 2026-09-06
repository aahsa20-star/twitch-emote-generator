"use client";

import { useRef } from "react";
import EmoteGenerator from "@/components/EmoteGenerator";
import StudioHeader from "@/components/StudioHeader";
import Footer from "@/components/Footer";
import type { AccessSnapshot } from "@/types/auth";
import AccessProvider from "@/components/providers/AccessProvider";

/**
 * Creator shell. page.tsx (Server Component) renders this only when the
 * request is unlocked (or SITE_LOCK_ENABLED=false).
 *
 * The studio (EmoteGenerator) is mounted once and stays mounted; the header's
 * brand button only asks it to show step 1 again (09 §実装構造).
 */
export default function HomeClient({ initialAccess }: { initialAccess: AccessSnapshot }) {
  const brandClickRef = useRef<(() => void) | null>(null);
  return (
    <AccessProvider initialAccess={initialAccess}>
      <div className="min-h-screen flex flex-col">
        <StudioHeader onBrandClick={() => brandClickRef.current?.()} />
        <EmoteGenerator registerBrandHandler={(fn) => { brandClickRef.current = fn; }} />
        <Footer />
      </div>
    </AccessProvider>
  );
}
