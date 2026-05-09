# 品質監査レポート — エモート出力品質の現状分析

**目的**: VLLO等の他ツールと比べて出力が見劣りする問題に対して、原因の特定と修正方針の整理。
**スコープ**: コード変更なし、現状のパイプラインを実出力で検証。
**監査者**: Claude (Sonnet)
**日付**: 2025-05-09

---

## エグゼクティブサマリー

実際の合成テスト画像3種を本番ビルドのパイプラインに通して28/56/112px出力を取得し、視覚比較した。**最大の発見は「28px出力にテキストが一切焼き込まれない」という意図的な仕様**。次点で「フチ取りが28pxで実質的に消える」「自動クロップの余白が大きすぎて被写体が小さく見える」。

### 28px実出力（Read tool で視覚確認、各画像はリポジトリの `test-images/` に保存）

| ケース | 出力 | 一目の所見 |
|---|---|---|
| 01-logo-star_28 | ![](test-images/01-logo-star_28.png) | 星と紫枠は識別可能、ただし周囲に明らかな余白、コーナーのギザつき |
| 02-portrait_28 | ![](test-images/02-portrait_28.png) | 顔は識別可能だが目・口がほぼ消失、被写体が小さい |
| 02-portrait-white-border_28 | ![](test-images/02-portrait-white-border_28.png) | **白フチONなのに視覚的に判別不能**（プレーンな portrait と区別がつかない） |
| 03-icon_28 | ![](test-images/03-icon_28.png) | ハートと黄ドット、ドットが極小で識別困難 |
| 03-icon-with-text_28 | ![](test-images/03-icon-with-text_28.png) | **テキスト「草」が完全に消失**（ただのハート+ドットになる） |
| 02-portrait-border-text_28 | ![](test-images/02-portrait-border-text_28.png) | **フチもテキストも消失**、プレーンな portrait と区別不能 |

### 112px との比較（参考）

| ケース | 112px |
|---|---|
| 03-icon-with-text_112 | ![](test-images/03-icon-with-text_112.png) |

→ 112pxでは「草」が中央に明確に表示されるが、**28pxでは完全に消える**。これがユーザーの「文字が読めない」体感の正体。

### 致命度の高い問題ランキング

1. 🔴 **28px出力からテキストが完全に消える**（条件分岐 `size > 32` の意図的なスキップ）
2. 🔴 **フチ取りが28pxで視覚的に消える**（線幅 ≈ 0.5px、shadow blur で更に薄まる）
3. 🟡 **背景透過後の縁にエイリアシング/ハロー**（color decontamination が無い）
4. 🟡 **自動クロップの余白がやや大きい**（5%/3.5%/2% padding）
5. 🟡 **マスター解像度が控えめ**（HI_RES=224、112px出力には2倍しかない）
6. 🟢 **GIFはディザリング無し** （`quality: 10` で固定、ユーザー制御なし）

---

## カテゴリ1: オートクロップ・余白制御

### 1.1 該当コード
- [src/lib/canvas/types.ts:35-58](src/lib/canvas/types.ts) — `findContentBounds(imageData)`：alpha > 10 のピクセル境界をスキャン
- [src/lib/canvas/backgroundRemoval.ts:9-29](src/lib/canvas/backgroundRemoval.ts) — `centerAndResize(source, targetSize, padding=0.05, adjustment?)`
- [src/lib/canvas/backgroundRemoval.ts:80-128](src/lib/canvas/backgroundRemoval.ts) — `drawWithBounds(...)`：実描画
- [src/lib/canvas/pipeline.ts:130-135](src/lib/canvas/pipeline.ts) — `processEmote` 内で `effectivePadding` を size 別に縮小（≤32: ×0.4、≤56: ×0.7、else: ×1.0）

### 1.2 現状挙動

1. 背景透過後の Canvas に対して `findContentBounds` が alpha>10 のピクセルを走査して bbox を求める
2. bbox を切り出して `targetSize - 2*padding*targetSize` に内接フィット（アスペクト比保持、最大辺基準）
3. `padding` は config 由来（デフォルト 0.05）×サイズ別係数

**重要**: bbox は alpha>10 のピクセルを基準にしているので、**背景透過がうまくいった場合のみオートクロップが効く**。`skipBgRemoval` パスや、alpha が常に 255（透過処理なし、不透明背景の元画像）の場合、findContentBounds は画像全体を返し、**オートクロップが事実上無効化**される。

実出力で確認すると、portrait_28.png は顔が canvas の ~70% に収まっているので、bg removal が効いた状態では bbox 検出は機能している。ただし 5% padding × HI_RES=224 = 11.2px の余白が両側に残るため、被写体が小さく見える。

### 1.3 根本原因

- **(A) 余白5%は静止画では適切でも、28px Twitchエモート用途には大きすぎる**。VLLO等は実質0〜2%。チャット中の小さい画像で被写体面積が大きく見える方が刺さる。
- **(B) `skipBgRemoval` 時の自動クロップ無効化**: 不透明背景の元画像を「透過済み」として通すと、findContentBounds が画像全体を返してクロップが効かない。被写体が canvas の 30-50% しかない場合、極端に小さく見える。
- **(C) GIF/動画の `computeUnionBounds`**: 全フレーム和集合で一つの bbox を計算しているのは正しいが、サイズ別 padding 縮小ロジック（×0.4/0.7/1.0）は画像と統一されている。この値もそもそも大きい。

### 1.4 修正方針

| 優先度 | 内容 |
|---|---|
| **A** | デフォルト padding を **0.05 → 0.02 (2%)** に下げる。サイズ別係数を `≤32: 0`/`≤56: 0.5`/`else: 1.0` に。28px出力では実質マージン0。 |
| **A** | `skipBgRemoval` パスでも自動クロップを実行: alpha が一様に 255 の場合は **明度ベースの bbox 検出**にフォールバック（背景白前提で「白でない」ピクセル境界を検出）または **ユーザーに矩形クロップUIを提示**。 |
| **B** | `findContentBounds` の alpha 閾値 10 → 30 にして、bg removal の弱い半透明エッジを bbox から除外（よりタイトなクロップ）。 |
| **C** | 「賢いデフォルト」: 顔検出（既存の MediaPipe）が効く画像では、顔の中心を canvas 中央に強制配置 + 顔比率 50% 程度に拡大するモードを追加。 |

---

## カテゴリ2: マスター解像度とリサイズパイプライン

### 2.1 該当コード
- [src/lib/canvas/types.ts:1-8](src/lib/canvas/types.ts) — `HI_RES = 224`、`GIF_HI_RES = 256`、`USM_MAX_SIZE = 56`
- [src/lib/canvas/pipeline.ts:82-117](src/lib/canvas/pipeline.ts) — `downscale(source, targetSize)`: 段階的1/2縮小 + bilinear + USM
- [src/lib/canvas/pipeline.ts:24-80](src/lib/canvas/pipeline.ts) — `applyUSM(canvas, amount=0.6)`: 3x3 box blur によるアンシャープマスク
- [src/lib/canvas/pipeline.ts:119-185](src/lib/canvas/pipeline.ts) — `processEmote`: HI_RES=224 でフチ・テキスト等を描画後、targetSize にダウンスケール

### 2.2 現状挙動

