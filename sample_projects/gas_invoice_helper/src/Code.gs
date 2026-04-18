/**
 * Code.gs - GAS 請求書・入金管理補助ツール
 *
 * 機能:
 *   1. 請求書番号を自動採番して請求書データに記録
 *   2. 支払期日が近い未入金請求をリマインドメールで通知
 *   3. 入金確認後にステータスを自動更新
 *
 * セットアップ:
 *   1. config.gs の SPREADSHEET_ID を自分のシートIDに変更
 *   2. スプレッドシートに「取引先マスター」「請求書データ」シートを作成
 *   3. installTriggers() を1回実行してトリガーを設定
 *
 * シート構造（請求書データ）:
 *   A: 請求書番号 | B: 請求日 | C: 取引先ID | D: 取引先名
 *   E: 金額(税抜) | F: 消費税 | G: 合計 | H: 支払期日
 *   I: ステータス | J: 入金日 | K: 備考
 */

// ── トリガー設定（初回だけ実行） ────────────────────────────────

/**
 * 自動実行トリガーをインストールする（手動で1回だけ実行）
 */
function installTriggers() {
  // 既存トリガーを削除
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // 毎朝9時にリマインドチェックを実行
  ScriptApp.newTrigger('checkPaymentReminders')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();

  writeLog('INFO', 'トリガーをインストールしました（毎朝9時にリマインドチェック）');
}

// ── 請求書番号の採番 ────────────────────────────────────────────

/**
 * 次の請求書番号を採番して返す
 * 形式: INV-YYYYMM-001
 * @returns {string}
 */
function generateInvoiceNumber() {
  const config    = getConfig();
  const ss        = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet     = ss.getSheetByName(config.SHEETS.INVOICES);
  const lastRow   = sheet.getLastRow();
  const yearMonth = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMM');

  // 当月の請求書件数をカウント
  let monthCount = 0;
  if (lastRow > 1) {
    const numbers = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    monthCount = numbers.filter(n => String(n).includes(yearMonth)).length;
  }

  const seq = String(monthCount + 1).padStart(3, '0');
  return `${config.INVOICE_PREFIX}${yearMonth}-${seq}`;
}

/**
 * 新しい請求書を登録する
 * @param {Object} params
 * @param {string} params.clientId   取引先ID
 * @param {string} params.clientName 取引先名
 * @param {number} params.amount     税抜金額
 * @param {string} params.dueDate    支払期日 (YYYY-MM-DD)
 * @param {string} [params.note]     備考
 * @returns {string} 採番された請求書番号
 */
function addInvoice({ clientId, clientName, amount, dueDate, note = '' }) {
  const config  = getConfig();
  const ss      = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet   = ss.getSheetByName(config.SHEETS.INVOICES);
  const invoiceNo = generateInvoiceNumber();
  const tax     = Math.floor(amount * config.TAX_RATE);
  const total   = amount + tax;

  sheet.appendRow([
    invoiceNo,
    todayStr(),
    clientId,
    clientName,
    amount,
    tax,
    total,
    dueDate,
    '未入金',
    '',
    note,
  ]);

  writeLog('INFO', `請求書を登録: ${invoiceNo} / ${clientName} / ${formatCurrency(total)}`);
  return invoiceNo;
}

// ── 入金ステータス更新 ───────────────────────────────────────────

/**
 * 入金確認済みに更新する
 * @param {string} invoiceNo 請求書番号
 * @param {string} [paidDate] 入金日 (YYYY-MM-DD)。省略時は今日
 */
function markAsPaid(invoiceNo, paidDate) {
  const config  = getConfig();
  const ss      = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet   = ss.getSheetByName(config.SHEETS.INVOICES);
  const data    = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === invoiceNo) {
      sheet.getRange(i + 1, 9).setValue('入金済');             // ステータス列
      sheet.getRange(i + 1, 10).setValue(paidDate || todayStr()); // 入金日列
      writeLog('INFO', `入金済に更新: ${invoiceNo}`);
      return;
    }
  }

  writeLog('WARN', `請求書番号が見つかりません: ${invoiceNo}`);
}

// ── リマインド通知 ───────────────────────────────────────────────

/**
 * 支払期日が近い未入金請求をチェックしてメール通知する
 * （毎朝トリガーで自動実行）
 */
function checkPaymentReminders() {
  const config      = getConfig();
  const ss          = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet       = ss.getSheetByName(config.SHEETS.INVOICES);
  const invoices    = sheetToObjects(sheet);
  const today       = new Date();
  const reminderDay = config.REMINDER_DAYS_BEFORE;

  const targets = invoices.filter(inv => {
    if (inv['ステータス'] !== '未入金') return false;
    const due  = new Date(inv['支払期日']);
    const diff = Math.floor((due - today) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= reminderDay;
  });

  if (targets.length === 0) {
    writeLog('INFO', `リマインド対象なし（${todayStr()}）`);
    return;
  }

  const lines = targets.map(inv =>
    `・${inv['請求書番号']} / ${inv['取引先名']} / ${formatCurrency(inv['合計'])} / 期日: ${formatDate(new Date(inv['支払期日']))}`
  );

  const subject = `【入金確認】支払期日まで${reminderDay}日以内の未入金が${targets.length}件あります`;
  const body    = [
    '以下の請求書について入金確認をお願いします。',
    '',
    ...lines,
    '',
    `※ このメールは自動送信です（${todayStr()}）`,
  ].join('\n');

  sendEmailSafe(config.NOTIFY_TO, subject, body);
  writeLog('INFO', `リマインド送信: ${targets.length}件`);
}

// ── 月次サマリー生成 ─────────────────────────────────────────────

/**
 * 当月の請求・入金サマリーをログシートに出力する
 */
function generateMonthlySummary() {
  const config   = getConfig();
  const ss       = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet    = ss.getSheetByName(config.SHEETS.INVOICES);
  const invoices = sheetToObjects(sheet);
  const yearMonth = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM');

  const thisMonth = invoices.filter(inv =>
    String(inv['請求日']).startsWith(yearMonth.replace('/', '-'))
  );

  const total  = thisMonth.reduce((s, i) => s + Number(i['合計'] || 0), 0);
  const paid   = thisMonth.filter(i => i['ステータス'] === '入金済').reduce((s, i) => s + Number(i['合計'] || 0), 0);
  const unpaid = total - paid;

  writeLog('INFO', [
    `【月次サマリー ${yearMonth}】`,
    `件数: ${thisMonth.length}件`,
    `請求合計: ${formatCurrency(total)}`,
    `入金済: ${formatCurrency(paid)}`,
    `未入金: ${formatCurrency(unpaid)}`,
  ].join(' / '));
}
