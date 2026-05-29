export type Screen = "upload" | "results" | "feedback" | "applications";

export type JobHandoff = {
  targetRole: string;
  jobContext: string;
  title: string;
  company: string;
  location: string;
  url: string;
  notes: string;
  source: string;
};

export type ResumeProfile = {
  currentTitle: string;
  careerLevel: "Entry" | "Early Career" | "Mid Career" | "Senior" | "Leadership" | "Unknown";
  yearsExperienceEstimate: number;
  industries: string[];
  skills: {
    technical: string[];
    tools: string[];
    soft: string[];
  };
  workHistory: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    highlights: string[];
  }>;
  education: Array<{
    institution: string;
    credential: string;
    field: string;
  }>;
  certifications: string[];
  projects: string[];
  languages: string[];
  locationSignals: string[];
};

export type ResumeAnalysis = {
  score: number;
  summary: string;
  profile?: ResumeProfile;
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
