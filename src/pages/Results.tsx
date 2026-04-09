import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, BarChart3, RotateCcw, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Prediction } from '@/types';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import Navbar from '@/components/Common/Navbar';

const tooltipStyle = { background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' };

export default function Results() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const ageGroup = localStorage.getItem('pz_age_group') || 'adult';

  useEffect(() => {
    if (!assessmentId) return;
    const fetchPrediction = async () => {
      const { data, error } = await supabase.from('predictions').select('*').eq('assessment_id', assessmentId).single();
      if (error) toast.error('Failed to load results');
      else setPrediction(data as unknown as Prediction);
      setLoading(false);
    };
    setTimeout(fetchPrediction, 1500);
  }, [assessmentId]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><div className="flex flex-col items-center gap-6"><Brain className="h-20 w-20 text-primary" /><div className="text-center space-y-2"><p className="text-xl font-semibold">Analyzing your results...</p><p className="text-sm text-muted-foreground">Running ML model inference...</p></div></div></div>;
  }

  if (!prediction) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><div className="text-center space-y-4"><p className="text-xl text-muted-foreground">Results not found</p><Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button></div></div>;
  }

  const radarData = [
    { category: 'Verbal', score: prediction.verbal_score ?? 0, avg: ageGroup === 'child' ? 62 : ageGroup === 'elderly' ? 74 : 68 },
    { category: 'Logical', score: prediction.logical_score ?? 0, avg: ageGroup === 'child' ? 58 : ageGroup === 'elderly' ? 65 : 72 },
    { category: 'Spatial', score: prediction.spatial_score ?? 0, avg: ageGroup === 'child' ? 65 : ageGroup === 'elderly' ? 58 : 65 },
    { category: 'Processing', score: prediction.processing_speed_score ?? 0, avg: ageGroup === 'child' ? 70 : ageGroup === 'elderly' ? 55 : 67 },
  ];
  const subScores = [
    { label: 'Verbal', score: prediction.verbal_score ?? 0 },
    { label: 'Logical', score: prediction.logical_score ?? 0 },
    { label: 'Spatial', score: prediction.spatial_score ?? 0 },
    { label: 'Processing Speed', score: prediction.processing_speed_score ?? 0 },
  ];

  return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 pt-24 pb-16 max-w-5xl"><motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10"><div className="text-center space-y-4"><p className="text-5xl font-extrabold gradient-text">{prediction.predicted_iq}</p><p className="text-muted-foreground">Percentile: {prediction.percentile ?? 'N/A'}</p></div><div className="grid lg:grid-cols-2 gap-6"><div className="glass-card p-6"><h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><BarChart3 className="h-5 w-5 text-primary" /> Cognitive Domain Scores</h3><ResponsiveContainer width="100%" height={260}><BarChart data={subScores}><CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" /><XAxis dataKey="label" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="score" fill="hsl(239 84% 67%)" /></BarChart></ResponsiveContainer></div><div className="glass-card p-6"><h3 className="text-lg font-semibold mb-4">Cognitive Radar</h3><ResponsiveContainer width="100%" height={260}><RadarChart data={radarData}><PolarGrid stroke="hsl(215 25% 27%)" /><PolarAngleAxis dataKey="category" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} /><Radar name="Your Score" dataKey="score" stroke="hsl(239 84% 67%)" fill="hsl(239 84% 67%)" fillOpacity={0.35} /><Radar name="Average" dataKey="avg" stroke="hsl(215 20% 65%)" fill="hsl(215 20% 65%)" fillOpacity={0.1} /><Tooltip contentStyle={tooltipStyle} /></RadarChart></ResponsiveContainer></div></div><div className="flex gap-3 justify-center"><Button className="gradient-bg" onClick={() => navigate('/assessment/age-select')}><RotateCcw className="mr-2 h-4 w-4" /> Retake</Button><Button variant="outline" onClick={() => navigate('/dashboard')}><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</Button></div></motion.div></div></div>;
}
