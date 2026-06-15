export type TranscriptSource = 'govopendata' | 'tushare' | 'github';

export interface ParsedTranscript {
  date: string;            // 'YYYY-MM-DD'
  source: TranscriptSource;
  text: string;            // cleaned full transcript body
  items: string[];         // headline list (best-effort; may be empty)
}
