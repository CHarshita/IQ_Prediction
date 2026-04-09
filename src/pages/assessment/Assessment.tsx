import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  assessmentFieldsByGroup,
  predictionApiUrl,
} from "@/lib/assessmentProfiles";
import { useAssessmentStore } from "@/store/assessmentStore";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Question } from "@/types";

const categoryColors: Record<string, string> = {
  verbal: "bg-blue-500/20 text-blue-400",
  logical: "bg-green-500/20 text-green-400",
  spatial: "bg-purple-500/20 text-purple-400",
  processing: "bg-amber-500/20 text-amber-400",
};

const UNKNOWN_VALUE = "NA";

interface PredictionPayload {
  predicted_iq: number;
  percentile: number;
  confidence_score: number;
  sub_scores: Record<string, number>;
  model_version: string;
  dataset_iq?: number;
  mcq_accuracy?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseNumber(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSelect(value: string | number | undefined, fallback: string) {
  if (value === undefined || value === null || value === "" || value === UNKNOWN_VALUE) {
    return fallback;
  }
  return String(value);
}

function buildLocalPrediction(
  ageGroup: "child" | "adult" | "elderly",
  features: Record<string, string | number>,
  categoryScores: Record<string, number>,
  accuracy: number,
  averageResponseTime: number,
): PredictionPayload {
  const baseByGroup = {
    child: 92,
    adult: 95,
    elderly: 90,
  } satisfies Record<"child" | "adult" | "elderly", number>;

  const featureValues = Object.values(features)
    .map((value) => (typeof value === "number" ? value : Number.NaN))
    .filter((value) => Number.isFinite(value));

  const featureAverage =
    featureValues.length > 0
      ? featureValues.reduce((sum, value) => sum + value, 0) / featureValues.length
      : 0;

  const speedBonus = clamp((3000 - averageResponseTime) / 80, -8, 8);
  const datasetSignal = clamp(featureAverage / 12, -10, 10);
  const mcqSignal = clamp((accuracy - 0.5) * 70, -25, 35);
  const predictedIq = Math.round(
    clamp(baseByGroup[ageGroup] + datasetSignal + mcqSignal + speedBonus, 70, 160),
  );

  const percentile = Math.round(clamp((predictedIq - 55) / 105, 0, 1) * 100);
  const confidenceScore = clamp(
    Math.round(72 + accuracy * 18 + (featureValues.length > 0 ? 6 : 0)),
    65,
    96,
  );

  const fallbackCategories = ["verbal", "logical", "spatial", "processing"] as const;
  const sub_scores = Object.fromEntries(
    fallbackCategories.map((category) => {
      const rawScore = categoryScores[category] ?? Math.round(accuracy * 100);
      const blended = Math.round(clamp(rawScore * 0.7 + accuracy * 30, 40, 100));
      return [category, blended];
    }),
  ) as Record<string, number>;

  return {
    predicted_iq: predictedIq,
    percentile,
    confidence_score: confidenceScore,
    sub_scores,
    model_version: "frontend-fallback-v1",
    dataset_iq: Math.round(clamp(baseByGroup[ageGroup] + datasetSignal, 70, 160)),
    mcq_accuracy: accuracy,
  };
}

function normalizeChildFeatures(age: number, values: Record<string, string>) {
  const ageYears = parseNumber(age, 10);
  const education = parseNumber(values.educ_cat, 1);
  const momage = parseNumber(values.momage, 30);

  return {
    age_years: ageYears,
    educ_cat: education,
    momage,
    age_education_interaction: ageYears * education,
  };
}

function normalizeAdultFeatures(age: number, values: Record<string, string>) {
  const stressLevel = parseNumber(values.stress_level, 5);
  const screenTime = parseNumber(values.daily_screen_time, 5);

  return {
    Age: age,
    Gender: parseSelect(values.gender, "Female"),
    Sleep_Duration: parseNumber(values.sleep_duration, 7),
    Stress_Level: stressLevel,
    Diet_Type: parseSelect(values.diet_type, "Non-Vegetarian"),
    Daily_Screen_Time: screenTime,
    Exercise_Frequency: parseSelect(values.exercise_frequency, "Medium"),
    Caffeine_Intake: parseNumber(values.caffeine_intake, 1),
    Reaction_Time: parseNumber(values.reaction_time, 300),
    Memory_Test_Score: parseNumber(values.memory_test_score, 50),
    stress_screentime_interaction: stressLevel * screenTime,
  };
}

function normalizeElderlyFeatures(age: number, values: Record<string, string>) {
  const chronicDiseases = parseNumber(values.chronic_diseases, 1);
  const gdsScore = parseNumber(values.gds_score, 4);

  return {
    Age: age,
    Gender: parseSelect(values.gender, "Female"),
    Education_Level: parseSelect(values.education_level, "Secondary"),
    Region: parseSelect(values.region, "Urban"),
    Marital_Status: parseSelect(values.marital_status, "Married"),
    Chronic_Diseases: chronicDiseases,
    Glucose_Level: parseNumber(values.glucose_level, 110),
    BMI: parseNumber(values.bmi, 24),
    GDS_Score: gdsScore,
    Sleep_Quality_Score: parseNumber(values.sleep_quality_score, 6),
    Physical_Activity_Score: parseNumber(values.physical_activity_score, 5),
    Smoking_Status: parseSelect(values.smoking_status, "No"),
    Alcohol_Use: parseSelect(values.alcohol_use, "No"),
    cognitive_risk: chronicDiseases + gdsScore,
  };
}

export default function Assessment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    assessmentId,
    ageGroup,
    formData,
    startTime,
    currentQuestion,
    responses,
    setFormData,
    setCurrentQuestion,
    addResponse,
    nextQuestion,
    previousQuestion,
    reset,
  } = useAssessmentStore();
  const [values, setValues] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionLoading, setQuestionLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());
  const [direction, setDirection] = useState(1);

  const fields = useMemo(
    () => (ageGroup ? assessmentFieldsByGroup[ageGroup] : []),
    [ageGroup],
  );
  const hasProfileData = Object.keys(formData.fields || {}).length > 0;

  if (!assessmentId || !ageGroup || !formData || !user) {
    navigate("/assessment/age-select");
    return null;
  }

  useEffect(() => {
    if (Object.keys(formData.fields || {}).length > 0) {
      setValues((current) =>
        Object.keys(current).length > 0
          ? current
          : Object.fromEntries(
              Object.entries(formData.fields).map(([key, value]) => [
                key,
                String(value),
              ]),
            ),
      );
    }
  }, [formData.fields]);

  useEffect(() => {
    if (!hasProfileData) {
      return;
    }

    supabase
      .from("questions")
      .select("*")
      .eq("age_group", ageGroup)
      .order("category")
      .order("difficulty")
      .limit(15)
      .then(({ data, error }) => {
        if (error) {
          toast.error("Failed to load questions");
          return;
        }
        setQuestions((data as unknown as Question[]) || []);
        setQuestionLoading(false);
      });
  }, [ageGroup, hasProfileData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (startTime) {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    if (!questions.length) {
      return;
    }
    const existing = responses.find(
      (response) => response.question_id === questions[currentQuestion]?.id,
    );
    setSelectedOption(existing?.selected_option || null);
  }, [currentQuestion, questions, responses]);

  const handleChange = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const buildFeatures = () => {
    if (ageGroup === "child") {
      return normalizeChildFeatures(formData.age, values);
    }
    if (ageGroup === "adult") {
      return normalizeAdultFeatures(formData.age, values);
    }
    return normalizeElderlyFeatures(formData.age, values);
  };

  const handleSubmit = async () => {
    setFormData({
      ...formData,
      fields: values,
    });
    setCurrentQuestion(0);
    setQuestionStartedAt(Date.now());
    setQuestionLoading(true);
  };

  const currentPrompt = questions[currentQuestion];

  const handleSelectOption = (option: string) => {
    if (!currentPrompt) return;

    setSelectedOption(option);
    addResponse({
      question_id: currentPrompt.id,
      answer_value: option === currentPrompt.correct_option ? 1 : 0,
      selected_option: option,
      response_time_ms: Date.now() - questionStartedAt,
    });
  };

  const handleNextQuestion = () => {
    setDirection(1);
    setQuestionStartedAt(Date.now());
    nextQuestion();
  };

  const handlePreviousQuestion = () => {
    setDirection(-1);
    setQuestionStartedAt(Date.now());
    previousQuestion();
  };

  const handleFinishAssessment = async () => {
    if (!currentPrompt) {
      return;
    }

    setSubmitting(true);

    try {
      const features = buildFeatures();
      const categoryScores = questions.reduce<Record<string, number>>(
        (accumulator, question) => {
          const categoryQuestions = questions.filter(
            (item) => item.category === question.category,
          );
          const categoryResponses = responses.filter((response) =>
            categoryQuestions.some((item) => item.id === response.question_id),
          );

          const correct = categoryResponses.filter(
            (response) => response.answer_value === 1,
          ).length;
          const total = Math.max(categoryQuestions.length, 1);
          accumulator[question.category] = Math.round((correct / total) * 100);
          return accumulator;
        },
        {},
      );

      const totalCorrect = responses.filter((response) => response.answer_value === 1).length;
      const averageResponseTime =
        responses.length > 0
          ? responses.reduce((sum, response) => sum + response.response_time_ms, 0) /
            responses.length
          : 0;

      const accuracy = questions.length > 0 ? totalCorrect / questions.length : 0;
      let prediction: PredictionPayload;

      try {
        const response = await fetch(`${predictionApiUrl}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            age_group: ageGroup,
            features,
            mcq_summary: {
              total_questions: questions.length,
              correct_answers: totalCorrect,
              accuracy,
              avg_response_time_ms: averageResponseTime,
              category_scores: categoryScores,
            },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.detail || "Prediction API failed");
        }

        prediction = (await response.json()) as PredictionPayload;
      } catch (predictionError) {
        console.warn("Prediction API unavailable, using local fallback.", predictionError);
        prediction = buildLocalPrediction(
          ageGroup,
          features,
          categoryScores,
          accuracy,
          averageResponseTime,
        );
        toast.info("Assessment completed with local prediction.");
      }

      const { error: predictionError } = await supabase.from("predictions").insert({
        assessment_id: assessmentId,
        user_id: user.id,
        age_group: ageGroup,
        predicted_iq: prediction.predicted_iq,
        percentile: prediction.percentile,
        verbal_score: prediction.sub_scores?.verbal ?? null,
        logical_score: prediction.sub_scores?.logical ?? null,
        spatial_score: prediction.sub_scores?.spatial ?? null,
        processing_speed_score: prediction.sub_scores?.processing ?? null,
        confidence_score: prediction.confidence_score ?? 87,
        model_version: prediction.model_version ?? "dataset-path-v1",
      });

      if (predictionError) {
        throw predictionError;
      }

      const startedAt = startTime ? startTime : Date.now();
      await supabase
        .from("assessments")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          time_taken_seconds: Math.max(
            1,
            Math.round((Date.now() - startedAt) / 1000),
          ),
        })
        .eq("id", assessmentId);

      toast.success("Assessment completed successfully.");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate prediction.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, "0")}`;
  };

  if (hasProfileData && questionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Brain className="h-16 w-16 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading assessment questions...</p>
        </div>
      </div>
    );
  }

  if (hasProfileData && currentPrompt) {
    const total = questions.length;
    const options = [
      { key: "A", text: currentPrompt.option_a },
      { key: "B", text: currentPrompt.option_b },
      { key: "C", text: currentPrompt.option_c },
      { key: "D", text: currentPrompt.option_d },
    ];

    return (
      <div className="min-h-screen bg-background flex">
        <div className="hidden w-20 flex-col items-center border-r border-border/50 bg-card/30 py-8 lg:flex">
          <Brain className="mb-6 h-8 w-8 text-primary" />
          <div className="flex flex-1 flex-col gap-1 overflow-auto">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className={`h-3 w-3 rounded-full transition-colors ${
                  index === currentQuestion
                    ? "bg-primary glow-effect"
                    : responses.find((response) => response.question_id === question.id)
                      ? "bg-primary/50"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          <div className="mb-8 flex w-full max-w-2xl items-center justify-between">
            <span className={`rounded-md px-3 py-1 text-sm ${categoryColors[currentPrompt.category] || ""}`}>
              {currentPrompt.category.charAt(0).toUpperCase() + currentPrompt.category.slice(1)}
            </span>
            <span className="text-sm text-muted-foreground">
              Question {currentQuestion + 1} of {total}
            </span>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-mono">{formatTime(elapsed)}</span>
            </div>
          </div>

          <div className="mb-8 h-2 w-full max-w-2xl rounded-full bg-muted">
            <div
              className="h-full rounded-full gradient-bg transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / total) * 100}%` }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: direction * 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -direction * 50 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl space-y-8"
            >
              <h2 className="text-2xl font-semibold leading-relaxed md:text-3xl">
                {currentPrompt.question_text}
              </h2>

              <div className="grid gap-3">
                {options.map((option) => (
                  <motion.button
                    key={option.key}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleSelectOption(option.key)}
                    className={`glass-card flex items-center gap-4 border-2 p-4 text-left transition-all ${
                      selectedOption === option.key
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:border-primary/30"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg font-bold text-sm ${
                        selectedOption === option.key
                          ? "gradient-bg text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {option.key}
                    </span>
                    <span className="text-lg">{option.text}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex w-full max-w-2xl items-center justify-between">
            <Button variant="outline" onClick={handlePreviousQuestion} disabled={currentQuestion === 0}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            {currentQuestion === total - 1 ? (
              <Button
                className="gradient-bg glow-effect"
                onClick={handleFinishAssessment}
                disabled={submitting || responses.length < total}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Finish Assessment
              </Button>
            ) : (
              <Button onClick={handleNextQuestion} disabled={!selectedOption}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="space-y-4 text-center">
            <Brain className="mx-auto h-16 w-16 text-primary" />
            <h1 className="text-4xl font-extrabold">
              Take <span className="gradient-text">assessment</span>
            </h1>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Fill in the profile details first.
            </p>
          </div>

          <div className="glass-card space-y-6 p-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <p className="text-sm text-muted-foreground">Age group</p>
                <p className="mt-2 text-2xl font-bold capitalize">{ageGroup}</p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <p className="text-sm text-muted-foreground">Age</p>
                <p className="mt-2 text-2xl font-bold">{formData.age}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  {field.type === "select" ? (
                    <Select
                      value={values[field.name] ?? ""}
                      onValueChange={(value) => handleChange(field.name, value)}
                    >
                      <SelectTrigger id={field.name}>
                        <SelectValue placeholder={`Select ${field.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                        <SelectItem value={UNKNOWN_VALUE}>NA / Not sure</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={field.name}
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      placeholder={field.placeholder}
                      value={values[field.name] ?? ""}
                      onChange={(event) =>
                        handleChange(field.name, event.target.value)
                      }
                    />
                  )}
                  {field.helper ? (
                    <p className="text-xs text-muted-foreground">{field.helper}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Leave blank or choose NA if you do not know this detail.
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                  navigate("/assessment/age-select");
                }}
              >
                Back
              </Button>
              <Button
                className="gradient-bg"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Take Test
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
