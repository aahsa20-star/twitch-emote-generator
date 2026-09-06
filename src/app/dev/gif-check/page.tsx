import { notFound } from "next/navigation";
import GifCheck from "./GifCheck";

/**
 * /dev/gif-check — development-only regression harness for GIF transparency
 * (B12). Returns 404 in production builds.
 */
export const dynamic = "force-dynamic";

export default function GifCheckPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <GifCheck />;
}
