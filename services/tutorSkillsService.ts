import { apiClient } from './apiClient';
import type { ApiRequestError } from './apiClient';
import { isAgentV2Configured } from './agentV2Service';

// The tutor's skills, kept in medai-agent-v2 (`/v1/admin/skills`, SKILL-17).
// Shapes mirror agent-v2's `@medai/contracts` admin/skills.ts (contracts 0.89.0).
// Every route answers only a superadmin's token; anyone else gets
// `403 superadmin_required`. Every write answers the skill as it now stands.

export const ADMIN_SKILLS_PATH = '/v1/admin/skills';

/** The modes a skill can be listed in, in the order the editor shows them. `faculty` is the deans' Ask. */
export const SKILL_MODES = [
  { value: 'study', label: 'Study' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'general', label: 'General' },
  { value: 'faculty', label: 'Faculty' },
] as const;

export const SKILL_DESCRIPTION_MAX = 500;
export const SKILL_BODY_MAX = 20_000;
export const SKILL_MESSAGE_MAX = 500;

/**
 * - `published` — students get the latest version;
 * - `draft_ahead` — students get an older version, and a newer one is saved;
 * - `unpublished` — students get none;
 * - `archived` — hidden, and students get none.
 */
export type SkillStatus = 'published' | 'draft_ahead' | 'unpublished' | 'archived';

export interface SkillSummary {
  name: string;
  status: SkillStatus;
  /** The version students get, or null. */
  publishedNumber: number | null;
  latestNumber: number;
  /** The latest version's description and modes. */
  description: string;
  modes: string[];
  createdAt: string;
  updatedAt: string;
  latestBy: string;
  latestByEmail: string | null;
}

export interface SkillVersionSummary {
  number: number;
  published: boolean;
  description: string;
  modes: string[];
  /** The first 12 hex digits of the body's SHA-256: what a conversation's block names. */
  contentHash: string;
  message: string;
  basedOn: number | null;
  createdBy: string;
  createdByEmail: string | null;
  createdAt: string;
  bodyCharacters: number;
}

export interface SkillDetail {
  skill: SkillSummary;
  /** Newest first. */
  versions: SkillVersionSummary[];
}

export interface SkillVersion extends SkillVersionSummary {
  name: string;
  body: string;
  /** The version as a SKILL.md in the open Agent Skills format, for export. */
  source: string;
}

export type SkillEventAction = 'created' | 'saved' | 'published' | 'unpublished' | 'archived' | 'restored';

export interface SkillEvent {
  action: SkillEventAction;
  versionNumber: number | null;
  actorId: string;
  actorEmail: string | null;
  /** For a publish, `number` and the `previous` number; for an unpublish or archive, `previous`. */
  detail: { number?: number; previous?: number | null } & Record<string, unknown>;
  at: string;
}

export interface SkillFields {
  description: string;
  modes: string[];
  body: string;
}

export interface SkillDraft extends SkillFields {
  name: string;
}

export interface SkillValidation {
  valid: boolean;
  problems: string[];
  contentHash: string | null;
}

export type SkillProblemCode =
  | 'superadmin_required'
  | 'invalid_request'
  | 'invalid_skill'
  | 'skill_not_found'
  | 'skill_version_not_found'
  | 'skill_name_taken'
  | 'skill_version_conflict'
  | 'skill_archived'
  | 'mode_cap_exceeded';

export interface SkillProblem {
  code: SkillProblemCode;
  message: string;
  /** With `invalid_skill`: every reason, as the tutor's reader words it. */
  problems?: string[];
  /** With `skill_version_conflict`: the latest number. */
  latestNumber?: number;
  /** With `mode_cap_exceeded`. */
  mode?: string;
  listed?: number;
}

/** The problem a skill route refused with, or null for any other failure. */
export const skillProblemOf = (error: unknown): SkillProblem | null => {
  const data = (error as ApiRequestError | undefined)?.data;
  if (!data || typeof data !== 'object') return null;
  const problem = (data as { error?: unknown }).error;
  if (!problem || typeof problem !== 'object') return null;
  return typeof (problem as { code?: unknown }).code === 'string' ? (problem as SkillProblem) : null;
};

const skillPath = (name: string, rest = '') => `${ADMIN_SKILLS_PATH}/${encodeURIComponent(name)}${rest}`;

export const tutorSkillsService = {
  /** Whether this site talks to agent-v2 at all (`VITE_AGENT_V2_API_URL`). */
  isConfigured: isAgentV2Configured,

  list: (includeArchived = false) =>
    apiClient.get<{ skills: SkillSummary[] }>(
      'AGENT_V2',
      includeArchived ? `${ADMIN_SKILLS_PATH}?archived=true` : ADMIN_SKILLS_PATH,
    ),

  get: (name: string) => apiClient.get<SkillDetail>('AGENT_V2', skillPath(name)),

  getVersion: (name: string, number: number) =>
    apiClient.get<SkillVersion>('AGENT_V2', skillPath(name, `/versions/${number}`)),

  events: (name: string) => apiClient.get<{ events: SkillEvent[] }>('AGENT_V2', skillPath(name, '/events')),

  /** A new skill, saved as v1 and not published. */
  create: (draft: SkillDraft & { message?: string }) =>
    apiClient.post<SkillDetail>('AGENT_V2', ADMIN_SKILLS_PATH, draft),

  /** A new version, refused with `skill_version_conflict` unless `basedOn` is the latest. */
  save: (name: string, draft: SkillFields & { basedOn: number; message?: string }) =>
    apiClient.post<SkillDetail>('AGENT_V2', skillPath(name, '/versions'), draft),

  /** Publish a version; an older number is a rollback. */
  publish: (name: string, number: number) =>
    apiClient.post<SkillDetail>('AGENT_V2', skillPath(name, '/publish'), { number }),

  unpublish: (name: string) => apiClient.post<SkillDetail>('AGENT_V2', skillPath(name, '/unpublish'), {}),

  archive: (name: string) => apiClient.post<SkillDetail>('AGENT_V2', skillPath(name, '/archive'), {}),

  restore: (name: string) => apiClient.post<SkillDetail>('AGENT_V2', skillPath(name, '/restore'), {}),

  /** Check a draft as a save would, writing nothing. */
  validate: (draft: SkillDraft) => apiClient.post<SkillValidation>('AGENT_V2', `${ADMIN_SKILLS_PATH}/validate`, draft),
};
