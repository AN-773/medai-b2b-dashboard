import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Contact,
  Crop,
  Globe,
  ImagePlus,
  Linkedin,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
  Twitter,
  UserRound,
  X,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import ConfirmationModal from '../ConfirmationModal';
import TeamCardQrModal from './TeamCardQrModal';
import PhotoCropModal from './PhotoCropModal';
import {
  TeamMember,
  teamMemberService,
  UpdateTeamMemberRequest,
} from '../../services/teamMemberService';

const PAGE_SIZE = 24;

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;

/**
 * Downscales the *source* handed to the cropper — not the stored result, which
 * the crop step renders at 512px. 1600px keeps a phone photo sharp enough to
 * crop into without loading a 12MP bitmap into memory, and routing through this
 * library also normalizes EXIF orientation so portrait photos aren't sideways.
 */
const PHOTO_SOURCE_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
};

interface EditorState {
  /** Empty when creating; the existing slug when editing. */
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
  sortOrder: string;
  /** New data URI when the photo was changed this session, '' when cleared. */
  photo: string | null;
  /** Existing photo URL, shown until the operator replaces or clears it. */
  existingPhotoUrl: string | null;
}

const emptyEditor = (): EditorState => ({
  slug: '',
  name: '',
  jobTitle: '',
  department: '',
  company: 'Medical Student AI',
  bio: '',
  email: '',
  phone: '',
  linkedinUrl: '',
  twitterUrl: '',
  websiteUrl: '',
  schedulingUrl: '',
  sortOrder: '0',
  photo: null,
  existingPhotoUrl: null,
});