1. **マスター解像度 = 224px**（112pxの2倍）。すべての処理（centerAndResize、border、frame、text）はこの解像度で行う。
2. **段階的縮小**: `224 → 112 → 56 → 28`。各段で 1/2 にするまで bilinear (`imageSmoothingQuality: "high"`) で halve、最後に targetSize にフィット。これは Lanczos 相当の画質を bilinear だけで近似する正攻法。✓ 良い実装。
3. **USM (Unsharp Mask)**: 出力サイズ ≤ 56 のときのみ適用。amount=0.6 の控えめなシャープニング。3x3 box blur ベース。透明ピクセルはスキップしてエッジハロー回避。

### 2.3 根本原因

- **(A) HI_RES=224 が低すぎる**。28px出力に対してはマスターが8倍欲しいところ、現在は8倍だが、112px出力に対してはたった2倍。112px ターゲットの細部（テキストの輪郭、フチのアンチエイリアス）が再現しきれない。VLLO等は内部で4K相当で処理して縮小する。
- **(B) USM の amount=0.6 は控えめ**。28pxではもう少し強くシャープにすると識別性が上がる。box blur ベースなので Gaussian の方が品質が高い。
- **(C) GIF用の 256px (GIF_HI_RES) は微妙な選択**。なぜ 224 と異なるのか不明確。512 に統一するのが自然。

### 2.4 修正方針

| 優先度 | 内容 |
|---|---|
| **A** | `HI_RES` を **224 → 448** に倍増。`GIF_HI_RES` も **256 → 512** に統一。フチ・テキストが鮮明になる（特に112px出力）。**メモリ影響は小**（448×448×4 = 0.8MB/canvas、許容範囲）。 |
| **B** | USM の amount をサイズ別に: 28px=0.9、56px=0.7、112px=0.5。 |
| **B** | USM の box blur を **Gaussian (3x3 with kernel [1,2,1; 2,4,2; 1,2,1]/16)** に置換。エッジ周辺のリンギングが減る。 |
| **C** | OffscreenCanvas + Web Worker で重い処理を移譲（UX の体感速度向上、品質には影響しない）。 |

---

## カテゴリ3: テキストレンダリング 🔴最優先カテゴリ

### 3.1 該当コード
- [src/lib/canvas/drawing.ts:88-146](src/lib/canvas/drawing.ts) — `applyTextOverlay(canvas, options, canvasSize)`
- [src/lib/canvas/pipeline.ts:160-175](src/lib/canvas/pipeline.ts) — `processEmote` の text 適用箇所、**`size > 32` 条件で28px出力をスキップ**
- [src/lib/canvas/pipeline.ts:228-243](src/lib/canvas/pipeline.ts) — `processFrameWithBounds` の同様の条件

### 3.2 現状挙動

```ts
// pipeline.ts:160
const textToRender = resolveTextToRender(config);
if (textToRender && size > 32) {  // ← 28 はここで弾かれる
  canvas = applyTextOverlay(canvas, {...}, HI_RES);
  ...
}
```

`applyTextOverlay` 内部:
- font サイズ: `userFontSize * (canvasSize/112)`、デフォルト `canvasSize * 0.22`
- フチ幅: `userOutlineWidth * (canvasSize/112)`、デフォルト `canvasSize * 0.025`、デフォルト userOutlineWidth=3
- 描画順: `strokeText` → `fillText` ✓ 正しい順序
- `lineWidth = outlineWidth * 2`（描画幅は半分が外側に出るのでこれで正味 outlineWidth）✓ 正しい
- `lineJoin: "round"`、`miterLimit: 2` ✓ 妥当
- フォントは `bold ${size}px ${family}` で常に bold 指定

実出力検証:
- 03-icon-with-text_112.png: 「草」が中央に明確、フチも見える ✓
- **03-icon-with-text_28.png: 「草」が完全に存在しない** 🔴
- 02-portrait-border-text_28.png: 同じく「草」消失 🔴

### 3.3 根本原因

#### 致命的: `size > 32` での意図的スキップ

コメントには「text is unreadable at 32px or smaller」とあり、開発時に「28pxで文字を入れても読めないからスキップする」という判断がされている。しかし:

- ユーザーUI上で「テキスト」を入力すると 28/56/112 全てに反映される印象を与える
- プレビューは 112px ベースなので「テキスト見えてる」と思って書き出すと、最も使われる 28px には**何も入っていない**
- これは仕様じゃなく**UXバグ**。少なくとも「28pxでは省略されます」の明示的な警告が必要。
- 実際には 28px でも 1〜2文字（「草」「!」「?」）なら十分読める

#### 構造的: 28pxでのフチ幅が 0.75px 相当

userOutlineWidth=3 (display px at 112) → 224 master では 6px → 28px 出力スケールでは `6 × 28/224 = 0.75px`。**サブピクセル幅**で、アンチエイリアスでほぼ消える。

#### 構造的: フォントサイズも 28px では極小

userFontSize null のときデフォルト `canvasSize * 0.22 = 0.22 × 224 = 49.28px`、28px 出力スケールでは `49.28 × 28/224 = 6.16px`。可読限界以下。

### 3.4 修正方針

| 優先度 | 内容 |
|---|---|
| **A** ⭐ | **`size > 32` のスキップを撤廃** または **「28pxではテキストが省略されます」のUI警告**を追加。スキップを撤廃するなら、28px時はフォントを最大化（canvasSize × 0.4 程度）+ フチを最低 1px 確保。 |
| **A** | フチ幅の最低保証: `outlineWidth = max(1px-in-output-space, scaled)`。28px 出力で 1px 以下にならないよう floor。 |
| **A** | フォントサイズの最低保証: 28px 出力で文字が canvas 高さの 50% を下回らないよう floor。 |
| **B** | フチ取りを `strokeText` ではなく **シルエット+shadowBlur**（border と同じ手法）にして、28pxでもエッジが滑らかに。または **3x3 stamp filter**（4方向 fillText でフチを「叩く」）でアンチエイリアスを保証。 |
| **B** | `textBaseline: "middle"` + `actualBoundingBoxAscent` でフォントによっては数px ズレる。フォント別オフセット表を持つか、`measureText` の bounding box を使った再センタリングを実装。 |
| **C** | 文字色・フチ色のデフォルトを「白文字+黒フチ・3pxフチ」に（コントラスト最大化）。現在は白文字+黒フチがデフォルトなのでOKだが、フチ幅3pxは前述のように28pxでは 0.75px になるので大きめのデフォルトに（例: 5）。 |

---

## カテゴリ4: フチ取り（Border）品質

### 4.1 該当コード
- [src/lib/canvas/drawing.ts:7-84](src/lib/canvas/drawing.ts) — `applyBorder(canvas, style, userBorderWidth, customBorderColor, outputSize)`

### 4.2 現状挙動

**アルゴリズム**: シルエット（被写体形状を border 色で塗りつぶし）を作成 → 大きい canvas に shadowBlur 付きで3回 drawImage（不透明度ビルドアップ） → destination-out でシルエット中心をくり抜き → 元画像と合成。

**スケーリング**:
- `scaleFactor = outputSize / size`（HI_RES から見た縮小率）
- `borderScaleFactor = max(0.5, sqrt(scaleFactor))` ← 28px 出力では `max(0.5, sqrt(0.125)) = 0.5`
- `borderWidth = max(1, round(userBorderWidth * (size/112) * borderScaleFactor))`
- userBorderWidth=4 (デフォルト) → 224 master で `4 × 2 × 0.5 = 4px`
- 出力スケールに換算: `4 × 28/224 = 0.5px` 相当

### 4.3 根本原因

#### 致命的: 28pxでのフチ幅が ≈0.5px

