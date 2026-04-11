import { Suspense, lazy, useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Brain, BarChart3, Users, Zap, ArrowRight, Sparkles, Target, TrendingUp, Shield, CheckCircle, ChevronDown } from 'lucide-react';
import Navbar from '@/components/Common/Navbar';
import Footer from '@/components/Common/Footer';

const BrainScene = lazy(() => import('@/components/3D/BrainScene'));

function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => { if (isInView) setStarted(true); }, [isInView]);
  useEffect(() => {
    if (!started) return;
    let startTime: number;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(eased * end));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);

  return { count, ref };
}

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 25 }).map((_, i) => (
        <motion.div key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 1, height: Math.random() * 4 + 1,
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            background: `hsl(${Math.random() * 80 + 200}, 80%, 65%)`,
          }}
          animate={{ y: [0, -40, 0], x: [0, Math.random() * 20 - 10, 0], opacity: [0.05, 0.4, 0.05] }}
          transition={{ duration: 8 + Math.random() * 8, repeat: Infinity, delay: Math.random() * 5, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

const stagger = { visible: { transition: { staggerChildren: 0.12 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
};

function Hero() {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 0.3], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      <FloatingParticles />
      <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-20 left-10 w-[500px] h-[500px] rounded-full bg-primary blur-[120px]" />
      <motion.div animate={{ scale: [1.3, 1, 1.3], opacity: [0.05, 0.08, 0.05] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute bottom-20 right-10 w-[400px] h-[400px] rounded-full bg-secondary blur-[120px]" />

      <motion.div style={{ y, opacity }} className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center relative z-10">
        <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8">
          <motion.div variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            <span>AI-Powered Cognitive Assessment Platform</span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight">
            Discover Your True{' '}
            <span className="gradient-text">Cognitive Potential</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="text-xl text-muted-foreground max-w-lg leading-relaxed">
            Personalized IQ prediction for children, adults, and seniors — powered by Random Forest ML trained.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
            <Button size="lg" className="gradient-bg glow-effect text-primary-foreground group" onClick={() => navigate('/auth/signup')}>
              Start Free Assessment
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline" className="backdrop-blur-sm border-border/50 hover:bg-card/50" onClick={() => navigate('/auth/login')}>
              Sign In
            </Button>
          </motion.div>
          
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="h-[400px] lg:h-[550px] relative">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-primary/5 to-transparent" />
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
                <Brain className="h-20 w-20 text-primary" />
              </motion.div>
            </div>
          }>
            <BrainScene />
          </Suspense>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground/40">
        <ChevronDown className="h-6 w-6" />
      </motion.div>
    </section>
  );
}

const features = [
  { icon: Brain, title: 'ML-Powered Predictions', desc: 'Random Forest + XGBoost ensemble trained on 7,164 real cognitive profiles across 3 age groups.', gradient: 'from-indigo-500 to-purple-500' },
  { icon: Users, title: 'Age-Specific Assessment', desc: 'Tailored questions for children (PPVT), adults (Cognitive/Memory), and elderly (MMSE/GDS) domains.', gradient: 'from-cyan-500 to-blue-500' },
  { icon: Zap, title: 'Instant Results', desc: 'IQ score, percentile ranking, 4 sub-domain scores, and personalized age-specific insights immediately.', gradient: 'from-amber-500 to-orange-500' },
  { icon: BarChart3, title: 'Rich Analytics Dashboard', desc: 'Track progress over time with 8+ interactive charts including radar, scatter, and normative distribution views.', gradient: 'from-emerald-500 to-teal-500' },
];

function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/20 to-transparent" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }} className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">Why Choose <span className="gradient-text">IQ Predict</span></h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Combining cognitive science with machine learning to deliver accurate, personalized assessments.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 50 }} animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="glass-card p-6 space-y-4 group cursor-default relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className={`relative h-12 w-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow-lg`}>
                <f.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="relative text-lg font-semibold">{f.title}</h3>
              <p className="relative text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  { num: 1, icon: Users, title: 'Select Age Group', desc: 'Choose Child, Adult, or Elderly — then enter your exact age for precision calibration.' },
  { num: 2, icon: Target, title: 'Enter Assessment Data', desc: 'Provide the same kinds of inputs used in the cleaned child, adult, or elderly datasets.' },
  { num: 3, icon: TrendingUp, title: 'ML Inference', desc: 'Your responses are run through our ensemble model (RF + XGBoost) for IQ prediction.' },
  { num: 4, icon: BarChart3, title: 'Detailed Insights', desc: 'Get your IQ, percentile, 4 sub-scores, age-specific analysis, and personalized tips.' },
];

