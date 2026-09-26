export type Screen = "dashboard" | "upload" | "results" | "applications" | "import";

export type JobHandoff = {
  targetRole: string;
  jobContext: string;
  title: string;
  company: string;
  location: string;
  salary: string;
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

export type JobQualifications = {
  requiredSkills: string[];
  preferredSkills: string[];
  tools: string[];
  responsibilities: string[];
  education: string[];
  certifications: string[];
  experienceLevel: string;
  yearsExperience: string;
  employmentType: string;
  location: string;
  salary: string;
};

export type JobDetails = {
  title: string;
  company: string;
  location: string;
  salary: string;
  employmentType: string;
  workplaceType: string;
  sourceUrl: string;
};

export type ScoreAudit = {
  verdict: "reasonable" | "review";
  confidence: number;
  expectedMin: number;
  expectedMax: number;
  explanation: string;
  flags: string[];
  historicalContext: string;
};

export type Readiness = {
  version: string;
  level: string;
  explanation: string;
  requirements: Array<{id:string; requirement:string; jobQuote:string; importance:string; category:string; status:string; resumeQuote:string; reason:string; nextAction:string}>;
  counts: Record<string, number>;
  criticalUnresolved: number;
  assessed: number;
  total: number;
  extractionIncomplete: boolean;
};

export type ResumeAnalysis = {
  score: number | null;
  readiness?: Readiness;
  scoringVersion?: string;
  sourceEvidence?: Array<{claim:string;resumeQuote:string;jobQuote:string}>;
  summary: string;
  profile?: ResumeProfile;
  jobDetails?: JobDetails;
  jobQualifications?: JobQualifications;
  scoreAudit?: ScoreAudit;
  orchestration?: {
    provider: string;
    stages: string[];
  };
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
