# gas_claude_classifier — Claude API × GAS メール自動分類

Gmail に届いた問い合わせメールを **Claude API** で自動分類・要約し、
スプレッドシートに記録 + Slack 通知するサンプルプロジェクト。

## できること

- Gmail のラベル付きメールを取得して Claude API で分類・要約
- カテゴリ（請求 / 契約 / サポート / 問い合わせ / その他）と優先度（高/中/低）を自動判定
- 結果をスプレッドシートに追記（優先度で行を色分け）
- 優先度「高」の案件を Slack に即時通知

## セットアップ（5分）

### 1. Google スプレッドシートを作成

Apps Script エディタ（拡張機能 → Apps Script）を開き、`src/Code.gs` の内容を貼り付ける。

### 2. Claude API キーを設定

スクリプトプロパティ（プロジェクトの設定 → スクリプトプロパティ）に以下を追加：

| キー | 値 |
|-----|---|
| `CLAUDE_API_KEY` | Anthropic API キー（https://console.anthropic.com/） |

### 3. Gmail ラベルを作成

Gmail で対象メールに付けるラベルを作成し、`CONFIG.LABEL_NAME` に合わせる（既定: `未分類問い合わせ`）。

### 4. トリガーを設定

Apps Script のトリガー画面で `runDailyClassification` を時間ベースで登録（例: 毎朝8時）。

### 5.（任意）Slack 通知

Incoming Webhook URL を取得して `CONFIG.SLACK_WEBHOOK_URL` に設定する。

## ファイル構成

```
src/
  Code.gs          ← メイン処理（Gmail取得 → Claude分類 → シート記録）
sample_data/
  sample_emails.csv  ← 動作確認用サンプルデータ
```

## カスタマイズポイント

`CATEGORIES` 配列を編集することで、分類ラベルと判定例を自由に変更できる。

```javascript
const CATEGORIES = [
  { id: 'billing', label: '請求・支払い', examples: ['請求書', '入金'] },
  { id: 'support', label: 'サポート',     examples: ['エラー', '不具合'] },
  // ← 自社に合わせて追加・変更
];
```

## API コスト目安

Claude Haiku 使用時：メール1件あたり約 **0.03〜0.05円**（入力500文字 + 出力100文字程度）。
50件/日で月1,500件処理しても **約50〜75円/月**。

## 使用技術

- Google Apps Script
- Claude API（claude-haiku-4-5-20251001）
- Gmail API
- Google スプレッドシート
- Slack Webhook
