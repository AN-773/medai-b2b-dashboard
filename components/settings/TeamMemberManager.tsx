import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Contact,
  Crop,
  ImagePlus,
  Link2,
  Pencil,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Trash2,
  UserRound,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import TeamCardQrModal from './TeamCardQrModal';
import PhotoCropModal from './PhotoCropModal';
import {
  TeamMember,
  teamCardUrl,
  teamMemberService,
  UpdateTeamMemberRequest,
} from '../../services/teamMemberService';
import {
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  Menu,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Spinner,
  StatusDot,
  Textarea,
  cn,
} from '@/components/ui';
import { ListFooter, SuccessNotice, Toast, copyText, useToast } from '../admin/AdminFeedback';

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

type StatusFilter = 'all' | 'live' | 'inactive';

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

const editorsEqual = (left: EditorState, right: EditorState) =>
  (Object.keys(left) as Array<keyof EditorState>).every((key) => left[key] === right[key]);

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

const Avatar: React.FC<{
  name: string;
  photoUrl: string | null;
  dimmed?: boolean;
  className?: string;
}> = ({ name, photoUrl, dimmed = false, className }) => (
  <span
    className={cn(
      'flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 font-semibold text-stone-600 ring-1 ring-inset ring-stone-200/70',
      dimmed && 'opacity-60 grayscale',
      className,
    )}
  >
    {photoUrl ? (
      <img src={photoUrl} alt="" className="h-full w-full object-cover" />
    ) : name.trim() ? (
      initialsOf(name)
    ) : (
      <UserRound size={22} className="text-stone-400" />
    )}
  </span>
);

const SectionTitle: React.FC<{ title: string; description?: string }> = ({
  title,
  description,
}) => (
  <div className="mb-4">
    <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
    {description && <p className="mt-0.5 text-[13px] text-stone-500">{description}</p>}
  </div>
);

