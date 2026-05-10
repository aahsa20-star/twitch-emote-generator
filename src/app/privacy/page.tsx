import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "プライバシーポリシー | Twitch Emote Generator",
  description:
    "Twitch Emote Generator における個人情報の取り扱いに関するプライバシーポリシー。日本の個人情報保護法に準拠。",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-gray-200">
      <main className="flex-1 px-4 py-10 md:px-8 md:py-14">
        <article className="mx-auto max-w-3xl space-y-8">
          {/* Breadcrumb-ish back link */}
          <div className="text-sm">
            <Link
              href="/"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              ← トップへ戻る
            </Link>
          </div>

          {/* Title block */}
          <header className="space-y-2 border-b border-gray-800 pb-6">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
              プライバシーポリシー
            </h1>
            <p className="text-sm text-gray-400">
              最終更新日：2026年5月10日
            </p>
            <p className="text-sm text-gray-300 leading-relaxed">
              Twitch Emote Generator（以下「本サービス」）における個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。本ポリシーは日本の個人情報保護法に準拠して作成されています。
            </p>
          </header>

          {/* §1 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              1. 取得する個人情報
            </h2>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-100">
                1-1. Twitch アカウント連携時に取得する情報
              </h3>
              <p className="text-sm leading-relaxed">
                ユーザーが Twitch アカウントで本サービスにログインした場合、Twitch の OAuth 認証を通じて以下の情報を取得します。
              </p>
              <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
                <li>Twitch ユーザー ID</li>
                <li>Twitch ユーザー名（login）</li>
                <li>Twitch 表示名（display name）</li>
                <li>メールアドレス</li>
                <li>プロフィール画像 URL</li>
                <li>
                  @datsusara_aki チャンネルへのフォロー有無
                </li>
                <li>
                  上記チャンネルへのフォロー日時（フォローしている場合）
                </li>
              </ul>
              <p className="text-sm leading-relaxed">
                なお、@datsusara_aki チャンネル以外への、ユーザーのフォロー情報は取得しません。
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-100">
                1-2. ユーザーの操作によって取得する情報
              </h3>
              <p className="text-sm leading-relaxed">
                ユーザーが本サービス内で以下の操作を行った場合、Twitch アカウント情報（ユーザー ID、ユーザー名、表示名、プロフィール画像 URL）と関連付けて以下の情報を取得・保存します。
              </p>
              <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
                <li>
                  <strong className="text-gray-100">テンプレート投稿時：</strong>
                  投稿者情報、投稿したテンプレートの内容、説明文
                </li>
                <li>
                  <strong className="text-gray-100">AI アニメーション生成時：</strong>
                  生成リクエストの内容、AI への指示プロンプト（自由記入テキストを含む）
                </li>
                <li>
                  <strong className="text-gray-100">カスタムアニメーション投稿時：</strong>
                  アニメーション名、説明文、生成元プロンプト
                </li>
                <li>
                  <strong className="text-gray-100">「いいね」操作時：</strong>
                  いいねした対象のテンプレート ID
                </li>
                <li>
                  <strong className="text-gray-100">通報操作時：</strong>
                  通報対象、通報理由
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-100">
                1-3. ブラウザに保存される情報
              </h3>
              <p className="text-sm leading-relaxed">
                本サービスはユーザーの利便性のため、ブラウザの Cookie およびローカルストレージに以下の情報を保存します。
              </p>
              <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
                <li>セッショントークン（ログイン状態の維持）</li>
                <li>ユーザーが選択した UI 設定（テーマ、表示設定等）</li>
                <li>アクセス権限に関するキャッシュ情報</li>
              </ul>
              <p className="text-sm leading-relaxed">
                これらの情報はユーザー自身のブラウザにのみ保存され、サーバーには送信されません（セッショントークンを除く）。
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-100">
                1-4. アクセス解析情報
              </h3>
              <p className="text-sm leading-relaxed">
                本サービスは Umami Analytics を使用してアクセス解析を行います。Umami は Cookie や個人を特定する情報を使用せず、以下の匿名情報のみを収集します。
              </p>
              <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
                <li>ページビュー</li>
                <li>リファラー（前のページの URL）</li>
                <li>ブラウザ・OS の種類</li>
                <li>国・地域（IP アドレスから推定。IP アドレス自体は保存されません）</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-100">
                1-5. サーバーログ
              </h3>
              <p className="text-sm leading-relaxed">
                本サービスのインフラ提供元（Vercel）は、一般的なアクセスログ（IP アドレス、User-Agent 等）を一時的に保持する場合があります。これらは Vercel のプライバシーポリシーに基づいて取り扱われます。
              </p>
            </div>
          </section>

          {/* §2 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              2. 個人情報の利用目的
            </h2>
            <p className="text-sm leading-relaxed">
              取得した情報は、以下の目的のためにのみ利用します。
            </p>
            <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
              <li>ユーザーアカウントの識別および表示</li>
              <li>一部機能（ダウンロード機能、サブスク特典機能等）の利用権限の判定</li>
              <li>テンプレートギャラリーにおける投稿者表示</li>
              <li>重複投稿の防止およびスパム対策</li>
              <li>AI 機能の利用回数制限（レート制限）</li>
              <li>不適切コンテンツの自動非公開処理</li>
              <li>サービスの改善および不具合対応</li>
              <li>利用状況の統計分析</li>
            </ul>
            <p className="text-sm leading-relaxed">
              ユーザーの同意なく、上記以外の目的で個人情報を利用することはありません。
            </p>
          </section>

          {/* §3 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              3. 個人情報の保存場所と保持期間
            </h2>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-100">
                3-1. Twitch アカウント情報（セッション情報）
              </h3>
              <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
                <li>
                  <strong className="text-gray-100">保存場所：</strong>
                  JWT 形式のセッショントークン（HttpOnly Cookie）
                </li>
                <li>
                  <strong className="text-gray-100">保持期間：</strong>
                  セッション期間中（最大 30 日）
                </li>
              </ul>
              <p className="text-sm leading-relaxed">
                ログアウト時、または期間経過後に自動削除されます。
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-100">
                3-2. 投稿コンテンツに紐づく個人情報
              </h3>
              <p className="text-sm leading-relaxed">
                ユーザーが本サービス内でテンプレート投稿、AI アニメーション生成、いいね、通報等の操作を行った場合、Supabase 社が提供するデータベースサービスに
                <strong className="text-gray-100">永続的に保存されます</strong>
                。
              </p>
              <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
                <li>
                  <strong className="text-gray-100">保存場所：</strong>
                  Supabase（クラウドデータベース）
                </li>
                <li>
                  <strong className="text-gray-100">保持期間：</strong>
                  原則として永続。ただし、以下の場合に削除されます。
                  <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-gray-300">
                    <li>ユーザーが投稿の個別削除操作を行った場合</li>
                    <li>ユーザーが本ポリシー第 5 条に基づき削除請求を行った場合</li>
                    <li>本サービスの終了時</li>
                  </ul>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-100">
                3-3. ローカルストレージ情報
              </h3>
              <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
                <li>
                  <strong className="text-gray-100">保存場所：</strong>
                  ユーザー自身のブラウザ
                </li>
                <li>
                  <strong className="text-gray-100">保持期間：</strong>
                  ユーザーが削除するまで、またはブラウザの設定に従って削除されるまで
                </li>
              </ul>
              <p className="text-sm leading-relaxed">
                これらの情報はサーバー側には送信されません。
              </p>
            </div>
          </section>

          {/* §4 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              4. アップロードした画像について
            </h2>
            <p className="text-sm leading-relaxed">
              ユーザーが本サービスにアップロードした画像（エモート作成元の画像）は、
              <strong className="text-gray-100">サーバーには送信されず</strong>
              、すべてユーザー自身のブラウザ内で処理されます。本サービスはアップロード画像を保存しません。
            </p>
            <p className="text-sm leading-relaxed">
              ただし、ユーザーがテンプレートとして投稿する操作を明示的に行った場合に限り、生成結果のテンプレート情報が Supabase に保存されます。この場合の保存内容については第 1-2 条をご確認ください。
            </p>
          </section>

          {/* §5 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              5. 個人情報の削除請求について
            </h2>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-100">
                5-1. ユーザー自身による即時削除
              </h3>
              <p className="text-sm leading-relaxed">
                ユーザーは以下の方法で、本サービスが取得した自身の個人情報を削除できます。
              </p>
              <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
                <li>
                  <strong className="text-gray-100">ログアウト：</strong>
                  本サービスからログアウトすることで、セッショントークンに含まれる個人情報は消去されます。
                </li>
                <li>
                  <strong className="text-gray-100">Twitch 側でのアプリ連携解除：</strong>
                  Twitch のアカウント設定から本サービスとの連携を解除することができます。
                </li>
                <li>
                  <strong className="text-gray-100">ブラウザのストレージクリア：</strong>
                  ブラウザの設定から Cookie やローカルストレージを削除することで、ブラウザに保存された情報を消去できます。
                </li>
                <li>
                  <strong className="text-gray-100">個別投稿の削除：</strong>
                  本サービスにログインし、投稿者として自身が投稿したテンプレートやコンテンツを個別に削除できます。
                </li>
                <li>
                  <strong className="text-gray-100">アカウント全データ削除：</strong>
                  ログイン状態でギャラリー画面の「アカウント削除」ボタンから、Supabase 上の自身の全投稿者情報・投稿コンテンツ・操作履歴を即時削除できます。
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-100">
                5-2. 一括削除請求
              </h3>
              <p className="text-sm leading-relaxed">
                Supabase に保存された投稿者情報および関連データの一括削除を希望される場合は、第 10 条に記載の連絡先までご連絡ください。
              </p>
              <p className="text-sm leading-relaxed">
                ご連絡いただく際は以下の情報をお伝えください。
              </p>
              <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
                <li>Twitch ユーザー名（login）</li>
                <li>削除を希望する範囲（全データ／特定の投稿のみ等）</li>
              </ul>
              <p className="text-sm leading-relaxed">
                連絡を受けてから原則として
                <strong className="text-gray-100"> 14 日以内 </strong>
                に対応いたします。
              </p>
            </div>
          </section>

          {/* §6 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              6. 第三者への提供について
            </h2>
            <p className="text-sm leading-relaxed">
              本サービスは、ユーザーの個人情報を第三者に販売、ライセンス供与、その他の方法で提供することは行いません。
            </p>
            <p className="text-sm leading-relaxed">ただし、以下の場合を除きます。</p>
            <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
              <li>法令に基づき開示が要求される場合</li>
              <li>ユーザー本人の同意がある場合</li>
            </ul>
            <p className="text-sm leading-relaxed">
              なお、テンプレートギャラリーに投稿されたコンテンツに含まれる投稿者情報（Twitch ユーザー名、表示名、プロフィール画像）は、ギャラリーの公開機能により、本サービスを利用する他のユーザーが閲覧できる状態となります。これは「第三者への提供」ではなく、ユーザー自身が公開を選択した投稿の一部としての公開となります。
            </p>
          </section>

          {/* §7 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              7. 利用する外部サービス
            </h2>
            <p className="text-sm leading-relaxed">
              本サービスは以下の外部サービスを利用しています。各サービスのプライバシーポリシーは、それぞれのリンクからご確認ください。
            </p>
            <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
              <li>
                <strong className="text-gray-100">Twitch</strong>
                （認証およびアカウント連携）：
                <a
                  href="https://www.twitch.tv/p/legal/privacy-notice/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 break-all"
                >
                  https://www.twitch.tv/p/legal/privacy-notice/
                </a>
              </li>
              <li>
                <strong className="text-gray-100">Vercel</strong>
                （ホスティング）：
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 break-all"
                >
                  https://vercel.com/legal/privacy-policy
                </a>
              </li>
              <li>
                <strong className="text-gray-100">Supabase</strong>
                （データベース）：
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 break-all"
                >
                  https://supabase.com/privacy
                </a>
              </li>
              <li>
                <strong className="text-gray-100">Umami</strong>
                （アクセス解析）：
                <a
                  href="https://umami.is/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 break-all"
                >
                  https://umami.is/privacy
                </a>
              </li>
              <li>
                <strong className="text-gray-100">Anthropic</strong>
                （AI アニメーション生成）：
                <a
                  href="https://www.anthropic.com/legal/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 break-all"
                >
                  https://www.anthropic.com/legal/privacy
                </a>
              </li>
            </ul>
          </section>

          {/* §8 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              8. Cookie の使用について
            </h2>
            <p className="text-sm leading-relaxed">
              本サービスは以下の目的で Cookie を使用します。
            </p>
            <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
              <li>セッション管理（ログイン状態の維持）</li>
              <li>ユーザー設定の保存</li>
              <li>アクセス権限のキャッシュ</li>
            </ul>
            <p className="text-sm leading-relaxed">
              ブラウザの設定により Cookie を無効にすることができますが、その場合、ログイン機能等の一部機能が利用できなくなります。
            </p>
          </section>

          {/* §9 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              9. 未成年者の利用について
            </h2>
            <p className="text-sm leading-relaxed">
              本サービスは Twitch のサービス利用規約に準じます。Twitch のサービス利用規約により、13 歳未満のユーザーは Twitch のサービスを利用できません。本サービスにおいても同様の方針を適用します。
            </p>
          </section>

          {/* §10 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              10. お問い合わせ・削除請求の連絡先
            </h2>
            <p className="text-sm leading-relaxed">
              本プライバシーポリシーに関するお問い合わせ、または個人情報の削除請求は、以下の方法でご連絡ください。
            </p>
            <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
              <li>
                <strong className="text-gray-100">X（Twitter）DM：</strong>{" "}
                <a
                  href="https://x.com/akiissamurai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300"
                >
                  @akiissamurai
                </a>
              </li>
              <li>
                <strong className="text-gray-100">Twitch Whispers：</strong>{" "}
                <a
                  href="https://www.twitch.tv/datsusara_aki"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300"
                >
                  @datsusara_aki
                </a>
              </li>
            </ul>
          </section>

          {/* §11 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              11. 本ポリシーの変更について
            </h2>
            <p className="text-sm leading-relaxed">
              本サービスは、必要に応じて本プライバシーポリシーを変更することがあります。重要な変更がある場合は、本サービス上で告知します。本ポリシーの最終更新日は本ページ冒頭に記載しています。
            </p>
          </section>

          {/* Closing */}
          <div className="border-t border-gray-800 pt-6 text-sm text-gray-400">
            事業者：Aki（個人開発者）
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
