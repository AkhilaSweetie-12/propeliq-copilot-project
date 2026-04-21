export type ProjectRole = 'OWNER' | 'ADMIN' | 'CONTRIBUTOR' | 'VIEWER';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  role: ProjectRole;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
}