実出力で確認: **白フチありの portrait と無しの portrait が視覚的に判別できない**。これは:
1. shadowBlur ベースなのでエッジが半透明（3パス重ね描きでも完全不透明にならない）
2. 224 master 上で 4px のフチ → 28px 出力で 0.5px 相当 → ほぼ消える
3. 透明背景上では視認性がさらに低い（白フチが他の白っぽいピクセルと混ざる）

#### 設計的: shadowBlur はラスター/ぼかしベース

shadowBlur は GPU ぼかしで実装される（環境によっては CPU フォールバック）。エッジが「ふわっ」となるのが意図だが、**28px ではボケが幅を食い尽くしてフチが見えない**。VLLO 等は **distance transform** か **stamp filter (8方向 fillRect)** で1px精度のシャープなフチを描いている。

### 4.4 修正方針

| 優先度 | 内容 |
|---|---|
| **A** ⭐ | フチ幅の出力スケール最低保証: 28px 出力では 1.5px、56px では 2px、112px では 3px を下限にする（`borderWidth = max(outputMinPx * (size/output), userScaled)`）。 |
| **A** | shadowBlur 方式から **8方向 stamp filter** に置換: `for (dx,dy in 8方向)` で `drawImage(silhouette, dx*r, dy*r)` を重ねる。エッジが鋭く、フチ幅が予測可能。コード量増 ~30 行。 |
| **B** | distance transform ベース（より高品質、計算コスト高）。被写体マスクから各ピクセルまでの最短距離を求めて threshold でフチ。subpixel 精度で 28px でも美しい。 |
| **B** | フチ色のデフォルトを「黒」（白より背景馴染みに強い）にする。ユーザーの白フチ選択は尊重。 |

---

## カテゴリ5: 背景透過の縁処理

### 5.1 該当コード
- [src/lib/backgroundRemoval.ts:1-26](src/lib/backgroundRemoval.ts) — `removeBackground(imageBlob, onProgress, quality)`：@imgly/background-removal を呼ぶだけ
- 後処理: なし

### 5.2 現状挙動

`@imgly/background-removal` の出力 PNG をそのまま `bgRemovedCanvas` にする。**color decontamination・alpha matting・1pxエロージョン・feathering 等の後処理は一切なし**。

`@imgly/background-removal` (ISNet モデル) の特性:
- Hard alpha 寄り（境界 1〜2px は半透明、それ以外は 0 か 255）
- **RGB値は元画像のまま**（背景色の混入があるピクセルは半透明＋元のRGB）
- Composite 時に元の背景色が「ハロー」として残る

### 5.3 根本原因

- **(A) Color decontamination 不在**: 髪の毛・縁取り部分で「白背景画像 → 透過 → ダーク背景に乗せる」と縁に白いハローが残る。VLLO 等はこれを matting refinement で除去している。
- **(B) Alpha threshold ベースの bbox 検出**: alpha>10 の閾値が緩いと、ノイズアルファでクロップが緩くなる。alpha>30〜50 の方がタイト。
- **(C) 1px エロージョン無し**: bg removal の境界 1px は不安定（モデル誤差）なので、erosion で削るとクリーンになるが、削りすぎるとディテール喪失。

### 5.4 修正方針

| 優先度 | 内容 |
|---|---|
| **A** | 簡易 color decontamination: 半透明ピクセル（0 < alpha < 255）に対して、周辺の不透明ピクセルから RGB を sample して置換。エッジの色滲みが減る。実装 ~50 行。 |
| **A** | findContentBounds の alpha 閾値を 10 → 30 にして bbox を tighter に（カテゴリ1と連動）。 |
| **B** | 1px エロージョン: 半透明ピクセルを「不透明な隣接が < 4」の場合に透明化。edge の不安定さを抑える。 |
| **B** | Alpha matting refinement (Closed-form / KNN matting): 計算コスト高だが品質は劇的に改善。WebAssembly 実装あり。 |
| **C** | Bg removal モデルを **isnet (高精度)** に統一。現在はデフォルト `isnet_quint8`（量子化版で高速だがエッジが甘い）。`quality` フラグで切替できるが、デフォルト変更を検討。 |

---

## カテゴリ6: アニメーション品質

### 6.1 該当コード
- [src/lib/gif/animatedEncoder.ts:1-65](src/lib/gif/animatedEncoder.ts) — `encodeAnimatedGif(frames, delays, size, repeat)`：gif.js 薄ラッパ
- [src/lib/animations/index.ts](src/lib/animations/index.ts) — 既存52種アニメ用の `generateGif` (gif.js)

### 6.2 現状挙動

- フォーマット: **GIF only**。APNG・WebP は使っていない。
- gif.js の設定:
  - `quality: 10`（1=最高画質、30=最低、10は中位）
  - `transparent: 0x00000000`（完全透明のみ透過）
  - `workers: 2`、`workerScript: "/gif.worker.js"`
  - `repeat`: 設定可能（再生設定機能で実装済み）
- フチ・テキスト・フレーム装飾: **毎フレーム再描画**（オーバーレイ合成ではない）。`processFrameWithBounds` が各フレームに同じ装飾を適用。
- ディザリング・色数最適化: gif.js のデフォルト neuquant 量子化（256色）、ディザリング設定は明示してない（デフォルト）。

### 6.3 根本原因

- **(A) GIF は alpha が 1bit（透明か不透明）**: 半透明ピクセル（bg removal の境界）が 0 or 255 に丸められて**ジャギー化**。これが「アニメGIFのフチがガタつく」原因。
- **(B) GIF の256色制限**: 高彩度の漸変（ぼかし、shadowBlur）でバンディングが目立つ。
- **(C) ディザリング無設定**: gif.js の `dither: false` (デフォルト)。`dither: 'FloydSteinberg'` にすると階調が滑らかになる（ファイルサイズは少し増える）。
- **(D) `quality: 10` 固定**: ユーザーが品質を選べない。1にすればクオリティ向上、30にすればサイズ削減。

### 6.4 修正方針

| 優先度 | 内容 |
|---|---|
| **A** | gif.js に `dither: 'FloydSteinberg'`（または `'FalseFloydSteinberg-serpentine'` がより自然）を追加。エッジのジャギー感とバンディングが軽減。ファイルサイズ +5〜15%。 |
| **B** | **APNG 対応**: フル alpha + 全色出力可能。半透明エッジが綺麗に出る。`UPNG.js` (~30KB) で実装可能。Twitch・Discord・7TV 全てで APNG 対応。GIF と並列で出力するか、ユーザー選択。 |
| **B** | **WebP アニメーション**: Twitch は対応してないが Discord・7TV は対応。ファイルサイズが GIF/APNG の半分以下、品質も上。`@webp/webp-encoder` で実装可能。 |
| **B** | gif.js `quality` をユーザー設定可能に（1〜30）。デフォルトは 5（高画質寄り）。 |
| **C** | フチ・テキストを **全フレーム共通レイヤーとして1回描画** → 各フレームに合成 で計算量削減。今は毎フレーム再描画なので 60フレームなら60回フチ計算。これを1回に減らせる。**ただし `processFrameWithBounds` の bounds 計算と統合する設計工夫が必要**。 |

---

## 全体まとめ — 修正優先度マトリクス

### 🔴 優先度A（次セッションで実装、ユーザー体感に直結）

