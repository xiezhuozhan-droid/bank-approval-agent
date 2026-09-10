import { DEPARTMENTS } from './departments.js';
import { POLICY_LIBRARY, INDUSTRY_NOTES, KB_SUMMARY } from './policies.js';
import { CASES } from './cases.js';
import type { Department, DeptId } from '../domain/types.js';

export { DEPARTMENTS, POLICY_LIBRARY, INDUSTRY_NOTES, CASES };
export { FINANCIAL_RULES, PRODUCT_MATCHING } from './policies.js';
export { caseById } from './cases.js';
export { deptMap, PIPELINE_OWNERSHIP, AUTHORITY_LADDER } from './departments.js';

export const KB = {
  summary: KB_SUMMARY(),
  departments: DEPARTMENTS,
  policies: POLICY_LIBRARY,
  industryNotes: INDUSTRY_NOTES,
  cases: CASES,
};

export const deptById = (id: DeptId): Department | undefined =>
  DEPARTMENTS.find((d) => d.id === id);
