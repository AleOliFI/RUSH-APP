import { create } from 'zustand';
import type { HRVReading } from '../types/hrv';
import type { ReadinessAssessment } from '../types/readiness';

interface HRVState {
  readings: HRVReading[];
  todayAssessment: ReadinessAssessment | null;
  isMeasuring: boolean;
  redChannelBuffer: number[];
  setReadings: (readings: HRVReading[]) => void;
  addReading: (reading: HRVReading) => void;
  setTodayAssessment: (assessment: ReadinessAssessment | null) => void;
  setMeasuring: (measuring: boolean) => void;
  pushRedChannelValue: (value: number) => void;
  clearBuffer: () => void;
}

export const useHRVStore = create<HRVState>((set) => ({
  readings: [],
  todayAssessment: null,
  isMeasuring: false,
  redChannelBuffer: [],
  setReadings: (readings) => set({ readings }),
  addReading: (reading) => set((s) => ({ readings: [reading, ...s.readings] })),
  setTodayAssessment: (assessment) => set({ todayAssessment: assessment }),
  setMeasuring: (isMeasuring) => set({ isMeasuring }),
  pushRedChannelValue: (value) =>
    set((s) => ({ redChannelBuffer: [...s.redChannelBuffer, value] })),
  clearBuffer: () => set({ redChannelBuffer: [] }),
}));
