// AI-Powered Syllabus Parser Service for Intelligent Chapter & Structure Extraction
// Strictly grounded in uploaded PDF document text. Never invents syllabus content.

import { SubjectType, ChapterContentBoundary } from '../types';

export interface ParsedSyllabus {
  chapters: string[];
  rawText: string;
  boundaries?: Record<string, ChapterContentBoundary>;
}

export interface ExtractedTocEntry {
  chapterNumber?: number;
  chapterTitle: string;
  startPage?: number;
  endPage?: number;
}

/**
 * Cleans and normalizes extracted PDF text
 * Removes artifacts, unescapes characters, and normalizes whitespace
 */
export function cleanExtractedText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\([()\\])/g, '$1') // Unescape escaped parentheses
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs
    .replace(/\n\s*\n\s*\n+/g, '\n\n') // Limit consecutive newlines
    .trim();
}

/**
 * Identifies whether a string is normal textbook prose rather than a chapter heading.
 * Prevents splitting sentences like "A rational number can be written in the form p/q, where p and q are integers."
 */
export function isProseSentence(str: string): boolean {
  const s = str.trim();
  if (!s) return true;

  // Ends with punctuation typical of sentences (. ? ;)
  if (/[.?;]$/.test(s)) return true;

  // Starts with a lowercase letter
  if (/^[a-z]/.test(s)) return true;

  // Word count check: chapter titles are rarely longer than 9 words
  const words = s.split(/\s+/);
  if (words.length > 9) return true;

  // Subordinate clauses, explanatory prose, and textbook statement markers
  const proseMarkers = [
    /\b(which is|where |such that|can be written|in the form|has two factors|is a prime|are called|is defined as)\b/i,
    /\b(we have|we know that|for example|let us|suppose that|therefore|because|since|if and only if|it follows that)\b/i,
    /\b(is|are|was|were|has|have|had|can|could|will|would|should|may|might)\s+(a|an|the|written|defined|known|called|expressed|given|used|found|seen|equal)\b/i,
    /^[•\-\*]?\s*(?:and|or|but|because|although|however|meanwhile|moreover|thus)\b/i,
    /\b(?:p\/q|f\(x\)|dy\/dx|sin\s*θ|cos\s*θ)\b/i
  ];

  return proseMarkers.some(pattern => pattern.test(s));
}

/**
 * Cleans chapter title by stripping noise, chapter prefixes, and formatting properly
 */
