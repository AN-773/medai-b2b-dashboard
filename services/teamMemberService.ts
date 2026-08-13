import { apiClient } from './apiClient';

// Shapes mirror contracts/team-cards-contract.md (IAM service).

export interface TeamMember {
  id: string;
  /** Public identifier — the printed QR code resolves to /team/{slug}. */
  slug: string;
  name: string;
  jobTitle: string;
  department: string;
  company: string;
  bio: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  schedulingUrl: string;
  hasPhoto: boolean;
  /** Absolute URL of the photo endpoint, or null when no photo is set. */
  photoUrl: string | null;
  active: boolean;
  sortOrder: number;
  createdBy?: string | null;
  created?: string;
  updated?: string;
}

export interface TeamMemberListResponse {
  items: TeamMember[];
  total: number;
  page: number;
}

export interface CreateTeamMemberRequest {
  /** Omit to derive the slug from the name server-side. */
  slug?: string;
  name: string;
  jobTitle?: string;
  department?: string;
  company?: string;
  bio?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  schedulingUrl?: string;
  /** Base64 data URI (PNG/JPEG/WEBP), 512KB max once decoded. */
  photo?: string;
  sortOrder?: number;
}

export interface UpdateTeamMemberRequest {
  slug: string;
  name?: string;
  jobTitle?: string;
  department?: string;
  company?: string;
  bio?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  schedulingUrl?: string;
  /** Data URI to replace the photo, or '' to remove it. Omit to leave unchanged. */
  photo?: string;
  active?: boolean;
  sortOrder?: number;
}

/**
 * Where the QR codes point. This is the public Nuxt app, not the dashboard, so it
 * cannot be derived from any of the API base URLs.
 */
const PUBLIC_APP_URL = (
  import.meta.env.VITE_PUBLIC_APP_URL || 'https://medicalstudent.ai'
).replace(/\/+$/, '');

export const teamCardUrl = (slug: string): string => `${PUBLIC_APP_URL}/team/${slug}`;

export const teamMemberService = {
  listTeamMembers: async (page = 1, limit = 20, search = ''): Promise<TeamMemberListResponse> => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search.trim()) {
      params.set('q', search.trim());
    }

    return apiClient.get<TeamMemberListResponse>('IAM', `/team-members?${params.toString()}`);
  },

  createTeamMember: async (payload: CreateTeamMemberRequest): Promise<TeamMember> => {
    return apiClient.post<TeamMember>('IAM', '/team-members', payload);
  },

  updateTeamMember: async (payload: UpdateTeamMemberRequest): Promise<TeamMember> => {
    return apiClient.put<TeamMember>('IAM', '/team-members', {
      ...payload,
      slug: payload.slug.trim().toLowerCase(),
    });
  },

  setTeamMemberActive: async (slug: string, active: boolean): Promise<TeamMember> => {
    return apiClient.put<TeamMember>('IAM', '/team-members', {
      slug: slug.trim().toLowerCase(),
      active,
    });
  },

  deleteTeamMember: async (slug: string): Promise<void> => {
    return apiClient.delete<void>('IAM', `/team-members/${encodeURIComponent(slug.trim().toLowerCase())}`);
  },
};
