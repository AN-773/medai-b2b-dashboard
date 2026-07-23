import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Power,
  RefreshCw,
  Ticket,
  Users,
} from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import { promoCodeService, PromoCode } from '../../services/promoCodeService';

type PromoStatus = 'Active' | 'Inactive' | 'Expired' | 'Exhausted';

const getPromoStatus = (promo: PromoCode): PromoStatus => {
  if (!promo.active) return 'Inactive';
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now()) return 'Expired';
  if (promo.maxRedemptions > 0 && promo.redemptionCount >= promo.maxRedemptions) return 'Exhausted';
  return 'Active';
};

const statusBadgeClass: Record<PromoStatus, string> = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Inactive: 'bg-slate-100 text-slate-500 border-slate-200',
  Expired: 'bg-amber-50 text-amber-700 border-amber-200',
  Exhausted: 'bg-rose-50 text-rose-700 border-rose-200',
};

const PromoCodeManager: React.FC = () => {
  const pageSize = 10;
  const [code, setCode] = useState('');
  const [freeDays, setFreeDays] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdPromo, setCreatedPromo] = useState<PromoCode | null>(null);

  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCodes, setTotalCodes] = useState(0);

  const [pendingToggle, setPendingToggle] = useState<PromoCode | null>(null);
  const [togglingCode, setTogglingCode] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalCodes / pageSize));

  const fetchPromoCodes = async (page = currentPage) => {
    setIsLoading(true);
    setLoadError('');

    try {
      const response = await promoCodeService.listPromoCodes(page, pageSize);
      setPromoCodes(response.items || []);
      setTotalCodes(response.total || 0);
      setCurrentPage(response.page || page);
    } catch (error) {
      console.error('Failed to load promo codes:', error);
      setLoadError('Unable to load promo codes right now.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromoCodes(1);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedCode = code.trim().toUpperCase();
    const parsedFreeDays = Number(freeDays);
    const parsedMaxRedemptions = maxRedemptions ? Number(maxRedemptions) : 0;

    if (!/^[A-Z0-9_-]{3,32}$/.test(normalizedCode)) {
      setSubmitError('Code must be 3-32 characters using letters, numbers, dashes or underscores.');
      return;
    }
    if (!Number.isInteger(parsedFreeDays) || parsedFreeDays < 1 || parsedFreeDays > 3650) {
      setSubmitError('Free days must be a whole number between 1 and 3650.');
      return;
    }
    if (!Number.isInteger(parsedMaxRedemptions) || parsedMaxRedemptions < 0) {
      setSubmitError('Max uses must be 0 (unlimited) or a positive whole number.');
      return;
    }
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      setSubmitError('Expiration date must be in the future.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const promo = await promoCodeService.createPromoCode({
        code: normalizedCode,
        freeDays: parsedFreeDays,
        maxRedemptions: parsedMaxRedemptions,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });

      setCreatedPromo(promo);
      setCode('');
      setFreeDays('');
      setMaxRedemptions('');
      setExpiresAt('');
      fetchPromoCodes(1);
    } catch (error: any) {
      console.error('Failed to create promo code:', error);
      setSubmitError(
        error?.status === 409
          ? 'A promo code with this code already exists.'
          : error?.message || 'Promo code creation failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (promo: PromoCode) => {
    setTogglingCode(promo.code);
    setLoadError('');

    try {
      await promoCodeService.setPromoCodeActive(promo.code, !promo.active);
      await fetchPromoCodes(currentPage);
    } catch (error) {
      console.error('Failed to update promo code:', error);
      setLoadError('Unable to update the promo code right now.');
    } finally {
      setTogglingCode('');
    }
  };

  const formatExpiry = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString() : 'Never';

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 font-['Inter']">
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold">Promo Codes</h3>
          <p className="text-sm text-slate-500">
            Create codes that grant free pro days, cap how many people can use them, and set expiry dates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchPromoCodes(currentPage)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Refresh Codes
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] gap-6 mb-6">
        <form onSubmit={handleSubmit} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Ticket size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Create Promo Code</p>
                <p className="text-xs text-slate-500 mt-1">
                  The code grants free pro days when a user redeems it in the app.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label
                  htmlFor="promo-code"
                  className="text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]"
                >
                  Code
                </label>
                <div className="relative">
                  <Ticket size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="promo-code"
                    type="text"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder="WELCOME-30"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="promo-free-days"
                  className="text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]"
                >
                  Free Days
                </label>
                <input
                  id="promo-free-days"
                  type="number"
                  min={1}
                  max={3650}
                  value={freeDays}
                  onChange={(event) => setFreeDays(event.target.value)}
                  placeholder="30"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label
                  htmlFor="promo-max-uses"
                  className="text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]"
                >
                  Max Uses <span className="normal-case font-semibold text-slate-400">(blank or 0 = unlimited)</span>
                </label>
                <div className="relative">
                  <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="promo-max-uses"
                    type="number"
                    min={0}
                    value={maxRedemptions}
                    onChange={(event) => setMaxRedemptions(event.target.value)}
                    placeholder="Unlimited"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="promo-expires"
                  className="text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]"
                >
                  Expiration Date <span className="normal-case font-semibold text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <CalendarClock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="promo-expires"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {submitError && (
              <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-900">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <p className="text-sm">{submitError}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-2">
              <p className="text-xs text-slate-500">
                Users redeem codes from the mobile app to unlock free pro days.
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating Code
                  </>
                ) : (
                  <>
                    <Ticket size={16} />
                    Create Promo Code
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm min-h-[220px]">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <p className="text-sm font-bold text-slate-900">Last Created Code</p>
          </div>

          {createdPromo ? (
            <div className="space-y-3 text-sm text-slate-700">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-emerald-900">
                Promo code created successfully.
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Code</p>
                <p className="font-mono font-bold">{createdPromo.code}</p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Free Days</p>
                <p>{createdPromo.freeDays}</p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Max Uses</p>
                <p>{createdPromo.maxRedemptions > 0 ? createdPromo.maxRedemptions : 'Unlimited'}</p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Expires</p>
                <p>{formatExpiry(createdPromo.expiresAt)}</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-10">
              <Ticket size={40} className="text-slate-200 mb-4" />
              <p className="font-medium text-slate-900">No code created yet</p>
              <p className="text-sm mt-1 max-w-sm">
                Create a promo code to share free pro days with users.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Promo Code Directory</h4>
            <p className="text-xs text-slate-500 mt-1">
              Track usage and deactivate codes at any time.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            {totalCodes} code{totalCodes === 1 ? '' : 's'}
          </div>
        </div>

        {loadError && (
          <div className="mx-6 mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-900">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm">{loadError}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white">
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Free Days</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Uses</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Expires</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Loading promo codes
                    </div>
                  </td>
                </tr>
              ) : promoCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No promo codes yet. Create your first one above.
                  </td>
                </tr>
              ) : (
                promoCodes.map((promo) => {
                  const status = getPromoStatus(promo);
                  const isToggling = togglingCode === promo.code;

                  return (
                    <tr key={promo.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-mono font-bold text-slate-900">{promo.code}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Created {promo.created ? new Date(promo.created).toLocaleDateString() : 'recently'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{promo.freeDays}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {promo.redemptionCount}
                        {promo.maxRedemptions > 0 ? ` / ${promo.maxRedemptions}` : ' / ∞'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{formatExpiry(promo.expiresAt)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass[status]}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            promo.active ? setPendingToggle(promo) : handleToggleActive(promo)
                          }
                          disabled={isToggling}
                          className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            promo.active
                              ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {isToggling ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Power size={14} />
                          )}
                          {promo.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {currentPage} of {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchPromoCodes(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <button
              type="button"
              onClick={() => fetchPromoCodes(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

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
        onConfirm={() => {
          if (pendingToggle) {
            handleToggleActive(pendingToggle);
          }
          setPendingToggle(null);
        }}
        onCancel={() => setPendingToggle(null)}
      />
    </div>
  );
};

export default PromoCodeManager;
