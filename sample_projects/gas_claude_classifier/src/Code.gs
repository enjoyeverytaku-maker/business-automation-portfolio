/**
 * Claude API × GAS テキスト分類サンプル
 * 用途: Gmail の問い合わせメールを Claude API で自動分類・要約する
 *
 * セットアップ:
 *   1. スクリプトプロパティに CLAUDE_API_KEY を設定する
 *   2. LABEL_NAME に監視したい Gmail ラベル名を設定する
 *   3. SHEET_NAME に結果を書き込むシート名を設定する
 *   4. runDailyClassification() を時間ベーストリガーに登録する
 */

// ── 設定 ────────────────────────────────────────────
const CONFIG = {
  LABEL_NAME:   '未分類問い合わせ',  // 処理対象の Gmail ラベル
  SHEET_NAME:   '分類結果',          // 結果を書き込むシート名
  MAX_EMAILS:   50,                  // 1回の実行で処理する最大件数
  BODY_MAX_CHARS: 500,               // Claude に送るメール本文の最大文字数
  CLAUDE_MODEL: 'claude-haiku-4-5-20251001', // コスト重視なら Haiku
  SLACK_WEBHOOK_URL: '', // Slack 通知する場合は Webhook URL を設定（空なら通知しない）
};

// ── カテゴリ定義 ─────────────────────────────────────
const CATEGORIES = [
  { id: 'billing',   label: '請求・支払い', examples: ['請求書', '支払い', '入金', '領収書', '振込'] },
  { id: 'contract',  label: '契約・手続き', examples: ['契約', '申込', '解約', '更新', '手続き'] },
  { id: 'support',   label: 'サポート・障害', examples: ['エラー', '動かない', '不具合', '困って', 'できない'] },
  { id: 'inquiry',   label: '一般問い合わせ', examples: ['教えて', '確認', '質問', '相談'] },
  { id: 'other',     label: 'その他', examples: [] },
];

const PRIORITIES = ['高', '中', '低'];

// ── メイン処理 ───────────────────────────────────────
function runDailyClassification() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) throw new Error('CLAUDE_API_KEY がスクリプトプロパティに設定されていません');

  const emails = fetchLabeledEmails_(CONFIG.LABEL_NAME, CONFIG.MAX_EMAILS);
  if (emails.length === 0) {
    Logger.log('処理対象メールなし');
    return;
  }

  const sheet = getOrCreateSheet_(CONFIG.SHEET_NAME);
  ensureHeader_(sheet);

  const highPriorityItems = [];

  for (const email of emails) {
    try {
      const result = classifyWithClaude_(email, apiKey);
      appendRow_(sheet, email, result);
      if (result.priority === '高') highPriorityItems.push({ email, result });
      Utilities.sleep(500); // API レート制限対策
    } catch (e) {
      Logger.log(`分類エラー [${email.subject}]: ${e.message}`);
      appendErrorRow_(sheet, email, e.message);
    }
  }

  if (CONFIG.SLACK_WEBHOOK_URL && highPriorityItems.length > 0) {
    notifySlack_(highPriorityItems);
  }

  Logger.log(`完了: ${emails.length}件処理`);
}

// ── Gmail からラベル付きメールを取得 ─────────────────
function fetchLabeledEmails_(labelName, maxCount) {
  const label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    Logger.log(`ラベル "${labelName}" が見つかりません`);
    return [];
  }

  const threads = label.getThreads(0, maxCount);
  const emails = [];

  for (const thread of threads) {
    const msg = thread.getMessages()[0]; // スレッドの先頭メッセージのみ
    emails.push({
      id:      msg.getId(),
      subject: msg.getSubject(),
      from:    msg.getFrom(),
      date:    msg.getDate(),
      body:    msg.getPlainBody().substring(0, CONFIG.BODY_MAX_CHARS),
    });
  }

  return emails;
}

// ── Claude API で分類・要約 ───────────────────────────
function classifyWithClaude_(email, apiKey) {
  const categoryList = CATEGORIES.map(c =>
    `- ${c.id}: ${c.label}（例: ${c.examples.join('、') || 'なし'}）`
  ).join('\n');

  const prompt = `以下のメールを分類・要約してください。必ず JSON のみ返答してください。

【カテゴリ定義】
${categoryList}

【優先度定義】
- 高: 今日中の対応が必要（クレーム・障害・支払い期限など）
- 中: 数日以内に対応が必要
- 低: 急ぎでない

【メール情報】
件名: ${email.subject}
差出人: ${email.from}
本文（先頭${CONFIG.BODY_MAX_CHARS}文字）:
${email.body}

【出力 JSON】
{
  "category_id": "billing|contract|support|inquiry|other のいずれか",
  "priority": "高|中|低 のいずれか",
  "summary": "内容を1〜2文で要約（30文字以内）",
  "reason": "このカテゴリ・優先度にした理由（20文字以内）"
}`;

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify({
      model:      CONFIG.CLAUDE_MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  if (status !== 200) throw new Error(`API エラー: ${status} ${response.getContentText()}`);

  const text = JSON.parse(response.getContentText()).content[0].text.trim();

  // JSON 部分だけ抽出（前後に余分なテキストがある場合に対応）
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`JSON パース失敗: ${text}`);

  const result = JSON.parse(jsonMatch[0]);

  // バリデーション
  const validCategoryIds = CATEGORIES.map(c => c.id);
  if (!validCategoryIds.includes(result.category_id)) result.category_id = 'other';
  if (!PRIORITIES.includes(result.priority)) result.priority = '中';

  // category_id → label に変換
  result.category_label = CATEGORIES.find(c => c.id === result.category_id)?.label || 'その他';

  return result;
}

// ── シート操作 ───────────────────────────────────────
function getOrCreateSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  const headers = ['受信日時', '件名', '差出人', 'カテゴリ', '優先度', '要約', '判定理由', 'メールID'];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8f0fe');
}

function appendRow_(sheet, email, result) {
  const row = [
    email.date,
    email.subject,
    email.from,
    result.category_label,
    result.priority,
    result.summary,
    result.reason,
    email.id,
  ];
  sheet.appendRow(row);

  // 優先度に応じて行を色付け
  const lastRow = sheet.getLastRow();
  const colors = { '高': '#fce8e6', '中': '#fef7e0', '低': '#e6f4ea' };
  const color = colors[result.priority] || '#ffffff';
  sheet.getRange(lastRow, 1, 1, row.length).setBackground(color);
}

function appendErrorRow_(sheet, email, errorMsg) {
  sheet.appendRow([
    email.date,
    email.subject,
    email.from,
    'エラー',
    '-',
    errorMsg,
    '-',
    email.id,
  ]);
}

// ── Slack 通知 ───────────────────────────────────────
function notifySlack_(items) {
  const text = items.map(({ email, result }) =>
    `• *[優先度: 高]* ${result.category_label} — ${email.subject}\n  ${result.summary}`
  ).join('\n');

  UrlFetchApp.fetch(CONFIG.SLACK_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      text: `*【優先度:高】の問い合わせ ${items.length}件*\n${text}`,
    }),
  });
}
