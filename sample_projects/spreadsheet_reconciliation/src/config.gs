/**
 * config.gs - 設定値の管理
 */

const CONFIG = {
  // ── スプレッドシート設定 ────────────────────────────────────
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',

  SHEETS: {
    BANK:   '銀行明細',     // 銀行から取得した入出金明細
    LEDGER: '帳簿データ',   // 自社帳簿・売掛金台帳
    RESULT: '照合結果',     // マッチング結果の出力先
    LOG:    '処理ログ',
  },

  // ── 照合設定 ──────────────────────────────────────────────
  // 金額の一致判定に使う許容誤差（円）
  AMOUNT_TOLERANCE: 0,

  // 日付の一致判定に使う許容日数（銀行着金のズレを吸収）
  DATE_TOLERANCE_DAYS: 3,

  // ── 出力設定 ──────────────────────────────────────────────
  // 照合済みの行をハイライトする色
  COLOR_MATCHED:   '#d9ead3',  // 薄緑
  COLOR_UNMATCHED: '#fce5cd',  // 薄オレンジ
  COLOR_SUSPECT:   '#fff2cc',  // 薄黄（金額一致・日付ズレ）

  // ── デバッグ ─────────────────────────────────────────────
  DRY_RUN: false,
};

function getConfig() {
  return CONFIG;
}