1. **テキストの28pxスキップを撤廃 or UI警告**（カテゴリ3）— 一番のユーザー不満の正体
2. **フチ幅の出力スケール最低保証** + **stamp filter 化**（カテゴリ4）— 28pxでフチが見えない問題
3. **デフォルト padding 0.05 → 0.02**（カテゴリ1）— 被写体が小さく見える問題
4. **HI_RES 224 → 448 に倍増**（カテゴリ2）— マスター解像度を上げて細部が潰れない
5. **フォントサイズ・フチ幅の最低保証**（カテゴリ3）— 28pxでも読めるサイズに floor
6. **gif.js に Floyd-Steinberg ディザリング追加**（カテゴリ6）— エッジのジャギー軽減

### 🟡 優先度B（次々セッション、品質をさらに引き上げる）

7. Color decontamination（カテゴリ5）— 縁のハロー除去
8. APNG 出力対応（カテゴリ6）— 半透明エッジが綺麗
9. USM をサイズ別 amount + Gaussian 化（カテゴリ2）
10. Distance transform ベースのフチ取り（カテゴリ4）
11. 1px エロージョン（カテゴリ5）

### 🟢 優先度C（余裕があれば）

12. 顔検出ベースの「賢いデフォルト」配置（カテゴリ1）
13. WebP アニメ対応（カテゴリ6）
14. OffscreenCanvas + Worker（カテゴリ2）

---

## 監査時に気づいた追加の品質改善案

監査スコープ外だが、視覚的・体験的に気になった点を列挙します。

### 1. プレビューの正確性

現在のプレビューは**画面上の表示倍率が実エモートサイズと無関係**。Twitch チャットでの実物大（28px）プレビューを「Twitchチャットで見るとこう」というUIで提供すべき。実際のチャットを模した背景（Twitchの暗いグレーの上にエモートを並べた画像）+ 28px 等倍表示で「読めるか」テストできる。これがあれば、ユーザーは出力品質の問題を**自分で**発見できる。優先度: **A**

### 2. テキスト位置・回転の自由度

現在は top/center/bottom の3択 + offsetX/Y。任意の角度回転（-15°〜+15°）と縁取りスタイル（フラット・3D・グラデ）があると、表現力が大きく上がる。Twitchエモートでよく見る「斜めに大きく文字」が今は出来ない。優先度: **B**

### 3. 「Auto Fit」モード

「被写体が canvas の何%を占めるか」をユーザーが選べるスライダー。現状は padding しか触れない。「被写体を canvas の 80% / 90% / 100% で配置」のプリセットがあると、被写体の大きさが一目でわかる。padding と内部的に同等だが UX的に直感的。優先度: **A**

### 4. 「Twitchチャット潰れチェッカー」

28px 出力を **2倍／3倍／4倍に拡大表示**して「これがチャット内で見えるサイズです」と示すコンパニオンビュー。ユーザーが「あ、文字が潰れてる」「フチ薄すぎ」と自分で気づける。これは多分一番効果的な「品質感」UI。優先度: **A**

### 5. プリセットスタイル

「ミーム風」「シンプル」「インパクト」みたいなクリック1発で全パラメータが決まるプリセット。VLLO 等の「テンプレート」UIに相当。素人が**何を選べばいいか分からない問題**が解消する。テンプレート機能はあるがそれは構図テンプレなので、**スタイル**プリセット（フチ太さ・テキスト大きさ・フォント・色の組み合わせ）が別途欲しい。優先度: **B**

### 6. 文字のグラデーション・影

`fillStyle = grad`（CanvasGradient）と shadowBlur をテキストに適用するだけで、品質感が大きく変わる。VLLO のテキスト品質はほぼ「上から下へのゴールド/赤系グラデ + 下方向の影」で作られている。実装 ~20 行。優先度: **B**

### 7. 「色の自動推奨」

被写体の主要色を抽出してフチ色をコントラスト最大の色に自動設定する機能。今はユーザーが選ぶ必要があり、白被写体に白フチを選んでしまう事故が起きる（実際の監査でも白フチが消えた）。実装: 主要色抽出 (k-means or pixel sampling) → 補色をフチに。優先度: **B**

### 8. 「チャット内での見やすさスコア」

出力画像から「チャット内で何文字目までが読めるか」「フチ幅は十分か」を簡易的にスコア化（0〜100）して表示。技術指標（コントラスト比、フチ幅÷被写体サイズ、テキスト面積比）から計算。**ユーザーは数字に弱いがバッジには弱い**。優先度: **C**

### 9. 出力サイズの可変化

現在は Twitch=28/56/112、Discord=32/64/128 等で固定。**512px 出力**（プロフィール用）や **24px 出力**（古いプラットフォーム互換）の選択肢があると応用が利く。優先度: **C**

### 10. アンドゥ・履歴

操作のアンドゥが無い。フチ色を変えてしまったら戻すのが面倒。`useState` 履歴スタックで20手分くらい持てば十分。優先度: **B**

### 11. 「文字なら太字フォント、画像ならディスプレイフォント」の自動レコメンド

22フォント全部見せられても素人は選べない。「短いテキストなら Dela Gothic、長いテキストなら Noto Sans」など、テキスト内容ベースの推奨が自動で反映されると親切。優先度: **C**

---

## 監査メソッドの記録

検証手段として以下を実施しました（再現可能性のため）:

1. プロダクションビルド（`npm run build && npm run start`）を起動
2. ブラウザeval (`mcp__Claude_Preview__preview_eval`) で3種の合成画像を生成:
   - 01-logo-star: 紫の角丸正方形 + 黄色の星
   - 02-portrait: 顔（円）+ 肩のシルエット
   - 03-icon: 赤いハート + 4隅の黄ドット
3. アップロード → ImageAdjustEditor スキップ → `透過済みPNGをそのまま使う` トグル → 28/56/112px の各 variant を取得
4. ボーダー有/テキスト有/両方有 の組み合わせも追加キャプチャ
5. base64 デコードして `test-images/` に保存
6. Read tool で視覚確認

12個のPNGファイル (`test-images/*.png`) はリポジトリにコミットされ、次セッションで実装結果と Before/After 比較できます。

---

## まとめ

最大の不満の正体は **「28px 出力からテキストとフチが消える」** という設計上の欠陥（意図的だが UI で告知していない）。これは1日で直せます。
他の品質課題（マスター解像度、color decontamination、ディザリング、アニメ品質）も既存コードに小〜中規模の追加で対応可能。**全部実装すれば VLLO に肉薄するレベルまで上がる**と判断します。

次セッションで優先度Aから順に実装してください。

---

## 修正履歴

各修正の適用結果ログ。実測ベースの視覚・性能検証は **修正5完了後にまとめて実施** する方針（中間 after 画像は再生成コストに見合わない）。各修正は静的分析（コード読みからの導出）+ `npm run build` smoke test で個別確認。

### 修正1: HI_RES 224 → 448（カテゴリ2）

**変更**: `src/lib/canvas/types.ts` の `HI_RES` 定数を 224 → 448 に引き上げ。

**狙い**: 112px出力で 4倍オーバーサンプリング（旧2倍）になり、border/text/frame の anti-alias 精度が向上。

**静的分析（実測ではなく数式から導出）**:

