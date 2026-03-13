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
      </ul>
      <p className="text-center text-gray-500">
        本サービスはサービス改善のためUmami Analyticsによるアクセス解析を行っています。取得するデータはIPアドレスを含まない匿名の統計情報のみです。
      </p>
      <div className="text-center pt-3 border-t border-gray-800">
        <p className="text-gray-500 mb-2">Made by Aki</p>
        <div className="flex items-center justify-center gap-4">
          <a href="https://x.com/akiissamurai" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors">
            <Twitter size={16} />
          </a>
          <a href="https://youtube.com/channel/UCLZJRStlPpH7fAjZjbjP4sQ" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors">
            <Youtube size={16} />
          </a>
          <a href="https://discord.gg/CheMXWdj" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors">
            <MessageCircle size={16} />
          </a>
        </div>
      </div>
    </footer>
  );
}
