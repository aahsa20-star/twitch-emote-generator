import Script from "next/script";
import type { Metadata } from "next";
import {
  Inter,
  Noto_Sans_JP,
  Dela_Gothic_One,
  Reggae_One,
  Rampart_One,
  DotGothic16,
  Zen_Tokyo_Zoo,
  Rock_3D,
  Boogaloo,
  Permanent_Marker,
  Black_Han_Sans,
  RocknRoll_One,
  Kaisei_Decol,
  // Phase 3 additions: fill underrepresented genres (mincho, rounded,
  // brush, English impact/pop/pixel) for emote-friendly variety.
  Shippori_Mincho,
  Hina_Mincho,
  M_PLUS_Rounded_1c,
  Yusei_Magic,
  Yuji_Syuku,
  Klee_One,
  Bungee,
  Bangers,
  Lobster,
  Press_Start_2P,
} from "next/font/google";
import AuthProvider from "@/components/providers/AuthProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
});

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

const blackHanSans = Black_Han_Sans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-black-han-sans",
});

const rocknrollOne = RocknRoll_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-rocknroll-one",
});

const kaiseiDecol = Kaisei_Decol({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-kaisei-decol",
});

// --- Phase 3 additions ---

// Mincho (端正な明朝)
const shipporiMincho = Shippori_Mincho({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-shippori-mincho",
});

const hinaMincho = Hina_Mincho({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hina-mincho",
});

// Rounded (丸文字)
const mPlusRounded1c = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: "800",
  variable: "--font-mplus-rounded-1c",
});

const yuseiMagic = Yusei_Magic({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-yusei-magic",
});

// Brush / handwritten (筆文字・手書き和風)
const yujiSyuku = Yuji_Syuku({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-yuji-syuku",
});

const kleeOne = Klee_One({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-klee-one",
});

// English impact
const bungee = Bungee({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bungee",
});

const bangers = Bangers({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bangers",
});

// English pop
const lobster = Lobster({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-lobster",
});

// English pixel
const pressStart2P = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start-2p",
});

export const metadata: Metadata = {
  title: "Twitch Emote Generator｜エモート作成ツール（無料・ブラウザ完結）",
  description:
    "Twitchエモートの作り方がわからなくても大丈夫。画像・GIF・動画から背景透過・フチ取り・テキスト入れ・アニメーション・全サイズ書き出しまでブラウザだけで完結。Discord / 7TV / BTTV / FFZにも対応。スタンプ作成・エモート制作が無料でできます。",
  metadataBase: new URL("https://twitch-emote-generator.vercel.app"),
  verification: {
    google: "xccOfwL_XFWfigZqCYHxDcXj594lfO70WftcTX-8or8",
  },
  openGraph: {
    title: "Twitch Emote Generator｜エモート作成ツール（無料・ブラウザ完結）",
    description:
      "背景透過→フチ取り→アニメーション→全サイズ出力まで、ブラウザだけで完結。Twitch / Discord / 7TV / BTTV / FFZ対応。",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
  },
  twitter: {
    card: "summary_large_image",
    title: "Twitch Emote Generator｜エモート作成ツール",
    description:
      "背景透過→フチ取り→アニメーション→全サイズ出力まで、ブラウザだけで完結。Twitch / Discord / 7TV / BTTV / FFZ対応。",
  },
};

const fontVars = [
  inter.variable,
  notoSansJP.variable,
  delaGothicOne.variable,
  reggaeOne.variable,
  rampartOne.variable,
  dotGothic16.variable,
  zenTokyoZoo.variable,
  rock3D.variable,
  boogaloo.variable,
  permanentMarker.variable,
  blackHanSans.variable,
  rocknrollOne.variable,
  kaiseiDecol.variable,
  shipporiMincho.variable,
  hinaMincho.variable,
  mPlusRounded1c.variable,
  yuseiMagic.variable,
  yujiSyuku.variable,
  kleeOne.variable,
  bungee.variable,
  bangers.variable,
  lobster.variable,
  pressStart2P.variable,
].join(" ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body className={`${fontVars} font-sans antialiased`}>
        <AuthProvider>
        {children}
        </AuthProvider>
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="30d97495-7286-4936-a2a9-831d65ec49bc"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
