export default function Footer() {
  return (
    <footer className="mt-auto py-5 px-6 text-xs text-gray-500 border-t border-gray-800 space-y-3">
      <p className="text-center text-gray-400">
アップロードした画像はサーバーに送信されません。すべての処理はお使いのブラウザ内で完結します。
      </p>
      <ul className="text-center space-y-1 text-gray-500">
        <li>・本ツールはTwitchによる承認・審査の通過を保証するものではありません。</li>
        <li>・第三者の著作物・肖像を無断で使用しないでください。</li>
        <li>・生成物の利用はすべてご自身の責任で行ってください。</li>
      </ul>
    </footer>
  );
}
