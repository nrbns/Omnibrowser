export type DocumentReviewSourceType = 'pdf' | 'docx' | 'web';

export interface DocumentSection {
  title: string;
  level: number;
  content: string;
  page?: number;
  line?: number;
  startPosition: number;
  endPosition: number;
}

export interface DocumentEntity {
  name: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'concept' | 'other';
  occurrences: Array<{ position: number; context: string }>;
}

export interface TimelineEvent {
  date: string;
  description: string;
  source: string;
  confidence: number;
}

export interface DocumentClaim {
  id: string;
  text: string;
  position: number;
  page?: number;
  line?: number;
  section?: string;
  verification: {
    status: 'verified' | 'unverified' | 'disputed';
    sources: Array<{
      url: string;
      title: string;
      supports: boolean;
      confidence: number;
    }>;
    confidence: number;
  };
}

export interface DocumentReview {
  id: string;
  title: string;
  type: DocumentReviewSourceType;
  content: string;
  sections: DocumentSection[];
  entities: DocumentEntity[];
  timeline: TimelineEvent[];
  claims: DocumentClaim[];
  createdAt: number;
  updatedAt: number;
}

