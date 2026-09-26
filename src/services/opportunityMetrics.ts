// Shared display buckets: detailed statuses remain unchanged in storage.
export function opportunityStage(status: string) {
 const value=status.toLowerCase();
 if(value.includes('accept')) return 'Accepted';
 if(value.includes('offer')) return 'Offer';
 if(value.includes('interview') || value.includes('screen')) return 'Interviewing';
 if(value==='applied') return 'Applied';
 if(['interested','researching','applying'].includes(value)) return 'Interested';
 return status;
}
