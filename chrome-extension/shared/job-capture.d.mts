export type CapturedJob = {version: 1} & Record<'title'|'company'|'location'|'salary'|'employmentType'|'workplaceType'|'experience'|'education'|'description'|'companyBio'|'responsibilities'|'requirements'|'preferred'|'benefits'|'postedAt'|'deadline'|'url'|'source', string>;
export const FIELD_LIMITS: Record<string,number>;
export const HANDOFF_KEY: string;
export function normalizeJob(value: unknown): CapturedJob;
export function jobContext(value: unknown): string;
export function encodeJob(value: unknown): string;
export function decodeJob(value: string): CapturedJob;
