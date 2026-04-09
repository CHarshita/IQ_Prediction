import argparse
import json
import math
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MinMaxScaler, OneHotEncoder

ROOT = Path(__file__).resolve().parents[2]
QUESTION_DIR_CANDIDATES = [
    ROOT / "data",
    ROOT.parent / "Question bank",
]
ORIGINAL_DIR_CANDIDATES = [
    ROOT / "data original",
    ROOT.parent / "Original data",
]
ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "iq_random_forest.joblib"
METADATA_PATH = ARTIFACT_DIR / "iq_random_forest_metadata.json"

TARGET_CANDIDATES = [
    "iq",
    "iq_score",
    "predicted_iq",
    "full_scale_iq",
    "fsiq",
    "total_iq",
    "measured_iq",
    "ppvt",
    "cognitive_score",
    "mmse_score",
]
ID_CANDIDATES = {
    "id",
    "student_id",
    "subject_id",
    "respondent_id",
    "participant_id",
    "record_id",
    "candidate_id",
    "user_id",
    "participantid",
    "participant_id",
    "unnamed_0",
}
FEATURE_NAME_CANDIDATES = {
    "feature_name",
    "feature",
    "original_column",
    "column_name",
    "variable",
    "field_name",
}
QUESTION_ID_CANDIDATES = {"question_id", "id", "question_no", "question_number"}


def normalize_name(value: Any) -> str:
    text = str(value).strip().lower()
    normalized = "".join(ch if ch.isalnum() else "_" for ch in text)
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized.strip("_")


def first_existing_directory(candidates: list[Path]) -> Path:
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


DEFAULT_QUESTION_DIR = first_existing_directory(QUESTION_DIR_CANDIDATES)
DEFAULT_ORIGINAL_DIR = first_existing_directory(ORIGINAL_DIR_CANDIDATES)


def infer_age_group_from_name(name: str) -> str | None:
    lowered = name.lower()
    if "child" in lowered:
        return "child"
    if "adult" in lowered:
        return "adult"
    if "elder" in lowered or "senior" in lowered or "old" in lowered:
        return "elderly"
    return None


def infer_dataset_kind(file_name: str, columns: list[str]) -> str:
    lowered_name = file_name.lower()
    normalized_columns = {normalize_name(column) for column in columns}

    if "child" in lowered_name or {"ppvt", "educ_cat", "momage"}.issubset(normalized_columns):
        return "child"
    if "adult" in lowered_name or {"age", "memory_test_score", "cognitive_score"}.issubset(normalized_columns):
        return "adult"
    if "old" in lowered_name or "elder" in lowered_name or {"age", "mmse_score", "gds_score"}.issubset(normalized_columns):
        return "elderly"
    return "generic"


