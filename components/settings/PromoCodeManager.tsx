import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Power, QrCode, RefreshCw, Ticket } from 'lucide-react';
import PromoCodeQrModal from './PromoCodeQrModal';
import {
  promoCodeService,
  PromoCode,
  PromoStatus,
  getPromoStatus,
} from '../../services/promoCodeService';
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  Menu,
  PageHeader,
  ProgressBar,
  SearchInput,
  SegmentedControl,
  Spinner,
  cn,
  type BadgeTone,
} from '@/components/ui';
import { ListFooter, SuccessNotice, Toast, shortDate, useToast } from '../admin/AdminFeedback';

const PAGE_SIZE = 24;

const CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

const STATUS_TONE: Record<PromoStatus, BadgeTone> = {
  Active: 'green',
  Inactive: 'neutral',
  Expired: 'amber',
  Exhausted: 'red',
};

type StatusFilter = 'all' | PromoStatus;

interface EditorState {
  code: string;
  freeDays: string;
  /** Blank = unlimited, matching the API's `0`. */
  maxRedemptions: string;
  /** `datetime-local` value; blank = never expires. */
  expiresAt: string;
}

const emptyEditor = (): EditorState => ({
  code: '',
  freeDays: '',
  maxRedemptions: '',
  expiresAt: '',
});

/** RFC3339 from the API → the local-time string a `datetime-local` input wants. */
const toDateTimeLocal = (value: string | null | undefined): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const editorFromPromo = (promo: PromoCode): EditorState => ({
  code: promo.code,
  freeDays: String(promo.freeDays),
  maxRedemptions: promo.maxRedemptions > 0 ? String(promo.maxRedemptions) : '',
  expiresAt: toDateTimeLocal(promo.expiresAt),
});

const fullDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : 'Never expires';

const freeDaysLabel = (days: number) => `${days} free day${days === 1 ? '' : 's'}`;

