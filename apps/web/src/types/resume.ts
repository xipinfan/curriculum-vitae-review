export interface StructuredResumeEntry {
  headline: string;
  period?: string;
  highlights: string[];
}

export interface StructuredResume {
  basics: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    summary?: string;
  };
  skills: string[];
  experiences: StructuredResumeEntry[];
  projects: StructuredResumeEntry[];
  education: StructuredResumeEntry[];
  rawSections: Record<string, string[]>;
}

export interface ImportedResumeRecord {
  id: string;
  workspaceId: string;
  sourceType: 'TEXT' | 'MARKDOWN' | 'PDF' | 'DOCX';
  createdAt: string;
}

export interface ParsedResumeResult {
  resumeId: string;
  parserVersion: string;
  parsedAt: string;
  parsedData: StructuredResume;
  reused: boolean;
}

export interface ConfirmedResumeIntake {
  workspaceId: string;
  workspaceName?: string;
  resumeId: string;
  resumeContent: string;
  parsedData: StructuredResume;
  role: string;
  techStack: string;
  techStackList: string[];
  level: string;
  domain: string;
  confidence: number;
  reasoning: string;
}