export function cleanChapterTitle(rawTitle: string): string {
  let clean = rawTitle
    // Strip trailing period counts, marks, hours, weightage etc.
    // e.g. "(15) Periods", "(15 Periods)", "(15 Periods, 6 Marks)", "[15 Periods]", "15 Periods"
    .replace(/\s*[\(\[\{]?\s*(?:no\.?\s*of\s*)?\d+\s*[\)\]\}]?\s*(?:periods?|marks?|hours?|hrs?|pts?)\b.*$/i, '')
    .replace(/\s*[\(\[\{]\s*(?:no\.?\s*of\s*)?(?:periods?|marks?|hours?|hrs?|pts?)\s*[:=]?\s*\d+.*$/i, '')
    .replace(/\s*\(\s*\d+\s*(?:periods?|marks?|hours?|hrs?)[^)]*\)\s*$/i, '')
    .replace(/\s*[-–—:]\s*\d+\s*(?:periods?|marks?|hours?|hrs?)\b.*$/i, '')
    .replace(/\s+\d{1,2}\s+(?:marks?|periods?)\s*$/i, '')
    .replace(/\s*\(?\d+\s*(?:marks?|periods?|hours?|hrs?|pts?)\)?\s*$/i, '')
    .replace(/\s+\d{1,2}\s*$/, '') // trailing marks in syllabus tables like "I NUMBER SYSTEMS 06"
    // Strip leading chapter/unit prefixes
    .replace(/^(?:chapter|unit|module|lesson|part|theme)\s*(?:[0-9]+|[ivx]+)?\s*[:.,\-–—\u2500\u2014\u2015]*\s*/i, '')
    .replace(/^section\s+(?:[0-9]+|[ivx]+|[a-e])\s*[:.,\-–—\u2500\u2014\u2015]*\s*/i, '')
    .replace(/^(?:[0-9]{1,2}|[IVX]{1,5})\s*[\.\)\]\-–—\u2500\u2014\u2015:,]+\s*/i, '')
    .replace(/^(?:[0-9]{1,2}|[IVX]{1,5})\s+([A-Z])/i, '$1')
    .replace(/^[•\-\*▪►\uF0B7\u2022\u25E6\u25AA\u25CF\u2023·\s]+/, '')
    .replace(/[:.,\-–—\u2500\u2014\u2015]+$/, '')
    .trim();

  // If uppercase, capitalize words nicely
  if (clean === clean.toUpperCase() && clean.length > 4) {
    clean = clean
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return clean;
}

/**
 * Splits inline chapter strings like "Quadratic , 2 - Integration,3- Statistic, 4- Probability"
 * into distinct individual chapter title candidates.
 * Preserves compound chapter names like "2 ── Acids, Bases and Salts".
 */
export function splitInlineChapters(text: string): string[] {
  if (!text || !text.trim()) return [];
  const trimmed = text.trim();

  // Case 1: Line contains multiple numbered items (e.g. "Quadratic , 2 - Integration,3- Statistic, 4- Probability")
  const hasMultipleNumbers = /(?:^|[,;])\s*(?:(?:chapter|unit)?\s*\d+\s*[-–—\u2500\.:\)]\s*|\b\d+\s*[-–—\u2500\.:\)]\s*)/gi;
  const numMatches = trimmed.match(hasMultipleNumbers);
  if (numMatches && numMatches.length >= 2) {
    const numberedSplit = trimmed.split(/(?:^|[,;])\s*(?:(?:chapter|unit)?\s*\d+\s*[-–—\u2500\.:\)]\s*|\b\d+\s*[-–—\u2500\.:\)]\s*)/i);
    const valid = numberedSplit.map(s => cleanChapterTitle(s)).filter(s => s.length >= 3);
    if (valid.length >= 2) {
      return valid;
    }
  }

  // Case 2: Line starts with a single chapter number or prefix (e.g. "2 ── Acids, Bases and Salts")
  // Do NOT split commas here because commas inside chapter titles are valid
  if (/^\s*(?:(?:chapter|unit|module|lesson)\s*(?:[0-9]+|[ivx]+)?\s*[:.,\-–—\u2500\u2014\u2015]*|(?:[0-9]{1,2}|[IVX]{1,5})\s*[\.\)\]\-–—\u2500\u2014\u2015:,]*|[0-9]{1,2}\s+[A-Z])/i.test(trimmed)) {
    return [trimmed];
  }

  // Case 3: Comma-separated list of short chapter titles (e.g. "Quadratic, Integration, Statistics, Probability")
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(s => cleanChapterTitle(s)).filter(Boolean);
    // Don't split single chapter titles like "Acids, Bases and Salts" or "Light, Reflection and Refraction"
    const hasConjunction = /\b(and|&)\b/i.test(trimmed);
    const minParts = hasConjunction ? 3 : 2;
    if (parts.length >= minParts) {
      if (parts.every(p => p.length >= 3 && p.length <= 40 && !isProseSentence(p))) {
        return parts;
      }
    }
  }

  return [trimmed];
}

/**
 * Detects and extracts structured Table of Contents (TOC) if present in the document.
 * Returns chapter titles, numbers, and page references strictly from the TOC block.
 */
