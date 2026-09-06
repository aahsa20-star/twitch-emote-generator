import { notFound } from "next/navigation";
import AnimationSheet from "./AnimationSheet";

/**
 * /dev/animations — development-only visual harness for all fixed animations
 * (コミット C / D). 404 in production builds.
 */
export const dynamic = "force-dynamic";

export default function AnimationsDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AnimationSheet />;
}
