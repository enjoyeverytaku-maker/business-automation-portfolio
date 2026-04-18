/**
 * Code.gs - GAS スプレッドシート照合ツール
 *
 * 機能:
 *   1. 銀行明細と帳簿データを自動照合
 *   2. 照合結果（一致/不一致/要確認）を専用シートに出力
 *   3. 未照合の明細を色分けしてハイライト
 *
 * セットアップ:
 *   1. config.gs の SPREADSHEET_ID を変更
 *   2. スプレッドシートに「銀行明細」「帳簿データ」シートを作成
 *   3. runReconciliation() を実行
 *
 * 銀行明細シート構造:
 *   A: 取引日 | B: 摘要 | C: 入金額 | D: 出金額 | E: 残高
 *
 * 帳簿データシート構造:
 *   A: 計上日 | B: 取引先名 | C: 金額 | D: 種別(入金/出金) | E: 請求書番号 | F: 備考
 */

/**
 * メイン照合処理
 */
function runReconciliation() {
  const config = getConfig();
  const ss     = SpreadsheetApp.openById(config.SPREADSHEET_ID);

  const bankSheet   = ss.getSheetByName(config.SHEETS.BANK);
  const ledgerSheet = ss.getSheetByName(config.SHEETS.LEDGER);
  const resultSheet = getOrCreateSheet(ss, config.SHEETS.RESULT);

  const bankRows   = sheetToObjects(bankSheet);
  const ledgerRows = sheetToObjects(ledgerSheet);

  writeLog('INFO', `照合開始: 銀行明細 ${bankRows.length}件 / 帳簿 ${ledgerRows.length}件`);

  const results = reconcile(bankRows, ledgerRows);

  writeResults(resultSheet, results);
  applyHighlights(bankSheet, results, config);
  writeLog('INFO', summarize(results));
}

// ── 照合ロジック ────────────────────────────────────────────

/**
 * 銀行明細と帳簿を突き合わせる
 * @param {Object[]} bankRows
 * @param {Object[]} ledgerRows
 * @returns {Object[]} results
 */
function reconcile(bankRows, ledgerRows) {
  const config  = getConfig();
  const matched = new Set();
  const results = [];

  bankRows.forEach((bank, bi) => {
    const bankAmount = Number(bank['入金額'] || 0) - Number(bank['出金額'] || 0);
    const bankDate   = new Date(bank['取引日']);

    let bestMatch = null;
    let bestScore = -1;

    ledgerRows.forEach((ledger, li) => {
      if (matched.has(li)) return;

      const ledgerAmount = Number(ledger['金額']) * (ledger['種別'] === '出金' ? -1 : 1);
      if (Math.abs(bankAmount - ledgerAmount) > config.AMOUNT_TOLERANCE) return;

      const ledgerDate = new Date(ledger['計上日']);
      const dayDiff    = Math.abs((bankDate - ledgerDate) / (1000 * 60 * 60 * 24));
      if (dayDiff > config.DATE_TOLERANCE_DAYS) return;

      // スコア：日付が近いほど高い
      const score = config.DATE_TOLERANCE_DAYS - dayDiff;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { li, ledger, dayDiff };
      }
    });

    if (bestMatch) {
      matched.add(bestMatch.li);
      results.push({
        bankRow:     bi + 2,
        status:      bestMatch.dayDiff === 0 ? 'matched' : 'suspect',
        bankDate:    formatDate(bankDate),
        bankAmount,
        ledgerDate:  formatDate(new Date(bestMatch.ledger['計上日'])),
        ledgerRef:   bestMatch.ledger['請求書番号'] || '',
        clientName:  bestMatch.ledger['取引先名'] || '',
        dayDiff:     bestMatch.dayDiff,
      });
    } else {
      results.push({
        bankRow:    bi + 2,
        status:     'unmatched',
        bankDate:   formatDate(bankDate),
        bankAmount,
        ledgerDate:  '',
        ledgerRef:  '',
        clientName: '',
        dayDiff:    null,
      });
    }
  });

  return results;
}

// ── 出力 ────────────────────────────────────────────────────

/**
 * 照合結果シートに書き出す
 */
function writeResults(sheet, results) {
  sheet.clearContents();

  const headers = ['銀行行番号', 'ステータス', '銀行取引日', '銀行金額', '帳簿計上日', '取引先名', '請求書番号', '日付差(日)'];
  sheet.appendRow(headers);

  results.forEach(r => {
    sheet.appendRow([
      r.bankRow,
      statusLabel(r.status),
      r.bankDate,
      r.bankAmount,
      r.ledgerDate,
      r.clientName,
      r.ledgerRef,
      r.dayDiff !== null ? r.dayDiff : '-',
    ]);
  });
}

/**
 * 銀行明細シートの行を色分けする
 */
function applyHighlights(sheet, results, config) {
  if (config.DRY_RUN) return;
  results.forEach(r => {
    const color = r.status === 'matched'   ? config.COLOR_MATCHED
                : r.status === 'suspect'   ? config.COLOR_SUSPECT
                : config.COLOR_UNMATCHED;
    sheet.getRange(r.bankRow, 1, 1, 5).setBackground(color);
  });
}

// ── ヘルパー ─────────────────────────────────────────────────

function getOrCreateSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function statusLabel(status) {
  return status === 'matched'   ? '照合済'
       : status === 'suspect'   ? '要確認（日付ズレ）'
       : '未照合';
}

function summarize(results) {
  const matched   = results.filter(r => r.status === 'matched').length;
  const suspect   = results.filter(r => r.status === 'suspect').length;
  const unmatched = results.filter(r => r.status === 'unmatched').length;
  return `照合完了: 照合済=${matched}件 / 要確認=${suspect}件 / 未照合=${unmatched}件`;
}

// ── 共通ユーティリティ ─────────────────────────────────────

function writeLog(level, message) {
  const config = getConfig();
  try {
    const ss    = SpreadsheetApp.openById(config.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(config.SHEETS.LOG) || ss.insertSheet(config.SHEETS.LOG);
    sheet.appendRow([new Date(), level, message]);
  } catch (e) {
    console.log(`[LOG ERROR] ${e.message}`);
  }
  console.log(`[${level}] ${message}`);
}

function sheetToObjects(sheet) {
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]]))
  );
}

function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
}
