from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


MODEL_DIR = Path(__file__).resolve().parent / "models"

app = FastAPI(title="PsychZenith IQ Predictor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictionRequest(BaseModel):
    age_group: str
    features: dict[str, Any]
    mcq_summary: dict[str, Any] | None = None


def load_bundle(age_group: str) -> dict[str, Any]:
    model_path = MODEL_DIR / f"{age_group}_model.joblib"
    if not model_path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Model artifact not found for {age_group}. Run backend/train_models.py first.",
        )
    return joblib.load(model_path)


def to_iq_scale(age_group: str, raw_value: float) -> int:
    if age_group == "child":
        return int(np.clip(round(55 + raw_value * 85), 70, 160))
    if age_group == "adult":
        return int(np.clip(round(55 + raw_value * 85), 70, 160))
    return int(np.clip(round(45 + raw_value * 95), 70, 160))


def percentile_from_iq(iq: int) -> int:
    return int(np.clip(round(((iq - 70) / 60) * 99), 1, 99))


def build_subscores(age_group: str, features: dict[str, Any]) -> dict[str, int]:
    if age_group == "child":
        age = float(features["age_years"])
        education = float(features["educ_cat"])
        momage = float(features["momage"])
        return {
            "verbal": int(np.clip(round(55 + education * 15), 0, 100)),
            "logical": int(np.clip(round(55 + age * 20), 0, 100)),
            "spatial": int(np.clip(round(50 + (age + education) * 12), 0, 100)),
            "processing": int(np.clip(round(50 + momage * 1.2), 0, 100)),
        }

    if age_group == "adult":
        memory = float(features["Memory_Test_Score"])
        reaction = float(features["Reaction_Time"])
        stress = float(features["Stress_Level"])
        exercise = features["Exercise_Frequency"]
        exercise_score = {"Low": 45, "Medium": 65, "High": 82}.get(str(exercise), 60)
        return {
            "verbal": int(np.clip(round(memory), 0, 100)),
            "logical": int(np.clip(round(100 - stress * 7), 0, 100)),
            "spatial": int(np.clip(round(exercise_score), 0, 100)),
            "processing": int(np.clip(round(100 - ((reaction - 100) / 9)), 0, 100)),
        }

    gds = float(features["GDS_Score"])
    sleep = float(features["Sleep_Quality_Score"])
    activity = float(features["Physical_Activity_Score"])
    glucose = float(features["Glucose_Level"])
    return {
        "verbal": int(np.clip(round(100 - gds * 6), 0, 100)),
        "logical": int(np.clip(round(100 - ((glucose - 50) / 2.5)), 0, 100)),
        "spatial": int(np.clip(round(activity * 10), 0, 100)),
        "processing": int(np.clip(round(sleep * 10), 0, 100)),
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict")
def predict(payload: PredictionRequest) -> dict[str, Any]:
    bundle = load_bundle(payload.age_group)
    feature_columns = bundle["feature_columns"]

    missing = [column for column in feature_columns if column not in payload.features]
    if missing:
      raise HTTPException(status_code=400, detail=f"Missing features: {', '.join(missing)}")

    frame = pd.DataFrame([{column: payload.features[column] for column in feature_columns}])
    raw_prediction = float(bundle["pipeline"].predict(frame)[0])
    dataset_iq = to_iq_scale(payload.age_group, raw_prediction)
    sub_scores = build_subscores(payload.age_group, payload.features)

    mcq_accuracy = None
    if payload.mcq_summary:
        mcq_accuracy = float(payload.mcq_summary.get("accuracy", 0))
        mcq_iq = int(np.clip(round(70 + mcq_accuracy * 90), 70, 160))
        predicted_iq = int(round(dataset_iq * 0.75 + mcq_iq * 0.25))

        category_scores = payload.mcq_summary.get("category_scores", {})
        for key, target_key in {
            "verbal": "verbal",
            "logical": "logical",
            "spatial": "spatial",
            "processing": "processing",
        }.items():
            if key in category_scores:
                sub_scores[target_key] = int(
                    np.clip(round(sub_scores[target_key] * 0.6 + float(category_scores[key]) * 0.4), 0, 100)
                )
    else:
        predicted_iq = dataset_iq

    percentile = percentile_from_iq(predicted_iq)

    return {
        "predicted_iq": predicted_iq,
        "percentile": percentile,
        "confidence_score": 87,
        "sub_scores": sub_scores,
        "model_version": "dataset-path-v1",
        "dataset_iq": dataset_iq,
        "mcq_accuracy": mcq_accuracy,
    }
