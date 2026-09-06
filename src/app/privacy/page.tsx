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
              最終更新日：2026年9月5日
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
                2026 年 9 月の更新で、テンプレート投稿・カスタムアニメーション投稿・いいね・通報・AI アニメーション生成の各機能を終了しました。現在の本サービスは、これらの操作に伴う情報（投稿内容、説明文、AI への指示プロンプト、いいね・通報の履歴）を取得・保存しません。
              </p>
              <p className="text-sm leading-relaxed">
                終了前に投稿されたデータの取り扱いは第 3-2 条をご確認ください。
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-100">
                1-3. ブラウザに保存される情報
              </h3>
              <p className="text-sm leading-relaxed">
                本サービスはユーザーの利便性のため、ブラウザの Cookie およびローカルストレージに以下の情報を保存します。
              </p>
              <ul className="list-disc list-inside text-sm leading-relaxed space-y-1 pl-2">
                <li>
                  <strong className="text-gray-100">Twitch セッション Cookie：</strong>
                  ログイン状態の維持。Twitch から取得したアクセストークン、および指定チャンネルをフォローしているかの確認結果（確認日時を含む）を暗号化して保持します。フォロー確認の結果は通常 24 時間、Twitch 側の一時的な障害時は最長 48 時間まで有効として扱います。
                </li>
                <li>
                  <strong className="text-gray-100">合言葉 Cookie（emote-access-v1）：</strong>
                  合言葉で解放した状態の維持。合言葉そのものは含まず、サーバーの署名と有効期限（発行から 30 日）だけを持ちます。閲覧で期限は延長されません。
                </li>
                <li>ユーザーが選択した UI 設定（表示設定等）</li>
              </ul>
              <p className="text-sm leading-relaxed">
                上記の Cookie は、アクセスのたびにブラウザからサーバーへ送信され、サーバー側で利用可否の判定に使われます。UI 設定はブラウザ内にのみ保存され、サーバーには送信されません。
              </p>
              <p className="text-sm leading-relaxed">
                合言葉の入力には、総当たり対策として送信元（IP アドレスをハッシュ化した値）ごとに 15 分あたり 10 回までの試行制限を設けています。この記録はサーバーのメモリ上にのみ、IP アドレスを復元できない形で一時的に保持され、制限期間（15 分）の経過またはサーバーの再起動で破棄されます。データベース等への永続保存は行いません。
              </p>
              <p className="text-sm leading-relaxed">
                「Twitch からログアウト」と「この端末の合言葉認証を解除」は別の操作です。片方を行っても、もう一方の Cookie は削除されません。
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
              <li>作成・保存機能の利用権限の判定（指定チャンネルのフォロー確認、合言葉認証）</li>
              <li>合言葉入力の総当たり対策（試行制限）</li>
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
                3-2. 終了した共有機能（テンプレート・カスタムアニメーション）のデータ
              </h3>
              <p className="text-sm leading-relaxed">
                2026 年 9 月の更新以降、本サービスのアプリケーションはデータベースに接続せず、新たな投稿データを保存しません。
              </p>
              <p className="text-sm leading-relaxed">
                機能終了前に投稿されたテンプレート・カスタムアニメーション・いいね・通報・AI 生成履歴のデータは、当時利用していたデータベースサービス（Supabase）上に残存している可能性があります。これらは現在アプリから閲覧・編集・削除できず、他のユーザーにも公開されていません。残存データの保持または削除の方針は運営者が決定し、削除を希望されるユーザーには第 5 条の手順で対応します。
              </p>
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
                  <strong className="text-gray-100">合言葉認証の解除：</strong>
                  「アカウント・データ管理」画面または編集画面の「この端末の合言葉認証を解除」から、合言葉 Cookie を削除できます。
                </li>
              </ul>
              <p className="text-sm leading-relaxed">
                共有機能の終了に伴い、アプリ内からの「個別投稿の削除」「アカウント全データ削除」は提供していません。終了前の投稿データの削除は第 5-2 条の請求で対応します。
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-100">
                5-2. 一括削除請求
              </h3>
              <p className="text-sm leading-relaxed">
                機能終了前に投稿された投稿者情報および関連データ（第 3-2 条）の削除を希望される場合は、第 10 条に記載の連絡先までご連絡ください。
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
                （終了した共有機能の残存データの保管。アプリからの接続はありません）：
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
              <li>セッション管理（ログイン状態の維持、フォロー確認結果の保持）</li>
              <li>合言葉認証の状態の保持（署名付き Cookie）</li>
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
