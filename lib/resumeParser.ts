import type { ResumeData } from '@/types';

/**
 * Parse a PDF resume file into structured data.
 */
export async function parseResumePDF(file: File, jobProfile?: string): Promise<ResumeData> {
  const arrayBuffer = await file.arrayBuffer();

  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
  }

  const structured = await extractStructuredResume(fullText, jobProfile);
  return { ...structured, rawText: fullText };
}

/**
 * Call the Gemini API route to extract structured resume fields.
 */
async function extractStructuredResume(
  text: string,
  jobProfile?: string
): Promise<Omit<ResumeData, 'rawText'>> {
  const roleContext = jobProfile && jobProfile !== 'Other' 
    ? `Evaluate the resume strength specifically for a "${jobProfile}" role.` 
    : 'Evaluate the resume strength for a software engineering role.';

  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'parse_resume',
      content: text,
      instruction: `Extract structured JSON from this resume. Return ONLY valid JSON with these exact keys:
{
  "name": "string",
  "email": "string",
  "skills": ["string", "string"],
  "experience": [{"company": "string", "role": "string", "duration": "string", "bullets": ["string"]}],
  "education": [{"institution": "string", "degree": "string", "year": "string"}],
  "projects": [{"name": "string", "description": "string", "tech": ["string"]}],
  "rating": 0,
  "suggestions": "string"
}

Rating criteria (1-10 scale):
1. Impact metrics: Does the resume quantify achievements? (revenue, users, performance improvements)
2. Technical depth: Are technologies and methodologies described with specificity?
3. Clarity & structure: Is it well-organized, concise, and free of jargon overload?
4. Role relevance: ${roleContext}
5. Project quality: Do projects demonstrate practical, real-world problem solving?

Suggestions: Provide 2-3 brief, specific, actionable improvement suggestions.

If any field is missing from the resume, use reasonable defaults (empty arrays, empty strings).
Return ONLY the JSON object, no markdown fences.`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resume parsing failed: ${response.statusText}`);
  }

  const data = await response.json();

  try {
    const parsed = JSON.parse(data.text);
    // Ensure rating is a number
    if (parsed.rating && typeof parsed.rating === 'string') {
      parsed.rating = parseFloat(parsed.rating) || undefined;
    }
    return parsed;
  } catch {
    const jsonMatch = data.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.rating && typeof parsed.rating === 'string') {
        parsed.rating = parseFloat(parsed.rating) || undefined;
      }
      return parsed;
    }
    throw new Error('Could not parse structured resume from Gemini response');
  }
}