const TeamMemberManager: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [editor, setEditor] = useState<EditorState | null>(null);
  /** The editor as it was opened — anything different is unsaved. */
  const [savedEditor, setSavedEditor] = useState<EditorState | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  /**
   * Full-resolution source for the cropper, kept after confirming so the
   * operator can reopen and re-position without re-picking the file.
   */
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createdMember, setCreatedMember] = useState<TeamMember | null>(null);
  const [qrMember, setQrMember] = useState<TeamMember | null>(null);
  const [pendingToggle, setPendingToggle] = useState<TeamMember | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TeamMember | null>(null);
  const [busySlug, setBusySlug] = useState('');
  const { toast, showToast } = useToast();

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

  const statusCounts = useMemo(() => {
    const live = members.filter((member) => member.active).length;
    return { all: members.length, live, inactive: members.length - live };
  }, [members]);

  const visibleMembers = useMemo(
    () =>
      statusFilter === 'all'
        ? members
        : members.filter((member) => member.active === (statusFilter === 'live')),
    [members, statusFilter],
  );

  const isDirty = Boolean(editor && savedEditor && !editorsEqual(editor, savedEditor));

  const openCreate = () => {
    const initial = emptyEditor();
    setEditor(initial);
    setSavedEditor(initial);
    setEditingMember(null);
    setIsEditing(false);
    setSubmitError('');
  };

  const openEdit = (member: TeamMember) => {
    const initial = editorFromMember(member);
    setEditor(initial);
    setSavedEditor(initial);
    setEditingMember(member);
    setIsEditing(true);
    setSubmitError('');
  };

  const closeEditor = () => {
    setEditor(null);
    setSavedEditor(null);
    setEditingMember(null);
    setSubmitError('');
    setIsConfirmingDiscard(false);
    setCropSource(null);
    setIsCropOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const requestCloseEditor = () => {
    if (isSubmitting) return;
    if (isDirty) {
      setIsConfirmingDiscard(true);
      return;
    }
    closeEditor();
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

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!editor || isSubmitting || isCompressing) return;

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
        showToast('Changes saved');
      } else {
        const created = await teamMemberService.createTeamMember({
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
        setCreatedMember(created ?? null);
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
      showToast(`${member.name}'s card ${member.active ? 'deactivated' : 'activated'}`);
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
      // Deleted from inside the editor: nothing left to edit.
      if (editingMember?.slug === member.slug) closeEditor();
      if (createdMember?.slug === member.slug) setCreatedMember(null);
      showToast(`${member.name}'s card deleted`);
      await fetchMembers(currentPage, search);
    } catch (error) {
      console.error('Failed to delete team member:', error);
      setLoadError('Unable to delete that team member right now.');
    } finally {
      setBusySlug('');
      setPendingDelete(null);
    }
  };

  const handleCopyLink = async (member: TeamMember) => {
    if (await copyText(teamCardUrl(member.slug))) showToast('Card link copied');
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  const previewPhoto = editor?.photo || editor?.existingPhotoUrl || '';
  const drawerHint = !editor
    ? ''
    : isCompressing
      ? 'Processing photo…'
      : !editor.name.trim()
        ? 'Add a name to create the card'
        : isDirty
          ? 'Unsaved changes'
          : '';

  const renderList = () => {
    if (isLoading && !hasLoadedOnce) {
      return <Spinner label="Loading team cards…" className="py-20" />;
    }
    if (members.length === 0) {
      if (loadError) return null;
      return search ? (
        <EmptyState
          compact
          icon={Contact}
          title="No matches"
          description="Nothing matched that search. Try a different name, slug or email."
          action={
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear search
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={Contact}
          title="No contact cards yet"
          description="Add a team member to generate their public card and a QR code you can print on a badge."
          action={
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              New card
            </Button>
          }
        />
      );
    }
    if (visibleMembers.length === 0) {
      return (
        <EmptyState
          compact
          icon={Contact}
          title={`No ${statusFilter === 'live' ? 'live' : 'inactive'} cards${totalPages > 1 ? ' on this page' : ''}`}
          action={
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
              Show all cards
            </Button>
          }
        />
      );
    }

    return (
      <ul className={cn('divide-y divide-stone-100 transition-opacity', isLoading && 'opacity-60')}>
        {visibleMembers.map((member) => {
          const isBusy = busySlug === member.slug;
          const role = [member.jobTitle, member.department].filter(Boolean).join(' · ');
          return (
            <li
              key={member.slug}
              className="flex items-center gap-2 py-2 pl-2 pr-3 transition-colors hover:bg-stone-50"
            >
              <button
                type="button"
                onClick={() => openEdit(member)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <Avatar
                  name={member.name}
                  photoUrl={member.photoUrl}
                  dimmed={!member.active}
                  className="h-10 w-10 text-[13px]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-stone-900">
                    {member.name}
                  </span>
                  <span className="block truncate text-[13px] text-stone-500">
                    {role || <span className="text-stone-400">No job title</span>}
                  </span>
                </span>
                <span
                  className="hidden w-56 flex-shrink-0 truncate font-mono text-xs text-stone-400 lg:block"
                  title={teamCardUrl(member.slug)}
                >
                  /team/{member.slug}
                </span>
              </button>
              <span className="hidden w-20 flex-shrink-0 sm:block">
                <StatusDot tone={member.active ? 'green' : 'neutral'}>
                  {member.active ? 'Live' : 'Inactive'}
                </StatusDot>
              </span>
              <IconButton
                icon={QrCode}
                label={`QR code for ${member.name}`}
                size="sm"
                onClick={() => setQrMember(member)}
              />
              {isBusy ? (
                <Spinner className="h-7 w-7" />
              ) : (
                <Menu
                  size="sm"
                  label={`Actions for ${member.name}`}
                  items={[
                    { label: 'Edit', icon: Pencil, onSelect: () => openEdit(member) },
                    { label: 'QR code', icon: QrCode, onSelect: () => setQrMember(member) },
                    {
                      label: 'Copy card link',
                      icon: Link2,
                      onSelect: () => void handleCopyLink(member),
                    },
                    {
                      label: member.active ? 'Deactivate' : 'Activate',
                      icon: Power,
                      onSelect: () => setPendingToggle(member),
                    },
                    {
                      label: 'Delete',
                      icon: Trash2,
                      tone: 'danger',
                      onSelect: () => setPendingDelete(member),
                    },
                  ]}
                />
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div>
      <PageHeader
        title="Team cards"
        description={
          <>
            Every member gets a card at{' '}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[13px] text-stone-700">
              /team/&lt;slug&gt;
            </code>
            , reachable only by scanning their QR code — never linked from the site, never indexed.
          </>
        }
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            New card
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, slug or email"
          className="w-full sm:w-72"
        />
        {members.length > 0 && (
          <SegmentedControl<StatusFilter>
            label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All', count: statusCounts.all },
              { value: 'live', label: 'Live', count: statusCounts.live },
              { value: 'inactive', label: 'Inactive', count: statusCounts.inactive },
            ]}
          />
        )}
        <Button
          aria-label="Refresh team cards"
          title="Refresh team cards"
          icon={RefreshCw}
          loading={isLoading}
          onClick={() => fetchMembers(currentPage, search)}
          className="w-9 px-0 sm:ml-auto"
        />
      </div>

      <div className="mt-5 space-y-4">
        {createdMember && (
          <SuccessNotice
            onDismiss={() => setCreatedMember(null)}
            action={
              <Button size="sm" icon={QrCode} onClick={() => setQrMember(createdMember)}>
                Get QR code
              </Button>
            }
          >
            {createdMember.name}&apos;s card is live at{' '}
            <span className="font-mono">/team/{createdMember.slug}</span>.
          </SuccessNotice>
        )}

        {loadError && (
          <InlineAlert
            onDismiss={members.length > 0 ? () => setLoadError('') : undefined}
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => fetchMembers(currentPage, search)}
                disabled={isLoading}
                className="-my-1"
              >
                Try again
              </Button>
            }
          >
            {loadError}
          </InlineAlert>
        )}

        {!(loadError && members.length === 0) && (
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
            {renderList()}
            {members.length > 0 && (
              <ListFooter
                page={currentPage}
                totalPages={totalPages}
                total={total}
                noun="card"
                disabled={isLoading}
                onPrevious={() => fetchMembers(currentPage - 1, search)}
                onNext={() => fetchMembers(currentPage + 1, search)}
                note={
                  totalPages > 1 && statusFilter !== 'all'
                    ? 'status filter covers this page'
                    : undefined
                }
              />
            )}
          </div>
        )}
      </div>

      <Drawer
        open={editor !== null}
        onClose={requestCloseEditor}
        dismissible={!isSubmitting && !isConfirmingDiscard && !isCropOpen}
        title={isEditing ? editingMember?.name || 'Edit card' : 'New team card'}
        description={
          derivedSlug ? (
            <span className="font-mono text-xs">/team/{derivedSlug}</span>
          ) : (
            'Add a name to generate the card link.'
          )
        }
        toolbar={
          submitError ? (
            <div className="border-b border-stone-200 px-6 py-3">
              <InlineAlert onDismiss={() => setSubmitError('')}>{submitError}</InlineAlert>
            </div>
          ) : undefined
        }
        footer={
          <>
            {isEditing && editingMember && (
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => setPendingDelete(editingMember)}
                disabled={isSubmitting}
                className="-ml-2"
              >
                Delete
              </Button>
            )}
            <span className="ml-auto truncate text-[13px] text-stone-500">{drawerHint}</span>
            <Button variant="ghost" onClick={requestCloseEditor} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={isCompressing || !editor?.name.trim() || (isEditing && !isDirty)}
              loading={isSubmitting}
            >
              {isEditing ? 'Save changes' : 'Create card'}
            </Button>
          </>
        }
      >
        {editor && (
          <form onSubmit={handleSubmit} className="divide-y divide-stone-100">
            <section className="px-6 py-5">
              <div className="flex flex-wrap items-center gap-5">
                <div className="relative">
                  <Avatar
                    name={editor.name}
                    photoUrl={previewPhoto || null}
                    className="h-20 w-20 text-xl"
                  />
                  {isCompressing && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
                      <Spinner />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-900">Photo</p>
                  <p className="mt-0.5 text-[13px] text-stone-500">
                    PNG, JPEG or WEBP. You&apos;ll crop it to a 512px square.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      icon={ImagePlus}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isCompressing}
                    >
                      {previewPhoto ? 'Replace photo' : 'Upload photo'}
                    </Button>
                    {/* Only offered while the original is still in memory — a
                        saved photo is already cropped, so there is nothing
                        outside the frame left to recover. */}
                    {cropSource && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Crop}
                        onClick={() => setIsCropOpen(true)}
                      >
                        Reposition
                      </Button>
                    )}
                    {previewPhoto && (
                      <Button
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        onClick={() => {
                          updateEditor({ photo: '', existingPhotoUrl: null });
                          setCropSource(null);
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="px-6 py-5">
              <SectionTitle title="Card details" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  {(id) => (
                    <Input
                      id={id}
                      value={editor.name}
                      onChange={(event) => updateEditor({ name: event.target.value })}
                      placeholder="Jane Doe"
                      autoComplete="off"
                    />
                  )}
                </Field>
                <Field
                  label="Slug"
                  hint={isEditing ? undefined : 'Optional'}
                  description={
                    isEditing
                      ? 'Locked — printed QR codes already point at it.'
                      : 'Blank uses the name. It becomes the printed card URL.'
                  }
                >
                  {(id) => (
                    <Input
                      id={id}
                      value={editor.slug}
                      disabled={isEditing}
                      onChange={(event) =>
                        updateEditor({ slug: event.target.value.toLowerCase().replace(/\s+/g, '-') })
                      }
                      placeholder={slugify(editor.name) || 'jane-doe'}
                      autoComplete="off"
                      className="font-mono"
                    />
                  )}
                </Field>
                <Field label="Job title" hint="Optional">
                  {(id) => (
                    <Input
                      id={id}
                      value={editor.jobTitle}
                      onChange={(event) => updateEditor({ jobTitle: event.target.value })}
                      placeholder="Head of Clinical Content"
                    />
                  )}
                </Field>
                <Field label="Department" hint="Optional">
                  {(id) => (
                    <Input
                      id={id}
                      value={editor.department}
                      onChange={(event) => updateEditor({ department: event.target.value })}
                      placeholder="Clinical"
                    />
                  )}
                </Field>
                <Field label="Company" hint="Optional">
                  {(id) => (
                    <Input
                      id={id}
                      value={editor.company}
                      onChange={(event) => updateEditor({ company: event.target.value })}
                    />
                  )}
                </Field>
                <Field label="Sort order">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      value={editor.sortOrder}
                      onChange={(event) => updateEditor({ sortOrder: event.target.value })}
                      className="tabular-nums"
                    />
                  )}
                </Field>
                <Field
                  label="Bio"
                  hint={`${editor.bio.length}/600`}
                  description="One short paragraph shown under the name on the card."
                  className="sm:col-span-2"
                >
                  {(id) => (
                    <Textarea
                      id={id}
                      rows={3}
                      maxLength={600}
                      value={editor.bio}
                      onChange={(event) => updateEditor({ bio: event.target.value })}
                      className="resize-y"
                    />
                  )}
                </Field>
              </div>
            </section>

            <section className="px-6 py-5">
              <SectionTitle title="Contact" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" hint="Optional">
                  {(id) => (
                    <Input
                      id={id}
                      type="email"
                      value={editor.email}
                      onChange={(event) => updateEditor({ email: event.target.value })}
                      placeholder="jane@medicalstudent.ai"
                      autoComplete="off"
                    />
                  )}
                </Field>
                <Field label="Phone" hint="Optional">
                  {(id) => (
                    <Input
                      id={id}
                      type="tel"
                      value={editor.phone}
                      onChange={(event) => updateEditor({ phone: event.target.value })}
                      placeholder="+1 555 010 0100"
                      autoComplete="off"
                    />
                  )}
                </Field>
              </div>
            </section>

            <section className="px-6 py-5">
              <SectionTitle title="Links" description="Full http(s) links. Leave blank to hide." />
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ['LinkedIn', 'linkedinUrl', 'https://linkedin.com/in/janedoe'],
                    ['X / Twitter', 'twitterUrl', 'https://x.com/janedoe'],
                    ['Website', 'websiteUrl', 'https://medicalstudent.ai'],
                    ['Scheduling link', 'schedulingUrl', 'https://cal.com/janedoe'],
                  ] as const
                ).map(([text, key, placeholder]) => (
                  <Field key={key} label={text}>
                    {(id) => (
                      <Input
                        id={id}
                        type="url"
                        value={editor[key]}
                        onChange={(event) => updateEditor({ [key]: event.target.value })}
                        placeholder={placeholder}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </section>
            {/* Enter in a single-line field saves. */}
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </form>
        )}
      </Drawer>

      {/* Lives outside the drawer so the drawer's autofocus lands on the name field. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handlePhotoSelected(file);
        }}
      />

      <PhotoCropModal
        imageSrc={isCropOpen ? cropSource : null}
        onCancel={() => setIsCropOpen(false)}
        onCropped={handleCropped}
      />

      <TeamCardQrModal member={qrMember} onClose={() => setQrMember(null)} />

      <ConfirmDialog
        open={isConfirmingDiscard}
        title="Discard changes?"
        description="Your edits to this card haven't been saved."
        confirmLabel="Discard"
        onConfirm={closeEditor}
        onCancel={() => setIsConfirmingDiscard(false)}
      />

      <ConfirmDialog
        open={Boolean(pendingToggle)}
        title={pendingToggle?.active ? 'Deactivate this card?' : 'Activate this card?'}
        description={
          pendingToggle?.active
            ? `Scanning ${pendingToggle?.name}'s QR code will show a "not found" page until you reactivate it. The card's details are kept.`
            : `${pendingToggle?.name}'s card will resolve publicly again for anyone who scans the QR code.`
        }
        confirmLabel={pendingToggle?.active ? 'Deactivate' : 'Activate'}
        tone={pendingToggle?.active ? 'danger' : 'default'}
        busy={Boolean(pendingToggle) && busySlug === pendingToggle?.slug}
        onConfirm={() => pendingToggle && void handleToggleActive(pendingToggle)}
        onCancel={() => setPendingToggle(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this card permanently?"
        description={`${pendingDelete?.name}'s card and photo will be erased. Any QR code already printed will stop working for good. Deactivate instead if the code is already in circulation.`}
        confirmLabel="Delete"
        busy={Boolean(pendingDelete) && busySlug === pendingDelete?.slug}
        onConfirm={() => pendingDelete && void handleDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />

      <Toast message={toast} />
    </div>
  );
};

export default TeamMemberManager;
