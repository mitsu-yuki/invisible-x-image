# Invisible X Image

x.com（旧 Twitter）上の画像・動画をグレーのプレースホルダーに置き換える Chrome 拡張機能（Manifest V3）です。プレースホルダー中央のボタンをクリックすると、そのメディアだけ表示できます。

詳細な仕様は [docs/requirements.md](./docs/requirements.md) を参照してください。

## 開発環境

- Node.js は [mise](https://mise.jdx.dev/) で管理しています。リポジトリ直下の `mise.toml` に従い、以下でセットアップしてください。

  ```sh
  mise install
  ```

- 依存パッケージのインストール:

  ```sh
  mise exec -- pnpm install
  ```

  （`postinstall` で `wxt prepare` が実行され、型情報が `.wxt/` に生成されます）

## ビルド手順

型チェック:

```sh
mise exec -- pnpm run compile
```

本番ビルド:

```sh
mise exec -- pnpm run build
```

成功すると `.output/chrome-mv3/` 以下に `manifest.json` や content script、popup 一式が生成されます。

開発中に自動リロードしたい場合は次を利用できます（Chrome が自動起動します）。

```sh
mise exec -- pnpm run dev
```

## Chrome への読み込み手順

1. 上記の `pnpm run build` を実行し、`.output/chrome-mv3/` を生成する。
2. Chrome で `chrome://extensions` を開く。
3. 右上の「デベロッパーモード」を ON にする。
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、`.output/chrome-mv3/` ディレクトリを選択する。
5. 拡張機能一覧に「Invisible X Image」が表示されれば読み込み完了。

コードを変更した場合は再度 `pnpm run build` を行い、`chrome://extensions` の当該拡張機能で「再読み込み」ボタンを押してください。

## 手動確認手順

1. https://x.com （または https://twitter.com ）のホームタイムラインを開く。
2. 画像・動画付きのポストがグレーのプレースホルダーになり、中央に「画像を表示」または「動画を表示」ボタンが表示されることを確認する。
3. ボタンをクリックすると、そのメディアのみプレースホルダーが解除され元の画像・動画が表示されることを確認する（他のポストのプレースホルダーは維持される）。
4. ページをリロードすると再びプレースホルダーに戻ることを確認する。
5. 動画付きポストでプレースホルダー化した際に動画が再生・音声が流れていないことを確認する。
6. スクロールしてタイムラインに新しいポストが読み込まれても、プレースホルダー化が継続して機能することを確認する。
7. ポスト詳細ページ・プロフィールページ（メディアタブ含む）・検索結果・リスト・ブックマーク・通知など、SPA 内の別ページに遷移してもプレースホルダー化が機能することを確認する。
8. ツールバーの拡張機能アイコンをクリックしてポップアップを開き、「画像を隠す」「動画を隠す」のチェックボックスが現在の設定を反映していることを確認する。
9. ポップアップのチェックボックスを OFF にすると、開いているタブ上のプレースホルダーがリロードなしで即座に解除されることを確認する。再度 ON にすると、手動で解除していたものも含めて再度プレースホルダー化されることを確認する。

## ディレクトリ構成

```
├── docs/requirements.md   # 要件書
├── wxt.config.ts          # manifest 定義
├── entrypoints/
│   ├── content/
│   │   ├── index.ts       # content script（検出・プレースホルダー化・設定購読）
│   │   └── style.css       # プレースホルダーのスタイル
│   └── popup/
│       ├── index.html
│       └── main.ts
├── utils/
│   ├── selectors.ts       # DOM セレクタ定数
│   └── settings.ts        # Settings 型・読み書き・変更購読
├── package.json
├── pnpm-workspace.yaml    # pnpm 設定（依存のビルドスクリプト許可）
└── README.md
```

## 権限

- `storage`（設定の保存のみ）
- host permissions: `https://x.com/*`, `https://twitter.com/*`

外部通信・リモートコードの読み込みは一切行いません。
