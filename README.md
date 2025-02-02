# Twitter Blocker

Twitterへのアクセスを常時ブロックし、必要な時だけ一時的に解除できるChrome拡張機能です。

## 機能

- Twitterへのアクセスを常時ブロック
- ポップアップから解除時間（分単位）を設定可能
- 設定時間経過後に自動的にブロック状態に戻る
- twitter.comとx.comの両方に対応

## インストール方法

1. このリポジトリをクローンまたはダウンロード
2. Chrome拡張機能の管理ページを開く
   - Chromeで`chrome://extensions`にアクセス
3. デベロッパーモードをオン
   - 右上のデベロッパーモードをオンにする
4. 拡張機能を読み込む
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - ダウンロードしたフォルダを選択

## 使い方

1. インストール直後は、TwitterとX.comへのアクセスが常時ブロックされます
2. Twitterを使用したい場合：
   - ブラウザ右上の拡張機能アイコンをクリック
   - 使用したい時間（分）を入力
   - 「保存」ボタンをクリック
3. 設定した時間が経過すると：
   - 自動的にブロック状態に戻ります
   - 再度使用したい場合は、上記手順を繰り返してください

## デプロイ

1. デプロイ用の圧縮ファイルを作成　`zip -r twitter-blocker.zip *-x "*.git*" -x "store-assets/*"`
2. ストアにデプロイする https://chrome.google.com/webstore/devconsole/

## Privacy Policy

このChrome拡張機能は、以下のプライバシーポリシーに従って動作します：

1. データ収集
   - ユーザーの個人情報は一切収集しません
   - 拡張機能の設定データのみをブラウザのローカルストレージに保存します

2. 保存されるデータ
   - 一時解除の時間設定
   - デフォルトの解除時間設定
   - これらのデータは、ブラウザのローカルストレージにのみ保存され、外部に送信されることはありません

3. 権限の使用
   - storage: 設定の保存のみに使用
   - tabs: Twitter/X.comのタブのリロードのみに使用
   - host permissions: Twitter.comとX.comのアクセス制御のみに使用

4. データの削除
   - 拡張機能をアンインストールすると、すべての設定データは完全に削除されます

5. 第三者へのデータ提供
   - いかなる場合も、保存されたデータを第三者に提供することはありません

6. 問い合わせ
   - プライバシーに関する質問や懸念がある場合は、GitHubのIssueでご連絡ください

## License

MIT License

Copyright (c) 2024 noricha-vr

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
