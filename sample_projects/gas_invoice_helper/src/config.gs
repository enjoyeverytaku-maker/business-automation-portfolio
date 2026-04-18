/**
 * config.gs - 設定値の管理
 * このファイルの定数を自分の環境に合わせて変更してください。
 */

const CONFIG = {
  // ── スプレッドシート設定 ────────────────────────────────────
  // SpreadsheetApp.getActiveSpreadsheet() で現在のシートを使う場合はコメントアウト
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',

  // シート名
  SHEETS: {
    CLIENTS:  '取引先マスター',
    INVOICES: '請求書データ',
    LOG:      '処理ログ',
  },

  // ── 請求書設定 ────────────────────────────────────────────
  INVOICE_PREFIX: 'INV-',      // 請求書番号のプレフィックス
  TAX_RATE:       0.10,        // 消費税率

  // ── 通知設定 ──────────────────────────────────────────────
  // 未入金リマインドを送る日数（支払期日の何日前）
  REMINDER_DAYS_BEFORE: 7,

  // 通知元メールアドレス（Gmail の送信元）
  NOTIFY_FROM: Session.getActiveUser().getEmail(),

  // 通知先（経理担当者など）。カンマ区切りで複数指定可
  NOTIFY_TO: 'accounting@example.com',

  // ── デバッグ設定 ─────────────────────────────────────────
  DRY_RUN: false,  // true にするとメール送信をスキップしてログだけ出す
};

/** 設定値を取得する（存在しないキーはエラー） */
function getConfig() {
  return CONFIG;
}