const editorFromMember = (member: TeamMember): EditorState => ({
  slug: member.slug,
  name: member.name,
  jobTitle: member.jobTitle || '',
  department: member.department || '',
  company: member.company || '',
  bio: member.bio || '',
  email: member.email || '',
  phone: member.phone || '',
  linkedinUrl: member.linkedinUrl || '',
  twitterUrl: member.twitterUrl || '',
  websiteUrl: member.websiteUrl || '',
  schedulingUrl: member.schedulingUrl || '',
  sortOrder: String(member.sortOrder ?? 0),
  photo: null,
  existingPhotoUrl: member.photoUrl,
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const isBlankOrUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const label = 'block text-xs font-medium text-slate-600 mb-1.5';
const field =
  'w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5';
const fieldWithIcon = `${field} pl-9`;
const iconInField = 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none';
const ghostButton =
  'inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50';
const primaryButton =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-slate-800 disabled:opacity-50';
const iconButton =
  'inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50';

const TeamMemberManager: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  /**
   * Full-resolution source for the cropper, kept after confirming so the
   * operator can reopen and re-position without re-picking the file.
   */
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLFormElement>(null);

  const [qrMember, setQrMember] = useState<TeamMember | null>(null);
  const [pendingToggle, setPendingToggle] = useState<TeamMember | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TeamMember | null>(null);
  const [busySlug, setBusySlug] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchMembers = async (page = currentPage, query = search) => {
    setIsLoading(true);
    setLoadError('');

    try {
      const response = await teamMemberService.listTeamMembers(page, PAGE_SIZE, query);
      setMembers(response.items || []);
      setTotal(response.total || 0);
      setCurrentPage(response.page || page);
    } catch (error) {
      console.error('Failed to load team members:', error);
      setLoadError('Unable to load team members right now.');
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  // Debounce the search so typing a name does not fire a request per keystroke.
  // Runs on mount too, which covers the initial load.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchMembers(1, search);
    }, search ? 350 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const derivedSlug = useMemo(() => {
    if (!editor) return '';
    if (editor.slug.trim()) return editor.slug.trim().toLowerCase();
    return slugify(editor.name);
  }, [editor]);

  const openCreate = () => {
    setEditor(emptyEditor());
    setIsEditing(false);
    setSubmitError('');
  };

  const openEdit = (member: TeamMember) => {
    setEditor(editorFromMember(member));
    setIsEditing(true);
    setSubmitError('');
  };

  // The editor opens above a grid that can be scrolled well out of view, so pull
  // it into sight rather than leaving the operator wondering what the click did.
  useEffect(() => {
    if (editor) {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [editor?.slug, isEditing]);

  const closeEditor = () => {
    setEditor(null);
    setSubmitError('');
    setCropSource(null);
    setIsCropOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateEditor = (patch: Partial<EditorState>) =>
    setEditor((current) => (current ? { ...current, ...patch } : current));

  // A picked file goes to the cropper rather than straight into the record:
  // object-cover would otherwise centre-crop blindly and lop off heads.
  const handlePhotoSelected = async (file: File) => {
    setIsCompressing(true);
    setSubmitError('');

    try {
      const source = await imageCompression(file, PHOTO_SOURCE_OPTIONS);
      setCropSource(await imageCompression.getDataUrlFromFile(source));
      setIsCropOpen(true);
    } catch (error) {
      console.error('Failed to process photo:', error);
      setSubmitError('Could not process that image. Try a different PNG, JPEG or WEBP.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCropped = (dataUrl: string) => {
    updateEditor({ photo: dataUrl });
    setIsCropOpen(false);
  };

  const validate = (state: EditorState): string => {
    if (!state.name.trim()) return 'Name is required.';
    if (state.name.trim().length > 200) return 'Name must be 200 characters or fewer.';
    if (!derivedSlug) return 'Could not derive a slug from that name — set one manually.';
    if (!SLUG_PATTERN.test(derivedSlug)) {
      return 'Slug must be 1-64 lowercase letters, numbers or hyphens.';
    }
    if (state.email.trim() && !state.email.includes('@')) return 'Email must be a valid address.';
    if (state.bio.length > 600) return 'Bio must be 600 characters or fewer.';

    const links: Array<[string, string]> = [
      ['LinkedIn URL', state.linkedinUrl],
      ['X / Twitter URL', state.twitterUrl],
      ['Website URL', state.websiteUrl],
      ['Scheduling URL', state.schedulingUrl],
    ];
    for (const [name, value] of links) {
      if (!isBlankOrUrl(value)) return `${name} must be a full http(s) link.`;
    }

    return '';
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;

    const validationError = validate(editor);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    const sortOrder = Number(editor.sortOrder) || 0;

    try {
      if (isEditing) {
        const payload: UpdateTeamMemberRequest = {
          slug: editor.slug,
          name: editor.name.trim(),
          jobTitle: editor.jobTitle.trim(),
          department: editor.department.trim(),
          company: editor.company.trim(),
          bio: editor.bio.trim(),
          email: editor.email.trim(),
          phone: editor.phone.trim(),
          linkedinUrl: editor.linkedinUrl.trim(),
          twitterUrl: editor.twitterUrl.trim(),
          websiteUrl: editor.websiteUrl.trim(),
          schedulingUrl: editor.schedulingUrl.trim(),
          sortOrder,
        };
        // Only send `photo` when it actually changed, so an unrelated edit never
        // rewrites (or accidentally clears) the stored image.
        if (editor.photo !== null) {
          payload.photo = editor.photo;
        }
        await teamMemberService.updateTeamMember(payload);
      } else {
        await teamMemberService.createTeamMember({
          slug: derivedSlug,
          name: editor.name.trim(),
          jobTitle: editor.jobTitle.trim(),
          department: editor.department.trim(),
          company: editor.company.trim(),
          bio: editor.bio.trim(),
          email: editor.email.trim(),
          phone: editor.phone.trim(),
          linkedinUrl: editor.linkedinUrl.trim(),
          twitterUrl: editor.twitterUrl.trim(),
          websiteUrl: editor.websiteUrl.trim(),
          schedulingUrl: editor.schedulingUrl.trim(),
          photo: editor.photo || undefined,
          sortOrder,
        });
      }

      closeEditor();
      await fetchMembers(isEditing ? currentPage : 1, search);
    } catch (error: any) {
      console.error('Failed to save team member:', error);
      setSubmitError(
        error?.status === 409
          ? 'A team member with this slug already exists.'
          : error?.message || 'Saving the team member failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (member: TeamMember) => {
    setBusySlug(member.slug);
    setLoadError('');

    try {
      await teamMemberService.setTeamMemberActive(member.slug, !member.active);
      await fetchMembers(currentPage, search);
    } catch (error) {
      console.error('Failed to update team member:', error);
      setLoadError('Unable to update that team member right now.');
    } finally {
      setBusySlug('');
      setPendingToggle(null);
    }
  };

  const handleDelete = async (member: TeamMember) => {
    setBusySlug(member.slug);
    setLoadError('');

    try {
      await teamMemberService.deleteTeamMember(member.slug);
      await fetchMembers(currentPage, search);
    } catch (error) {
      console.error('Failed to delete team member:', error);
      setLoadError('Unable to delete that team member right now.');
    } finally {
      setBusySlug('');
      setPendingDelete(null);
    }
  };

  const previewPhoto = editor?.photo || editor?.existingPhotoUrl || '';
  const showEmptyState = hasLoadedOnce && !isLoading && members.length === 0;

  const renderLinkField = (
    id: string,
    text: string,
    icon: React.ReactNode,
    value: string,
    placeholder: string,
    onChange: (next: string) => void
  ) => (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <div className="relative">
        {icon}
        <input
          id={id}
          type="url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={fieldWithIcon}
        />
      </div>
    </div>
  );

  return (
    <div className="font-['Inter'] text-slate-900">
      {/* The page shell already renders the "Team Cards" heading, so this is a
          toolbar rather than a second title block. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <Search size={15} className={iconInField} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, slug or email"
            className={fieldWithIcon}
          />
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => fetchMembers(currentPage, search)}
            disabled={isLoading}
            title="Refresh"
            aria-label="Refresh"
            className={`${ghostButton} w-10 px-0`}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : undefined} />
          </button>
          <button type="button" onClick={openCreate} className={primaryButton}>
            <Plus size={16} />
            Add member
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        Every member gets a card at{' '}
        <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[13px]">
          /team/&lt;slug&gt;
        </code>
        , reachable only by scanning their QR code — never linked from the site, never indexed.
      </p>

      {loadError && (
        <div className="flex items-center gap-2 px-4 py-3 mb-5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <AlertCircle size={16} className="shrink-0" />
          {loadError}
        </div>
      )}

      {editor && (
        <form
          ref={editorRef}
          onSubmit={handleSubmit}
          className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden"
        >
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {isEditing ? `Edit ${editor.name || 'member'}` : 'New team member'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEditing
                  ? 'The slug is locked — printed QR codes already point at it.'
                  : 'Pick the slug carefully: it becomes the printed card URL.'}
              </p>
            </div>
            <button
              type="button"
              onClick={closeEditor}
              aria-label="Close editor"
              className={iconButton}
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="shrink-0">
                <p className={label}>Photo</p>
                <div className="flex items-start gap-3">
                  <div className="w-[72px] h-[72px] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {isCompressing ? (
                      <Loader2 size={18} className="animate-spin text-slate-400" />
                    ) : previewPhoto ? (
                      <img src={previewPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserRound size={24} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) handlePhotoSelected(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isCompressing}
                      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ImagePlus size={13} />
                      {previewPhoto ? 'Replace' : 'Upload'}
                    </button>
                    {/* Only offered while the original is still in memory —
                        a saved photo is already cropped, so there is nothing
                        outside the frame left to recover. */}
                    {cropSource && (
                      <button
                        type="button"
                        onClick={() => setIsCropOpen(true)}
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <Crop size={13} />
                        Reposition
                      </button>
                    )}
                    {previewPhoto && (
                      <button
                        type="button"
                        onClick={() => {
                          updateEditor({ photo: '', existingPhotoUrl: null });
                          setCropSource(null);
                        }}
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    )}
                    <p className="text-[11px] text-slate-400 leading-tight max-w-[8rem]">
                      Square, 512px
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="team-name" className={label}>
                    Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    value={editor.name}
                    onChange={(event) => updateEditor({ name: event.target.value })}
                    placeholder="Jane Doe"
                    className={field}
                  />
                </div>

                <div>
                  <label htmlFor="team-slug" className={label}>
                    Slug <span className="text-slate-400 font-normal">· blank = from name</span>
                  </label>
                  <input
                    id="team-slug"
                    type="text"
                    value={editor.slug}
                    disabled={isEditing}
                    onChange={(event) =>
                      updateEditor({ slug: event.target.value.toLowerCase().replace(/\s+/g, '-') })
                    }
                    placeholder={slugify(editor.name) || 'jane-doe'}
                    className={`${field} disabled:bg-slate-50 disabled:text-slate-500`}
                  />
                  {derivedSlug && (
                    <p className="text-[11px] text-slate-400 mt-1 truncate">/team/{derivedSlug}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="team-title" className={label}>
                    Job title
                  </label>
                  <input
                    id="team-title"
                    type="text"
                    value={editor.jobTitle}
                    onChange={(event) => updateEditor({ jobTitle: event.target.value })}
                    placeholder="Head of Clinical Content"
                    className={field}
                  />
                </div>

                <div>
                  <label htmlFor="team-department" className={label}>
                    Department
                  </label>
                  <input
                    id="team-department"
                    type="text"
                    value={editor.department}
                    onChange={(event) => updateEditor({ department: event.target.value })}
                    placeholder="Clinical"
                    className={field}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="team-company" className={label}>
                  Company
                </label>
                <input
                  id="team-company"
                  type="text"
                  value={editor.company}
                  onChange={(event) => updateEditor({ company: event.target.value })}
                  className={field}
                />
              </div>

              <div>
                <label htmlFor="team-email" className={label}>
                  Email
                </label>
                <div className="relative">
                  <Mail size={15} className={iconInField} />
                  <input
                    id="team-email"
                    type="email"
                    value={editor.email}
                    onChange={(event) => updateEditor({ email: event.target.value })}
                    placeholder="jane@medicalstudent.ai"
                    className={fieldWithIcon}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="team-phone" className={label}>
                  Phone
                </label>
                <div className="relative">
                  <Phone size={15} className={iconInField} />
                  <input
                    id="team-phone"
                    type="tel"
                    value={editor.phone}
                    onChange={(event) => updateEditor({ phone: event.target.value })}
                    placeholder="+1 555 010 0100"
                    className={fieldWithIcon}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderLinkField(
                'team-linkedin',
                'LinkedIn',
                <Linkedin size={15} className={iconInField} />,
                editor.linkedinUrl,
                'https://linkedin.com/in/janedoe',
                (next) => updateEditor({ linkedinUrl: next })
              )}
              {renderLinkField(
                'team-twitter',
                'X / Twitter',
                <Twitter size={15} className={iconInField} />,
                editor.twitterUrl,
                'https://x.com/janedoe',
                (next) => updateEditor({ twitterUrl: next })
              )}
              {renderLinkField(
                'team-website',
                'Website',
                <Globe size={15} className={iconInField} />,
                editor.websiteUrl,
                'https://medicalstudent.ai',
                (next) => updateEditor({ websiteUrl: next })
              )}
              {renderLinkField(
                'team-scheduling',
                'Scheduling link',
                <CalendarClock size={15} className={iconInField} />,
                editor.schedulingUrl,
                'https://cal.com/janedoe',
                (next) => updateEditor({ schedulingUrl: next })
              )}
            </div>

            <div className="border-t border-slate-100 pt-5 grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
              <div>
                <label htmlFor="team-bio" className={label}>
                  Bio <span className="text-slate-400 font-normal">· {editor.bio.length}/600</span>
                </label>
                <textarea
                  id="team-bio"
                  rows={3}
                  maxLength={600}
                  value={editor.bio}
                  onChange={(event) => updateEditor({ bio: event.target.value })}
                  placeholder="One short paragraph shown under the name on the card."
                  className={`${field} h-auto py-2.5 resize-y`}
                />
              </div>
              <div>
                <label htmlFor="team-sort" className={label}>
                  Sort order
                </label>
                <input
                  id="team-sort"
                  type="number"
                  value={editor.sortOrder}
                  onChange={(event) => updateEditor({ sortOrder: event.target.value })}
                  className={field}
                />
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                <AlertCircle size={16} className="shrink-0" />
                {submitError}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className={primaryButton}
            >
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {isEditing ? 'Save changes' : 'Create card'}
            </button>
            <button type="button" onClick={closeEditor} className={ghostButton}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading && !hasLoadedOnce ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : showEmptyState ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
            <Contact size={22} className="text-slate-400" />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-900">
            {search ? 'No matches' : 'No contact cards yet'}
          </p>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            {search
              ? 'Nothing matched that search. Try a different name, slug or email.'
              : 'Add a team member to generate their public card and a QR code you can print on a badge.'}
          </p>
          {!search && (
            <button type="button" onClick={openCreate} className={`${primaryButton} mt-5`}>
              <Plus size={16} />
              Add member
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {members.map((member) => (
            <div
              key={member.slug}
              className={`group relative rounded-2xl border bg-white p-5 transition hover:shadow-[0_4px_16px_rgba(16,24,40,0.08)] ${
                member.active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-sm font-semibold ${
                    member.photoUrl
                      ? 'bg-slate-100'
                      : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                  } ${member.active ? '' : 'grayscale opacity-70'}`}
                >
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initialsOf(member.name)
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate leading-tight">
                    {member.name}
                  </p>
                  <p className="text-[13px] text-slate-500 truncate mt-0.5">
                    {member.jobTitle || '—'}
                  </p>
                  {member.department && (
                    <p className="text-xs text-slate-400 truncate">{member.department}</p>
                  )}
                </div>

                <span
                  title={member.active ? 'Live' : 'Inactive'}
                  className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${
                    member.active ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
              </div>

              <p className="mt-4 text-[11px] font-mono text-slate-400 truncate">
                /team/{member.slug}
              </p>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setQrMember(member)}
                  title="QR code"
                  aria-label={`QR code for ${member.name}`}
                  className={iconButton}
                >
                  <QrCode size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(member)}
                  title="Edit"
                  aria-label={`Edit ${member.name}`}
                  className={iconButton}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingToggle(member)}
                  disabled={busySlug === member.slug}
                  title={member.active ? 'Deactivate' : 'Activate'}
                  aria-label={member.active ? `Deactivate ${member.name}` : `Activate ${member.name}`}
                  className={iconButton}
                >
                  {busySlug === member.slug ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Power size={15} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(member)}
                  disabled={busySlug === member.slug}
                  title="Delete"
                  aria-label={`Delete ${member.name}`}
                  className={`${iconButton} ml-auto hover:bg-rose-50 hover:text-rose-600`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-slate-500">
            Page {currentPage} of {totalPages} · {total} member{total === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchMembers(currentPage - 1, search)}
              disabled={currentPage <= 1 || isLoading}
              className={`${ghostButton} h-9 text-xs`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => fetchMembers(currentPage + 1, search)}
              disabled={currentPage >= totalPages || isLoading}
              className={`${ghostButton} h-9 text-xs`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <PhotoCropModal
        imageSrc={isCropOpen ? cropSource : null}
        onCancel={() => setIsCropOpen(false)}
        onCropped={handleCropped}
      />

      <TeamCardQrModal member={qrMember} onClose={() => setQrMember(null)} />

      <ConfirmationModal
        isOpen={Boolean(pendingToggle)}
        title={pendingToggle?.active ? 'Deactivate this card?' : 'Activate this card?'}
        message={
          pendingToggle?.active
            ? `Scanning ${pendingToggle?.name}'s QR code will show a "not found" page until you reactivate it. The card's details are kept.`
            : `${pendingToggle?.name}'s card will resolve publicly again for anyone who scans the QR code.`
        }
        confirmLabel={pendingToggle?.active ? 'Deactivate' : 'Activate'}
        variant={pendingToggle?.active ? 'warning' : 'info'}
        onConfirm={() => pendingToggle && handleToggleActive(pendingToggle)}
        onCancel={() => setPendingToggle(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(pendingDelete)}
        title="Delete this card permanently?"
        message={`${pendingDelete?.name}'s card and photo will be erased. Any QR code already printed will stop working for good. Deactivate instead if the code is already in circulation.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default TeamMemberManager;
