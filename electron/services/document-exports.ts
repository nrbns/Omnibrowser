/**
 * Document Export Service
 * Export documents with citations in various formats
 */

import { DocumentReview, DocumentClaim } from './document-review';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'ieee' | 'harvard';

/**
 * Format citation in APA style
 */
function formatAPACitation(source: { url: string; title: string }): string {
  // Simplified APA format
  const domain = new URL(source.url).hostname.replace(/^www\./, '');
  const year = new Date().getFullYear();
  return `${domain} (${year}). ${source.title}. Retrieved from ${source.url}`;
}

/**
 * Format citation in MLA style
 */
function formatMLACitation(source: { url: string; title: string }): string {
  const domain = new URL(source.url).hostname.replace(/^www\./, '');
  const accessDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `"${source.title}." ${domain}. Web. ${accessDate}. <${source.url}>.`;
}

/**
 * Format citation in Chicago style
 */
function formatChicagoCitation(source: { url: string; title: string }): string {
  const domain = new URL(source.url).hostname.replace(/^www\./, '');
  const accessDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `${domain}. "${source.title}." Last modified ${accessDate}. ${source.url}.`;
}

/**
 * Format citation in IEEE style
 */
function formatIEEECitation(source: { url: string; title: string }): string {
  return `[Online]. Available: ${source.url}`;
}

/**
 * Format citation in Harvard style
 */
function formatHarvardCitation(source: { url: string; title: string }): string {
  const domain = new URL(source.url).hostname.replace(/^www\./, '');
  const year = new Date().getFullYear();
  return `${domain} ${year}, ${source.title}, viewed ${new Date().toLocaleDateString('en-AU')}, <${source.url}>.`;
}

/**
 * Format citation based on style
 */
function formatCitation(source: { url: string; title: string }, style: CitationStyle): string {
  switch (style) {
    case 'apa':
      return formatAPACitation(source);
    case 'mla':
      return formatMLACitation(source);
    case 'chicago':
      return formatChicagoCitation(source);
    case 'ieee':
      return formatIEEECitation(source);
    case 'harvard':
      return formatHarvardCitation(source);
    default:
      return formatAPACitation(source);
  }
}

/**
 * Export document to Markdown with footnotes
 */
export function exportToMarkdown(review: DocumentReview, citationStyle: CitationStyle = 'apa'): string {
  let md = `# ${review.title}\n\n`;
  md += `*Document Review - Generated ${new Date(review.createdAt).toLocaleString()}*\n\n`;
  
  // Table of Contents
  if (review.sections.length > 0) {
    md += `## Table of Contents\n\n`;
    for (const section of review.sections) {
      const indent = '  '.repeat(section.level - 1);
      md += `${indent}- [${section.title}](#${section.title.toLowerCase().replace(/\s+/g, '-')})\n`;
    }
    md += `\n`;
  }
  
  // Sections with claims
  let footnoteCounter = 1;
  const footnotes: string[] = [];
  const claimToFootnote = new Map<string, number>();
  
  for (const section of review.sections) {
    md += `${'#'.repeat(section.level + 1)} ${section.title}\n\n`;
    
    // Add section content with claim annotations
    let sectionContent = section.content;
    const sectionClaims = review.claims.filter(c => c.section === section.title);
    
    for (const claim of sectionClaims) {
      // Find claim in content
      const claimIndex = sectionContent.indexOf(claim.text);
      if (claimIndex >= 0) {
        // Get verification status emoji
        const statusEmoji = claim.verification.status === 'verified' ? '✅' :
                           claim.verification.status === 'disputed' ? '⚠️' : '❓';
        
        // Add footnote reference
        if (!claimToFootnote.has(claim.id)) {
          claimToFootnote.set(claim.id, footnoteCounter);
          footnotes.push(`[^${footnoteCounter}]: ${statusEmoji} ${claim.text}\n`);
          
          // Add citations
          for (const source of claim.verification.sources.slice(0, 3)) {
            footnotes.push(`   - ${formatCitation(source, citationStyle)}\n`);
          }
          
          footnoteCounter++;
        }
        
        const footnoteNum = claimToFootnote.get(claim.id)!;
        sectionContent = sectionContent.replace(
          claim.text,
          `${claim.text}[^${footnoteNum}]`
        );
      }
    }
    
    md += `${sectionContent}\n\n`;
  }
  
  // Add footnotes
  if (footnotes.length > 0) {
    md += `---\n\n## References\n\n`;
    md += footnotes.join('');
  }
  
  // Add verification summary
  md += `\n---\n\n## Verification Summary\n\n`;
  const verifiedCount = review.claims.filter(c => c.verification.status === 'verified').length;
  const disputedCount = review.claims.filter(c => c.verification.status === 'disputed').length;
  const unverifiedCount = review.claims.filter(c => c.verification.status === 'unverified').length;
  
  md += `- ✅ Verified: ${verifiedCount}\n`;
  md += `- ⚠️ Disputed: ${disputedCount}\n`;
  md += `- ❓ Unverified: ${unverifiedCount}\n`;
  md += `- Total Claims: ${review.claims.length}\n`;
  
  return md;
}

