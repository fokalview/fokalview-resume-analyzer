// Reporting matches are exact references, not authentication or evidence of ownership.
// Public responses may attach to a saved group but can never merge signup groups.
export function recordMatchKeys(item) {
  return [
    item.leadId && `lead:${item.leadId}`,
    item.candidateId && `candidate:${item.candidateId}`,
    item.contactId && `contact:${item.contactId}`,
    item.email && `email:${String(item.email).trim().toLowerCase()}`,
    item.legacySignupHash && `signup-hash:${item.legacySignupHash}`,
    item.legacyFollowupHash && `followup-hash:${item.legacyFollowupHash}`
  ].filter(Boolean);
}

function primaryIdentity(item) {
  const keys = recordMatchKeys(item);
  return keys.find(key => key.startsWith('email:'))
    || keys.find(key => key.startsWith('signup-hash:') || key.startsWith('followup-hash:'))
    || keys[0];
}

export function buildSignupGroups(waitlist) {
  // Only saved signup aliases participate in this graph. This preserves a
  // hash-only → readable-email transition without trusting a public response.
  const parents = waitlist.map((_, index) => index);
  const firstForKey = new Map();
  function root(index) {
    while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; }
    return index;
  }
  waitlist.forEach((signup, index) => {
    for (const key of recordMatchKeys(signup)) {
      if (firstForKey.has(key)) parents[root(index)] = root(firstForKey.get(key));
      else firstForKey.set(key, index);
    }
  });
  const components = new Map();
  waitlist.forEach((signup, index) => {
    const key = root(index);
    if (!components.has(key)) components.set(key, []);
    components.get(key).push(signup);
  });
  const groups = [];
  for (const signups of components.values()) {
    const emails = new Set(signups.map(item => String(item.email || '').trim().toLowerCase()).filter(Boolean));
    const partitions = new Map();
    for (const signup of signups) {
      // A contradictory saved component is not permission to combine people.
      // Split it by known email; unknown records retain their own identity.
      const key = emails.size > 1 ? primaryIdentity(signup) || signup : signups;
      if (!partitions.has(key)) partitions.set(key, []);
      partitions.get(key).push(signup);
    }
    for (const partition of partitions.values()) groups.push({ signups: partition, responses: [], identifiable: partition.some(item => Boolean(primaryIdentity(item))), identityMatchStatus: 'matched' });
  }
  const byKey = new Map();
  for (const group of groups) for (const signup of group.signups) for (const key of recordMatchKeys(signup)) {
    if (!byKey.has(key)) byKey.set(key, new Set());
    byKey.get(key).add(group);
  }
  return { groups, byKey };
}

export function matchResponse(response, signupGroups) {
  const candidates = new Set(recordMatchKeys(response).flatMap(key => [...(signupGroups.byKey.get(key) || [])]));
  if (candidates.size > 1) return { status: 'needs_review', group: null };
  const group = [...candidates][0];
  if (!group) return { status: 'unmatched', group: null };
  for (const field of ['email', 'leadId', 'contactId', 'candidateId']) {
    const normalize = value => field === 'email' ? String(value || '').trim().toLowerCase() : String(value || '').trim();
    const supplied = normalize(response[field]);
    const known = new Set(group.signups.map(signup => normalize(signup[field])).filter(Boolean));
    if (supplied && known.size && !known.has(supplied)) return { status: 'needs_review', group: null };
  }
  return { status: 'matched', group };
}

export function buildContactCohort(waitlist, followups) {
  const signupGroups = buildSignupGroups(waitlist);
  const groups = [...signupGroups.groups];
  const standalone = new Map();
  for (const response of followups) {
    const match = matchResponse(response, signupGroups);
    if (match.group) {
      match.group.responses.push(response);
      continue;
    }
    // Ambiguous historic records remain visible individually, excluded from outcomes.
    const identity = match.status === 'needs_review' ? response : primaryIdentity(response) || response;
    let group = standalone.get(identity);
    if (!group) {
      group = { signups: [], responses: [], identifiable: match.status !== 'needs_review' && Boolean(primaryIdentity(response)), identityMatchStatus: match.status };
      standalone.set(identity, group);
      groups.push(group);
    }
    group.responses.push(response);
  }
  for (const group of groups) {
    group.responses.sort((left, right) => String(right.submittedAt || '').localeCompare(String(left.submittedAt || '')) || String(right.id || '').localeCompare(String(left.id || '')));
    group.latestResponse = group.responses[0] || null;
  }
  return { groups };
}
