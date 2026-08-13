import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Search,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import PromoCodeQrModal from './PromoCodeQrModal';
import {
  promoCodeService,
  PromoCode,
  PromoStatus,
  getPromoStatus,
} from '../../services/promoCodeService';

const PAGE_SIZE = 24;

const CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

const statusPillClass: Record<PromoStatus, string> = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Inactive: 'bg-slate-100 text-slate-500 border-slate-200',
  Expired: 'bg-amber-50 text-amber-700 border-amber-100',
  Exhausted: 'bg-rose-50 text-rose-700 border-rose-100',
};

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

const shortDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

const fullDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : 'Never expires';

const usageTone = (percent: number) =>
  percent >= 100 ? 'bg-rose-500' : percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

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

const PromoCodeManager: React.FC = () => {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [editor, setEditor] = useState<EditorState | null>(null);
  /** Non-null while editing an existing code; null means the form creates one. */
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const editorRef = useRef<HTMLFormElement>(null);

  const [createdPromo, setCreatedPromo] = useState<PromoCode | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PromoCode | null>(null);
  const [busyCode, setBusyCode] = useState('');
  const [qrPromo, setQrPromo] = useState<PromoCode | null>(null);

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

  // The editor opens above a grid that can be scrolled well out of view, so pull
  // it into sight rather than leaving the operator wondering what the click did.
  useEffect(() => {
    if (editor) {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [editingPromo?.code, editor !== null]);

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;

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
      await fetchPromoCodes(currentPage, search);
    } catch (error) {
      console.error('Failed to update promo code:', error);
      setLoadError('Unable to update the promo code right now.');
    } finally {
      setBusyCode('');
      setPendingToggle(null);
    }
  };

  const showEmptyState = hasLoadedOnce && !isLoading && promoCodes.length === 0;

  return (
    <div className="font-['Inter'] text-slate-900">
      {/* The page shell already renders the "Promo Codes" heading, so this is a
          toolbar rather than a second title block. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <Search size={15} className={iconInField} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search codes"
            className={fieldWithIcon}
          />
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => fetchPromoCodes(currentPage, search)}
            disabled={isLoading}
            title="Refresh"
            aria-label="Refresh"
            className={`${ghostButton} w-10 px-0`}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : undefined} />
          </button>
          <button type="button" onClick={openCreate} className={primaryButton}>
            <Plus size={16} />
            New code
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        Each code grants free Pro days when redeemed in the app or by scanning its QR code. A
        printed code is public forever — set a redemption cap and an expiry before it leaves the
        building.
      </p>

      {loadError && (
        <div className="flex items-center gap-2 px-4 py-3 mb-5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <AlertCircle size={16} className="shrink-0" />
          {loadError}
        </div>
      )}

      {/* Right after creating a code is when you actually want the QR. */}
      {createdPromo && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 mb-5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900">
          <CheckCircle2 size={16} className="shrink-0" />
          <p className="min-w-0">
            <span className="font-mono font-semibold">{createdPromo.code}</span> is live —{' '}
            {createdPromo.freeDays} free day{createdPromo.freeDays === 1 ? '' : 's'},{' '}
            {createdPromo.maxRedemptions > 0
              ? `${createdPromo.maxRedemptions} redemptions`
              : 'no redemption cap'}
            .
          </p>
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => setQrPromo(createdPromo)}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-emerald-200 bg-white text-xs font-medium text-emerald-800 transition hover:bg-emerald-50"
            >
              <QrCode size={13} />
              Get QR code
            </button>
            <button
              type="button"
              onClick={() => setCreatedPromo(null)}
              aria-label="Dismiss"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-emerald-700 transition hover:bg-emerald-100"
            >
              <X size={15} />
            </button>
          </div>
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
                {editingPromo ? `Edit ${editingPromo.code}` : 'New promo code'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {editingPromo
                  ? 'The code itself is locked — printed QR codes already point at it.'
                  : 'Pick the code carefully: it becomes the printed redeem link.'}
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

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="promo-code" className={label}>
                  Code <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Ticket size={15} className={iconInField} />
                  <input
                    id="promo-code"
                    type="text"
                    value={editor.code}
                    disabled={Boolean(editingPromo)}
                    onChange={(event) => updateEditor({ code: event.target.value.toUpperCase() })}
                    placeholder="WELCOME-30"
                    className={`${fieldWithIcon} uppercase disabled:bg-slate-50 disabled:text-slate-500`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="promo-free-days" className={label}>
                  Free days <span className="text-rose-500">*</span>
                </label>
                <input
                  id="promo-free-days"
                  type="number"
                  min={1}
                  max={3650}
                  value={editor.freeDays}
                  onChange={(event) => updateEditor({ freeDays: event.target.value })}
                  placeholder="30"
                  className={field}
                />
              </div>

              <div>
                <label htmlFor="promo-max-uses" className={label}>
                  Max uses <span className="text-slate-400 font-normal">· blank = unlimited</span>
                </label>
                <div className="relative">
                  <Users size={15} className={iconInField} />
                  <input
                    id="promo-max-uses"
                    type="number"
                    min={0}
                    value={editor.maxRedemptions}
                    onChange={(event) => updateEditor({ maxRedemptions: event.target.value })}
                    placeholder="Unlimited"
                    className={fieldWithIcon}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="promo-expires" className={label}>
                  Expires <span className="text-slate-400 font-normal">· blank = never</span>
                </label>
                <div className="relative">
                  <CalendarClock size={15} className={iconInField} />
                  <input
                    id="promo-expires"
                    type="datetime-local"
                    value={editor.expiresAt}
                    onChange={(event) => updateEditor({ expiresAt: event.target.value })}
                    className={fieldWithIcon}
                  />
                </div>
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
            <button type="submit" disabled={isSubmitting} className={primaryButton}>
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {editingPromo ? 'Save changes' : 'Create code'}
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
            <Ticket size={22} className="text-slate-400" />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-900">
            {search ? 'No matches' : 'No promo codes yet'}
          </p>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            {search
              ? 'Nothing matched that search. Try a different code.'
              : 'Create a code to hand out free Pro days, then print its QR code for flyers and handouts.'}
          </p>
          {!search && (
            <button type="button" onClick={openCreate} className={`${primaryButton} mt-5`}>
              <Plus size={16} />
              New code
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {promoCodes.map((promo) => {
            const status = getPromoStatus(promo);
            const isLive = status === 'Active';
            const isBusy = busyCode === promo.code;
            const usedPercent =
              promo.maxRedemptions > 0
                ? Math.min(100, Math.round((promo.redemptionCount / promo.maxRedemptions) * 100))
                : null;

            return (
              <div
                key={promo.id}
                className={`group relative rounded-2xl border bg-white p-5 transition hover:shadow-[0_4px_16px_rgba(16,24,40,0.08)] ${
                  isLive ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center ${
                      isLive
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Ticket size={19} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-semibold text-slate-900 truncate leading-tight">
                      {promo.code}
                    </p>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                      {promo.freeDays} free day{promo.freeDays === 1 ? '' : 's'} of Pro
                    </p>
                  </div>

                  <span
                    className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass[status]}`}
                  >
                    {status}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500">Redemptions</span>
                    <span className="font-semibold text-slate-700">
                      {promo.redemptionCount}
                      {promo.maxRedemptions > 0 ? ` / ${promo.maxRedemptions}` : ' · no cap'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    {usedPercent !== null && (
                      <div
                        className={`h-full rounded-full transition-all ${usageTone(usedPercent)}`}
                        style={{ width: `${usedPercent}%` }}
                      />
                    )}
                  </div>
                </div>

                <div
                  className={`mt-3 flex items-center gap-1.5 text-xs ${
                    status === 'Expired' ? 'text-amber-700' : 'text-slate-500'
                  }`}
                  title={fullDate(promo.expiresAt)}
                >
                  <CalendarClock size={13} className="shrink-0" />
                  <span className="truncate">
                    {promo.expiresAt ? `Expires ${shortDate(promo.expiresAt)}` : 'No expiry'}
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setQrPromo(promo)}
                    title="QR code"
                    aria-label={`QR code for ${promo.code}`}
                    className={iconButton}
                  >
                    <QrCode size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(promo)}
                    title="Edit"
                    aria-label={`Edit ${promo.code}`}
                    className={iconButton}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      promo.active ? setPendingToggle(promo) : handleToggleActive(promo)
                    }
                    disabled={isBusy}
                    title={promo.active ? 'Deactivate' : 'Activate'}
                    aria-label={promo.active ? `Deactivate ${promo.code}` : `Activate ${promo.code}`}
                    className={iconButton}
                  >
                    {isBusy ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Power size={15} />
                    )}
                  </button>

                  <span className="ml-auto text-[11px] text-slate-400 truncate">
                    {promo.created ? `Created ${shortDate(promo.created)}` : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-slate-500">
            Page {currentPage} of {totalPages} · {total} code{total === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchPromoCodes(currentPage - 1, search)}
              disabled={currentPage <= 1 || isLoading}
              className={`${ghostButton} h-9 text-xs`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => fetchPromoCodes(currentPage + 1, search)}
              disabled={currentPage >= totalPages || isLoading}
              className={`${ghostButton} h-9 text-xs`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <PromoCodeQrModal promo={qrPromo} onClose={() => setQrPromo(null)} />

      <ConfirmationModal
        isOpen={pendingToggle !== null}
        title="Deactivate promo code?"
        message={
          pendingToggle
            ? `Users will no longer be able to redeem ${pendingToggle.code}. Existing grants keep their free days. You can reactivate the code later.`
            : ''
        }
        confirmLabel="Deactivate"
        variant="warning"
        onConfirm={() => pendingToggle && handleToggleActive(pendingToggle)}
        onCancel={() => setPendingToggle(null)}
      />
    </div>
  );
};

export default PromoCodeManager;