export function extractTableOfContents(lines: string[]): { entries: ExtractedTocEntry[]; tocEndIndex: number } {
  const entries: ExtractedTocEntry[] = [];
  const seen = new Set<string>();

  // Look for TOC Header
  let tocStartIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const line = lines[i].replace(/[:\-–—\s]+$/, '').trim();
    if (/^(?:table\s+of\s+contents|contents|index|syllabus\s+outline|table\s+des\s+matières|course\s+structure|units\s*&\s*chapters)$/i.test(line)) {
      tocStartIndex = i + 1;
      break;
    }
  }

  if (tocStartIndex === -1) {
    return { entries: [], tocEndIndex: -1 };
  }

  let tocEndIndex = Math.min(lines.length, tocStartIndex + 50);

  // Scan lines within the TOC block
  for (let i = tocStartIndex; i < tocEndIndex; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Stop if we hit subsequent major body headers e.g. "Chapter 1" after at least 4 items
    if (/^(?:chapter\s+1\b|unit\s+1\b|part\s+1\b|lesson\s+1\b)/i.test(line) && entries.length >= 3) {
      tocEndIndex = i;
      break;
    }

    // Pattern A: "Chapter 1: Number Systems ........ 1-15" or "1. Number Systems ..... 1"
    const dottedMatch = line.match(/^(?:chapter|unit|lesson)?\s*([0-9]{1,2}|[IVX]{1,5})?[\.\:\)\-–—]?\s*(.+?)(?:[\.\s\-_~]{2,}|\s+p(?:age|\.)?\s*|\s+)(\d{1,3})(?:\s*[-–—]\s*\d{1,3})?\s*$/i);
    if (dottedMatch) {
      const numStr = dottedMatch[1];
      const titleCandidate = dottedMatch[2].replace(/[\.\-_~]+$/, '').trim();
      const pageStr = dottedMatch[3];

      if (!isProseSentence(titleCandidate) && titleCandidate.length >= 3 && titleCandidate.length <= 60) {
        const cleaned = cleanChapterTitle(titleCandidate);
        const norm = cleaned.toLowerCase();
        if (!seen.has(norm) && cleaned.length >= 3) {
          seen.add(norm);
          entries.push({
            chapterNumber: numStr ? parseInt(numStr, 10) : undefined,
            chapterTitle: cleaned,
            startPage: pageStr ? parseInt(pageStr, 10) : undefined
          });
        }
        continue;
      }
    }

    // Pattern B: "Chapter 1 — Number Systems" or "1. Polynomials"
    const cleanLineMatch = line.match(/^(?:chapter|unit|lesson)\s*([0-9]{1,2}|[IVX]{1,5})?\s*[:\-–—,]\s*([A-Za-z][A-Za-z0-9\s&'\-–—]{2,55})$/i)
      || line.match(/^([0-9]{1,2})\.\s+([A-Za-z][A-Za-z0-9\s&'\-–—]{2,55})$/);
    if (cleanLineMatch) {
      const titleCandidate = cleanLineMatch[2].trim();
      if (!isProseSentence(titleCandidate) && titleCandidate.length >= 3) {
        const cleaned = cleanChapterTitle(titleCandidate);
        const norm = cleaned.toLowerCase();
        if (!seen.has(norm) && cleaned.length >= 3) {
          seen.add(norm);
          entries.push({
            chapterNumber: cleanLineMatch[1] ? parseInt(cleanLineMatch[1], 10) : undefined,
            chapterTitle: cleaned
          });
        }
      }
    }
  }

  return { entries, tocEndIndex };
}

/**
 * Extracts chapters strictly present in the uploaded document text.
 * The uploaded PDF is the primary source of truth.
 * NEVER adds chapters from external curriculum memory when document text is provided.
 */
export function extractChaptersFromText(text: string, subject?: SubjectType): string[] {
  // If no text was provided at all (cold start without file upload)
  if (!text || !text.trim()) {
    return [];
  }

  const cleaned = cleanExtractedText(text);
  const chapters: string[] = [];
  const seen = new Set<string>();

  // Filter out syllabus metadata, boilerplate, and instructions
  const metadataPatterns = [
    /\b(marks|weightage|weight|question paper|paper design|time allowed|maximum marks|max marks|total marks)\b/i,
    /\b(prescribed books?|reference books?|recommended books?|textbook|author|publisher|published by)\b/i,
    /\b(course structure|course overview|learning outcomes|learning objectives|curriculum structure|general objectives)\b/i,
    /\b(internal assessment|external examination|theory paper|practical examination|project work|lab work|viva)\b/i,
    /\b(evaluation scheme|assessment scheme|guidelines|general instructions|blueprint|design of question)\b/i,
    /\b(syllabus \d{4}|\bclass\s*[-–:]*\s*(?:ix|x|xi|xii|\d+)\b)/i,
    /\b(duration|hours|minutes|mins|periods?|term\s*[12i]+|semester\s*[12i]+)\b/i,
    /\b(all questions are compulsory|general instructions|section [a-e]\s*contains)\b/i,
    /^page\s*\d+/i,
    /^[-_=\s*#~]+$/,
    /^\d+\s*$/,
    /^[ivxlcdm]+\s*$/i
  ];

  const tryAddChapter = (rawTitle: string): boolean => {
    const raw = rawTitle.trim();
    if (raw.length < 3 || raw.length > 90) return false;

    // Skip noise/artifacts
    if (/^(obj|endobj|xref|trailer|startxref|stream|endstream|PDF-\d|filter|flatedecode)/i.test(raw)) return false;

    // Skip lines that are purely metadata headers or instructions
    if (/^(?:time allowed|maximum marks|max marks|total marks|prescribed books?|reference books?|evaluation scheme|course structure|course overview|learning outcomes|internal assessment|external examination|theory paper|practical examination|assessment scheme|guidelines|general instructions|blueprint|design of question paper|all questions are compulsory|page\s*\d+|[-_=\s*#~]+|\d+|[ivxlcdm]+)$/i.test(raw)) {
      return false;
    }

    const clean = cleanChapterTitle(raw);
    if (clean.length < 3 || clean.length > 65) return false;
    if (/^[\d\W_]+$/.test(clean)) return false;
    if (metadataPatterns.some(pattern => pattern.test(clean))) return false;
    if (isProseSentence(clean)) return false;

    const normalized = clean.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);

    chapters.push(clean);
    return true;
  };

  const rawLines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const inlines = splitInlineChapters(rawLine);
    lines.push(...inlines);
  }

  // =========================================================================
  // STAGE 1: Table of Contents (TOC) Extraction First
  // =========================================================================
  const { entries: tocEntries, tocEndIndex } = extractTableOfContents(lines);
  if (tocEntries.length > 0) {
    const bodyAfterToc = lines.slice(tocEndIndex > 0 ? tocEndIndex : 0).join('\n').toLowerCase();
    const verifiedTocChapters: string[] = [];

    for (const entry of tocEntries) {
      const titleLower = entry.chapterTitle.toLowerCase();
      // Verify chapter appears in document body (outside of TOC if multi-page/long)
      if (bodyAfterToc.length > 200) {
        if (bodyAfterToc.includes(titleLower)) {
          verifiedTocChapters.push(entry.chapterTitle);
        }
      } else {
        // Short/outline document: TOC entries are the document chapters
        verifiedTocChapters.push(entry.chapterTitle);
      }
    }

    if (verifiedTocChapters.length >= 2) {
      return verifiedTocChapters;
    }
  }

  // =========================================================================
  // STAGE 2: Two-Line Chapter Heading Consolidation
  // Example:
  // Line i:   "Chapter 1"
  // Line i+1: "Number Systems"
  // =========================================================================
  for (let i = 0; i < lines.length - 1; i++) {
    const current = lines[i];
    const next = lines[i + 1];

    if (/^\s*(?:chapter|unit|lesson|module|part)\s*(?:[0-9]+|[ivx]+)?\s*[:.,\-–—\u2500\u2014\u2015]?\s*$/i.test(current)) {
      if (next && !isProseSentence(next) && next.length >= 3 && next.length <= 60) {
        if (!metadataPatterns.some(p => p.test(next))) {
          if (tryAddChapter(next)) {
            i++; // Skip next line since it was consumed as the title
          }
        }
      }
    }
  }

  // =========================================================================
  // STAGE 3: Underline Heading Detection
  // Example:
  // "Chemical Reactions and Equations"
  // "--------------------------------"
  // =========================================================================
  for (let i = 0; i < lines.length - 1; i++) {
    const current = lines[i];
    const next = lines[i + 1];
    if (/^[-=~_]{3,35}$/.test(next) && !isProseSentence(current)) {
      tryAddChapter(current);
    }
  }

  if (chapters.length >= 2) {
    return chapters;
  }

  // =========================================================================
  // STAGE 4: Single-Line Explicit Numbered Chapter Patterns
  // Handles: "1 ── Chemical Reactions and Equations", "1 Real Numbers", "Chapter 1: Real Numbers"
  // =========================================================================
  const numberedPatterns = [
    /^\s*(?:chapter|unit|module|lesson|section|part|theme)\s*(?:[0-9]+|[ivx]+)?\s*[:.,\-–—\u2500\u2014\u2015\s]+\s*(.+)$/i,
    /^\s*(?:[0-9]{1,2}|[IVX]{1,5})\s*[\.\)\]\-–—\u2500\u2014\u2015:,]+\s*(.+)$/i,
    /^\s*(?:[0-9]{1,2})\s+([A-Z][A-Za-z0-9\s,\-–—&'()]{2,60})\s*$/,
    /^\s*(?:[IVX]{1,5})\s+([A-Za-z][A-Za-z0-9\s,\-–—&']{3,60})\s*$/i
  ];

  for (const line of lines) {
    let matchedTitle = '';
    for (const pattern of numberedPatterns) {
      const match = line.match(pattern);
      if (match) {
        matchedTitle = (match[1] || match[0]).trim();
        break;
      }
    }

    if (matchedTitle) {
      tryAddChapter(matchedTitle);
    }

    if (chapters.length >= 25) break;
  }

  // If numbered chapters were found, return them directly.
  // In syllabi with numbered chapters and bulleted sub-topics (e.g. PDF 2),
  // do NOT treat bullet sub-topics as separate chapters.
  if (chapters.length >= 2) {
    return chapters;
  }

  // =========================================================================
  // STAGE 5: Bullet Patterns (if no numbered chapters found)
  // =========================================================================
  for (const line of lines) {
    const bulletMatch = line.match(/^\s*[•\-\*▪►\uF0B7\u2022\u25E6\u25AA\u25CF\u2023·]\s+([A-Z][A-Za-z0-9\s,\-–—&']{3,60})$/);
    if (bulletMatch) {
      tryAddChapter(bulletMatch[1]);
    }
    if (chapters.length >= 25) break;
  }

  if (chapters.length >= 2) {
    return chapters;
  }

  // =========================================================================
  // STAGE 6: Clean Non-Prose Chapter Lines (e.g. from splitInlineChapters)
  // =========================================================================
  for (const line of lines) {
    if (!isProseSentence(line) && line.length >= 3 && line.length <= 60) {
      tryAddChapter(line);
    }
    if (chapters.length >= 25) break;
  }

  if (chapters.length >= 2) {
    return chapters;
  }

  // =========================================================================
  // STAGE 7: Explicit List Extraction ("Chapters: Real Numbers, Polynomials...")
  // =========================================================================
  if (chapters.length === 0) {
    for (const line of lines) {
      const listMatch = line.match(/^(?:chapters?|units?|topics?\s*covered|syllabus\s*contents?)\s*[:\-]\s*(.+)$/i);
      if (listMatch) {
        const items = listMatch[1].split(',').map(s => s.trim());
        if (items.length >= 2 && items.every(item => item.length <= 40 && !isProseSentence(item))) {
          items.forEach(it => tryAddChapter(it));
        }
      }
    }
  }

  // =========================================================================
  // STAGE 8: Domain-Grounded Subject Chapter Recovery
  // If fewer than 2 chapters were detected (e.g. complex PDF tables or non-standard formatting),
  // scan for verified chapters physically mentioned in the uploaded document text.
  // =========================================================================
  if (chapters.length < 2) {
    const mathChapters = [
      'Real Numbers', 'Number Systems', 'Polynomials', 'Linear Equations',
      'Pair of Linear Equations in Two Variables', 'Quadratic Equations',
      'Arithmetic Progressions', 'Triangles', 'Coordinate Geometry',
      'Introduction to Trigonometry', 'Trigonometry', 'Trigonometric Identities',
      'Some Applications of Trigonometry', 'Heights and Distances', 'Circles',
      'Constructions', 'Areas Related to Circles', 'Surface Areas and Volumes',
      'Statistics', 'Probability', 'Sets', 'Relations and Functions',
      'Inverse Trigonometric Functions', 'Matrices', 'Determinants',
      'Continuity and Differentiability', 'Integrals', 'Differential Equations',
      'Vector Algebra', 'Three Dimensional Geometry', 'Linear Programming'
    ];
    const candidateList = (!subject || subject === 'Mathematics') ? mathChapters : [];
    for (const cand of candidateList) {
      const reg = new RegExp(`\\b${cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (reg.test(cleaned)) {
        tryAddChapter(cand);
      }
    }
  }

  // The PDF is the sole source of truth. Return ONLY what was verified.
  return chapters;
}

/**
 * Extracts topics from a specific chapter's text content slice
 * Never creates generic fake strings; extracts actual subheadings or concepts from the text
 */
export function extractTopicsFromContentSlice(
  contentSlice: string,
  chapterName: string
): string[] {
  if (!contentSlice) return [chapterName];

  const lines = contentSlice.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const topics: string[] = [];
  const seen = new Set<string>();

  // Look for subheadings:
  // e.g. "1.1 Euclid's Division Lemma", "Section 2.3: Types of Chemical Reactions", " Fundamental Theorem of Arithmetic"
  const subHeadingPatterns = [
    /^(?:[0-9]{1,2}\.[0-9]{1,2}(?:\.[0-9]{1,2})?)\s*[:\-–—\u2500\u2014\u2015]?\s*(.+)$/,
    /^(?:sub-?topic|section)\s*[0-9A-Z\.]*[:\-–—\u2500\u2014\u2015]\s*(.+)$/i,
    /^[\uF0B7•\-\*▪►\u2022\u25E6\u25AA\u25CF\u2023·]\s*([A-Za-z0-9][A-Za-z0-9\s,\-–—&'()]{2,65})$/,
    /^([A-Z][A-Za-z0-9\s,\-–—&']{4,55}):\s*$/
  ];

  for (const line of lines) {
    if (line.toLowerCase().includes(chapterName.toLowerCase()) && line.length < chapterName.length + 15) {
      continue;
    }

    for (const pattern of subHeadingPatterns) {
      const match = line.match(pattern);
      if (match) {
        const candidate = cleanChapterTitle(match[1] || match[0]);
        if (candidate.length >= 3 && candidate.length <= 65 && !isProseSentence(candidate)) {
          const norm = candidate.toLowerCase();
          if (!seen.has(norm) && norm !== chapterName.toLowerCase()) {
            seen.add(norm);
            topics.push(candidate);
          }
        }
        break;
      }
    }
    if (topics.length >= 10) break;
  }

  // If no numbered subheadings found, search prominent capitalized concept lines
  if (topics.length < 2) {
    for (const line of lines) {
      if (line.length >= 5 && line.length <= 50 && /^[A-Z]/.test(line)) {
        if (!isProseSentence(line) && !line.includes(':') && !/\b(chapter|unit|page|marks)\b/i.test(line)) {
          const clean = cleanChapterTitle(line);
          const norm = clean.toLowerCase();
          if (clean.length >= 4 && !seen.has(norm) && norm !== chapterName.toLowerCase()) {
            seen.add(norm);
            topics.push(clean);
            if (topics.length >= 6) break;
          }
        }
      }
    }
  }

  // If still fewer than 2 topics, extract key sentences / definitions
  if (topics.length < 2) {
    const paragraphs = contentSlice.split(/\n\s*\n/).filter(p => p.trim().length > 30);
    for (const p of paragraphs.slice(0, 4)) {
      const firstSentence = p.split(/[.?!]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 10 && firstSentence.length < 50) {
        const title = cleanChapterTitle(firstSentence);
        if (!seen.has(title.toLowerCase()) && title.toLowerCase() !== chapterName.toLowerCase()) {
          seen.add(title.toLowerCase());
          topics.push(title);
        }
      }
    }
  }

  return topics.length > 0 ? topics : [chapterName];
}

/**
 * Computes exact boundaries and content slices for all detected chapters within the document text.
 */
export function getChapterBoundaries(
  text: string,
  chapters: string[],
  subject: SubjectType
): Record<string, ChapterContentBoundary> {
  const boundaries: Record<string, ChapterContentBoundary> = {};
  if (!text || !chapters || chapters.length === 0) return boundaries;

  const lowerText = text.toLowerCase();
  const chapterOffsets: { chapterName: string; index: number; originalIndex: number }[] = [];

  chapters.forEach((ch, idx) => {
    const chLower = ch.toLowerCase();
    let matchIdx = -1;

    // Search for heading occurrence
    const headingRegex = new RegExp(`(?:chapter|unit|section|\\n|^|\\d+[\\.\\)\\-–—\\u2500\\u2014\\u2015]*)\\s*[:\\-–—\\u2500\\u2014\\u2015]*\\s*${chLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    const match = lowerText.match(headingRegex);
    if (match && match.index !== undefined) {
      matchIdx = match.index;
    } else {
      matchIdx = lowerText.indexOf(chLower);
    }

    if (matchIdx !== -1) {
      chapterOffsets.push({
        chapterName: ch,
        index: matchIdx,
        originalIndex: idx
      });
    }
  });

  // Sort by appearance in text
  chapterOffsets.sort((a, b) => a.index - b.index);

  for (let i = 0; i < chapterOffsets.length; i++) {
    const current = chapterOffsets[i];
    const next = chapterOffsets[i + 1];
    const startOffset = current.index;
    const endOffset = next ? next.index : text.length;

    const slice = text.slice(startOffset, endOffset).trim();
    const extractedTopics = extractTopicsFromContentSlice(slice, current.chapterName);
    const chapterId = `ch_${subject.toLowerCase().slice(0, 3)}_${current.originalIndex + 1}`;

    boundaries[chapterId] = {
      chapterId,
      chapterName: current.chapterName,
      subject,
      startOffset,
      endOffset,
      topics: extractedTopics,
      contentSlice: slice.slice(0, 6000) // Keep bounded snippet for prompt & verification
    };
  }

  return boundaries;
}

/**
 * Extracts specific topics for a chapter, respecting its boundaries if available.
 */
export function extractTopicsForChapter(
  chapterName: string,
  chapterIndex: number,
  allChapters: string[],
  fullText: string
): string[] {
  if (!fullText) return [chapterName];

  const lowerText = fullText.toLowerCase();
  const lowerChap = chapterName.toLowerCase();
  const nextChap = allChapters[chapterIndex + 1]?.toLowerCase();

  const startIdx = lowerText.indexOf(lowerChap);
  const endIdx = nextChap ? lowerText.indexOf(nextChap, startIdx + lowerChap.length) : -1;

  const sectionText = startIdx !== -1
    ? fullText.slice(startIdx, endIdx !== -1 ? endIdx : startIdx + 8000)
    : fullText;

  return extractTopicsFromContentSlice(sectionText, chapterName);
}

/**
 * Main syllabus parsing function.
 * Orchestrates text cleaning, chapter extraction, and boundary slicing.
 */
export function parseSyllabusWithAI(
  rawText: string,
  subject?: SubjectType
): ParsedSyllabus {
  const cleaned = cleanExtractedText(rawText);
  const chapters = extractChaptersFromText(cleaned, subject);
  const boundaries = subject && chapters.length > 0
    ? getChapterBoundaries(cleaned, chapters, subject)
    : undefined;

  return {
    chapters,
    rawText: cleaned,
    boundaries
  };
}

/**
 * Fallback syllabus parse when no document was uploaded (cold start only)
 */
export function getFallbackSyllabusParse(subject: SubjectType): ParsedSyllabus {
  return {
    chapters: [],
    rawText: ''
  };
}
