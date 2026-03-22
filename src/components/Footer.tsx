import Image from "next/image";
import { Twitter, Youtube, MessageCircle } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-auto py-5 px-6 text-xs text-gray-500 border-t border-gray-800 space-y-3">
      <div className="text-center mb-6">
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSd0lqXIv7xUQW-twwu5QxBxcKsa62FxI81-ykmoCRLGq30EfA/viewform"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 text-sm border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:border-gray-400 transition-colors"
        >
          フィードバックを送る
        </a>
        <p className="text-xs text-gray-500 mt-1">改善のために、率直な意見をお聞かせください</p>
      </div>
      <p className="text-center text-gray-500">
        本サービスはTwitch Interactive, Inc.およびDiscord Inc.とは一切関係がありません。「Twitch」はTwitch Interactive, Inc.の、「Discord」はDiscord Inc.の登録商標です。
      </p>
      <p className="text-center text-gray-400">
        アップロードした画像はサーバーに送信されません。すべての処理はお使いのブラウザ内で完結します。
      </p>
      <ul className="text-center space-y-1 text-gray-500">
        <li>・本ツールはTwitchによる承認・審査の通過を保証するものではありません。</li>
        <li>・第三者の著作物・肖像・映像を無断で使用しないでください。</li>
        <li>・本ツールは現状有姿（AS-IS）で提供されます。動作・品質・特定目的への適合性について一切保証しません。</li>
        <li>・生成物の利用はすべてご自身の責任で行ってください。</li>
        <li>・背景透過はAIによる自動処理のため、結果の精度を保証しません。</li>
        <li>・AIが生成したアニメーションコードの著作権は投稿者に帰属しません。不適切なコンテンツは通報機能でご報告ください。</li>
        <li>・第三者の著作物・アニメーションを模倣した内容の投稿は禁止します。</li>
        <li>・テンプレート・アニメーションの投稿時にTwitchユーザー名・プロフィール画像が公開されることに同意したものとみなします。</li>
        <li>・投稿されたコンテンツは本サービスの機能改善・表示に使用する場合があります。</li>
      </ul>
      <p className="text-center text-gray-500">
        本サービスはサービス改善のためUmami Analyticsによるアクセス解析を行っています。取得するデータはIPアドレスを含まない匿名の統計情報のみです。
      </p>
      <div className="pt-3 border-t border-gray-800 space-y-3">
        <div className="flex items-center justify-center gap-4">
          <Image
            src="/aki.png"
            alt="Aki"
            width={40}
            height={40}
            className="rounded-full"
          />
          <span className="text-sm text-gray-400">Made by Aki</span>
          <div className="flex items-center gap-3">
            <a href="https://x.com/akiissamurai" target="_blank" rel="noopener noreferrer" aria-label="Xでフォロー" className="text-gray-500 hover:text-white transition-colors">
              <Twitter size={16} />
            </a>
            <a href="https://youtube.com/channel/UCLZJRStlPpH7fAjZjbjP4sQ" target="_blank" rel="noopener noreferrer" aria-label="YouTubeチャンネル" className="text-gray-500 hover:text-white transition-colors">
              <Youtube size={16} />
            </a>
            <a href="https://www.twitch.tv/datsusara_aki" target="_blank" rel="noopener noreferrer" aria-label="Twitchチャンネル" className="text-gray-500 hover:text-purple-400 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
            </a>
            <a href="https://discord.gg/9ktJgFrYKe" target="_blank" rel="noopener noreferrer" aria-label="Discordサーバー" className="text-gray-500 hover:text-white transition-colors">
              <MessageCircle size={16} />
            </a>
          </div>
        </div>
        <p className="text-center text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400 italic">{'"'}画像をアップするだけでスタンプが作れるツールが欲しい{'"'}</span>
          <br />
          配信中の視聴者の一言がきっかけでした。
          <br />
          コードが読めない・書けない・開発経験ゼロのAkiが、AIと2人で1週間で作り上げました。（2026年3月）
        </p>
      </div>
    </footer>
  );
}
