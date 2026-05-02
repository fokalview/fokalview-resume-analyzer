export type Screen = "upload" | "results" | "feedback";

export type ResumeAnalysis = {
  score: number;
  summary: string;
  strengths: string[];
  improvements: Array<{
    title: string;
    detail: string;
      priority: "High" | "Medium" | "Low";
    }>;
  keywordAnalysis: {
    matched: string[];
    missing: string[];
  };
  sections: Array<{
    name: string;
    score: number;
    note: string;
  }>;
};
