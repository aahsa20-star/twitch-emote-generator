import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Twitch Emote Generator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: 16,
          }}
        >
          Twitch Emote Generator
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#a78bfa",
            marginBottom: 40,
          }}
        >
          背景透過 → フチ取り → 3サイズ出力まで、ブラウザだけで完結
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
          }}
        >
          {["背景自動透過", "テキスト入れ", "アニメーション", "ZIP一括DL"].map(
            (label) => (
              <div
                key={label}
                style={{
                  fontSize: 18,
                  color: "#d1d5db",
                  padding: "8px 20px",
                  borderRadius: 999,
                  border: "1px solid #374151",
                  background: "rgba(31,41,55,0.8)",
                }}
              >
                {label}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
