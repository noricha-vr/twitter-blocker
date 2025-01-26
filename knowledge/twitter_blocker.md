# Twitter Blocker

## プロジェクト概要
- Chrome拡張機能(Manifest V3)
- 基本的にTwitterをブロックし、必要な時だけ一時解除
- ポップアップで解除時間を分単位で設定可能

## 技術スタック
- Manifest V3
- Chrome Storage API
- Content Scripts

## 主要機能
1. 常時ブロック機能
   - デフォルトでTwitterへのアクセスをブロック
   - x.comとtwitter.comの両方に対応

2. 一時解除機能
   - 分単位での解除時間設定
   - 時間経過後の自動ブロック
   - 解除中でも10秒ごとに時間をチェック

## 実装の工夫
- ブロック状態の二重チェック防止
- スタイルをインラインからCSSに分離
- 日本語の括弧は全角に統一

## 今後の課題
- [ ] デザインの改善
- [ ] 使用時間の統計機能
- [ ] 複数の時間プリセット

## 開発メモ
- Manifest V3の制約に注意
- Content Scriptでのページ制御が有効
- Storage APIの非同期処理に注意 
