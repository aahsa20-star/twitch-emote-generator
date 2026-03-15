import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Twitch Emote Generator｜エモート作成ツール（無料・ブラウザ完結）";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0f0f17 0%, #1a1a2e 50%, #16132b 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Purple glow - top right */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-120px",
            width: "450px",
            height: "450px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(145,70,255,0.25) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        {/* Purple glow - bottom left */}
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            left: "-100px",
            width: "350px",
            height: "350px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(145,70,255,0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: 58,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-1px",
            zIndex: 1,
            display: "flex",
          }}
        >
          Twitch Emote Generator
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: "#a78bfa",
            marginTop: 16,
            zIndex: 1,
            display: "flex",
          }}
        >
          エモート制作の面倒を全部省く
        </div>

        {/* Feature badges */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 44,
            zIndex: 1,
          }}
        >
          {["背景自動透過", "フチ取り", "アニメーション", "全サイズ出力", "ブラウザ完結"].map(
            (label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  fontSize: 18,
                  fontWeight: 500,
                  color: "#c4b5fd",
                  padding: "10px 22px",
                  borderRadius: 999,
                  border: "1px solid rgba(145,70,255,0.4)",
                  background: "rgba(145,70,255,0.1)",
                }}
              >
                {label}
              </div>
            )
          )}
        </div>

        {/* Platform line */}
        <div
          style={{
            fontSize: 18,
            color: "#6b7280",
            marginTop: 36,
            zIndex: 1,
            display: "flex",
          }}
        >
          Twitch / Discord / 7TV / BTTV / FFZ 対応 — 無料
        </div>
      </div>
    ),
    { ...size }
  );
}