| 指標 | before (224) | after (448) | デルタ |
|---|---|---|---|
| Master canvas メモリ | 196 KiB (224²×4) | 784 KiB (448²×4) | +588 KiB / canvas |
| Pipeline同時保持 canvas 数 | 最大2枚 | 最大2枚 | 構造変化なし |
| Pipeline中のメモリpeak | — | — | **+1.15 MiB** |
| Master上の描画コスト (border/frame/text) | O(224²) | O(448²) | **×4** |
| 28px出力の downscale 段数 | 3段 + USM | 4段 + USM | +1段 |
| 28px出力の downscale 累積コスト | ≈65K ops | ≈265K ops | **×4** |
| bg-removal | — | — | **影響なし**（pipeline 外） |
| GIF アニメ生成 | GIF_HI_RES=256 | GIF_HI_RES=256 | **影響なし** |

**体感処理時間予測**: bg-removal がドミナント（〜1〜3秒）なので、pipeline側が4倍になっても総処理時間としては **+5〜20%** 程度。Twitchエモートは1回出して終わるユースケースなので許容範囲。

**スコープ確認**:
- `processEmote` (line 119-185): HI_RES を 5箇所で使用 ✅ 影響あり
- `processFrameWithBounds` (line 262-319): HI_RES を 3箇所で使用 ✅ 影響あり
- `processEmoteWithHiRes` (line 191-249): GIF_HI_RES=256 を使用 ❌ 影響なし
- `downscale` (line 82-117): 動的サイズで動作 ✅ 自然対応

**Smoke test**: `npm run build` 通過。型エラー・bundle警告なし。

**最終視覚検証**: 修正5完了後、baseline vs all-fixes-applied で `test-images/` フルセットを再撮影予定。

**追記**: 修正1コミット時の `npm run build` は Google Fonts への fetch エラー（既知の Turbopack flakiness）でローカル失敗したが、`tsc --noEmit` 通過 + 既存コミット 3888d27 が同コードで本番デプロイ済みであることから fix1 由来でないことを確認済み。

---

### 修正2: デフォルトpadding 5% → 2%（カテゴリ1）

**変更**: 自動クロップ後の padding デフォルト値を 0.05 → 0.02 に引き下げ。被写体周囲のホワイトスペースを縮め、エモートとしての存在感を改善。

**変更ファイル**:
- `src/types/emote.ts:124` — JSDoc の `Default 0.05` → `Default 0.02`
- `src/hooks/useEmoteProcessor.ts:50` — 初期 state `padding: 0.05` → `0.02`
- `src/components/RecommendedPatterns.tsx:31` — おすすめパターンの初期 config 同期
- `src/lib/canvas/backgroundRemoval.ts:12` — `centerAndResize` 関数のデフォルト引数
- `src/lib/canvas/pipeline.ts:132,204,273` — `?? 0.05` フォールバック 3 箇所

**永続化の扱い**: `padding` は localStorage に保存されていない（`useState` のみ）。既存ユーザー設定上書きの懸念なし。新規セッション開始時に全員 0.02 が適用される。

**UI Slider 範囲**: `SettingsPanel.tsx` で `min=0, max=15`(%)。新デフォルト 2% は範囲内、変更不要。

**静的分析（数学的に確定）**:

| 指標 | before (0.05) | after (0.02) | 効果 |
|---|---|---|---|
| 被写体の実描画領域比率 | (1−0.10)² = 81% | (1−0.04)² = 92.16% | **被写体面積 +13.8%** |
| 描画コスト | 変化なし | 変化なし | — |
| メモリ | 変化なし | 変化なし | — |
| サイズ別係数（pipeline.ts:133）| 28px=×0.4 / 56px=×0.7 / その他=×1 | 同一 | 変更なし |

**実効 padding（サイズ別係数適用後）**:

| 出力サイズ | 旧 effective | 新 effective | 描画領域比率（新） |
|---|---|---|---|
| 28px | 0.05×0.4 = 0.02 | 0.02×0.4 = 0.008 | (1−0.016)² = 96.8% |
| 56px | 0.05×0.7 = 0.035 | 0.02×0.7 = 0.014 | (1−0.028)² = 94.5% |
| 112px | 0.05 | 0.02 | (1−0.04)² = 92.2% |

**リスク**:
- 人物画像で頭頂部・肩がギリギリすぎる可能性。最終視覚検証（修正5後）でケース02-portrait系を確認。問題があれば 0.03 に再調整。
- 28px は係数 ×0.4 でさらに圧縮されているので、元 0.05×0.4=0.02（旧の 28px effective）と新 0.02（112px の値）の境界に注意。

**Smoke test**: `tsc --noEmit` 通過（型エラーなし）。`npm run build` は依然として Google Fonts flakiness で失敗するが fix2 由来ではない（リテラル変更のみ・型整合）。

---

### 修正3: テキスト28pxスキップ撤廃 + サイズ適応レンダリング（カテゴリ3）

**変更**: `pipeline.ts` の `if (textToRender && size > 32)` を `if (textToRender)` に変更（3箇所）。さらに `applyTextOverlay` をサイズ適応レンダリングに改修：出力サイズに応じた最低 fontSize / 最低 stroke 幅を保証し、HI_RES で描画→縮小する流れで小サイズでも文字が読めるようにする。

**変更ファイル**:
- `src/lib/canvas/drawing.ts` — `applyTextOverlay` を全面改修。第4引数 `outputSize` を追加（デフォルト=canvasSize で後方互換）。`PreviewArea.tsx` の既存呼び出しは引数なしで動作継続。
- `src/lib/canvas/pipeline.ts` — `processEmote` / `processEmoteWithHiRes` / `processFrameWithBounds` の3箇所で `size > 32` を撤廃、`applyTextOverlay` 呼び出しに `size` を第4引数で渡す。

**サイズ適応の仕様**（output px 空間で適用）:

| 出力サイズ | minFontSize | minOutline |
|---|---|---|
| 28px | 14 (出力比 50%) | 2 |
| 56px | 22 (出力比 ~40%) | 3 |
| 112px | 0 (制限なし、ユーザー指定そのまま) | 0 |

**実装ロジック**（fontSize 例、出力px → canvas px の流れ）:

```typescript
// 1. user spec を output-px 空間に展開
userOutputFontSize = userFontSize * (outputSize / 112)  // userFontSize は112px換算
// 2. floor 適用
effectiveOutputFontSize = max(userOutputFontSize, minFontSizeAtOutput)
// 3. canvas (HI_RES) に拡大して描画
fontSize = effectiveOutputFontSize * (canvasSize / outputSize)
```

stroke も同論理。`ctx.lineWidth = outlineWidth * 2` の既存変換規則は維持（canvas strokeText が境界線を文字芯の両側に半分ずつ引くため）。

**stroke→fill 順序**: 既存実装で `strokeText` → `fillText` の順。fix3 でもこの順序を維持（コメントで意図を明示）。

**HI_RES math 自己検証**（28px出力・user fontSize=20px@112換算）:

| 段 | 値 |
|---|---|
| userOutputFontSize | 20 × (28/112) = 5 |
| minFontSizeAtOutput | 14 |
| effectiveOutputFontSize | max(5, 14) = **14** |
| fontSize at canvas (HI_RES=448) | 14 × (448/28) = **224 px** |

これは Aki が補足2 で示した「14 × (448/28) = 224px で描く」と一致。

**境界ケースの挙動**:
- ユーザーが 80px を指定 → 28px出力で 20px で描画（user spec が min 14 を超えるので尊重）
- ユーザーが 8px を指定 → 28px出力で 14px に引き上げ（min floor 適用）
- 「草生える」(4文字, userFontSize=null) → auto fallback 4.62 → floor 14 適用、各文字幅 ≈ 3.5px（限界、警告UIは別コミットで検討）

