export function fieldLabel(key: string): string;
export function displayValue(value: unknown): string;
export function flattenRecord(record: Record<string, unknown>): Record<string, string | number>;
export function csvForRecords(records: Record<string, unknown>[]): string;