def scan_tabular_files(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(
        path for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in {".xlsx", ".xls", ".csv"}
    )


def read_file_as_tables(file_path: Path) -> dict[str, pd.DataFrame]:
    if file_path.suffix.lower() == ".csv":
        return {"csv": pd.read_csv(file_path)}
    workbook = pd.read_excel(file_path, sheet_name=None)
    return {sheet_name: frame for sheet_name, frame in workbook.items()}


def prepare_sheet(frame: pd.DataFrame, sheet_name: str, table_count: int) -> pd.DataFrame:
    frame = frame.copy()
    frame.columns = [normalize_name(col) for col in frame.columns]
    frame = frame.dropna(how="all")
    frame = frame.reset_index(drop=True)
    frame["row_index"] = np.arange(len(frame))

    if table_count == 1:
        return frame

    protected = ID_CANDIDATES.union(TARGET_CANDIDATES).union({"row_index"})
    rename_map: dict[str, str] = {}
    prefix = normalize_name(sheet_name) or "sheet"
    for column in frame.columns:
        if column not in protected:
            rename_map[column] = f"{prefix}__{column}"
    return frame.rename(columns=rename_map)


def merge_tables(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    prepared = {name: prepare_sheet(frame, name, len(tables)) for name, frame in tables.items()}
    frames = list(prepared.values())
    merged = frames[0]

    for next_frame in frames[1:]:
        shared_id_columns = [column for column in merged.columns if column in next_frame.columns and column in ID_CANDIDATES]
        join_keys = shared_id_columns if shared_id_columns else ["row_index"]
        merged = merged.merge(next_frame, on=join_keys, how="outer", suffixes=("", "_dup"))

        duplicate_columns = [column for column in merged.columns if column.endswith("_dup")]
        for duplicate in duplicate_columns:
            original = duplicate[:-4]
            if original in TARGET_CANDIDATES:
                merged[original] = merged[original].combine_first(merged[duplicate])
            merged = merged.drop(columns=[duplicate])

    return merged


def find_target_column(columns: list[str], dataset_kind: str) -> str | None:
    preferred = {
        "child": ["ppvt"],
        "adult": ["cognitive_score"],
        "elderly": ["mmse_score"],
    }.get(dataset_kind, [])

    for candidate in preferred + TARGET_CANDIDATES:
        if candidate in columns:
            return candidate
    for column in columns:
        if "iq" in column or "score" in column:
            return column
    return None


def remove_outliers_iqr(frame: pd.DataFrame, columns: list[str], multiplier: float = 1.5) -> tuple[pd.DataFrame, dict[str, int]]:
    cleaned = frame.copy()
    removed_counts: dict[str, int] = {}

    for column in columns:
        if column not in cleaned.columns or not pd.api.types.is_numeric_dtype(cleaned[column]):
            continue
        q1 = cleaned[column].quantile(0.25)
        q3 = cleaned[column].quantile(0.75)
        iqr = q3 - q1
        if pd.isna(iqr) or iqr == 0:
            removed_counts[column] = 0
            continue
        lower_bound = q1 - multiplier * iqr
        upper_bound = q3 + multiplier * iqr
        mask = (cleaned[column] >= lower_bound) & (cleaned[column] <= upper_bound)
        removed_counts[column] = int((~mask).sum())
        cleaned = cleaned[mask]

    return cleaned.reset_index(drop=True), removed_counts


def add_child_age_columns(frame: pd.DataFrame) -> pd.DataFrame:
    if "age_months" in frame.columns and "age_years" in frame.columns:
        return frame

    rng = np.random.default_rng(42)
    n = len(frame)
    if n == 0:
        frame["age_months"] = []
        frame["age_years"] = []
        return frame

    n1 = int(0.10 * n)
    n2 = int(0.20 * n)
    n3 = int(0.35 * n)
    n4 = n - (n1 + n2 + n3)

    ages_months = np.concatenate([
        rng.uniform(0, 3, n1),
        rng.uniform(3, 12, n2),
        rng.uniform(12, 24, n3),
        rng.uniform(24, 36, n4),
    ])
    rng.shuffle(ages_months)

    frame = frame.copy()
    frame["age_months"] = ages_months[:n]
    frame["age_years"] = frame["age_months"] / 12.0
    return frame


def fill_missing_values(frame: pd.DataFrame, target_column: str) -> pd.DataFrame:
    cleaned = frame.copy()
    cleaned = cleaned.dropna(subset=[target_column])

    numeric_columns = cleaned.select_dtypes(include=["number"]).columns.tolist()
    categorical_columns = cleaned.select_dtypes(exclude=["number"]).columns.tolist()

    for column in numeric_columns:
        if column == target_column:
            continue
        cleaned[column] = cleaned[column].fillna(cleaned[column].median())

    for column in categorical_columns:
        mode = cleaned[column].mode(dropna=True)
        if not mode.empty:
            cleaned[column] = cleaned[column].fillna(mode.iloc[0])

    return cleaned


def normalize_numeric_features(frame: pd.DataFrame, target_column: str) -> pd.DataFrame:
    cleaned = frame.copy()
    numeric_columns = cleaned.select_dtypes(include=["number"]).columns.tolist()
    excluded = {target_column}.union(ID_CANDIDATES)
    feature_columns = [column for column in numeric_columns if column not in excluded]

    if feature_columns:
        scaler = MinMaxScaler()
        cleaned[feature_columns] = scaler.fit_transform(cleaned[feature_columns])

    return cleaned


def apply_dataset_specific_cleaning(frame: pd.DataFrame, file_name: str, age_group: str | None) -> tuple[pd.DataFrame, str, dict[str, Any]]:
    cleaned = frame.copy()
    cleaned.columns = [normalize_name(column) for column in cleaned.columns]
    cleaned = cleaned.dropna(how="all").drop_duplicates().reset_index(drop=True)

    unnamed_columns = [column for column in cleaned.columns if column.startswith("unnamed")]
    if unnamed_columns:
        cleaned = cleaned.drop(columns=unnamed_columns)

    dataset_kind = infer_dataset_kind(file_name, cleaned.columns.tolist())
    target_column = find_target_column(cleaned.columns.tolist(), dataset_kind)
    if not target_column:
        raise ValueError(f"Could not find a target column in '{file_name}'.")

    cleaned = fill_missing_values(cleaned, target_column)

    if dataset_kind == "child":
        cleaned = add_child_age_columns(cleaned)
        if {"age_months", "educ_cat"}.issubset(cleaned.columns):
            cleaned["age_education_interaction"] = cleaned["age_months"] * cleaned["educ_cat"]
        cleaned, outlier_info = remove_outliers_iqr(cleaned, [target_column], multiplier=1.5)
    elif dataset_kind == "adult":
        if {"stress_level", "daily_screen_time"}.issubset(cleaned.columns):
            cleaned["stress_screentime_interaction"] = cleaned["stress_level"] * cleaned["daily_screen_time"]
        cleaned, outlier_info = remove_outliers_iqr(cleaned, ["age", "memory_test_score", target_column], multiplier=1.5)
    elif dataset_kind == "elderly":
        if {"chronic_diseases", "gds_score"}.issubset(cleaned.columns):
            cleaned["cognitive_risk"] = cleaned["chronic_diseases"] + cleaned["gds_score"]
        cleaned, outlier_info = remove_outliers_iqr(cleaned, ["age", target_column, "gds_score"], multiplier=1.5)
    else:
        numeric_candidates = [column for column in cleaned.select_dtypes(include=["number"]).columns if column != target_column]
        cleaned, outlier_info = remove_outliers_iqr(cleaned, numeric_candidates[:3], multiplier=1.5)

    cleaned = normalize_numeric_features(cleaned, target_column)

    if age_group and "age_group" not in cleaned.columns:
        cleaned["age_group"] = age_group

    summary = {
        "dataset_kind": dataset_kind,
        "target_column": target_column,
        "rows": int(len(cleaned)),
        "columns": cleaned.columns.tolist(),
        "outliers_removed": outlier_info,
    }
    return cleaned, target_column, summary


def load_training_frame(original_dir: Path) -> tuple[pd.DataFrame, str, list[dict[str, Any]]]:
    files = scan_tabular_files(original_dir)
    if not files:
        raise FileNotFoundError(
            f"No Excel or CSV files found in '{original_dir}'. Add your original datasets there first."
        )

    cleaned_frames: list[pd.DataFrame] = []
    cleaning_summary: list[dict[str, Any]] = []
    target_column_by_kind: dict[str, str] = {}

    for file_path in files:
        tables = read_file_as_tables(file_path)
        merged = merge_tables(tables)
        age_group = infer_age_group_from_name(str(file_path.relative_to(original_dir)))
        cleaned, target_column, summary = apply_dataset_specific_cleaning(
            merged,
            file_path.name,
            age_group,
        )

        summary["file"] = str(file_path.relative_to(original_dir))
        cleaning_summary.append(summary)

        dataset_kind = summary["dataset_kind"]
        target_column_by_kind[dataset_kind] = target_column
        cleaned["source_file"] = file_path.name
        cleaned["target_column_name"] = target_column

        standardized_target = f"{dataset_kind}_target"
        cleaned[standardized_target] = cleaned[target_column]
        cleaned_frames.append(cleaned)

    training_frame = pd.concat(cleaned_frames, ignore_index=True, sort=False)
    training_frame.columns = [normalize_name(column) for column in training_frame.columns]
    training_frame["iq_target"] = np.nan

    for dataset_kind, target_column in target_column_by_kind.items():
        standardized_target = f"{dataset_kind}_target"
        if standardized_target in training_frame.columns:
            training_frame["iq_target"] = training_frame["iq_target"].combine_first(training_frame[standardized_target])

    training_frame = training_frame.dropna(subset=["iq_target"]).reset_index(drop=True)
    if training_frame.empty:
        raise ValueError("The training datasets were found, but all rows are missing the modeled target.")

    return training_frame, "iq_target", cleaning_summary


def summarize_question_workbooks(question_dir: Path) -> dict[str, Any]:
    files = scan_tabular_files(question_dir)
    summary: list[dict[str, Any]] = []
    mappings: dict[str, dict[str, Any]] = {}

    for file_path in files:
        tables = read_file_as_tables(file_path)
        file_age_group = infer_age_group_from_name(str(file_path.relative_to(question_dir))) or "unknown"
        for sheet_name, frame in tables.items():
            normalized_columns = [normalize_name(col) for col in frame.columns]
            summary.append({
                "file": str(file_path.relative_to(question_dir)),
                "sheet": sheet_name,
                "rows": int(len(frame)),
                "columns": normalized_columns,
                "age_group": file_age_group,
            })

            feature_column = next((col for col in normalized_columns if col in FEATURE_NAME_CANDIDATES), None)
            question_id_column = next((col for col in normalized_columns if col in QUESTION_ID_CANDIDATES), None)

            if feature_column and question_id_column:
                normalized_frame = frame.copy()
                normalized_frame.columns = normalized_columns
                age_group_mappings = mappings.setdefault(file_age_group, {})

                for _, row in normalized_frame.iterrows():
                    question_id = row.get(question_id_column)
                    feature_name = row.get(feature_column)
                    if pd.isna(question_id) or pd.isna(feature_name):
                        continue

                    sheet_key = normalize_name(sheet_name) or "sheet"
                    age_group_mappings[str(question_id)] = {
                        "feature_name": normalize_name(feature_name),
                        "sheet_name": sheet_key,
                    }

    return {"files": summary, "mappings": mappings}


def build_pipeline(frame: pd.DataFrame, target_column: str) -> tuple[Pipeline, list[str]]:
    ignored_columns = {
        target_column,
        "row_index",
    }.union(ID_CANDIDATES)

    feature_columns = [column for column in frame.columns if column not in ignored_columns]
    if not feature_columns:
        raise ValueError("No feature columns were found after removing ID and target columns.")

    X = frame[feature_columns].copy()

    categorical_columns = [
        column for column in feature_columns
        if X[column].dtype == "object" or str(X[column].dtype).startswith("category")
    ]
    numeric_columns = [column for column in feature_columns if column not in categorical_columns]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                Pipeline(steps=[("imputer", SimpleImputer(strategy="median"))]),
                numeric_columns,
            ),
            (
                "categorical",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_columns,
            ),
        ]
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "model",
                RandomForestRegressor(
                    n_estimators=300,
                    max_depth=14,
                    min_samples_split=4,
                    min_samples_leaf=2,
                    random_state=42,
                ),
            ),
        ]
    )

    return pipeline, feature_columns


