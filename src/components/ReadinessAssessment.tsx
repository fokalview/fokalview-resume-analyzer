import type { Readiness } from '../types';

export function ReadinessSummary({value}: {value: Readiness}) {
  return <section className="readiness-summary" aria-label="Job readiness assessment">
    <p className="eyebrow">Evidence-based readiness</p>
    <h2>{value.level}</h2>
    <p>{value.explanation}</p>
    <div className="readiness-counts">
      <span><strong>{value.counts.demonstrated || 0}</strong> demonstrated</span>
      <span><strong>{(value.counts.partial || 0) + (value.counts.transferable || 0)}</strong> partial or transferable</span>
      <span><strong>{value.criticalUnresolved}</strong> critical checks unresolved</span>
    </div>
    <p>{value.assessed} of {value.total} extracted requirements have evidence sufficient to assess.</p>
    <small>This assessment describes the supplied evidence for this job. It does not predict hiring decisions. Missing evidence does not establish lack of ability.</small>
  </section>;
}

export function RequirementEvidence({value}: {value: Readiness}) {
  return <section className="requirement-evidence" aria-label="Requirement evidence">
    <h2>Requirements and evidence</h2>
    {!value.requirements.length && <p>Add a complete job description to establish the requirements for this review.</p>}
    {['critical','core','preferred','unclear'].map(importance => {
      const rows = value.requirements.filter(item => item.importance === importance);
      return rows.length ? <section key={importance}><h3>{({critical:'Critical checks',core:'Core work and qualifications',preferred:'Preferred qualifications',unclear:'Importance to clarify'})[importance]}</h3>
        {rows.map((item,index) => <details className="requirement-card" key={`${item.id}-${index}`}>
          <summary><span>{item.requirement}</span><strong>{item.status.replaceAll('-', ' ')}</strong></summary>
          <div><p>{item.reason}</p><p><strong>Job posting:</strong> {item.jobQuote}</p>
            <p><strong>Your evidence:</strong> {item.resumeQuote || 'No verified excerpt available.'}</p>
            <p><strong>Next action:</strong> {item.nextAction}</p></div>
        </details>)}
      </section> : null;
    })}
  </section>;
}
