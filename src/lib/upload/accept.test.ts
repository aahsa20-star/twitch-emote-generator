import { describe, expect, it } from "vitest";
import { checkUpload, UPLOAD_ACCEPT_ATTR, UPLOAD_LABELS, UPLOAD_LIMITS } from "./accept";

describe("checkUpload", () => {
  it("accepts static images, GIFs and videos within their limits", () => {
    expect(checkUpload({ type: "image/png", size: 1000 })).toEqual({ ok: true, kind: "image" });
    expect(checkUpload({ type: "image/gif", size: UPLOAD_LIMITS.gif })).toEqual({ ok: true, kind: "gif" });
    expect(checkUpload({ type: "video/mp4", size: 5 })).toEqual({ ok: true, kind: "video" });
  });

  it("asks for a conversion for HEIC / HEIF (by type or extension)", () => {
    const byType = checkUpload({ type: "image/heic", size: 10 });
    const byExt = checkUpload({ type: "", size: 10, name: "IMG_0001.HEIC" });
    expect(byType.ok).toBe(false);
    expect(byExt.ok).toBe(false);
    if (!byType.ok) expect(byType.code).toBe("convert-first");
    if (!byExt.ok) expect(byExt.message).toContain("変換");
  });

  it("rejects unsupported types with the accepted list", () => {
    const r = checkUpload({ type: "application/pdf", size: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("unsupported");
      expect(r.message).toContain(UPLOAD_LABELS.image.formats);
    }
  });

  it("enforces per-kind size limits from the definition", () => {
    const r = checkUpload({ type: "image/jpeg", size: UPLOAD_LIMITS.image + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("too-large");
      expect(r.message).toContain(UPLOAD_LABELS.image.limit);
    }
    expect(checkUpload({ type: "video/webm", size: UPLOAD_LIMITS.video + 1 }).ok).toBe(false);
  });

  it("the accept attribute is explicit (no image/*)", () => {
    expect(UPLOAD_ACCEPT_ATTR).not.toContain("image/*");
    expect(UPLOAD_ACCEPT_ATTR).toContain("image/png");
    expect(UPLOAD_ACCEPT_ATTR).toContain("video/mp4");
  });
});
