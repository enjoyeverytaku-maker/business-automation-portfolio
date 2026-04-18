"""cleaner.py - CSV クリーニング処理"""

import re
import unicodedata
from datetime import datetime
from typing import Optional

import pandas as pd

from config import CleanerConfig


def clean(df: pd.DataFrame, cfg: CleanerConfig) -> tuple[pd.DataFrame, dict]:
    """
    DataFrame をクリーニングして返す。
    Returns: (cleaned_df, stats)
    """
    stats = {"rows_before": len(df), "changes": []}

    if cfg.strip_whitespace:
        df = _strip_whitespace(df, stats)

    if cfg.normalize_fullwidth:
        df = _normalize_fullwidth(df, stats)

    if cfg.drop_empty_rows:
        before = len(df)
        df = df.dropna(how="all").reset_index(drop=True)
        removed = before - len(df)
        if removed:
            stats["changes"].append(f"空白行削除: {removed}行")

    if cfg.drop_duplicates:
        before = len(df)
        df = df.drop_duplicates().reset_index(drop=True)
        removed = before - len(df)
        if removed:
            stats["changes"].append(f"重複行削除: {removed}行")

    for col in cfg.amount_columns:
        if col in df.columns:
            df, changed = _clean_amount_column(df, col)
            if changed:
                stats["changes"].append(f"金額正規化: {col}")

    for col in cfg.date_columns:
        if col in df.columns:
            df, changed = _clean_date_column(df, col)
            if changed:
                stats["changes"].append(f"日付正規化: {col}")

    stats["rows_after"] = len(df)
    return df, stats


def _strip_whitespace(df: pd.DataFrame, stats: dict) -> pd.DataFrame:
    str_cols = df.select_dtypes(include="object").columns
    df[str_cols] = df[str_cols].apply(lambda s: s.str.strip())
    return df


def _normalize_fullwidth(df: pd.DataFrame, stats: dict) -> pd.DataFrame:
    str_cols = df.select_dtypes(include="object").columns
    df[str_cols] = df[str_cols].apply(
        lambda s: s.map(lambda v: unicodedata.normalize("NFKC", str(v)) if pd.notna(v) else v)
    )
    return df


def _clean_amount_column(df: pd.DataFrame, col: str) -> tuple[pd.DataFrame, bool]:
    """¥1,000 → 1000.0 に変換する"""
    original = df[col].copy()
    cleaned = (
        df[col]
        .astype(str)
        .str.replace(r"[¥,\s円]", "", regex=True)
        .str.replace(r"[^\d.\-]", "", regex=True)
    )
    numeric = pd.to_numeric(cleaned, errors="coerce")
    df[col] = numeric
    changed = not original.equals(df[col].astype(str))
    return df, changed


def _clean_date_column(df: pd.DataFrame, col: str) -> tuple[pd.DataFrame, bool]:
    """各種日付形式 → YYYY-MM-DD に正規化する"""
    original = df[col].copy()
    df[col] = pd.to_datetime(df[col], errors="coerce").dt.strftime("%Y-%m-%d")
    changed = not original.astype(str).equals(df[col].astype(str))
    return df, changed
