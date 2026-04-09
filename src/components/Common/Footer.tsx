import { Brain, Github, Twitter } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Footer() {
  return (
    <footer className="border-t border-border/30 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-card/20 to-transparent pointer-events-none" />
      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="grid md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              <span className="text-xl font-bold gradient-text">IQ Predict</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Personalized cognitive assessment platform powered by machine learning algorithms.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Links</h4>
            <div className="flex flex-col gap-2">
              {['About', 'Privacy Policy', 'Terms of Service', 'Contact'].map(link => (
                <a key={link} href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
                  {link}
                </a>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Assessment</h4>
            <div className="flex flex-col gap-2">
              {['Child Assessment', 'Adult Assessment', 'Elderly Assessment', 'How It Works'].map(link => (
                <a key={link} href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} IQ Predict. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <motion.a href="#" whileHover={{ scale: 1.1 }} className="text-muted-foreground hover:text-foreground transition-colors">
              <Twitter className="h-5 w-5" />
            </motion.a>
            <motion.a href="#" whileHover={{ scale: 1.1 }} className="text-muted-foreground hover:text-foreground transition-colors">
              <Github className="h-5 w-5" />
            </motion.a>
          </div>
        </div>
      </div>
    </footer>
  );
}