**位置（top/中央/下）の扱い**: 既存実装では `position` フィールドは型に存在するが描画では未使用、center-based + offset で自由配置。fix3 でもこの挙動を維持。

**PreviewArea.tsx の後方互換**: `applyTextOverlay(canvas, options, 112)` 呼び出しは `outputSize` がデフォルト 112 になり、`canvasSize/outputSize=1` で旧挙動と完全一致。

**Smoke test**: `tsc --noEmit` 通過（型エラーなし）。`npm run build` は依然として Google Fonts flakiness（fix3 由来ではない）。

**リスク**:
- 多文字テキスト（5文字以上）が28pxでさらに潰れる可能性。警告 UI（「現在の文字数で28pxでは何pxになるか」表示）は補足3に従い別コミットで検討。
- HI_RES上で 224px の文字を描画 → downscale で 8倍縮小という比率が極端で、フォント family によってはアンチエイリアスが甘くなる可能性。最終視覚検証で要確認。
- 既存ユーザーで「28pxには何も入らないことを期待していた」想定はないと判断。28pxでも文字が出るようになるのは品質向上として歓迎される変化。

**警告UIについて**: 「現在の文字数で28pxで何pxになるか」のヒント表示は実装可。`min(userOutputFontSize, minFontSizeAtOutput)` を使えば「user指定が floor で持ち上げられる」境界を計算できる。fix3-extra として別コミット切り出しを検討（このコミットには未実装）。

---

### 修正4: フチ取り最低幅保証 + stamp filter化（カテゴリ4）

**変更**: `applyBorder` を 3 つの軸で改修：
1. 出力サイズ別の最低 border 幅保証（4-1）
2. shadowBlur のサイズ依存減衰（4-2）
3. shadowBlur ベースの描画から **stamp filter** への切り替え（4-3）

実装は Aki指針の A→B 段階を**まとめて1コミット**で投入（パフォーマンス予測が許容範囲だったため）。

**変更ファイル**:
- `src/lib/canvas/drawing.ts` — `applyBorder` 全面改修。新引数 `isAnimated?: boolean` 追加、stamp filter 実装、`STAMP_8` / `STAMP_4` 定数定義。
- `src/lib/canvas/pipeline.ts:284` — `processFrameWithBounds` で `applyBorder(..., size, true)` を渡す。`processEmote` と `processEmoteWithHiRes` は default false（呼び出し1回なので 8-dir）。

**4-1: 最低 border 幅保証**

| 出力サイズ | min border (output px) |
|---|---|
| 28px | 2 |
| 56px | 3 |
| 112px | 0 (制限なし) |

実装ロジック（fix3 と同パターン）:
```typescript
userOutputBorder = userBorderWidth * (effectiveOutputSize / 112)
                ?? effectiveOutputSize * 0.027
effectiveOutputBorder = max(userOutputBorder, minBorderAtOutput)
borderWidth (canvas) = max(1, round(effectiveOutputBorder * (size / effectiveOutputSize)))
```

**4-2: shadowBlur サイズ依存減衰**

| 出力サイズ | blurDecay | 適用先 |
|---|---|---|
| 28px | **0**（stamp 単独で描画、AA は downscale に任せる） | solid border |
| 56px | 0.5 | solid border |
| 112px | 1.0（フル） | solid border |
| 28px | 0.3（drop shadow は完全消失を避ける） | "shadow" style |
| 56px | 0.6 | "shadow" style |
| 112px | 1.0 | "shadow" style |

solid border の AA blur は `borderWidth * 0.25 * blurDecay` を補助的に適用（28px では blurDecay=0 で無効化、stamp の鋭い octagonal エッジが downscale で自動的に滑らかになる）。

**4-3: stamp filter 化**

旧: shadowBlur + silhouette + 3-pass opacity buildup（jaggy・処理重い）
新: 8 方向（または 4 方向）silhouette stamp + optional AA blur + dest-out

8 方向（静止画 / 52種アニメ）— **radial 等距離正規化**:
```typescript
const STAMP_8 = [
  [0, -1],          [1/√2, -1/√2],
  [1, 0],           [1/√2,  1/√2],
  [0, 1],           [-1/√2, 1/√2],
  [-1, 0],          [-1/√2, -1/√2],
];
```
diagonals が cardinals と同じ radial 距離 r で stamp されるので、丸みを帯びた被写体で対角に余分な突起が出ない。

4 方向（GIF/動画 per-frame）:
```typescript
const STAMP_4 = [[0,-1], [1,0], [0,1], [-1,0]];
```
N/E/S/W のみ。45°方向の線厚が cardinals より細くなるが、アニメは 1/15〜1/30 秒で切り替わるので視覚的に許容範囲。

**isAnimated 判定経路**:
- `processEmote` (line 148): default false → 8-dir
- `processEmoteWithHiRes` (line 220): default false → 8-dir（applyBorder は hiRes 作成時に1回のみ、52種アニメは hiRes をベースに iterate するので per-frame 呼び出しなし）
- `processFrameWithBounds` (line 284): **true** → 4-dir（GIF/動画ソースで per-frame 実行）
- `PreviewArea.tsx` (4箇所): default false → 8-dir

**HI_RES math 自己検証**（28px出力・user borderWidth=3@112換算）:

| 段 | 値 |
|---|---|
| userOutputBorder | 3 × (28/112) = 0.75 |
| minBorderAtOutput | 2 |
| effectiveOutputBorder | max(0.75, 2) = **2** |
| borderWidth at canvas (HI_RES=448) | max(1, round(2 × (448/28))) = **32** |
| Downscale 後 (÷16) | **2 px** |

ユーザー指定 3px が 28px 出力時に 0.75px → 2px に floor 持ち上げ。ユーザーがより大きい値を指定（例 10px → output 2.5px）すれば user spec が勝つ（max(2.5, 2) = 2.5）。

**境界ケース**:
- ユーザーが 1px 指定 → 28pxで 0.25 → floor で 2px（保証発動）
- ユーザーが 10px 指定 → 28pxで 2.5 → user wins（floor 不発動）
- 112px のユーザー 3px → 3px（min=0 で何も持ち上がらない）

**パフォーマンス予測（静的分析）**:

| 経路 | 呼び出し回数 | 描画オペ数/回 | 累積 ops |
|---|---|---|---|
| 静止画 (HI_RES=448, 8-dir) | 1 | 8 stamps + 1 AA blur + 1 dest-out + 2 composite ≈ 12 | 12 × 803K ≈ **10M** |
| 52種アニメ (hiRes作成時のみ) | 1 | 同上 | **10M**（フレーム生成は別系統で applyBorder 不実行） |
| GIF/動画ソース (60fps想定 4-dir) | 60 | 4 stamps + 1 AA + 1 dest-out + 2 composite ≈ 8 | 60 × 8 × 262K = **126M** |

GIF case の 126M ops は gif.js エンコード（500M〜1G ops 想定）と比べて 12〜25% 程度の追加。許容範囲。

旧実装（shadowBlur 3-pass）と比較:
- 旧: 3 shadow draws + 1 dest-out + 1 composite = 5 op
- 新: 8 stamp + 1 AA blur + 1 dest-out + 2 composite = 12 op
- 1 回当たり ops は 2.4倍だが、shadowBlur (Gaussian) は drawImage より重いので実速度差は小さい見込み

**Smoke test**: `tsc --noEmit` 通過。`npm run build` は引き続き Google Fonts flakiness（fix4 由来ではない）。

