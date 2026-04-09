import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, ArrowRight, Calendar, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAssessmentStore } from '@/store/assessmentStore';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AgeGroup } from '@/types';
import Navbar from '@/components/Common/Navbar';

const groups = [
  {
    value: 'child' as AgeGroup,
    emoji: '👧',
    label: 'Child',
    sub: '0–17 years',
    desc: 'Age-appropriate questions focusing on foundational cognitive skills',
    gradient: 'from-pink-500 to-rose-500',
    glow: 'hover:shadow-pink-500/30',
    border: 'border-pink-500/50',
    bg: 'bg-pink-500/10',
    minAge: 0,
    maxAge: 17,
    color: '#ec4899',
  },
  {
    value: 'adult' as AgeGroup,
    emoji: '👨',
    label: 'Adult',
    sub: '18–59 years',
    desc: 'Comprehensive assessment covering all cognitive domains',
    gradient: 'from-blue-500 to-cyan-500',
    glow: 'hover:shadow-blue-500/30',
    border: 'border-blue-500/50',
    bg: 'bg-blue-500/10',
    minAge: 18,
    maxAge: 59,
    color: '#3b82f6',
  },
  {
    value: 'elderly' as AgeGroup,
    emoji: '👴',
    label: 'Elderly',
    sub: '60+ years',
    desc: 'Calibrated for age-related cognitive patterns with tailored benchmarks',
    gradient: 'from-amber-500 to-orange-500',
    glow: 'hover:shadow-amber-500/30',
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    minAge: 60,
    maxAge: 110,
    color: '#f59e0b',
  },
];

export default function AgeSelect() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setAgeGroup, setAssessmentId, setFormData, reset } = useAssessmentStore();
  const [step, setStep] = useState<'group' | 'age'>('group');
  const [selectedGroup, setSelectedGroup] = useState<typeof groups[0] | null>(null);
  const [age, setAge] = useState('');
  const [ageError, setAgeError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGroupSelect = (g: typeof groups[0]) => {
    setSelectedGroup(g);
    setAge('');
    setAgeError('');
    setStep('age');
  };

  const validateAge = (val: string) => {
    if (!selectedGroup) return false;
    const num = parseInt(val);
    if (isNaN(num)) { setAgeError('Please enter a valid age'); return false; }
    if (num < selectedGroup.minAge || num > selectedGroup.maxAge) {
      setAgeError(`Age must be between ${selectedGroup.minAge} and ${selectedGroup.maxAge} for ${selectedGroup.label}`);
      return false;
    }
    setAgeError('');
    return true;
  };

  const handleStart = async () => {
    if (!validateAge(age) || !user || !selectedGroup) return;
    setLoading(true);
    try {
      reset();
      const { data, error } = await supabase
        .from('assessments')
        .insert({ user_id: user.id, age_group: selectedGroup.value })
        .select('id')
        .single();
      if (error) throw error;
      setAgeGroup(selectedGroup.value);
      setAssessmentId(data.id);
      setFormData({
        age: parseInt(age, 10),
        age_group: selectedGroup.value,
        fields: {},
      });
      localStorage.setItem('pz_user_age', age);
      localStorage.setItem('pz_age_group', selectedGroup.value);
      navigate('/assessment');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start assessment');
    } finally {
      setLoading(false);
    }
  };

  return <div className="min-h-screen bg-background relative overflow-hidden"><Navbar /><div className="absolute inset-0 pointer-events-none" />
  <div className="flex min-h-screen items-center justify-center pt-16 p-4 relative z-10"><AnimatePresence mode="wait">{step === 'group' ? (
  <motion.div key="group" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.5 }} className="text-center space-y-12 max-w-5xl w-full">
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4"><motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }} className="inline-block"><Brain className="mx-auto h-16 w-16 text-primary" /></motion.div><h1 className="text-4xl md:text-6xl font-extrabold">Who is taking the <span className="gradient-text">assessment</span>?</h1><p className="text-muted-foreground text-lg max-w-xl mx-auto">Select the appropriate age group for questions calibrated to your cognitive development stage.</p></motion.div>
  <div className="grid md:grid-cols-3 gap-6 lg:gap-8">{groups.map((g, i) => (<motion.button key={g.value} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }} whileHover={{ scale: 1.03, y: -8 }} whileTap={{ scale: 0.97 }} onClick={() => handleGroupSelect(g)} className={`glass-card p-8 space-y-5 cursor-pointer border-2 border-transparent hover:border-primary/30 transition-all duration-300 group ${g.glow} hover:shadow-2xl`}><motion.div className="text-7xl" whileHover={{ scale: 1.2, rotate: [0, -10, 10, 0] }} transition={{ duration: 0.5 }}>{g.emoji}</motion.div><h3 className="text-2xl font-bold">{g.label}</h3><p className="text-muted-foreground font-medium">{g.sub}</p><p className="text-sm text-muted-foreground/70">{g.desc}</p><div className={`h-1 w-20 mx-auto rounded-full bg-gradient-to-r ${g.gradient} opacity-50 group-hover:opacity-100 group-hover:w-28 transition-all duration-300`} /><div className="flex items-center justify-center gap-1 text-xs text-muted-foreground/60 group-hover:text-primary/60 transition-colors"><ArrowRight className="h-3 w-3" /> Select & enter your age</div></motion.button>))}</div>
  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex items-center justify-center gap-2 text-sm text-muted-foreground/60"><Sparkles className="h-4 w-4" /> Questions are scientifically calibrated per age group</motion.p></motion.div>) : (
  <motion.div key="age" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-lg"><div className="glass-card p-10 space-y-8"><div className="text-center space-y-3"><motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }} className={`inline-flex items-center gap-3 rounded-2xl px-5 py-3 ${selectedGroup?.bg} border ${selectedGroup?.border}`}><span className="text-3xl">{selectedGroup?.emoji}</span><div className="text-left"><p className="font-bold text-lg">{selectedGroup?.label}</p><p className="text-sm text-muted-foreground">{selectedGroup?.sub}</p></div></motion.div><motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-3xl font-bold">How old are you?</motion.h2></div><motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3"><Label className="flex items-center gap-2 text-sm font-medium"><Calendar className="h-4 w-4 text-primary" /> Your Age (years)</Label><div className="relative"><Input type="number" placeholder={`Enter age (${selectedGroup?.minAge}–${selectedGroup?.maxAge})`} value={age} onChange={e => { setAge(e.target.value); if (e.target.value) validateAge(e.target.value); }} onKeyDown={e => e.key === 'Enter' && handleStart()} className="bg-background/50 text-lg h-14 text-center font-semibold pr-16 focus:border-primary/50 transition-colors" min={selectedGroup?.minAge} max={selectedGroup?.maxAge} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">yrs</span></div>{ageError && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-destructive">⚠️ {ageError}</motion.p>}</motion.div><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex gap-3"><Button variant="outline" onClick={() => { setStep('group'); setSelectedGroup(null); }} className="flex-shrink-0"><ChevronLeft className="h-4 w-4" /> Back</Button><Button className="flex-1 gradient-bg glow-effect h-12 text-base font-semibold" onClick={handleStart} disabled={!age || !!ageError || loading}>{loading ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full" /> : <> Start Assessment <ArrowRight className="ml-2 h-4 w-4" /> </>}</Button></motion.div></div></motion.div>)} </AnimatePresence></div></div>;
}
