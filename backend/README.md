# IQ Prediction Backend

## Dataset Sources

This backend is designed for the cleaned datasets produced from `colabcheck_eda.py`.

Default expected files:

- `e:\Foundation in DS project\child_cleaned_data.csv`
- `e:\Foundation in DS project\adult_cleaned_data.csv`
- `e:\Foundation in DS project\old_cleaned_data.csv`

## Train Models

```bash
python backend/train_models.py
```

This creates `.joblib` artifacts in `backend/models/`.

## Run API

```bash
uvicorn backend.app:app --reload
```

The frontend calls:

- `POST /predict`

Set `VITE_PREDICTION_API_URL=http://127.0.0.1:8000` in your frontend `.env` if needed.