/**
 * Export document to HTML with citations
 */
export function exportToHTML(review: DocumentReview, citationStyle: CitationStyle = 'apa'): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${review.title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1, h2, h3, h4, h5, h6 { color: #333; margin-top: 1.5em; }
    .claim-verified { background-color: #d4edda; border-left: 4px solid #28a745; padding: 2px 4px; }
    .claim-disputed { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 2px 4px; }
    .claim-unverified { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 2px 4px; }
    .footnote { font-size: 0.9em; color: #666; margin-top: 1em; }
    .citation { margin-left: 20px; margin-bottom: 5px; }
    .toc { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .summary { background: #e7f3ff; padding: 15px; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>${review.title}</h1>
  <p><em>Document Review - Generated ${new Date(review.createdAt).toLocaleString()}</em></p>
`;
  
  // Table of Contents
  if (review.sections.length > 0) {
    html += `  <div class="toc"><h2>Table of Contents</h2><ul>\n`;
    for (const section of review.sections) {
      html += `    <li><a href="#${section.title.toLowerCase().replace(/\s+/g, '-')}">${section.title}</a></li>\n`;
    }
    html += `  </ul></div>\n`;
  }
  
  // Sections
  let footnoteCounter = 1;
  const footnotes: string[] = [];
  const claimToFootnote = new Map<string, number>();
  
  for (const section of review.sections) {
    html += `  <section id="${section.title.toLowerCase().replace(/\s+/g, '-')}">\n`;
    html += `    <h${section.level + 1}>${section.title}</h${section.level + 1}>\n`;
    
    let sectionContent = section.content;
    const sectionClaims = review.claims.filter(c => c.section === section.title);
    
    for (const claim of sectionClaims) {
      const claimIndex = sectionContent.indexOf(claim.text);
      if (claimIndex >= 0) {
        if (!claimToFootnote.has(claim.id)) {
          claimToFootnote.set(claim.id, footnoteCounter);
          
          const statusClass = `claim-${claim.verification.status}`;
          footnotes.push(`    <div class="footnote" id="fn${footnoteCounter}">
      <sup>${footnoteCounter}</sup> <span class="${statusClass}">${claim.text}</span><br>
`);
          
          for (const source of claim.verification.sources.slice(0, 3)) {
            footnotes.push(`      <div class="citation">${formatCitation(source, citationStyle)}</div>\n`);
          }
          
          footnotes.push(`    </div>\n`);
          footnoteCounter++;
        }
        
        const footnoteNum = claimToFootnote.get(claim.id)!;
        const statusClass = `claim-${claim.verification.status}`;
        sectionContent = sectionContent.replace(
          claim.text,
          `<span class="${statusClass}">${claim.text}<sup><a href="#fn${footnoteNum}">${footnoteNum}</a></sup></span>`
        );
      }
    }
    
    html += `    <p>${sectionContent.replace(/\n/g, '<br>')}</p>\n`;
    html += `  </section>\n`;
  }
  
  // Footnotes
  if (footnotes.length > 0) {
    html += `  <hr>\n  <h2>References</h2>\n`;
    html += footnotes.join('');
  }
  
  // Summary
  const verifiedCount = review.claims.filter(c => c.verification.status === 'verified').length;
  const disputedCount = review.claims.filter(c => c.verification.status === 'disputed').length;
  const unverifiedCount = review.claims.filter(c => c.verification.status === 'unverified').length;
  
  html += `  <div class="summary">
    <h2>Verification Summary</h2>
    <ul>
      <li>✅ Verified: ${verifiedCount}</li>
      <li>⚠️ Disputed: ${disputedCount}</li>
      <li>❓ Unverified: ${unverifiedCount}</li>
      <li>Total Claims: ${review.claims.length}</li>
    </ul>
  </div>
`;
  
  html += `</body>
</html>`;
  
  return html;
}

/**
 * Export document to file
 */
export async function exportDocument(
  review: DocumentReview,
  format: 'markdown' | 'html',
  outputPath: string,
  citationStyle: CitationStyle = 'apa'
): Promise<void> {
  let content: string;
  
  if (format === 'markdown') {
    content = exportToMarkdown(review, citationStyle);
  } else {
    content = exportToHTML(review, citationStyle);
  }
  
  await fs.writeFile(outputPath, content, 'utf-8');
}