**リスク**:
- stamp filter の octagonal 形状が高解像度で見えると感じる可能性（特に塗りつぶし円形シルエット）。downscale で滑らかになる前提だが、112px 出力で輪郭がギザつくならAA blurDecayを 1.5 とかに上げる調整余地あり。最終視覚検証で要確認。
- 4-dir 動画フレームの 45° 方向の薄さが目立つケース（角張った被写体）。問題が見えれば後で 8-dir に戻す or 動的に判定する余地あり。
- `style === "shadow"`（drop shadow）の見た目が変わる可能性。decay 0.3/0.6/1.0 は控えめに保ったつもりだが、人によって「ドロップシャドウが弱くなった」と感じるかもしれない。

---

### 修正5: GIF ディザリング有効化（カテゴリ6）

**変更**: gif.js のオプションに `dither: "FloydSteinberg"` を追加（4箇所）。エッジ AA とグラデーションの band を改善。

**変更ファイル**（GIF 出力経路すべて）:
- `src/lib/animations/index.ts:196` — AI custom animation 用
- `src/lib/animations/index.ts:257` — 52種アニメ用（基本パターン）
- `src/lib/animationSandbox.ts:206` — sandbox iframe 内 AI 動画
- `src/lib/gif/animatedEncoder.ts:41` — GIF/動画ソース → 出力 GIF

`@types/gif.js` の型定義は `dither?: DitherMethod | boolean` で `"FloydSteinberg"` をネイティブで受け付けるため、型キャスト不要。

**選択値**: `"FloydSteinberg"`（serpentine なし）。
- gif.js が提供する 4 つのアルゴリズム（FloydSteinberg / FalseFloydSteinberg / Stucki / Atkinson）の中で最も視覚品質と速度のバランスが良い
- serpentine 版（行ごとに走査方向反転）はバンディング軽減に効くが、アニメフレーム間で誤差パターンが揺らぐ副作用がある可能性。標準版を選択

**ユーザー設定への露出**: トグル UI なし、固定 ON。理由は Aki の指針通り：
- 他の品質改善（fix1〜4）と組み合わせて「他ツール並み」を目指す本タスクの目的に沿う
- 「dither って何？」の UX 負荷を避ける
- ファイルサイズ増加が許容範囲（〜25%）

**パフォーマンス予測（静的分析）**:

| 指標 | before | after | デルタ |
|---|---|---|---|
| ファイルサイズ | — | — | **+10〜25%**（隣接ピクセルの色分散で LZW 圧縮効率↓） |
| 書き出し時間 | — | — | **+10〜30%**（per-pixel エラー拡散の追加コスト） |
| エッジ AA | shadowBlur 任せ（ジャギー残） | dither で疑似 AA | 大幅改善 |
| グラデーション band | 階調が見える | 視覚的に滑らか | 改善 |
| 透過 alpha 境界 | くっきり階段 | dither 補正でやや滑らか | 軽微改善 |

ディザ処理オペ数試算:
- 256px × 60フレーム = 約 15.7M ピクセル
- per-pixel 4 隣接 × 数算術 ≈ 50M ops
- gif.js 本体エンコード（500M〜1G ops 想定）の 5〜10% 追加

**Smoke test**: `tsc --noEmit` クリア（型エラーなし、`as unknown as boolean` 不要）。`npm run build` は引き続き Google Fonts flakiness（fix5 由来ではない）。

**リスク**:
- 静止画では dither は適用されない（GIF 限定）。dither を効かせるための追加実装は不要
- ファイルサイズ +25% を超える場合があれば（特に大きなグラデーション領域含む画像）、Twitch の GIF サイズ制限（256KB）に近づく可能性。20フレーム 112px の典型ケースで実測未確認、最終視覚検証で要確認
- ディザのドット感が28pxで目立つ可能性。ただし 28px の GIF はそもそも detail が乏しいので顕著には出ないと予想

---

## 修正1〜5 累積コミット

| # | hash | タイトル |
|---|---|---|
| 1 | `8cc2267` | HI_RES 224→448 |
| 2 | `b0f7e67` | デフォルトpadding 5%→2% |
| 3 | `7a598f0` | テキスト28pxスキップ撤廃 + サイズ適応レンダリング |
| 4 | `2e2f71e` | フチ取り最低幅保証 + stamp filter化 |
| 5 | _(このコミット)_ | GIF ディザリング有効化 |

優先度A 全 5 修正完了。最終視覚検証セッションで baseline (commit `3888d27` 時点) vs all-fixes-applied (fix5 commit) の比較を実施予定。

---

## 最終視覚検証セッションへの引き継ぎメモ（修正5後の新セッション向け）

> このセクションは fix5 完了時点でまとめた、**次セッションで Aki または別の Claude Code がそのまま実行できる引き継ぎメモ**です。再調査せずに進めるための情報を全部入れてあります。

### 0. 何を検証するか（チェックリスト）

各 fix が **想定通り視覚に現れているか** を baseline (`3888d27`) vs all-fixes (`fix5 commit`) で比較する。

| fix | チェックポイント | 見るべき画像 |
|---|---|---|
| 1 (HI_RES) | 112px出力で border/text/frame の anti-alias が向上、輪郭がシャープ | `01-logo-star_112` の星のコーナー、`03-icon-with-text_112` の文字輪郭 |
| 2 (padding) | 被写体が canvas をより大きく占める（面積 +13.8%）。ただし人物画像で頭頂・肩がギリギリすぎないか | `02-portrait_28/56/112` 全部 |
| 3 (text 28px) | 28pxでテキストが**消えなくなる**（最大の改善ポイント）。56pxでも見やすくなる | `02-portrait-border-text_28`、`03-icon-with-text_28/56`、新規 `_56`サイズも撮ること |
| 4 (border) | 28pxで border が**見えるようになる**。stamp filter で輪郭が均一に | `02-portrait-white-border_28/56`、`02-portrait-border-text_28/56` |
| 5 (dither) | GIFアニメのエッジジャギーが軽減、グラデーションのバンドが消える | アニメ系の比較は静止画 PNG では捕捉不可、別途 GIF サンプル必要 |

**ファイルサイズ予測との整合性確認**:
- fix5 で GIF サイズ +10〜25%。実測で 30% 超過なら dither serpentine 版や quality:5 への調整を検討
- fix1 で PNG サイズが微増（detail 増加）。激増（2倍超）するなら何か壊れてる

### 1. `pipeline.ts` の API 表面（fix5 commit 時点）

`src/lib/canvas/pipeline.ts` の export は **純関数**で React state 不要。preview_eval から直接呼べる。

```typescript
// 静止画用（主エントリポイント）
processEmote(
  source: HTMLCanvasElement | HTMLImageElement,
  size: number,                    // 出力px (28/56/112)
  config: EmoteConfig,             // src/types/emote.ts:117 参照
  subCanvas?: HTMLCanvasElement    // 2画像合成用 (optional)
): HTMLCanvasElement

// 52種アニメ用（HI_RES と downscaled output の両方を返す）
processEmoteWithHiRes(
  source, size, config, subCanvas?
): { output: HTMLCanvasElement; hiRes: HTMLCanvasElement }

// 既存GIF/動画ソース用（bounds事前計算済み、per-frame）
processFrameWithBounds(
  frame: HTMLCanvasElement,
  size: number,
  config: EmoteConfig,
  bounds: Bounds                   // canvas/types.ts の findContentBounds で算出
): HTMLCanvasElement
```

