# Python CSV クリーナー

会計・業務データの CSV を自動クリーニングするコマンドラインツール。  
全角→半角変換、金額・日付の正規化、空白行・重複の除去を一括で処理する。

## 機能

| 機能 | 説明 |
|------|------|
| 全角→半角変換 | `ＡＢＣ１２３` → `ABC123` |
| 前後空白除去 | `　株式会社A　` → `株式会社A` |
| 金額正規化 | `¥1,000円` → `1000.0` |
| 日付正規化 | `2026/04/01` / `2026年4月1日` → `2026-04-01` |
| 空白行削除 | 全カラムが空の行を除去 |
| 重複行削除 | オプションで有効化 |

## 使い方

```bash
# 基本
python src/main.py sample_data/input_dirty.csv

# 出力先を指定
python src/main.py input.csv output_clean.csv

# 重複も削除
python src/main.py input.csv --drop-dupes

# Shift-JIS ファイルを処理
python src/main.py input.csv --encoding cp932
```

## セットアップ

```bash
pip install -r requirements.txt
```

## テストの実行

```bash
pytest tests/
```

## 設定のカスタマイズ

`src/config.py` の `CleanerConfig` を編集して、金額列・日付列として扱うカラム名を追加できる。

```python
amount_columns: list[str] = ["金額", "単価", "合計", "税抜", "消費税"]
date_columns:   list[str] = ["日付", "取引日", "計上日", "請求日", "支払期日"]
```

## ファイル構成

```
src/
  main.py      エントリポイント（argparse）
  cleaner.py   クリーニング処理
  config.py    設定値（CleanerConfig）
tests/
  test_cleaner.py  pytest 単体テスト
sample_data/
  input_dirty.csv  汚いデータのサンプル
requirements.txt
```
