"""test_cleaner.py - cleaner.py の単体テスト"""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cleaner import clean, _clean_amount_column, _clean_date_column
from config import CleanerConfig


@pytest.fixture
def base_cfg():
    return CleanerConfig(verbose=False)


class TestAmountCleaning:
    def test_removes_yen_symbol(self, base_cfg):
        df = pd.DataFrame({"金額": ["¥1,000", "¥2,500"]})
        df, _ = _clean_amount_column(df, "金額")
        assert df["金額"].tolist() == [1000.0, 2500.0]

    def test_removes_comma(self, base_cfg):
        df = pd.DataFrame({"金額": ["100,000"]})
        df, _ = _clean_amount_column(df, "金額")
        assert df["金額"].tolist() == [100000.0]

    def test_removes_en_suffix(self, base_cfg):
        df = pd.DataFrame({"金額": ["5000円"]})
        df, _ = _clean_amount_column(df, "金額")
        assert df["金額"].tolist() == [5000.0]

    def test_handles_empty(self, base_cfg):
        df = pd.DataFrame({"金額": ["", None]})
        df, _ = _clean_amount_column(df, "金額")
        assert pd.isna(df["金額"]).all()


class TestDateCleaning:
    def test_normalizes_slash_format(self, base_cfg):
        df = pd.DataFrame({"日付": ["2026/04/18"]})
        df, _ = _clean_date_column(df, "日付")
        assert df["日付"].tolist() == ["2026-04-18"]

    def test_normalizes_japanese_format(self, base_cfg):
        df = pd.DataFrame({"日付": ["2026年4月18日"]})
        df, _ = _clean_date_column(df, "日付")
        assert df["日付"].tolist() == ["2026-04-18"]

    def test_invalid_date_becomes_nan(self, base_cfg):
        df = pd.DataFrame({"日付": ["not-a-date"]})
        df, _ = _clean_date_column(df, "日付")
        assert df["日付"].tolist() == ["NaT"]


class TestFullPipeline:
    def test_drop_empty_rows(self, base_cfg):
        df = pd.DataFrame({"A": ["val", None, "val2"], "B": ["x", None, "y"]})
        df_clean, stats = clean(df, base_cfg)
        assert len(df_clean) == 2
        assert any("空白行削除" in c for c in stats["changes"])

    def test_strip_whitespace(self, base_cfg):
        df = pd.DataFrame({"取引先名": ["  株式会社A  ", " 合同会社B"]})
        df_clean, _ = clean(df, base_cfg)
        assert df_clean["取引先名"].tolist() == ["株式会社A", "合同会社B"]

    def test_normalize_fullwidth(self, base_cfg):
        df = pd.DataFrame({"コード": ["ＡＢＣ１２３"]})
        df_clean, _ = clean(df, base_cfg)
        assert df_clean["コード"].tolist() == ["ABC123"]

    def test_drop_duplicates_option(self):
        cfg = CleanerConfig(verbose=False, drop_duplicates=True)
        df = pd.DataFrame({"A": ["x", "x", "y"]})
        df_clean, stats = clean(df, cfg)
        assert len(df_clean) == 2
        assert any("重複行削除" in c for c in stats["changes"])
