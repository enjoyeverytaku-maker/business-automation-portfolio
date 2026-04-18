/**
 * utils.gs - 共通ユーティリティ関数
 */

/**
 * 処理ログをログシートに追記する
 * @param {string} level  'INFO' | 'WARN' | 'ERROR'
 * @param {string} message
 */
function writeLog(level, message) {
  const config = getConfig();
  try {
    const ss    = SpreadsheetApp.openById(config.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(config.SHEETS.LOG)
                 || ss.insertSheet(config.SHEETS.LOG);
    sheet.appendRow([new Date(), level, message]);
  } catch (e) {
    console.log(`[LOG WRITE ERROR] ${e.message}`);
  }
  console.log(`[${level}] ${message}`);
}

/**
 * 今日の日付を YYYY-MM-DD 形式で返す
 * @returns {string}
 */
function todayStr() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
}

/**
 * 日付を YYYY-MM-DD 形式にフォーマットする
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  if (!(date instanceof Date)) return String(date);
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
}

/**
 * 数値を通貨フォーマット（¥1,000）に変換する
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return '¥' + Number(amount).toLocaleString('ja-JP');
}

/**
 * シートの全データを {header: value} の配列で返す
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Object[]}
 */
function sheetToObjects(sheet) {
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]]))
  );
}

/**
 * メール送信（DRY_RUN 時はログだけ出す）
 * @param {string} to
 * @param {string} subject
 * @param {string} body
 */
function sendEmailSafe(to, subject, body) {
  const config = getConfig();
  if (config.DRY_RUN) {
    writeLog('INFO', `[DRY_RUN] メール送信スキップ: to=${to}, subject=${subject}`);
    return;
  }
  GmailApp.sendEmail(to, subject, body);
  writeLog('INFO', `メール送信完了: to=${to}, subject=${subject}`);
}
