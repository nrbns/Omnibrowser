/**
 * Resume Service
 * Handles resume file parsing (PDF/DOCX) and text extraction
 */

import * as mammoth from 'mammoth';

export interface ResumeData {
  text: string;
  sections: ResumeSection[];
  metadata: {
    fileName: string;
    fileType: 'pdf' | 'docx';
    wordCount: number;
    pageCount?: number;
    extractedAt: number;
  };
}

export interface ResumeSection {
  type: 'header' | 'experience' | 'education' | 'skills' | 'summary' | 'projects' | 'other';
  title: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Parse PDF file
 */
export async function parsePDF(file: File): Promise<ResumeData> {
  try {
    // Dynamic import for pdf-parse (Node.js library)
    // Note: pdf-parse requires Node.js Buffer, works in Tauri but not pure browser
    const pdfParseModule: any = await import('pdf-parse');
    // Handle different export formats (CJS/ESM)
    const pdfParseFunc = pdfParseModule.default || pdfParseModule.pdfParse || pdfParseModule;

    if (typeof pdfParseFunc !== 'function') {
      throw new Error(
        'pdf-parse library not available. This feature requires Tauri (Node.js environment).'
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    // Convert ArrayBuffer to Buffer (required by pdf-parse)
    // In Tauri, Buffer is available globally
    if (typeof Buffer === 'undefined') {
      throw new Error('Buffer not available. PDF parsing requires Node.js environment (Tauri).');
    }
    const buffer = Buffer.from(arrayBuffer);
    const data = await pdfParseFunc(buffer);

    const text = data.text || '';
    const sections = extractSections(text);

    return {
      text,
      sections,
      metadata: {
        fileName: file.name,
        fileType: 'pdf',
        wordCount: text.split(/\s+/).length,
        pageCount: data.numpages,
        extractedAt: Date.now(),
      },
    };
  } catch (error) {
    console.error('[ResumeService] PDF parsing failed:', error);
    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse DOCX file
 */
export async function parseDOCX(file: File): Promise<ResumeData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    const text = result.value || '';
    const sections = extractSections(text);

    return {
      text,
      sections,
      metadata: {
        fileName: file.name,
        fileType: 'docx',
        wordCount: text.split(/\s+/).length,
        extractedAt: Date.now(),
      },
    };
  } catch (error) {
    console.error('[ResumeService] DOCX parsing failed:', error);
    throw new Error(
      `Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse resume file (auto-detect type)
 */
export async function parseResumeFile(file: File): Promise<ResumeData> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return parsePDF(file);
  } else if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx')
  ) {
    return parseDOCX(file);
  } else {
    throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
  }
}

/**
 * Extract sections from resume text
 */
function extractSections(text: string): ResumeSection[] {
  const sections: ResumeSection[] = [];
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // Common section headers
  const sectionPatterns = [
    { type: 'summary' as const, patterns: [/^(summary|objective|profile|about)$/i] },
    {
      type: 'experience' as const,
      patterns: [/^(experience|work experience|employment|work history|professional experience)$/i],
    },
    { type: 'education' as const, patterns: [/^(education|academic|qualifications)$/i] },
    { type: 'skills' as const, patterns: [/^(skills|technical skills|competencies|expertise)$/i] },
    { type: 'projects' as const, patterns: [/^(projects|personal projects|portfolio)$/i] },
  ];

  let currentSection: ResumeSection | null = null;
  let currentStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line is a section header
    let matchedSection = false;
    for (const { type, patterns } of sectionPatterns) {
      if (patterns.some(pattern => pattern.test(line))) {
        // Save previous section
        if (currentSection) {
          currentSection.endIndex = currentStartIndex;
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          type,
          title: line,
          content: '',
          startIndex: currentStartIndex,
          endIndex: currentStartIndex,
        };
        matchedSection = true;
        break;
      }
    }

    if (!matchedSection) {
      if (currentSection) {
        currentSection.content += (currentSection.content ? '\n' : '') + line;
      } else {
        // Content before first section
        if (sections.length === 0 || sections[sections.length - 1].type === 'header') {
          // Create or update header section
          if (sections.length === 0 || sections[sections.length - 1].type !== 'header') {
            sections.push({
              type: 'header',
              title: 'Header',
              content: line,
              startIndex: currentStartIndex,
              endIndex: currentStartIndex,
            });
          } else {
            sections[sections.length - 1].content += '\n' + line;
          }
        }
      }
    }

    currentStartIndex += line.length + 1; // +1 for newline
  }

  // Add final section
  if (currentSection) {
    currentSection.endIndex = currentStartIndex;
    sections.push(currentSection);
  }

  // If no sections found, create a single "other" section
  if (sections.length === 0) {
    sections.push({
      type: 'other',
      title: 'Content',
      content: text,
      startIndex: 0,
      endIndex: text.length,
    });
  }

  return sections;
}

/**
 * Validate resume format and detect issues
 */
export interface ResumeIssues {
  format: 'ats-friendly' | 'creative' | 'academic' | 'unknown';
  issues: Array<{
    type: 'formatting' | 'content' | 'length' | 'keywords';
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
  }>;
}

export function analyzeResume(resume: ResumeData): ResumeIssues {
  const issues: ResumeIssues['issues'] = [];
  let format: ResumeIssues['format'] = 'unknown';

  // Detect format
  const hasSections = resume.sections.length > 3;
  const hasSkills = resume.sections.some(s => s.type === 'skills');
  const hasExperience = resume.sections.some(s => s.type === 'experience');
  const wordCount = resume.metadata.wordCount;

  if (hasSections && hasSkills && hasExperience && wordCount > 200 && wordCount < 800) {
    format = 'ats-friendly';
  } else if (wordCount > 1000 || resume.sections.length > 6) {
    format = 'academic';
  } else if (!hasSections || wordCount < 200) {
    format = 'creative';
  }

  // Check for common issues
  if (wordCount < 200) {
    issues.push({
      type: 'length',
      severity: 'error',
      message: 'Resume is too short (less than 200 words)',
      suggestion: 'Add more details about your experience, skills, and achievements.',
    });
  } else if (wordCount > 1200) {
    issues.push({
      type: 'length',
      severity: 'warning',
      message: 'Resume is quite long (over 1200 words)',
      suggestion: 'Consider condensing to 1-2 pages for better ATS compatibility.',
    });
  }

  if (!hasSkills) {
    issues.push({
      type: 'content',
      severity: 'warning',
      message: 'No skills section found',
      suggestion: 'Add a skills section to highlight your technical and soft skills.',
    });
  }

  if (!hasExperience) {
    issues.push({
      type: 'content',
      severity: 'error',
      message: 'No experience section found',
      suggestion: 'Add your work experience or projects to show your expertise.',
    });
  }

  // Check for formatting issues
  if (resume.text.includes('\t') || resume.text.match(/\s{3,}/)) {
    issues.push({
      type: 'formatting',
      severity: 'info',
      message: 'Multiple spaces or tabs detected',
      suggestion: 'Use consistent spacing for better ATS parsing.',
    });
  }

  return { format, issues };
}
