# Invisible X Image

[English](./README.md)

x.com（旧 Twitter）のポスト内にある画像・動画を、長文の「さらに表示」と同様の折りたたみ UI で隠す Chrome 拡張機能（Manifest V3）です。折りたたまれたポストの本文右下に表示される「メディアを表示」リンクをクリックすると、そのポストのメディアが 1 クリックですべて表示されます。UI はブラウザの言語設定に応じて英語/日本語が切り替わります(`chrome.i18n` によるローカライズ)。

詳細な仕様は [docs/requirements-ja.md](./docs/requirements-ja.md) を参照してください。

## 開発環境

- Node.js は [mise](https://mise.jdx.dev/) で管理しています。リポジトリ直下の `mise.toml` に従い、以下でセットアップしてください。

  ```sh
  mise install
  ```

  mise を有効化（activate）していれば、以降の `pnpm` コマンドはそのまま実行できます。

- 依存パッケージのインストール:

  ```sh
  pnpm install
  ```

  （`postinstall` で `wxt prepare` が実行され、型情報が `.wxt/` に生成されます）

## ビルド手順

型チェック:

```sh
pnpm run compile
```

ユニットテスト(vitest):

```sh
pnpm run test
```

本番ビルド:

```sh
pnpm run build
```

成功すると `.output/chrome-mv3/` 以下に `manifest.json` や content script、popup 一式が生成されます。

配布用 zip の生成（GitHub Release 添付用など。`.output/invisible-x-image-<version>-chrome.zip` が生成されます）:

```sh
pnpm run zip
```

開発中に自動リロードしたい場合は次を利用できます（Chrome が自動起動します）。

```sh
pnpm run dev
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
2. 画像・動画付きのポストのメディア領域が折りたたまれ、本文の右下に「Show media」リンクが表示されることを確認する（画像・動画が混在するポストでもリンクは 1 つ）。
3. リンクをクリックすると、そのポストの折りたたまれたメディアがすべて 1 クリックで表示され、リンク自身が消えることを確認する（他のポストの折りたたみは維持される）。
4. ページをリロードすると再び折りたたまれることを確認する。
5. 動画付きポストが折りたたまれている間、動画が再生・音声が流れていないことを確認する。
6. スクロールしてタイムラインに新しいポストが読み込まれても、折りたたみが継続して機能することを確認する。
7. ポスト詳細ページ・プロフィールページ・検索結果・リスト・ブックマーク・通知など、SPA 内の別ページに遷移しても折りたたみが機能することを確認する。一方、プロフィールの「メディア」タブのグリッド（ポスト外に単体で並ぶメディア）は折りたたまれないことを確認する。
8. ツールバーの拡張機能アイコンをクリックしてポップアップを開き、「Hide images」「Hide videos」のチェックボックスが現在の設定を反映していることを確認する。
9. ポップアップのチェックボックスを OFF にすると、開いているタブ上の折りたたみがリロードなしで即座に展開され、リンクも消えることを確認する。再度 ON にすると、手動で展開済みだったものも含めて再度折りたたまれ、リンクも再表示されることを確認する。

## ディレクトリ構成

```
├── docs/
│   ├── requirements.md    # 要件書（英語）
│   └── requirements-ja.md # 要件書（日本語）
├── public/
│   └── _locales/          # chrome.i18n のメッセージバンドル（en, ja）
│       ├── en/messages.json
│       └── ja/messages.json
├── wxt.config.ts          # manifest 定義
├── vitest.config.ts       # テスト設定（WxtVitest + happy-dom）
├── entrypoints/
│   ├── content/
│   │   ├── index.ts       # content script エントリポイント（設定取得・Observer 配線）
│   │   ├── hider.ts       # フォールディング(折りたたみ)ロジック本体
│   │   ├── hider.test.ts
│   │   └── style.css      # 折りたたみ・「Show media」リンクのスタイル
│   └── popup/
│       ├── index.html
│       └── main.ts
├── utils/
│   ├── selectors.ts       # DOM セレクタ定数
│   ├── selectors.test.ts
│   ├── settings.ts        # Settings 型・読み書き・変更購読
│   └── settings.test.ts
├── package.json
├── pnpm-workspace.yaml    # pnpm 設定（依存のビルドスクリプト許可）
├── README.md              # 英語版
└── README-ja.md           # 本書
```

## 権限

- `storage`（設定の保存のみ）
- host permissions: `https://x.com/*`, `https://twitter.com/*`

外部通信・リモートコードの読み込みは一切行いません。

## ライセンス

[MIT License](./LICENSE) と [Beer-Ware License](./LICENSE-BEERWARE) のデュアルライセンスです。好きな方を選んで利用してください。