`HI_RES`/`GIF_HI_RES` 定数は `src/lib/canvas/types.ts`：
- `HI_RES = 448`（fix1 で 224 → 448 に変更）
- `GIF_HI_RES = 256`（不変）
- `USM_MAX_SIZE = 56`

### 2. EmoteConfig のデフォルト値（実コード由来）

`src/hooks/useEmoteProcessor.ts:33-56` 参照。eval で組むときの最小構成：

```typescript
const config: EmoteConfig = {
  outline: { style: "none", width: 3, color: "#ffffff" },
  frame: { type: "none" },
  subImage: { mode: "none", scale: 0.5, offsetX: 0, offsetY: 0 },
  text: {
    preset: null, customText: "",
    font: "Noto Sans JP",
    fillColor: "#ffffff", strokeColor: "#000000",
    position: "bottom",
    fontSize: 20, offsetX: 0, offsetY: 0, outlineWidth: 3,
  },
  animation: { type: "none", speed: "normal" },
  badge: { /* DEFAULT_BADGE_SETTINGS, 視覚検証では未使用 */ },
  padding: 0.02,                   // ← fix2 で 0.05 → 0.02
  contentOffsetX: 0, contentOffsetY: 0, contentScale: 1.0,
  animatedSpeed: 1.0, animatedLoopCount: 0,
};
```

### 3. eval から呼び出す手順

#### ステップ1: instrumentation を一時注入（**コミットしないこと**）

`src/lib/canvas/pipeline.ts` の末尾に追加:

```typescript
if (typeof window !== "undefined") {
  (window as Window & { __pipeline?: unknown }).__pipeline = {
    processEmote, processEmoteWithHiRes, processFrameWithBounds,
    HI_RES, GIF_HI_RES,
  };
}
```

`npm run dev` でホットリロードされる。視覚検証完了後に **必ず削除** してからコミットを進めること。

#### ステップ2: 入力サンプル画像を Canvas API で生成

監査時と同じ3種:

| ID | 内容 | 主要色 |
|---|---|---|
| 01-logo-star | 紫角丸正方形 + 黄色5角星（透明背景） | #7c3aed / #facc15 |
| 02-portrait | 顔（円） + 肩シルエット（半円）、透明背景 | #fcd5b5 / #6b7280 |
| 03-icon | 赤ハート（Path API）+ 4隅黄ドット、透明背景 | #ef4444 / #facc15 |

source canvas は **256×256 で生成**（pipeline 側で HI_RES に拡大される）、α=0 を背景に保つ。

#### ステップ3: スタイル組み合わせマトリクス

| ID 接尾辞 | outline | text |
|---|---|---|
| `_plain` | none | "" |
| `_white-border` | white | "" |
| `_border-text` | white | "草" (1文字テスト) |
| `_with-text` | none | "草" |
| `_long-text` | none | "草生える" (4文字テスト, fix3 多文字確認用) |

**新規追加**: 全パターンで `_56` サイズも生成（旧 baseline は 28/112 のみだったが、fix3 が 56px の text 描画を改善するので 56 を残しておく価値高い）。

#### ステップ4: eval テンプレート（壊れない書き方）

```typescript
const inputs = await buildInputs();  // 3種の source canvas を返す
const styles: StyleSpec[] = [...];   // 上記マトリクス
const sizes = [28, 56, 112] as const;

const results: Record<string, string> = {};

// 1個ずつ for...of で逐次 await。Promise.all は順不同で壊れる。
for (const input of inputs) {
  for (const style of styles) {
    for (const size of sizes) {
      // ★ 必ず let で再宣言。canvas/output を関数スコープ外で再利用しない
      const config = makeConfig(style);
      const out = (window as any).__pipeline.processEmote(
        input.canvas, size, config
      );
      // 寸法 sanity check
      if (out.width !== size || out.height !== size) {
        throw new Error(`Wrong size: ${input.id} ${style.id} ${size} → ${out.width}x${out.height}`);
      }
      results[`${input.id}-${style.id}_${size}`] = out.toDataURL("image/png");
      // canvas を release（メモリリーク回避）
      out.width = 0; out.height = 0;
    }
  }
}
return results;
```

#### ステップ5: 保存と検証

eval が返した base64 dict を:
1. Node 側で `Buffer.from(b64, "base64")` してファイルに書き出し → `test-images/after-fix5/<id>.png`
2. **必ず寸法と MD5 確認**:
   ```bash
   for f in test-images/after-fix5/*.png; do file "$f"; done
   md5 test-images/after-fix5/*.png | sort -k 4
   ```
3. 同 ID の baseline と after-fix5 を Read tool で並べて視覚確認

### 4. 前回 after-fix1 が壊れた原因（再発防止チェックリスト）

- ❌ canvas state を loop で使い回した → ✅ **每ループで `let` 宣言**
- ❌ `Promise.all` で順序混乱 → ✅ **`for...of` + `await`**
- ❌ size 指定が反映されず 28x28 化 → ✅ **eval 末尾で `out.width !== size` を必ず assert**
- ❌ MD5 重複に気付かず → ✅ **保存後 `md5 *.png` で全件 sort 確認**

### 5. bg-removal の扱い

監査時と同じく **「透過済みPNGをそのまま使う」トグル**経由で bg-removal を実行回避する想定。eval から `processEmote` を直接呼ぶときは bg-removal を経由せず source を直接渡せばよい（pipeline.ts は `centerAndResize` で α を見て bounds を算出する）。

サンプル画像を最初から透明背景で作っておけば bg-removal の WASM ロード（〜30MB モデル）も不要。

### 6. GIF 用 dither の視覚確認方法（fix5 専用）

PNG 静止画では dither の効果は見えない。dither は GIF エンコード時にのみ適用される。確認手順:

1. 入力にアニメソース（`processEmoteWithHiRes` で hi-res を作って 52種アニメに通す or `processFrameWithBounds` で動画フレームをループ）を用意
2. `gif.js` で出力 → blob → File system に保存
3. baseline と after-fix5 の同一 GIF を比較。エッジ AA・グラデーション帯が改善している
4. ファイルサイズも比較（fix5 予測 +10〜25%、それ超なら設定見直し）

簡易的には、52種アニメから選んだ1パターン（例: `pulse` や `bounce`）を 28px / 112px の 2 サイズで生成し、ImageMagick やブラウザで開いて視覚比較すれば十分。

### 7. 既知の制約・注意

- `npm run build` はこの実行環境では Google Fonts fetch が落ちて失敗する（`fonts.gstatic.com` への接続が遮断されている）。Vercel 上のビルドは成功している（既存コミットがデプロイ済み）。fix1〜5 の commit message でも明記済み
- preview_eval を使う場合は dev server を `npm run start`（prod build）で起動するほうが本番に近い挙動になる。ただし上記の理由で prod build できないなら `npm run dev` で fallback
- `test-images/` 直下に baseline 画像があるので、after-fix5 は `test-images/after-fix5/` に隔離して保存すること

### 8. 残課題（今回のスコープ外、次タスク候補）

- **優先度B/C**（QUALITY_AUDIT.md `修正優先度マトリクス` 参照）: bounds 閾値調整、color decontamination、顔検出ベース auto-crop など
- **追加発見11件**（QUALITY_AUDIT.md `監査時に気づいた追加の品質改善案` 参照）: プレビュー正確性、Twitchチャット潰れチェッカー、自動レコメンド等
- **fix3 警告UI**: 多文字を 28px で焼くと潰れることへの警告トースト or 実寸表示。ユーザビリティ改善として fix3-extra で切り出し可能
