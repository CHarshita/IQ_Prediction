import type { AgeGroup } from "@/types";

export type FieldType = "number" | "select";

export interface AssessmentFieldOption {
  label: string;
  value: string;
}

export interface AssessmentField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helper?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: AssessmentFieldOption[];
}

export const assessmentFieldsByGroup: Record<AgeGroup, AssessmentField[]> = {
  child: [
    {
      name: "educ_cat",
      label: "Education Category",
      type: "select",
      options: [
        { label: "Low", value: "0" },
        { label: "Medium", value: "1" },
        { label: "High", value: "2" },
        { label: "Very High", value: "3" },
      ],
    },
    {
      name: "momage",
      label: "Mother's Age",
      type: "number",
      min: 18,
      max: 60,
      step: 1,
      placeholder: "e.g. 32",
    },
  ],
  adult: [
    {
      name: "gender",
      label: "Gender",
      type: "select",
      options: [
        { label: "Female", value: "Female" },
        { label: "Male", value: "Male" },
      ],
    },
    {
      name: "sleep_duration",
      label: "Sleep Duration (hours)",
      type: "number",
      min: 0,
      max: 12,
      step: 0.5,
      placeholder: "e.g. 7.5",
    },
    {
      name: "stress_level",
      label: "Stress Level",
      type: "number",
      min: 1,
      max: 10,
      step: 1,
      placeholder: "1 to 10",
    },
    {
      name: "diet_type",
      label: "Diet Type",
      type: "select",
      options: [
        { label: "Vegetarian", value: "Vegetarian" },
        { label: "Non-Vegetarian", value: "Non-Vegetarian" },
      ],
    },
    {
      name: "daily_screen_time",
      label: "Daily Screen Time (hours)",
      type: "number",
      min: 0,
      max: 16,
      step: 0.5,
      placeholder: "e.g. 5",
    },
    {
      name: "exercise_frequency",
      label: "Exercise Frequency",
      type: "select",
      options: [
        { label: "Low", value: "Low" },
        { label: "Medium", value: "Medium" },
        { label: "High", value: "High" },
      ],
    },
    {
      name: "caffeine_intake",
      label: "Caffeine Intake (cups/day)",
      type: "number",
      min: 0,
      max: 10,
      step: 1,
      placeholder: "e.g. 2",
    },
    {
      name: "reaction_time",
      label: "Reaction Time (ms)",
      type: "number",
      min: 100,
      max: 1000,
      step: 1,
      placeholder: "e.g. 280",
    },
    {
      name: "memory_test_score",
      label: "Memory Test Score",
      type: "number",
      min: 0,
      max: 100,
      step: 1,
      placeholder: "e.g. 72",
    },
  ],
  elderly: [
    {
      name: "gender",
      label: "Gender",
      type: "select",
      options: [
        { label: "Female", value: "Female" },
        { label: "Male", value: "Male" },
      ],
    },
    {
      name: "education_level",
      label: "Education Level",
      type: "select",
      options: [
        { label: "Primary", value: "Primary" },
        { label: "Secondary", value: "Secondary" },
        { label: "Graduate", value: "Graduate" },
        { label: "Postgraduate", value: "Postgraduate" },
      ],
    },
    {
      name: "region",
      label: "Region",
      type: "select",
      options: [
        { label: "Urban", value: "Urban" },
        { label: "Rural", value: "Rural" },
      ],
    },
    {
      name: "marital_status",
      label: "Marital Status",
      type: "select",
      options: [
        { label: "Single", value: "Single" },
        { label: "Married", value: "Married" },
        { label: "Widowed", value: "Widowed" },
      ],
    },
    {
      name: "chronic_diseases",
      label: "Chronic Diseases Count",
      type: "number",
      min: 0,
      max: 10,
      step: 1,
      placeholder: "e.g. 2",
    },
    {
      name: "glucose_level",
      label: "Glucose Level",
      type: "number",
      min: 50,
      max: 250,
      step: 1,
      placeholder: "e.g. 110",
    },
    {
      name: "bmi",
      label: "BMI",
      type: "number",
      min: 10,
      max: 50,
      step: 0.1,
      placeholder: "e.g. 24.5",
    },
    {
      name: "gds_score",
      label: "GDS Score",
      type: "number",
      min: 0,
      max: 15,
      step: 1,
      placeholder: "e.g. 4",
    },
    {
      name: "sleep_quality_score",
      label: "Sleep Quality Score",
      type: "number",
      min: 0,
      max: 10,
      step: 1,
      placeholder: "e.g. 7",
    },
    {
      name: "physical_activity_score",
      label: "Physical Activity Score",
      type: "number",
      min: 0,
      max: 10,
      step: 1,
      placeholder: "e.g. 6",
    },
    {
      name: "smoking_status",
      label: "Smoking Status",
      type: "select",
      options: [
        { label: "No", value: "No" },
        { label: "Yes", value: "Yes" },
      ],
    },
    {
      name: "alcohol_use",
      label: "Alcohol Use",
      type: "select",
      options: [
        { label: "No", value: "No" },
        { label: "Yes", value: "Yes" },
      ],
    },
  ],
};

export const predictionApiUrl =
  import.meta.env.VITE_PREDICTION_API_URL ?? "http://127.0.0.1:8000";
