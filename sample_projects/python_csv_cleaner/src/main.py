"""main.py - CSV クリーナー エントリポイント"""

import argparse
import sys
from pathlib import Path

import pandas as pd

from cleaner import clean
from config import CleanerConfig


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="CSV クリーニングツール")
    p.add_argument("input",  type=Path, help="入力 CSV ファイルパス")
    p.add_argument("output", type=Path, nargs="?", help="出力 CSV ファイルパス（省略時: input_cleaned.csv）")
    p.add_argument("--encoding",    default="utf-8-sig", help="入力エンコーディング（デフォルト: utf-8-sig）")
    p.add_argument("--no-fullwidth", action="store_true",  help="全角→半角変換をスキップ")
    p.add_argument("--drop-dupes",   action="store_true",  help="重複行を削除する")
    p.add_argument("--quiet",        action="store_true",  help="サマリー出力を抑制する")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    input_path: Path = args.input
    if not input_path.exists():
        print(f"ERROR: ファイルが見つかりません: {input_path}", file=sys.stderr)
        sys.exit(1)

    output_path: Path = args.output or input_path.with_stem(input_path.stem + "_cleaned")

    cfg = CleanerConfig(
        encoding=args.encoding,
        normalize_fullwidth=not args.no_fullwidth,
        drop_duplicates=args.drop_dupes,
        verbose=not args.quiet,
    )

    try:
        df = pd.read_csv(input_path, encoding=cfg.encoding, dtype=str)
    except UnicodeDecodeError:
        # フォールバック: cp932 で再試行
        df = pd.read_csv(input_path, encoding="cp932", dtype=str)

    df_clean, stats = clean(df, cfg)

    df_clean.to_csv(output_path, index=False, encoding=cfg.output_encoding)

    if cfg.verbose:
        print(f"入力: {input_path} ({stats['rows_before']}行)")
        print(f"出力: {output_path} ({stats['rows_after']}行)")
        if stats["changes"]:
            print("変換内容:")
            for c in stats["changes"]:
                print(f"  - {c}")
        else:
            print("変換なし（クリーン済みデータ）")


if __name__ == "__main__":
    main()