def train_model(question_dir: Path, original_dir: Path) -> dict[str, Any]:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    training_frame, target_column, cleaning_summary = load_training_frame(original_dir)
    question_summary = summarize_question_workbooks(question_dir)
    pipeline, feature_columns = build_pipeline(training_frame, target_column)

    X = training_frame[feature_columns].copy()
    y = training_frame[target_column].astype(float)

    test_size = 0.2 if len(training_frame) >= 10 else 0.0
    metrics: dict[str, Any]

    if test_size > 0:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )
        pipeline.fit(X_train, y_train)
        predictions = pipeline.predict(X_test)
        metrics = {
            "r2": float(r2_score(y_test, predictions)),
            "mae": float(mean_absolute_error(y_test, predictions)),
            "rmse": float(math.sqrt(mean_squared_error(y_test, predictions))),
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
        }
    else:
        pipeline.fit(X, y)
        metrics = {
            "r2": None,
            "mae": None,
            "rmse": None,
            "train_rows": int(len(X)),
            "test_rows": 0,
        }

    joblib.dump(
        {
            "pipeline": pipeline,
            "feature_columns": feature_columns,
            "target_column": target_column,
        },
        MODEL_PATH,
    )

    metadata = {
        "target_column": target_column,
        "feature_columns": feature_columns,
        "metrics": metrics,
        "training_rows": int(len(training_frame)),
        "question_summary": question_summary["files"],
        "question_mappings": question_summary["mappings"],
        "cleaning_summary": cleaning_summary,
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    return metadata


def load_artifacts() -> tuple[dict[str, Any], dict[str, Any]]:
    if not MODEL_PATH.exists() or not METADATA_PATH.exists():
        raise FileNotFoundError(
            "Model artifacts were not found. Run the train command after adding your Excel files."
        )

    bundle = joblib.load(MODEL_PATH)
    metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    return bundle, metadata


def apply_response_feature_engineering(feature_values: dict[str, Any], age_group: str | None) -> dict[str, Any]:
    values = dict(feature_values)
    if age_group == "child":
        if "age_months" in values and "age_years" not in values:
            values["age_years"] = float(values["age_months"]) / 12.0
        if "age_months" in values and "educ_cat" in values:
            values["age_education_interaction"] = float(values["age_months"]) * float(values["educ_cat"])
    elif age_group == "adult":
        if "stress_level" in values and "daily_screen_time" in values:
            values["stress_screentime_interaction"] = float(values["stress_level"]) * float(values["daily_screen_time"])
    elif age_group == "elderly":
        if "chronic_diseases" in values and "gds_score" in values:
            values["cognitive_risk"] = float(values["chronic_diseases"]) + float(values["gds_score"])
    return values


def build_feature_values_from_responses(
    responses: list[dict[str, Any]],
    age_group: str | None,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    values: dict[str, Any] = {}
    if age_group:
        values["age_group"] = age_group

    mappings = metadata.get("question_mappings", {}).get(age_group or "", {})
    total_answers = len(responses)
    total_score = sum(float(item.get("answer_value", 0) or 0) for item in responses)
    total_time = sum(float(item.get("response_time_ms", 0) or 0) for item in responses)
    values["total_answers"] = total_answers
    values["total_score"] = total_score
    values["average_score"] = total_score / total_answers if total_answers else 0
    values["average_response_time_ms"] = total_time / total_answers if total_answers else 0

    for response in responses:
        question_id = str(response.get("question_id"))
        answer_value = float(response.get("answer_value", 0) or 0)
        response_time = float(response.get("response_time_ms", 0) or 0)
        selected_option = response.get("selected_option")

        mapping = mappings.get(question_id)
        if mapping:
            feature_name = mapping["feature_name"]
            sheet_name = mapping["sheet_name"]
            values[feature_name] = answer_value
            values[f"{sheet_name}__score_total"] = values.get(f"{sheet_name}__score_total", 0) + answer_value
            values[f"{sheet_name}__question_count"] = values.get(f"{sheet_name}__question_count", 0) + 1
            values[f"{sheet_name}__response_time_total"] = values.get(f"{sheet_name}__response_time_total", 0) + response_time

        if selected_option is not None:
            values[f"question_{question_id}__selected_option"] = str(selected_option)

    for key in list(values.keys()):
        if key.endswith("__response_time_total"):
            prefix = key[: -len("__response_time_total")]
            count = values.get(f"{prefix}__question_count", 0) or 0
            values[f"{prefix}__avg_response_time"] = values[key] / count if count else 0

    return apply_response_feature_engineering(values, age_group)


def predict_iq(payload: dict[str, Any]) -> dict[str, Any]:
    bundle, metadata = load_artifacts()
    pipeline: Pipeline = bundle["pipeline"]
    expected_features: list[str] = bundle["feature_columns"]

    age_group = payload.get("ageGroup") or payload.get("age_group")
    feature_values = payload.get("featureValues") or payload.get("feature_values") or {}
    responses = payload.get("responses") or []

    if responses and not feature_values:
        feature_values = build_feature_values_from_responses(responses, age_group, metadata)

    feature_values = apply_response_feature_engineering(feature_values, age_group)

    if age_group and "age_group" not in feature_values:
        feature_values["age_group"] = age_group

    input_row = {feature: feature_values.get(feature, np.nan) for feature in expected_features}
    input_frame = pd.DataFrame([input_row])
    predicted_iq = float(pipeline.predict(input_frame)[0])
    percentile = max(1, min(99, int(round((0.5 * (1 + math.erf((predicted_iq - 100) / (15 * math.sqrt(2))))) * 100))))

    used_features = {key: value for key, value in feature_values.items() if key in expected_features}

    return {
        "predicted_iq": round(predicted_iq, 2),
        "percentile": percentile,
        "model_version": "random_forest_v1",
        "used_features": used_features,
        "missing_features": [feature for feature in expected_features if feature not in used_features],
    }


def inspect_data(question_dir: Path, original_dir: Path) -> dict[str, Any]:
    question_summary = summarize_question_workbooks(question_dir)
    original_files = [str(path.relative_to(original_dir)) for path in scan_tabular_files(original_dir)]
    dataset_summaries = []

    for path_item in scan_tabular_files(original_dir):
        tables = read_file_as_tables(path_item)
        merged = merge_tables(tables)
        age_group = infer_age_group_from_name(str(path_item.relative_to(original_dir)))
        cleaned, target_column, summary = apply_dataset_specific_cleaning(merged, path_item.name, age_group)
        summary["file"] = str(path_item.relative_to(original_dir))
        summary["preview_rows"] = cleaned.head(3).to_dict(orient="records")
        summary["target_column"] = target_column
        dataset_summaries.append(summary)

    return {
        "question_files": question_summary["files"],
        "mapped_question_count": sum(len(value) for value in question_summary["mappings"].values()),
        "original_files": original_files,
        "cleaned_dataset_summaries": dataset_summaries,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and run the IQ Random Forest model.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    train_parser = subparsers.add_parser("train")
    train_parser.add_argument("--question-dir", default=str(DEFAULT_QUESTION_DIR))
    train_parser.add_argument("--original-dir", default=str(DEFAULT_ORIGINAL_DIR))

    predict_parser = subparsers.add_parser("predict")
    predict_parser.add_argument("--payload", required=True)

    inspect_parser = subparsers.add_parser("inspect")
    inspect_parser.add_argument("--question-dir", default=str(DEFAULT_QUESTION_DIR))
    inspect_parser.add_argument("--original-dir", default=str(DEFAULT_ORIGINAL_DIR))

    args = parser.parse_args()

    try:
        if args.command == "train":
            result = train_model(Path(args.question_dir), Path(args.original_dir))
        elif args.command == "predict":
            result = predict_iq(json.loads(args.payload))
        else:
            result = inspect_data(Path(args.question_dir), Path(args.original_dir))

        print(json.dumps({"ok": True, "result": result}, indent=2))
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