const PromoCodeManager: React.FC = () => {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [editor, setEditor] = useState<EditorState | null>(null);
  /** Non-null while editing an existing code; null means the form creates one. */
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [createdPromo, setCreatedPromo] = useState<PromoCode | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PromoCode | null>(null);
  const [busyCode, setBusyCode] = useState('');
  const [qrPromo, setQrPromo] = useState<PromoCode | null>(null);
  const { toast, showToast } = useToast();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchPromoCodes = async (page = currentPage, query = search) => {
    setIsLoading(true);
    setLoadError('');

    try {
      const response = await promoCodeService.listPromoCodes(page, PAGE_SIZE, query);
      setPromoCodes(response.items || []);
      setTotal(response.total || 0);
      setCurrentPage(response.page || page);
    } catch (error) {
      console.error('Failed to load promo codes:', error);
      setLoadError('Unable to load promo codes right now.');
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  // Debounced so typing a code does not fire a request per keystroke. Runs on
  // mount too, which covers the initial load.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchPromoCodes(1, search);
    }, search ? 350 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: promoCodes.length,
      Active: 0,
      Inactive: 0,
      Expired: 0,
      Exhausted: 0,
    };
    promoCodes.forEach((promo) => {
      counts[getPromoStatus(promo)] += 1;
    });
    return counts;
  }, [promoCodes]);

  const visibleCodes = useMemo(
    () =>
      statusFilter === 'all'
        ? promoCodes
        : promoCodes.filter((promo) => getPromoStatus(promo) === statusFilter),
    [promoCodes, statusFilter],
  );

  const openCreate = () => {
    setEditor(emptyEditor());
    setEditingPromo(null);
    setSubmitError('');
  };

  const openEdit = (promo: PromoCode) => {
    setEditor(editorFromPromo(promo));
    setEditingPromo(promo);
    setSubmitError('');
  };

  const closeEditor = () => {
    setEditor(null);
    setEditingPromo(null);
    setSubmitError('');
  };

  const updateEditor = (patch: Partial<EditorState>) =>
    setEditor((current) => (current ? { ...current, ...patch } : current));

  const isEditorDirty = useMemo(() => {
    if (!editor) return false;
    if (!editingPromo) return true;
    const saved = editorFromPromo(editingPromo);
    return (
      editor.freeDays !== saved.freeDays ||
      editor.maxRedemptions !== saved.maxRedemptions ||
      editor.expiresAt !== saved.expiresAt
    );
  }, [editingPromo, editor]);

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!editor || isSubmitting || !isEditorDirty) return;

    const normalizedCode = editor.code.trim().toUpperCase();
    const parsedFreeDays = Number(editor.freeDays);
    const parsedMaxRedemptions = editor.maxRedemptions.trim()
      ? Number(editor.maxRedemptions)
      : 0;

    if (!CODE_PATTERN.test(normalizedCode)) {
      setSubmitError('Code must be 3-32 characters using letters, numbers, dashes or underscores.');
      return;
    }
    if (!Number.isInteger(parsedFreeDays) || parsedFreeDays < 1 || parsedFreeDays > 3650) {
      setSubmitError('Free days must be a whole number between 1 and 3650.');
      return;
    }
    if (!Number.isInteger(parsedMaxRedemptions) || parsedMaxRedemptions < 0) {
      setSubmitError('Max uses must be blank (unlimited) or a positive whole number.');
      return;
    }
    // An already-expired code can be edited without touching its expiry, so only
    // the future rule applies to a date the operator actually changed.
    const expiryChanged =
      !editingPromo || editor.expiresAt !== toDateTimeLocal(editingPromo.expiresAt);
    if (editor.expiresAt && expiryChanged && new Date(editor.expiresAt).getTime() <= Date.now()) {
      setSubmitError('Expiration date must be in the future.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    const expiresAt = editor.expiresAt ? new Date(editor.expiresAt).toISOString() : '';

    try {
      if (editingPromo) {
        await promoCodeService.updatePromoCode({
          code: editingPromo.code,
          freeDays: parsedFreeDays,
          maxRedemptions: parsedMaxRedemptions,
          expiresAt,
        });
        closeEditor();
        showToast(`${editingPromo.code} updated`);
        await fetchPromoCodes(currentPage, search);
      } else {
        const promo = await promoCodeService.createPromoCode({
          code: normalizedCode,
          freeDays: parsedFreeDays,
          maxRedemptions: parsedMaxRedemptions,
          expiresAt: expiresAt || undefined,
        });
        setCreatedPromo(promo);
        closeEditor();
        await fetchPromoCodes(1, search);
      }
    } catch (error: any) {
      console.error('Failed to save promo code:', error);
      setSubmitError(
        error?.status === 409
          ? 'A promo code with this code already exists.'
          : error?.message || 'Saving the promo code failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (promo: PromoCode) => {
    setBusyCode(promo.code);
    setLoadError('');

    try {
      await promoCodeService.setPromoCodeActive(promo.code, !promo.active);
      showToast(`${promo.code} ${promo.active ? 'deactivated' : 'activated'}`);
      await fetchPromoCodes(currentPage, search);
    } catch (error) {
      console.error('Failed to update promo code:', error);
      setLoadError('Unable to update the promo code right now.');
    } finally {
      setBusyCode('');
      setPendingToggle(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  const renderRedemptions = (promo: PromoCode) => {
    if (promo.maxRedemptions <= 0) {
      return (
        <>
          <p className="tabular-nums text-stone-800">{promo.redemptionCount.toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-stone-400">No cap</p>
        </>
      );
    }
    const usedPercent = Math.min(
      100,
      Math.round((promo.redemptionCount / promo.maxRedemptions) * 100),
    );
    return (
      <>
        <p className="tabular-nums text-stone-800">
          {promo.redemptionCount.toLocaleString()}
          <span className="text-stone-400"> / {promo.maxRedemptions.toLocaleString()}</span>
        </p>
        <ProgressBar
          value={promo.redemptionCount}
          max={promo.maxRedemptions}
          tone={usedPercent >= 80 ? 'amber' : 'brand'}
          label={`${usedPercent}% of redemptions used`}
          className="ml-auto mt-1.5 w-20"
        />
      </>
    );
  };

  const renderList = () => {
    if (isLoading && !hasLoadedOnce) {
      return <Spinner label="Loading promo codes…" className="py-20" />;
    }
    if (promoCodes.length === 0) {
      if (loadError) return null;
      return search ? (
        <EmptyState
          compact
          icon={Ticket}
          title="No codes match"
          description="Nothing matched that search. Try a different code."
          action={
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear search
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={Ticket}
          title="No promo codes yet"
          description="Create a code to hand out free Pro days, then print its QR code for flyers and handouts."
          action={
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              New code
            </Button>
          }
        />
      );
    }
    if (visibleCodes.length === 0) {
      return (
        <EmptyState
          compact
          icon={Ticket}
          title={`No ${statusFilter.toLowerCase()} codes${totalPages > 1 ? ' on this page' : ''}`}
          action={
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
              Show all codes
            </Button>
          }
        />
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Code
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Redemptions
              </th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">
                Expires
              </th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">
                Created
              </th>
              <th scope="col" className="w-20 px-2 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody
            className={cn('divide-y divide-stone-100 transition-opacity', isLoading && 'opacity-60')}
          >
            {visibleCodes.map((promo) => {
              const status = getPromoStatus(promo);
              const isBusy = busyCode === promo.code;
              return (
                <tr key={promo.id} className="transition-colors hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(promo)}
                      className="rounded font-mono text-sm font-medium text-stone-900 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                    >
                      {promo.code}
                    </button>
                    <p className="mt-0.5 text-stone-500">{freeDaysLabel(promo.freeDays)} of Pro</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[status]} dot>
                      {status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">{renderRedemptions(promo)}</td>
                  <td
                    className={cn(
                      'hidden whitespace-nowrap px-4 py-3 tabular-nums md:table-cell',
                      status === 'Expired' ? 'text-amber-700' : 'text-stone-600',
                    )}
                    title={fullDate(promo.expiresAt)}
                  >
                    {promo.expiresAt ? (
                      shortDate(promo.expiresAt)
                    ) : (
                      <span className="text-stone-400">Never</span>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 tabular-nums text-stone-600 lg:table-cell">
                    {shortDate(promo.created) || <span className="text-stone-400">—</span>}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <IconButton
                        icon={QrCode}
                        label={`QR code for ${promo.code}`}
                        size="sm"
                        onClick={() => setQrPromo(promo)}
                      />
                      {isBusy ? (
                        <Spinner className="h-7 w-7" />
                      ) : (
                        <Menu
                          size="sm"
                          label={`Actions for ${promo.code}`}
                          items={[
                            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(promo) },
                            { label: 'QR code', icon: QrCode, onSelect: () => setQrPromo(promo) },
                            promo.active
                              ? {
                                  label: 'Deactivate',
                                  icon: Power,
                                  tone: 'danger',
                                  onSelect: () => setPendingToggle(promo),
                                }
                              : {
                                  label: 'Activate',
                                  icon: Power,
                                  onSelect: () => void handleToggleActive(promo),
                                },
                          ]}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Promo codes"
        description="Each code grants free Pro days when redeemed in the app or by scanning its QR code."
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            New code
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search codes"
          className="w-full sm:w-72"
        />
        {promoCodes.length > 0 && (
          <SegmentedControl<StatusFilter>
            label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All', count: statusCounts.all },
              { value: 'Active', label: 'Active', count: statusCounts.Active },
              { value: 'Inactive', label: 'Inactive', count: statusCounts.Inactive },
              { value: 'Expired', label: 'Expired', count: statusCounts.Expired },
              { value: 'Exhausted', label: 'Exhausted', count: statusCounts.Exhausted },
            ]}
            className="max-w-full overflow-x-auto"
          />
        )}
        <Button
          aria-label="Refresh promo codes"
          title="Refresh promo codes"
          icon={RefreshCw}
          loading={isLoading}
          onClick={() => fetchPromoCodes(currentPage, search)}
          className="w-9 px-0 sm:ml-auto"
        />
      </div>

      <div className="mt-5 space-y-4">
        {/* Right after creating a code is when you actually want the QR. */}
        {createdPromo && (
          <SuccessNotice
            onDismiss={() => setCreatedPromo(null)}
            action={
              <Button size="sm" icon={QrCode} onClick={() => setQrPromo(createdPromo)}>
                Get QR code
              </Button>
            }
          >
            <span className="font-mono font-medium">{createdPromo.code}</span> is live —{' '}
            {freeDaysLabel(createdPromo.freeDays)},{' '}
            {createdPromo.maxRedemptions > 0
              ? `${createdPromo.maxRedemptions} redemptions`
              : 'no redemption cap'}
            .
          </SuccessNotice>
        )}

        {loadError && (
          <InlineAlert
            onDismiss={promoCodes.length > 0 ? () => setLoadError('') : undefined}
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => fetchPromoCodes(currentPage, search)}
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

        {!(loadError && promoCodes.length === 0) && (
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
            {renderList()}
            {promoCodes.length > 0 && (
              <ListFooter
                page={currentPage}
                totalPages={totalPages}
                total={total}
                noun="code"
                disabled={isLoading}
                onPrevious={() => fetchPromoCodes(currentPage - 1, search)}
                onNext={() => fetchPromoCodes(currentPage + 1, search)}
                note={totalPages > 1 && statusFilter !== 'all' ? 'status filter covers this page' : undefined}
              />
            )}
          </div>
        )}
      </div>

      <Dialog
        open={editor !== null}
        onClose={closeEditor}
        dismissible={!isSubmitting}
        width="max-w-lg"
        title={editingPromo ? `Edit ${editingPromo.code}` : 'New promo code'}
        description={
          editingPromo
            ? 'The code itself is locked — printed QR codes already point at it.'
            : 'Pick the code carefully: it becomes the printed redeem link.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={closeEditor} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={!isEditorDirty}
              loading={isSubmitting}
            >
              {editingPromo ? 'Save changes' : 'Create code'}
            </Button>
          </>
        }
      >
        {editor && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {submitError && (
              <InlineAlert onDismiss={() => setSubmitError('')}>{submitError}</InlineAlert>
            )}
            <Field
              label="Code"
              description={
                editingPromo ? undefined : '3–32 letters, numbers, dashes or underscores.'
              }
            >
              {(id) => (
                <Input
                  id={id}
                  value={editor.code}
                  disabled={Boolean(editingPromo)}
                  onChange={(event) => updateEditor({ code: event.target.value.toUpperCase() })}
                  placeholder="WELCOME-30"
                  autoComplete="off"
                  className="font-mono"
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Free days" description="1–3650 days of Pro.">
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={1}
                    max={3650}
                    value={editor.freeDays}
                    onChange={(event) => updateEditor({ freeDays: event.target.value })}
                    placeholder="30"
                  />
                )}
              </Field>
              <Field label="Max uses" hint="Optional" description="Blank means unlimited.">
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={0}
                    value={editor.maxRedemptions}
                    onChange={(event) => updateEditor({ maxRedemptions: event.target.value })}
                    placeholder="Unlimited"
                  />
                )}
              </Field>
            </div>
            <Field label="Expires" hint="Optional" description="Blank means the code never expires.">
              {(id) => (
                <Input
                  id={id}
                  type="datetime-local"
                  value={editor.expiresAt}
                  onChange={(event) => updateEditor({ expiresAt: event.target.value })}
                />
              )}
            </Field>
            <p className="rounded-lg bg-stone-50 px-3 py-2.5 text-[13px] leading-5 text-stone-600">
              A printed code is public forever — set a redemption cap and an expiry before it
              leaves the building.
            </p>
            {/* Enter in any field submits. */}
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </form>
        )}
      </Dialog>

      <PromoCodeQrModal promo={qrPromo} onClose={() => setQrPromo(null)} />

      <ConfirmDialog
        open={pendingToggle !== null}
        title="Deactivate promo code?"
        description={
          pendingToggle
            ? `Users will no longer be able to redeem ${pendingToggle.code}. Existing grants keep their free days. You can reactivate the code later.`
            : ''
        }
        confirmLabel="Deactivate"
        busy={Boolean(pendingToggle) && busyCode === pendingToggle?.code}
        onConfirm={() => pendingToggle && void handleToggleActive(pendingToggle)}
        onCancel={() => setPendingToggle(null)}
      />

      <Toast message={toast} />
    </div>
  );
};

export default PromoCodeManager;
