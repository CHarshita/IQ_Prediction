import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Brain,
  Clock3,
  Eye,
  Plus,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import Navbar from "@/components/Common/Navbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Assessment, Prediction } from "@/types";

const CHART_COLORS = {
  iq: "hsl(184 100% 58%)",
  percentile: "hsl(27 96% 61%)",
  verbal: "hsl(184 100% 58%)",
  logical: "hsl(27 96% 61%)",
  spatial: "hsl(296 75% 66%)",
  processing: "hsl(142 69% 58%)",
};

const DOMAIN_COLORS = [
  CHART_COLORS.verbal,
  CHART_COLORS.logical,
  CHART_COLORS.spatial,
  CHART_COLORS.processing,
];

const DOMAIN_BAR_COLOR = "hsl(208 72% 36%)";
const AGE_GROUP_BAR_COLOR = "hsl(210 70% 38%)";

const IQ_BUCKETS = [
  { label: "70-79", min: 70, max: 79 },
  { label: "80-89", min: 80, max: 89 },
  { label: "90-99", min: 90, max: 99 },
  { label: "100-109", min: 100, max: 109 },
  { label: "110-119", min: 110, max: 119 },
  { label: "120-129", min: 120, max: 129 },
  { label: "130+", min: 130, max: Number.POSITIVE_INFINITY },
];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "14px",
  color: "hsl(var(--card-foreground))",
};

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString();
}

