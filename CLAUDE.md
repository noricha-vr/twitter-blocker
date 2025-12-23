# CLAUDE.md

Twitter/X.comへのアクセスをブロックし、タイマーで一時解除できるChrome拡張機能（Manifest V3）。

## Quick Reference

| 項目 | 値 |
|------|-----|
| 言語 | TypeScript |
| ビルド | `npm run build` |
| 開発モード | `npm run dev` |
| パッケージ作成 | `zip -r twitter-blocker.zip dist manifest.json icon -x "*.DS_Store"` |
| デプロイ先 | [Chrome Web Store](https://chrome.google.com/webstore/devconsole/) |
| ストアアセット | `store-assets/` |

## アーキテクチャ

| コンポーネント | 役割 |
|---------------|------|
| `src/contentScript.ts` | ブロックオーバーレイ管理、10秒ごとに状態更新、使用履歴チャート表示 |
| `src/popup.ts` | 一時解除UI、使用履歴保存、リダイレクトURL設定 |
| `src/background.ts` | リダイレクト処理、URL検証 |
| `src/options.ts` | 時間帯設定（未完成機能） |

## データストレージ（Chrome Storage Sync）

| キー | 用途 |
|------|------|
| `unblockUntil` | ブロック再開タイムスタンプ |
| `defaultMinutes` | デフォルト解除時間 |
| `usageHistory` | 日別使用時間（YYYY-MM-DD → 分） |
| `redirectURL` | ブロック時のリダイレクト先 |

## 実装詳細

- 日付フォーマット: `sv-SE`ロケール（YYYY-MM-DD）
- 履歴保持: 30日間（自動クリーンアップ）
- オーバーレイ: z-index 999999
- 状態確認: 10秒間隔

## 開発手順

1. `chrome://extensions` を開く
2. デベロッパーモードを有効化
3. 「パッケージ化されていない拡張機能を読み込む」でプロジェクトディレクトリを選択
4. 変更後はリロードボタンをクリック

## 手動テスト

1. twitter.com / x.com でオーバーレイ表示を確認
2. ポップアップから一時解除を実行
3. タイマー終了後の再ブロックを確認
4. リダイレクトURL設定と動作を確認

## 権限

- `storage`: 設定・履歴保存
- `tabs`: リダイレクト用タブ作成
- Host: `*://x.com/*`, `*://twitter.com/*`

## 制約・注意点

- Manifest V3: 永続バックグラウンドページなし、コンテンツスクリプトは分離コンテキスト
- UIテキスト: 日本語のみ（i18n未対応）
- 時間帯ブロック機能: UIのみ実装済み（ロジック未実装）
- **更新時は必ずバージョンを1上げる**（ブラウザで変更反映を確認するため）