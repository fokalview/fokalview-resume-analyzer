export const READINESS_VERSION = 'sagittaiq-evidence-v2';
const string = { type: 'string' };
export const requirementSchema = {
  type: 'array', minItems: 0, maxItems: 50,
  items: { type: 'object', additionalProperties: false,
    required: ['id', 'requirement', 'jobQuote', 'importance', 'category'],
    properties: { id: string, requirement: string, jobQuote: string,
      importance: { type: 'string', enum: ['critical', 'core', 'preferred', 'unclear'] },
      category: { type: 'string', enum: ['responsibility', 'qualification', 'scope'] }
    }
  }
};
export const evaluationSchema = {
  type: 'array', minItems: 0, maxItems: 50,
  items: { type: 'object', additionalProperties: false,
    required: ['id', 'status', 'resumeQuote', 'reason', 'nextAction'],
    properties: { id: string, status: { type: 'string', enum: ['demonstrated', 'partial', 'transferable', 'mentioned', 'not-evidenced', 'unclear', 'unmet'] }, resumeQuote: string, reason: string, nextAction: string }
  }
};

// Quotes establish provenance, not semantic correctness. The model's interpretation
// still requires evaluation against human-reviewed examples before broad release.
export function assessReadiness(requirements, evaluations, resumeText, jobContext) {
  const seen = new Set();
  let invalid = false;
  const rows = [];
  const ids = new Set();
  for (const item of requirements) {
    if (!item.id.trim() || ids.has(item.id)) { invalid = true; continue; }
    ids.add(item.id);
    const key = item.requirement.trim().toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!item.jobQuote.trim() || !jobContext.includes(item.jobQuote)) { invalid = true; continue; }
    const matches = evaluations.filter(value => value.id === item.id);
    const evaluation = matches.length === 1 ? matches[0] : null;
    let status = evaluation?.status || 'unclear';
    const quote = evaluation?.resumeQuote || '';
    const verified = !!quote.trim() && resumeText.includes(quote);
    if (status !== 'not-evidenced' && status !== 'unclear' && !verified) status = 'unclear';
    rows.push({ ...item, status, resumeQuote: verified ? quote : '',
      reason: status === 'unclear' && (!evaluation || !verified) ? 'The supplied materials do not contain verified evidence sufficient for this finding.' : evaluation.reason,
      nextAction: evaluation?.nextAction || 'Clarify this requirement and supply a relevant example, if available.' });
  }
  const essential = rows.filter(item => item.importance === 'core' || item.importance === 'critical');
  const counts = Object.fromEntries(['demonstrated', 'partial', 'transferable', 'mentioned', 'not-evidenced', 'unclear', 'unmet'].map(status => [status, rows.filter(item => item.status === status).length]));
  const unknown = essential.filter(item => ['unclear', 'mentioned', 'not-evidenced'].includes(item.status)).length;
  const supported = essential.filter(item => ['demonstrated', 'partial', 'transferable'].includes(item.status)).length;
  const critical = essential.filter(item => item.importance === 'critical' && item.status !== 'demonstrated');
  let level = 'More information needed';
  let explanation = 'Clarify the missing evidence before drawing a readiness conclusion.';
  if (!invalid && essential.some(item => item.category === 'responsibility') && unknown <= essential.length / 2) {
    if (essential.every(item => item.status === 'demonstrated') && !rows.some(item => item.importance === 'unclear')) {
      level = 'Strong alignment'; explanation = 'Evidence supports all extracted core and critical requirements, including the stated scope.';
    } else if (critical.some(item => item.status === 'unmet') || supported < essential.length / 2) {
      level = 'Significant gaps'; explanation = 'The evidence indicates important gaps in the core work or an explicitly required qualification.';
    } else {
      level = 'Promising alignment'; explanation = 'Relevant evidence supports substantial core work; review partial matches and unresolved requirements.';
    }
  }
  return { version: READINESS_VERSION, level, explanation, requirements: rows, counts,
    criticalUnresolved: critical.length, assessed: rows.filter(item => ['demonstrated','partial','transferable','unmet'].includes(item.status)).length,
    total: rows.length, extractionIncomplete: invalid };
}

export function normalizeReadiness(value) {
  if (!value || value.version !== READINESS_VERSION || !Array.isArray(value.requirements)) return undefined;
  const clean = text => String(text || '').slice(0, 2000);
  // Recompute the outcome on save rather than trusting client-supplied counts/level.
  const requirements = value.requirements.slice(0, 50).filter(item => item && typeof item === 'object').map((item, index) => ({
    id: String(index), requirement: clean(item.requirement), jobQuote: clean(item.jobQuote),
    importance: ['critical','core','preferred','unclear'].includes(item.importance) ? item.importance : 'unclear',
    category: ['responsibility','qualification','scope'].includes(item.category) ? item.category : 'qualification',
    status: ['demonstrated','partial','transferable','mentioned','not-evidenced','unclear','unmet'].includes(item.status) ? item.status : 'unclear',
    resumeQuote: clean(item.resumeQuote), reason: clean(item.reason), nextAction: clean(item.nextAction)
  }));
  const result = assessReadiness(requirements, requirements, requirements.map(item => item.resumeQuote).join('\n'), requirements.map(item => item.jobQuote).join('\n'));
  if (value.extractionIncomplete) { result.extractionIncomplete = true; result.level = 'More information needed'; result.explanation = 'Some job requirements could not be verified against the source. Review the posting before relying on this assessment.'; }
  return result;
}
