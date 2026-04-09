import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";

import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import AgeSelect from "./pages/assessment/AgeSelect";
import Assessment from "./pages/assessment/Assessment";
import Results from "./pages/Results";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppShell() {
  const { resolvedTheme } = useTheme();
  const sonnerTheme = resolvedTheme === "light" ? "light" : "dark";

  return (
    <>
      <div className="pointer-events-none fixed right-4 top-4 z-[70] md:right-6 md:top-5">
        <ThemeToggle className="pointer-events-auto" />
      </div>
      <Sonner
        theme={sonnerTheme}
        position="bottom-right"
        toastOptions={{
          style: {
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--card-foreground))",
          },
        }}
      />
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
        <Route path="/auth/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/auth/signup" element={<PageTransition><Signup /></PageTransition>} />
        <Route path="/auth/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
        <Route path="/assessment/age-select" element={<PageTransition><ProtectedRoute><AgeSelect /></ProtectedRoute></PageTransition>} />
        <Route path="/assessment" element={<PageTransition><ProtectedRoute><Assessment /></ProtectedRoute></PageTransition>} />
        <Route path="/results/:assessmentId" element={<PageTransition><ProtectedRoute><Results /></ProtectedRoute></PageTransition>} />
        <Route path="/dashboard" element={<PageTransition><ProtectedRoute><Dashboard /></ProtectedRoute></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppShell />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