function formatMinutes(seconds: number | null) {
  if (!seconds) return "N/A";
  return `${(seconds / 60).toFixed(1)} min`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <motion.div whileHover={{ y: -4 }} className="glass-card space-y-3 p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="text-4xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </motion.div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-6">
      <div className="mb-5 space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default function DashboardReal() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [predRes, assRes] = await Promise.all([
        supabase
          .from("predictions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("assessments")
          .select("*")
          .eq("user_id", user.id)
          .order("started_at", { ascending: true }),
      ]);

      setPredictions((predRes.data as Prediction[]) || []);
      setAssessments((assRes.data as Assessment[]) || []);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const assessmentMap = useMemo(
    () => new Map(assessments.map((assessment) => [assessment.id, assessment])),
    [assessments],
  );

  const latestPrediction = predictions[predictions.length - 1];
  const completedAssessments = assessments.filter(
    (assessment) => assessment.status === "completed",
  );
  const averageIQ =
    predictions.length > 0
      ? Math.round(
          predictions.reduce((sum, prediction) => sum + prediction.predicted_iq, 0) /
            predictions.length,
        )
      : null;
  const bestIQ =
    predictions.length > 0
      ? Math.max(...predictions.map((prediction) => prediction.predicted_iq))
      : null;
  const averageTimeSeconds =
    completedAssessments.length > 0
      ? Math.round(
          completedAssessments.reduce(
            (sum, assessment) => sum + (assessment.time_taken_seconds ?? 0),
            0,
          ) / completedAssessments.length,
        )
      : null;

  const timelineData = predictions.map((prediction, index) => ({
    attempt: index + 1,
    label: `Attempt ${index + 1}`,
    date: formatDate(prediction.created_at),
    iq: prediction.predicted_iq,
    percentile: prediction.percentile ?? 0,
  }));

  const latestDomainData = latestPrediction
    ? [
        { name: "Verbal", value: latestPrediction.verbal_score ?? 0 },
        { name: "Logical", value: latestPrediction.logical_score ?? 0 },
        { name: "Spatial", value: latestPrediction.spatial_score ?? 0 },
        { name: "Processing", value: latestPrediction.processing_speed_score ?? 0 },
      ]
    : [];

  const domainPieData = (() => {
    const total = latestDomainData.reduce((sum, item) => sum + item.value, 0);
    return latestDomainData.map((item) => ({
      ...item,
      share: total > 0 ? Number(((item.value / total) * 100).toFixed(1)) : 0,
    }));
  })();

  const histogramData = IQ_BUCKETS.map((bucket) => ({
    range: bucket.label,
    attempts: predictions.filter((prediction) => {
      const value = prediction.predicted_iq;
      return value >= bucket.min && value <= bucket.max;
    }).length,
  }));

  const scatterData = predictions
    .map((prediction, index) => {
      const assessment = assessmentMap.get(prediction.assessment_id);
      return {
        attempt: index + 1,
        iq: prediction.predicted_iq,
        percentile: prediction.percentile ?? 0,
        minutes: assessment?.time_taken_seconds
          ? Number((assessment.time_taken_seconds / 60).toFixed(1))
          : null,
        date: formatDate(prediction.created_at),
      };
    })
    .filter((item) => item.minutes !== null);

  const ageGroupBars = ["child", "adult", "elderly"].map((group) => ({
    ageGroup: group,
    count: assessments.filter((assessment) => assessment.age_group === group).length,
  }));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Brain className="h-12 w-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pb-16 pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">
                Dashboard for{" "}
                <span className="gradient-text">{profile?.full_name || "your progress"}</span>
              </h1>
              <p className="max-w-2xl text-muted-foreground">
                Every chart below uses your saved assessment results.
              </p>
            </div>
            <Button
              className="gradient-bg glow-effect"
              onClick={() => navigate("/assessment/age-select")}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Assessment
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Brain}
              label="Latest IQ"
              value={latestPrediction ? String(latestPrediction.predicted_iq) : "N/A"}
              hint="Most recent predicted IQ score"
            />
            <StatCard
              icon={TrendingUp}
              label="Average IQ"
              value={averageIQ ? String(averageIQ) : "N/A"}
              hint="Average across all saved predictions"
            />
            <StatCard
              icon={Trophy}
              label="Best IQ"
              value={bestIQ ? String(bestIQ) : "N/A"}
              hint="Highest IQ you have reached so far"
            />
            <StatCard
              icon={Clock3}
              label="Average Time"
              value={formatMinutes(averageTimeSeconds)}
              hint="Average time taken to finish completed assessments"
            />
          </div>

          <div className="space-y-6">
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="w-full justify-start overflow-x-auto bg-card/70">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="distribution">Distribution</TabsTrigger>
                <TabsTrigger value="timing">Timing</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-6">
                  <ChartCard
                    title="IQ Progress Over Time"
                    description="Line chart showing how your IQ and percentile changed from one attempt to the next."
                  >
                    {timelineData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={timelineData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <YAxis yAxisId="left" domain={[70, 160]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend />
                          <Line yAxisId="left" type="monotone" dataKey="iq" name="IQ" stroke={CHART_COLORS.iq} strokeWidth={3} dot={{ r: 4 }} />
                          <Line yAxisId="right" type="monotone" dataKey="percentile" name="Percentile" stroke={CHART_COLORS.percentile} strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart message="Take your first assessment to see your progress line." />
                    )}
                  </ChartCard>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <ChartCard
                      title="Cognitive Radar"
                      description="Radar chart showing the shape of your latest verbal, logical, spatial, and processing scores."
                    >
                      {latestDomainData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <RadarChart data={latestDomainData}>
                            <PolarGrid stroke="hsl(var(--border))" />
                            <PolarAngleAxis
                              dataKey="name"
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                            />
                            <PolarRadiusAxis
                              domain={[0, 100]}
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                            />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Radar
                              name="Latest score"
                              dataKey="value"
                              stroke={DOMAIN_BAR_COLOR}
                              fill={DOMAIN_BAR_COLOR}
                              fillOpacity={0.28}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChart message="Your radar chart appears after the first completed prediction." />
                      )}
                    </ChartCard>

                    <ChartCard
                      title="Latest Cognitive Domain Scores"
                      description="Bar graph of the four sub-scores from your latest prediction."
                    >
                      {latestDomainData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={latestDomainData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="name"
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                            />
                            <YAxis
                              domain={[0, 100]}
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                            />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="value" radius={[0, 0, 0, 0]} fill={DOMAIN_BAR_COLOR} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChart message="Your domain score bar graph appears after the first completed prediction." />
                      )}
                    </ChartCard>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="distribution" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <ChartCard
                    title="Score Mix"
                    description="Pie chart showing how your latest domain scores are distributed across the four cognitive areas."
                  >
                    {domainPieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={domainPieData}
                            dataKey="share"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            label={({ name, share }) => `${name} ${share}%`}
                          >
                            {domainPieData.map((entry, index) => (
                              <Cell key={entry.name} fill={DOMAIN_COLORS[index]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, "Share of latest score"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart message="Complete an assessment to see how your latest score splits across domains." />
                    )}
                  </ChartCard>

                  <ChartCard
                    title="IQ Range Histogram"
                    description="Histogram showing how many of your attempts fall into each IQ range."
                  >
                    {predictions.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={histogramData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="range" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, "Attempts"]} />
                          <Bar dataKey="attempts" name="Attempts" fill={CHART_COLORS.logical} radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart message="Your histogram will appear once you have at least one prediction." />
                    )}
                  </ChartCard>
                </div>

                <ChartCard
                  title="Assessment Mix by Age Group"
                  description="Bar graph counting how many of your saved assessments belong to each age group."
                >
                  {assessments.length > 0 ? (
                    <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-sky-500/10 via-background to-emerald-500/10 px-4 py-6 sm:px-6">
                      <div className="pointer-events-none absolute inset-y-6 left-10 w-40 rounded-full bg-sky-500/10 blur-3xl" />
                      <div className="pointer-events-none absolute inset-y-6 right-10 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
                      <div className="mx-auto w-full max-w-4xl">
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={ageGroupBars} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="ageGroup" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                            <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, "Assessments"]} />
                            <Bar
                              dataKey="count"
                              name="Assessments"
                              fill={AGE_GROUP_BAR_COLOR}
                              radius={[8, 8, 0, 0]}
                              barSize={88}
                              maxBarSize={96}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <EmptyChart message="No saved assessments yet." />
                  )}
                </ChartCard>
              </TabsContent>

              <TabsContent value="timing" className="space-y-6">
                <ChartCard
                  title="Time Taken vs IQ"
                  description="Scatter plot comparing how long each completed assessment took against the IQ score it produced. Bigger dots mean higher percentile."
                >
                  {scatterData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          type="number"
                          dataKey="minutes"
                          name="Time (minutes)"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        />
                        <YAxis
                          type="number"
                          dataKey="iq"
                          name="IQ"
                          domain={[70, 160]}
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        />
                        <ZAxis type="number" dataKey="percentile" range={[80, 320]} name="Percentile" />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          contentStyle={tooltipStyle}
                          formatter={(value: number, name: string) => [value, name]}
                          labelFormatter={(_, payload) => {
                            const point = payload?.[0]?.payload;
                            return point ? `${point.date} • Attempt ${point.attempt}` : "";
                          }}
                        />
                        <Scatter name="Completed assessments" data={scatterData} fill={CHART_COLORS.iq} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart message="Finish at least one assessment with a saved completion time to see this scatter plot." />
                  )}
                </ChartCard>
              </TabsContent>
              <TabsContent value="history" className="space-y-6">
                <div className="glass-card overflow-hidden">
                  <div className="border-b border-border/50 p-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Assessment History</h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Table of the exact results behind your saved dashboard data.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50">
                          {["Date", "Age Group", "Time", "IQ", "Percentile", "Result", "Open"].map((heading) => (
                            <th
                              key={heading}
                              className="p-4 text-left text-sm font-medium text-muted-foreground"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {assessments.map((assessment, index) => {
                          const prediction = predictions.find(
                            (item) => item.assessment_id === assessment.id,
                          );

                          return (
                            <motion.tr
                              key={assessment.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.04 }}
                              className="border-b border-border/50 transition-colors hover:bg-muted/10"
                            >
                              <td className="p-4 text-sm">{formatDate(assessment.started_at)}</td>
                              <td className="p-4 text-sm capitalize">{assessment.age_group}</td>
                              <td className="p-4 text-sm">
                                {formatMinutes(assessment.time_taken_seconds)}
                              </td>
                              <td className="p-4 text-sm font-semibold text-primary">
                                {prediction?.predicted_iq ?? "N/A"}
                              </td>
                              <td className="p-4 text-sm">
                                {prediction?.percentile ? `${prediction.percentile}th` : "N/A"}
                              </td>
                              <td className="p-4 text-sm capitalize">
                                {assessment.status || "unknown"}
                              </td>
                              <td className="p-4">
                                {prediction ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => navigate(`/results/${assessment.id}`)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="text-sm text-muted-foreground">No result</span>
                                )}
                              </td>
                            </motion.tr>
                          );
                        })}
                        {assessments.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-muted-foreground">
                              No assessments yet. Take one to populate your dashboard.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
