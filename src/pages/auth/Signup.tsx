import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Loader2, Brain, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

type SignupForm = z.infer<typeof signupSchema>;

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '6+ characters', met: password.length >= 6 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Number', met: /\d/.test(password) },
    { label: 'Special char', met: /[^A-Za-z0-9]/.test(password) },
  ];
  const strength = checks.filter(c => c.met).length;
  const colors = ['bg-destructive', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];

  if (!password) return null;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < strength ? colors[strength - 1] : 'bg-muted'}`} />
          ))}
        </div>
        <span className={`text-xs font-medium ${strength >= 3 ? 'text-green-400' : strength >= 2 ? 'text-yellow-400' : 'text-orange-400'}`}>
          {labels[strength - 1] || 'Very Weak'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-1 text-xs">
            {c.met ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <XCircle className="h-3 w-3 text-muted-foreground/50" />}
            <span className={c.met ? 'text-green-400' : 'text-muted-foreground/50'}>{c.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const passwordValue = watch('password', '');

  const onSubmit = async (data: SignupForm) => {
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.fullName },
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
          throw new Error('An account with this email already exists. Please log in instead.');
        }
        throw error;
      }

      if (authData.session) {
        if (authData.user) {
          await supabase.from('profiles')
            .upsert({ id: authData.user.id, full_name: data.fullName, email: data.email })
            .eq('id', authData.user.id);
        }
        toast.success('Account created! Welcome to PsychZenith 🧠');
        navigate('/assessment/age-select');
      } else {
        toast.success('Account created! Please check your email to confirm your account.');
        navigate('/auth/login');
      }
    } catch (err: any) {
      toast.error(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.03, 0.07, 0.03] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary blur-3xl" />
        <motion.div animate={{ scale: [1.2, 1, 1.2], opacity: [0.03, 0.06, 0.03] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-secondary blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card w-full max-w-md p-8 space-y-6 relative z-10">

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="text-center space-y-2">
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>
            <Brain className="mx-auto h-10 w-10 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-muted-foreground text-sm">Start your cognitive assessment today — no email verification required</p>
        </motion.div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} className="space-y-2">
            <Label>Full Name</Label>
            <Input placeholder="John Doe" {...register('fullName')} className="bg-background/50" />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </motion.div>

          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="you@example.com" {...register('email')} className="bg-background/50" />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </motion.div>

          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }} className="space-y-2">
            <Label>Password</Label>
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                {...register('password')} className="bg-background/50" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            <PasswordStrength password={passwordValue} />
          </motion.div>

          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="space-y-2">
            <Label>Confirm Password</Label>
            <Input type="password" placeholder="••••••••" {...register('confirmPassword')} className="bg-background/50" />
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Button type="submit" className="w-full gradient-bg glow-effect h-11" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
              {loading ? 'Creating Account...' : 'Create Account — Start Free'}
            </Button>
          </motion.div>
        </form>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
          className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
