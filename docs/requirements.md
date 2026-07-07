# invisible-x-image 要件書

x.com(旧 Twitter)上の画像・動画をプレースホルダーに置き換える Google Chrome 拡張機能。

## 1. 背景・目的

x.com のタイムラインには画像・動画付きのポストが多く流れてくる。見たくないメディアが視界に入るのを防ぐため、メディア部分をワンクリックで表示可能なプレースホルダーに置き換える拡張機能を提供する。

## 2. 機能要件

### 2.1 メディアのプレースホルダー化

- **FR-1**: x.com 上のポストに含まれる画像を、グレー背景のプレースホルダーに置き換えること。
- **FR-2**: x.com 上のポストに含まれる動画(GIF 含む)を、グレー背景のプレースホルダーに置き換えること。
- **FR-3**: プレースホルダーには種別に応じたラベル付きボタン(「画像を表示」/「動画を表示」)を中央に表示すること。
- **FR-4**: ボタンをクリックすると、**そのメディアのみ**プレースホルダーを解除し、元のメディアを表示すること。ページをリロードすると再びプレースホルダーに戻ってよい。
- **FR-5**: プレースホルダー化してもメディアコンテナの寸法(アスペクト比)は変えないこと。レイアウトシフトを起こさない。
- **FR-6**: プレースホルダーのクリックがポスト詳細ページへの遷移など親要素のイベントを発火させないこと(`stopPropagation` / `preventDefault`)。
- **FR-7**: プレースホルダー化した動画は再生を停止(`video.pause()`)し、音声が流れないようにすること。

### 2.2 対象範囲

- **FR-8**: x.com 全体を対象とすること。具体的には以下を含む:
  - ホームタイムライン(「おすすめ」「フォロー中」)
  - ポスト詳細ページ(リプライ含む)
  - プロフィールページ(メディアタブ含む)
  - 検索結果、トレンド、リスト、ブックマーク、通知
  - 引用ポスト内のメディア
- **FR-9**: `https://x.com/*` と `https://twitter.com/*` の両ドメインで動作すること。
- **対象外(v1 では処理しない)**: ユーザーアイコン、バナー画像、絵文字、リンクカード(OGP)のサムネイル、DM 内のメディア。

### 2.3 動的コンテンツへの追従

- **FR-10**: X は仮想スクロールの SPA であり、ポストは動的に DOM へ追加・再利用される。`MutationObserver`(`document.body`、`childList` + `subtree`)で追加ノードを監視し、新規メディアを即座にプレースホルダー化すること。
- **FR-11**: ページ内遷移(pushState による SPA 遷移)後も継続して動作すること。Observer は body 全体を監視するため遷移検知の特別処理は不要だが、遷移で DOM が丸ごと入れ替わっても検出漏れがないこと。
- **FR-12**: 初回ロード時(content script 実行時点)に既に存在するメディアも全走査して処理すること。
- **FR-13**: 同一要素を二重処理しないこと。処理済み要素には `data-ixi-processed` 属性を付与して判定する。

### 2.4 設定(ポップアップ UI)

- **FR-14**: ツールバーの拡張アイコンクリックでポップアップを表示すること。
- **FR-15**: ポップアップに「画像を隠す」「動画を隠す」の 2 つのトグル(checkbox)を設けること。UI は日本語。
- **FR-16**: 設定は `chrome.storage.sync` に保存すること。キーとデフォルト値:

  ```ts
  interface Settings {
    hideImages: boolean; // デフォルト true
    hideVideos: boolean; // デフォルト true
  }
  ```

- **FR-17**: 設定変更は**リロードなしで即時反映**されること。content script は `chrome.storage.onChanged` を購読し:
  - OFF になった種別 → 該当プレースホルダーを全解除
  - ON になった種別 → ページを再走査してプレースホルダー化

## 3. DOM セレクタ仕様

X のクラス名は難読化されており不安定なため、**`data-testid` 属性のみ**をセレクタに使う。ポストのルートは `article[data-testid="tweet"]`。

| 対象 | セレクタ | 備考 |
|---|---|---|
| 画像 | `div[data-testid="tweetPhoto"]` | ポスト内画像のコンテナ。複数枚レイアウトでも 1 枚ごとに存在 |
| 動画 | `div[data-testid="videoComponent"]` | 動画・GIF プレイヤーのコンテナ |
| 動画(補助) | `div[data-testid="videoPlayer"]` | videoComponent の外側に存在する場合がある |

