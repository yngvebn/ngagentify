export type AnnotationStatus = 'pending' | 'acknowledged' | 'diff_proposed' | 'resolved' | 'dismissed';

export interface AnnotationReply {
  id: string;
  createdAt: string;
  author: 'agent' | 'user';
  message: string;
}

export interface Annotation {
  id: string;
  sessionId: string;
  createdAt: string;
  status: AnnotationStatus;
  replies: AnnotationReply[];
  componentName: string;
  componentFilePath: string;
  templateFilePath?: string;
  selector: string;
  inputs: Record<string, unknown>;
  domSnapshot: string;
  componentTreePath: string[];
  annotationText: string;
  selectionText?: string;
  diff?: string;
  diffResponse?: 'approved' | 'rejected';
}

export interface Session {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  active: boolean;
  url: string;
}

export interface ComponentContext {
  componentName: string;
  componentFilePath: string;
  templateFilePath?: string;
  selector: string;
  inputs: Record<string, unknown>;
  domSnapshot: string;
  componentTreePath: string[];
}
