"""config.py - 設定値の管理"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CleanerConfig:
    # 入力ファイルのエンコーディング（自動検出する場合は None）
    encoding: Optional[str] = "utf-8-sig"

    # 出力エンコーディング
    output_encoding: str = "utf-8"

    # 金額列として扱うカラム名（カンマ・円記号を除去して数値化）
    amount_columns: list[str] = field(default_factory=lambda: ["金額", "単価", "合計", "税抜", "消費税"])

    # 日付列として扱うカラム名（パース→ISO 8601 に正規化）
    date_columns: list[str] = field(default_factory=lambda: ["日付", "取引日", "計上日", "請求日", "支払期日"])

    # 空白行を削除するか
    drop_empty_rows: bool = True

    # 重複行を削除するか
    drop_duplicates: bool = False

    # 全角英数字を半角に変換するか
    normalize_fullwidth: bool = True

    # 前後の空白を除去するか
    strip_whitespace: bool = True

    # 処理結果のサマリーをコンソールに出力するか
    verbose: bool = True


DEFAULT_CONFIG = CleanerConfig()
