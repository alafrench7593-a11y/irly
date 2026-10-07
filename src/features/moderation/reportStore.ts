import { create } from 'zustand';
import type { ReportTarget } from './moderation';

/** One report sheet for the whole app: any screen opens it with what to report. */
export const useReportStore = create<{ target: ReportTarget | null; name?: string; close: () => void }>((set) => ({
  target: null,
  close: () => set({ target: null, name: undefined }),
}));

export function openReport(target: ReportTarget, name?: string) {
  useReportStore.setState({ target, name });
}
