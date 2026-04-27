export type DiagnosisJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type DiagnosisSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type DiagnosisItemStatus = 'OPEN' | 'ADOPTED' | 'IGNORED' | 'MANUALLY_EDITED';

export interface DiagnosisItem {
  id: string;
  diagnosisJobId: string;
  category: string;
  severity: DiagnosisSeverity;
  title: string;
  description: string;
  suggestion: string | null;
  editedContent: string | null;
  status: DiagnosisItemStatus;
  userNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosisJob {
  id: string;
  workspaceId: string;
  resumeDocumentId: string | null;
  status: DiagnosisJobStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  items?: DiagnosisItem[];
}

export interface DiagnosisJobWithCount extends DiagnosisJob {
  _count: {
    items: number;
  };
}

export type DiagnosisItemAction = 'ADOPT' | 'IGNORE' | 'MANUAL_EDIT';

