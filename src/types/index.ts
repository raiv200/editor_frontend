// src/types/index.ts

export interface User {
  id: string;
  email: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Rfp {
  id: string;
  title: string;
  description?: string | null;
  company?: string | null;
  dueDate?: string | null;
  status: 'DRAFT' | 'IN_PROGRESS' | 'IN_REVIEW' | 'SUBMITTED' | 'COMPLETED';
  createdById: string;
  createdBy?: User;
  createdAt: string;
  updatedAt: string;
  sections?: Section[];
  access?: RfpAccess[];
  role?: string;
  totalQuestions?: number;
}

export interface RfpAccess {
  id: string;
  userId: string;
  rfpId: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  createdAt: string;
  user?: User;
}

export interface Section {
  id: string;
  rfpId: string;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  questions: Question[];
}

export interface Question {
  id: string;
  sectionId: string;
  title: string;
  fullQuestion: string;
  description?: string | null;
  order: number;
  maxChars: number;
  answer?: string | null;
  answerJson?: string | null;
  answeredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollaborationToken {
  token: string;
  appId: string;
  documentNames: string[];
  user: {
    id: string;
    name: string;
    color: string;
  };
}

export interface AnswerData {
  questionId: string;
  answer: string | null;
  answerJson: object | null;
  answeredAt: string | null;
}

// Editor types
export interface EditorUser {
  name: string;
  color: string;
  clientId?: number;
}

export interface EditorContent {
  html: string;
  json: object;
}