import type { Metadata } from "next";
import {
  Noto_Sans_JP,
  Dela_Gothic_One,
  Reggae_One,
  Rampart_One,
  DotGothic16,
  Zen_Tokyo_Zoo,
  Rock_3D,
  Boogaloo,
  Permanent_Marker,
} from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-noto-sans-jp",
});

const delaGothicOne = Dela_Gothic_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dela-gothic-one",
});

const reggaeOne = Reggae_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-reggae-one",
});

const rampartOne = Rampart_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-rampart-one",
});

const dotGothic16 = DotGothic16({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dotgothic16",
});

const zenTokyoZoo = Zen_Tokyo_Zoo({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-zen-tokyo-zoo",
});

const rock3D = Rock_3D({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-rock-3d",
});

const boogaloo = Boogaloo({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-boogaloo",
});

const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-permanent-marker",
});

export const metadata: Metadata = {
  title: "Twitch Emote Generator",
  description:
    "画像をアップロードするだけでTwitchエモートの複数バリエーションを即座に生成。ブラウザ完結型。",
};

const fontVars = [
  notoSansJP.variable,
  delaGothicOne.variable,
  reggaeOne.variable,
  rampartOne.variable,
  dotGothic16.variable,
  zenTokyoZoo.variable,
  rock3D.variable,
  boogaloo.variable,
  permanentMarker.variable,
].join(" ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body className={`${fontVars} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
