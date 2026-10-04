import { resolveCodePayload, validatePayloadUri } from '../../core/payload';
import type { Dataset, LabelTemplate } from '../../types';
export function analyzeContent(text: string, dataset: Dataset | null, template: LabelTemplate) {
  if (!text.trim() || text.length > 2000) throw new Error('Enter nonempty content up to 2,000 characters.');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(text)?.[1].toLowerCase() ?? '';
  const issues: string[] = [];
  if (Array.from(text).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) issues.push('Content includes control characters or line breaks. Check the intended scanner behavior.');
  if (scheme) {
    if (['http', 'https', 'fieldlens', 'location'].includes(scheme)) {
      try { validatePayloadUri(text, scheme === 'fieldlens' ? 'fieldlens' : scheme === 'location' ? 'location' : 'url'); } catch (reason) { issues.push(reason instanceof Error ? reason.message : 'Invalid URI.'); }
    } else issues.push(`Unsupported URI scheme: ${scheme}. Content is displayed as text and never opened.`);
  }
  let matches = 0;
  for (const record of dataset?.records ?? []) { try { if (resolveCodePayload(record, template.code) === text) matches += 1; } catch { /* Invalid dataset rows are diagnosed on Data health. */ } }
  if (matches > 1) issues.push(`Duplicate payload: ${matches} rows in this dataset generate this code.`);
  return { length: text.length, scheme: scheme || 'Plain text', matches, issues };
}