注意事項:

- `tweetPhoto` は**動画のサムネイルにも使われる**。コンテナ内(または祖先の videoPlayer 配下)に `video` 要素か `videoComponent` が存在する場合は「動画」として扱い、`hideVideos` 設定に従うこと。
- ポスト外(例: プロフィールのメディア欄グリッド)にも同じ testid が現れる場合があるが、v1 ではそのまま対象としてよい(メディアを隠す目的に合致するため)。
- セレクタは 1 箇所(定数モジュール)に集約し、X 側の DOM 変更時に追従しやすくすること。

## 4. プレースホルダー仕様

- 対象コンテナに CSS クラスを付与して子要素を `visibility: hidden` にする(`display: none` はレイアウト崩れの原因になるため使わない)。
- コンテナに `position: relative` を保証した上で、オーバーレイ要素(`position: absolute; inset: 0`)を挿入する。
- オーバーレイのスタイル:
  - 背景: 不透明のグレー(ダークモード・ライトモード双方で違和感のない `#333` 程度)
  - 中央にボタン: 角丸、テキストは「画像を表示」または「動画を表示」
  - `z-index` はコンテナ内で最前面になる程度(過剰な値は使わない)
- 解除時はオーバーレイ要素を削除し、付与したクラスを除去する。解除済みの目印として `data-ixi-revealed` 属性を付与し、再走査時に再プレースホルダー化しない(設定を OFF→ON した場合は revealed もリセットして再度隠す)。

## 5. 非機能要件

- **NFR-1**: Manifest V3 準拠。
- **NFR-2**: 権限は最小限にすること: `storage` のみ。host permissions は `https://x.com/*`, `https://twitter.com/*`。
- **NFR-3**: `remote code` なし、外部通信なし。
- **NFR-4**: MutationObserver のコールバックは軽量に保つこと(mutation ごとの全ページ `querySelectorAll` を避け、追加ノード配下のみ走査する。ただし実装が過度に複雑になる場合は、`requestAnimationFrame` / アイドルデバウンスでの全走査バッチ処理でも可)。
- **NFR-5**: TypeScript の型チェック(`tsc --noEmit` 相当)とビルドがエラーなしで通ること。

## 6. 技術構成

- フレームワーク: **WXT**(Manifest V3、manifest 自動生成)
- 言語: TypeScript(UI フレームワークなし。ポップアップは素の HTML + TS)
- パッケージ管理: pnpm(Node・pnpm・claude は mise で管理し、`mise.toml` でバージョンを固定する)

### ディレクトリ構成

```
├── docs/requirements.md   # 本書
├── wxt.config.ts          # manifest 定義
├── vitest.config.ts       # テスト設定(WxtVitest + happy-dom)
├── entrypoints/
│   ├── content/
│   │   ├── index.ts       # content script エントリポイント(設定取得・Observer 配線)
│   │   ├── hider.ts       # プレースホルダー化ロジック本体(*.test.ts で検証)
│   │   └── style.css      # プレースホルダーのスタイル
│   └── popup/
│       ├── index.html
│       └── main.ts
├── utils/
│   ├── selectors.ts       # DOM セレクタ定数
│   └── settings.ts        # Settings 型・読み書き・変更購読
├── package.json
└── README.md              # ビルド・インストール手順
```

### manifest 要件

- `name`: "Invisible X Image"
- `description`: 日本語で機能説明
- `default_locale` は不要(ポップアップ直書きでよい)
- content script: `matches: ["https://x.com/*", "https://twitter.com/*"]`, `run_at: "document_idle"`

## 7. 受け入れ基準

1. `pnpm run build` が成功し、`.output/chrome-mv3/` に読み込み可能な拡張機能一式が生成される。
2. `pnpm run compile`(tsc 型チェック)がエラーなしで通る。
3. `pnpm run test`(vitest)が成功する。
4. x.com のホームタイムラインで画像・動画がプレースホルダーになり、ボタンクリックで個別に表示できる(手動確認)。
5. ポップアップのトグル操作が開いているタブへリロードなしで反映される(手動確認)。
6. スクロールで新しく読み込まれたポスト、および SPA 遷移先のページでも機能する(手動確認)。
