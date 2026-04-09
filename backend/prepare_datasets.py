from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler


SOURCE_DIR = Path(r"e:\Foundation in DS project")


def remove_outliers_iqr(df: pd.DataFrame, columns: list[str], multiplier: float = 1.5) -> pd.DataFrame:
    cleaned = df.copy()
    for column in columns:
        q1 = cleaned[column].quantile(0.25)
        q3 = cleaned[column].quantile(0.75)
        iqr = q3 - q1
        lower = q1 - multiplier * iqr
        upper = q3 + multiplier * iqr
        cleaned = cleaned[(cleaned[column] >= lower) & (cleaned[column] <= upper)]
    return cleaned.reset_index(drop=True)


def normalize_features(df: pd.DataFrame, exclude_cols: list[str] | None = None) -> pd.DataFrame:
    exclude_cols = exclude_cols or []
    result = df.copy()
    numeric_cols = [col for col in result.select_dtypes(include=["number"]).columns if col not in exclude_cols]
    if numeric_cols:
        scaler = MinMaxScaler()
        result[numeric_cols] = scaler.fit_transform(result[numeric_cols])
    return result


def prepare_child() -> pd.DataFrame:
    df = pd.read_csv(SOURCE_DIR / "Child_dataset.csv", index_col=0)
    df = df.drop_duplicates()
    df = df.dropna(subset=["ppvt"])
    for column in df.select_dtypes(include=["number"]).columns:
        df[column] = df[column].fillna(df[column].median())

    rng = np.random.default_rng(42)
    n = len(df)
    n1 = int(0.10 * n)
    n2 = int(0.20 * n)
    n3 = int(0.35 * n)
    n4 = n - (n1 + n2 + n3)
    ages_months = np.concatenate(
        [
            rng.uniform(0, 3, n1),
            rng.uniform(3, 12, n2),
            rng.uniform(12, 24, n3),
            rng.uniform(24, 36, n4),
        ]
    )
    rng.shuffle(ages_months)
    df["age_months"] = ages_months
    df["age_years"] = df["age_months"] / 12
    df = remove_outliers_iqr(df, ["ppvt"])
    df = normalize_features(df)
    df["age_education_interaction"] = df["age_months"] * df["educ_cat"]
    return df


def prepare_adult() -> pd.DataFrame:
    df = pd.read_csv(SOURCE_DIR / "adult_dataset.csv")
    df = df.drop_duplicates()
    for column in df.select_dtypes(include=["number"]).columns:
        df[column] = df[column].fillna(df[column].median())
    for column in df.select_dtypes(include=["object"]).columns:
        df[column] = df[column].fillna(df[column].mode().iloc[0])
    df = remove_outliers_iqr(df, ["Age", "Memory_Test_Score", "Cognitive_Score"])
    df = normalize_features(df, exclude_cols=["User_ID"])
    df["stress_screentime_interaction"] = df["Stress_Level"] * df["Daily_Screen_Time"]
    return df


def prepare_old() -> pd.DataFrame:
    df = pd.read_csv(SOURCE_DIR / "old_people_dataset.csv")
    df = df.drop_duplicates()
    for column in df.select_dtypes(include=["number"]).columns:
        df[column] = df[column].fillna(df[column].median())
    for column in df.select_dtypes(include=["object"]).columns:
        df[column] = df[column].fillna(df[column].mode().iloc[0])
    df = remove_outliers_iqr(df, ["Age", "MMSE_Score", "GDS_Score"])
    df = normalize_features(df, exclude_cols=["Participant_ID"])
    df["cognitive_risk"] = df["Chronic_Diseases"] + df["GDS_Score"]
    return df


def main() -> None:
    child = prepare_child()
    adult = prepare_adult()
    old = prepare_old()

    child.to_csv(SOURCE_DIR / "child_cleaned_data.csv", index=False)
    adult.to_csv(SOURCE_DIR / "adult_cleaned_data.csv", index=False)
    old.to_csv(SOURCE_DIR / "old_cleaned_data.csv", index=False)

    print("cleaned datasets written successfully")


if __name__ == "__main__":
    main()
