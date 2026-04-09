import { create } from 'zustand';
import type { AgeGroup, AssessmentFormPayload, QuestionResponse } from '@/types';

interface AssessmentState {
  assessmentId: string | null;
  ageGroup: AgeGroup | null;
  formData: AssessmentFormPayload | null;
  currentQuestion: number;
  responses: QuestionResponse[];
  startTime: number | null;
  setAgeGroup: (ag: AgeGroup) => void;
  setAssessmentId: (id: string) => void;
  setFormData: (payload: AssessmentFormPayload) => void;
  setCurrentQuestion: (index: number) => void;
  addResponse: (r: QuestionResponse) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  reset: () => void;
}

export const useAssessmentStore = create<AssessmentState>((set) => ({
  assessmentId: null,
  ageGroup: null,
  formData: null,
  currentQuestion: 0,
  responses: [],
  startTime: null,
  setAgeGroup: (ageGroup) => set({ ageGroup }),
  setAssessmentId: (assessmentId) => set({ assessmentId, startTime: Date.now() }),
  setFormData: (formData) => set({ formData }),
  setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),
  addResponse: (r) =>
    set((state) => {
      const existing = state.responses.filter((x) => x.question_id !== r.question_id);
      return { responses: [...existing, r] };
    }),
  nextQuestion: () => set((state) => ({ currentQuestion: state.currentQuestion + 1 })),
  previousQuestion: () => set((state) => ({ currentQuestion: Math.max(0, state.currentQuestion - 1) })),
  reset: () => set({ assessmentId: null, ageGroup: null, formData: null, currentQuestion: 0, responses: [], startTime: null }),
}));
