from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MinMaxScaler, OneHotEncoder


ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
MODEL_DIR.mkdir(exist_ok=True)


@dataclass(frozen=True)
class DatasetConfig:
    age_group: str
    csv_path: Path
    target: str
    feature_columns: list[str]
    numeric_columns: list[str]
    categorical_columns: list[str]


CONFIGS = [
    DatasetConfig(
        age_group="child",
        csv_path=Path(r"e:\Foundation in DS project\child_cleaned_data.csv"),
        target="ppvt",
        feature_columns=[
            "age_years",
            "educ_cat",
            "momage",
            "age_education_interaction",
        ],
        numeric_columns=[
            "age_years",
            "educ_cat",
            "momage",
            "age_education_interaction",
        ],
        categorical_columns=[],
    ),
    DatasetConfig(
        age_group="adult",
        csv_path=Path(r"e:\Foundation in DS project\adult_cleaned_data.csv"),
        target="Cognitive_Score",
        feature_columns=[
            "Age",
            "Gender",
            "Sleep_Duration",
            "Stress_Level",
            "Diet_Type",
            "Daily_Screen_Time",
            "Exercise_Frequency",
            "Caffeine_Intake",
            "Reaction_Time",
            "Memory_Test_Score",
            "stress_screentime_interaction",
        ],
        numeric_columns=[
            "Age",
            "Sleep_Duration",
            "Stress_Level",
            "Daily_Screen_Time",
            "Caffeine_Intake",
            "Reaction_Time",
            "Memory_Test_Score",
            "stress_screentime_interaction",
        ],
        categorical_columns=[
            "Gender",
            "Diet_Type",
            "Exercise_Frequency",
        ],
    ),
    DatasetConfig(
        age_group="elderly",
        csv_path=Path(r"e:\Foundation in DS project\old_cleaned_data.csv"),
        target="MMSE_Score",
        feature_columns=[
            "Age",
            "Gender",
            "Education_Level",
            "Region",
            "Marital_Status",
            "Chronic_Diseases",
            "Glucose_Level",
            "BMI",
            "GDS_Score",
            "Sleep_Quality_Score",
            "Physical_Activity_Score",
            "Smoking_Status",
            "Alcohol_Use",
            "cognitive_risk",
        ],
        numeric_columns=[
            "Age",
            "Chronic_Diseases",
            "Glucose_Level",
            "BMI",
            "GDS_Score",
            "Sleep_Quality_Score",
            "Physical_Activity_Score",
            "cognitive_risk",
        ],
        categorical_columns=[
            "Gender",
            "Education_Level",
            "Region",
            "Marital_Status",
            "Smoking_Status",
            "Alcohol_Use",
        ],
    ),
]


def build_pipeline(config: DatasetConfig) -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", MinMaxScaler()),
                    ]
                ),
                config.numeric_columns,
            ),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                config.categorical_columns,
            ),
        ]
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "model",
                RandomForestRegressor(
                    n_estimators=250,
                    random_state=42,
                    max_depth=10,
                    min_samples_leaf=2,
                ),
            ),
        ]
    )


def train_one(config: DatasetConfig) -> dict[str, Any]:
    frame = pd.read_csv(config.csv_path)
    X = frame[config.feature_columns]
    y = frame[config.target]

    pipeline = build_pipeline(config)
    pipeline.fit(X, y)

    output_path = MODEL_DIR / f"{config.age_group}_model.joblib"
    joblib.dump(
        {
            "pipeline": pipeline,
            "target": config.target,
            "feature_columns": config.feature_columns,
            "numeric_columns": config.numeric_columns,
            "categorical_columns": config.categorical_columns,
        },
        output_path,
    )

    return {
      "age_group": config.age_group,
      "rows": len(frame),
      "output": str(output_path),
    }


def main() -> None:
    results = [train_one(config) for config in CONFIGS]
    for result in results:
        print(f"trained {result['age_group']} -> {result['output']} ({result['rows']} rows)")


if __name__ == "__main__":
    main()
