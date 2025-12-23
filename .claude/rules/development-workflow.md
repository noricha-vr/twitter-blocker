---
description: 開発ワークフロー規約。コード編集後に適用。
globs: ["src/**/*.ts", "manifest.json"]
---

# 開発ワークフロー

## コード編集後の必須作業

1. **バージョンを1上げる**
   - `manifest.json` と `package.json` の両方を更新
   - ブラウザで変更反映を確認するため必須

2. **リンター実行**
   - `npm run typecheck` で型チェック

3. **ビルド実行**
   - `npm run build` でビルド
   - エラーがあれば修正してから完了とする