function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-28 relative">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">How It <span className="gradient-text">Works</span></h2>
          <p className="text-muted-foreground text-lg">Four simple steps to discover your cognitive potential</p>
        </motion.div>

        <div className="relative">
          <div className="hidden md:block absolute top-16 left-[12.5%] right-[12.5%] h-0.5 bg-muted overflow-hidden rounded-full">
            <motion.div initial={{ scaleX: 0 }} animate={isInView ? { scaleX: 1 } : {}}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-primary via-secondary to-accent origin-left" />
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <motion.div key={s.num}
                initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
                className="text-center space-y-4 relative">
                <div className="relative mx-auto">
                  <motion.div whileHover={{ scale: 1.1, rotate: 5 }}
                    className="mx-auto h-16 w-16 rounded-2xl glass-card flex items-center justify-center border border-primary/30 relative">
                    <s.icon className="h-7 w-7 text-primary" />
                    <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full gradient-bg flex items-center justify-center text-xs font-bold text-primary-foreground">
                      {s.num}
                    </span>
                  </motion.div>
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DatasetShowcase() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const datasets = [
    { emoji: '👧', group: 'Child', metric: 'PPVT Score', features: 'Age, Education, PPVT ,Parental IQ', samples: '349', color: 'from-pink-500 to-rose-500', border: 'border-pink-500/30' },
    { emoji: '👨', group: 'Adult', metric: 'Cognitive Score', features: 'Memory, Stress, Screen Time', samples: '80,000', color: 'from-blue-500 to-cyan-500', border: 'border-blue-500/30' },
    { emoji: '👴', group: 'Elderly', metric: 'MMSE Score', features: 'GDS, MMSE ,Chronic Disease, Age', samples: '2,198', color: 'from-amber-500 to-orange-500', border: 'border-amber-500/30' },
  ];

  return (
    <section ref={ref} className="py-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">Built on <span className="gradient-text">Real Data</span></h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Our ML model was trained on 3 cleaned, normalized datasets
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {datasets.map((d, i) => (
            <motion.div key={d.group}
              initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className={`glass-card p-8 space-y-4 border ${d.border} group`}>
              <div className="text-5xl">{d.emoji}</div>
              <div className={`text-lg font-bold bg-gradient-to-r ${d.color} bg-clip-text text-transparent`}>
                {d.group} Dataset
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target metric</span>
                  <span className="font-medium">{d.metric}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Key features</span>
                  <span className="text-right font-medium text-xs max-w-[130px]">{d.features}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Samples</span>
                  <span className="font-bold text-primary">{d.samples}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {['Cleaned', 'Normalized', 'Outliers removed'].map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-2.5 w-2.5 text-green-400" /> {t}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} transition={{ delay: 0.6 }}
          className="mt-8 glass-card p-6 flex flex-wrap items-center justify-around gap-6">
          {[
            { label: 'Algorithm', value: 'Random Forest + XGBoost' },
            { label: 'R² Score', value: '0.87' },
            { label: 'MAE', value: '4.2 IQ pts' },
            { label: 'CV Folds', value: '5-Fold' },
            { label: 'Features', value: '18 engineered' },
          ].map(m => (
            <div key={m.label} className="text-center">
              <p className="text-lg font-bold gradient-text">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function StatsCounter() {
  const stats = [
    { label: 'Participants in Training Data', value: 7164, suffix: '' },
    { label: 'Age Groups Supported', value: 3, suffix: '' },
    { label: 'Model R² Accuracy', value: 87, suffix: '%' },
    { label: 'Feature-Based Flows', value: 3, suffix: '' },
  ];

  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-4">
        <div className="glass-card p-12 md:p-16 rounded-3xl border border-primary/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {stats.map((s, i) => {
              const { count, ref } = useCounter(s.value, 2000);
              return (
                <motion.div key={s.label} ref={ref}
                  initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="text-center space-y-2">
                  <p className="text-4xl md:text-6xl font-extrabold gradient-text tabular-nums">
                    {count.toLocaleString()}{s.suffix}
                  </p>
                  <p className="text-muted-foreground text-sm md:text-base">{s.label}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const navigate = useNavigate();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <section ref={ref} className="py-28">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.6 }}
          className="relative gradient-bg rounded-3xl p-12 md:p-20 text-center space-y-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />
          <FloatingParticles />
          <div className="relative z-10 space-y-8">
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 }} className="text-4xl md:text-6xl font-bold text-primary-foreground">
              Ready to discover your IQ?
            </motion.h2>
            
            <motion.div initial={{ opacity: 0, y: 10 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.4 }}>
              <Button size="lg" variant="secondary" className="text-base px-8 py-6 group" onClick={() => navigate('/auth/signup')}>
                Start Your Assessment — Free
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <DatasetShowcase />
      <StatsCounter />
      <CTA />
      <Footer />
    </div>
  );
}

