import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Search, ShieldAlert, ShieldCheck, Undo2, X } from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import { SuppressedEmail, notificationService } from '../../services/notificationService';
import {
  ErrorBanner,
  LoadingRow,
  Pagination,
  Panel,
  TableMessage,
  errorMessage,
  formatTimestamp,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './shared';

const PAGE_SIZE = 25;

const sourceLabel: Record<SuppressedEmail['source'], string> = {
  smtp_permanent: 'Hard bounce (SMTP)',
  acs_delivery_report: 'Delivery report',
  manual: 'Added manually',
};

const sourceBadgeClass: Record<SuppressedEmail['source'], string> = {
  smtp_permanent: 'bg-rose-50 text-rose-700 border-rose-200',
  acs_delivery_report: 'bg-amber-50 text-amber-700 border-amber-200',
  manual: 'bg-slate-100 text-slate-600 border-slate-200',
};

const SuppressionManager: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);

  const [entries, setEntries] = useState<SuppressedEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [newReason, setNewReason] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [addNotice, setAddNotice] = useState('');

  const [pendingRemove, setPendingRemove] = useState<SuppressedEmail | null>(null);
  const [removingEmail, setRemovingEmail] = useState('');

  const load = useCallback(async (activeQuery: string, nextOffset: number) => {
    setIsLoading(true);
    setListError('');

    try {
      const page = await notificationService.listSuppressions(activeQuery, PAGE_SIZE, nextOffset);
      setEntries(page.items || []);
      setTotal(page.total || 0);
    } catch (err) {
      console.error('Failed to load suppressions:', err);
      setEntries([]);
      setTotal(0);
      setListError(errorMessage(err, 'Unable to load the suppression list.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(query, offset);
  }, [load, query, offset]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery(searchInput.trim());
    setOffset(0);
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();

    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAddError('Enter a valid email address.');
      return;
    }

    setIsAdding(true);
    setAddError('');
    setAddNotice('');

    try {
      await notificationService.addSuppression(email, newReason.trim());
      setAddNotice(`${email} will no longer receive email from medai.`);
      setNewEmail('');
      setNewReason('');
      await load(query, 0);
      setOffset(0);
    } catch (err) {
      console.error('Failed to add suppression:', err);
      setAddError(errorMessage(err, 'Unable to suppress this address.'));
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (entry: SuppressedEmail) => {
    setRemovingEmail(entry.email);
    setListError('');

    try {
      await notificationService.removeSuppression(entry.email);
      await load(query, offset);
    } catch (err) {
      console.error('Failed to remove suppression:', err);
      setListError(errorMessage(err, 'Unable to remove this address.'));
    } finally {
      setRemovingEmail('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Suppression List</h3>
        <p className="text-sm text-slate-500">
          Addresses medai will never email again. Entries arrive automatically from hard bounces
          and provider delivery reports; removing one lets sending resume.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)] gap-6 items-start">
        <Panel
          title="Suppressed addresses"
          description={`${total.toLocaleString()} total`}
          actions={
            <button
              type="button"
              onClick={() => load(query, offset)}
              disabled={isLoading}
              className={secondaryButtonClass}
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Refresh
            </button>
          }
        >
          <form onSubmit={handleSearch} className="px-6 py-4 border-b border-slate-200 flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by address"
                aria-label="Search suppressed addresses"
                className={`${inputClass} pl-11`}
              />
            </div>
            <button type="submit" disabled={isLoading} className={secondaryButtonClass}>
              Search
            </button>
            {query && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setQuery('');
                  setOffset(0);
                }}
                className={secondaryButtonClass}
              >
                <X size={16} />
              </button>
            )}
          </form>

          {listError && (
            <div className="px-6 pt-6">
              <ErrorBanner message={listError} />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Suppressed</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <LoadingRow colSpan={4} label="Loading suppressions" />
                ) : entries.length === 0 ? (
                  <TableMessage colSpan={4}>
                    {query
                      ? `No suppressed address matches "${query}".`
                      : 'Nothing suppressed — every address is deliverable.'}
                  </TableMessage>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id || entry.email} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-900 break-all">{entry.email}</p>
                        {entry.reason && (
                          <p className="text-xs text-slate-500 mt-1 break-words">{entry.reason}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${
                            sourceBadgeClass[entry.source] ?? sourceBadgeClass.manual
                          }`}
                        >
                          {sourceLabel[entry.source] ?? entry.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                        {formatTimestamp(entry.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setPendingRemove(entry)}
                          disabled={removingEmail === entry.email}
                          className="inline-flex items-center gap-2 px-3 py-2 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {removingEmail === entry.email ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Undo2 size={14} />
                          )}
                          Unsuppress
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            total={total}
            disabled={isLoading}
            onChange={setOffset}
          />
        </Panel>

        <form onSubmit={handleAdd}>
          <Panel title="Suppress an address" description="Blocks all future email to this address.">
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label htmlFor="suppress-email" className={labelClass}>
                  Email address
                </label>
                <input
                  id="suppress-email"
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="bounced@example.com"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="suppress-reason" className={labelClass}>
                  Reason <span className="normal-case font-semibold text-slate-400">(optional)</span>
                </label>
                <input
                  id="suppress-reason"
                  type="text"
                  value={newReason}
                  onChange={(event) => setNewReason(event.target.value)}
                  placeholder="Reported as spam"
                  className={inputClass}
                />
              </div>

              <ErrorBanner message={addError} />

              {addNotice && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                  <p>{addNotice}</p>
                </div>
              )}

              <button type="submit" disabled={isAdding} className={`${primaryButtonClass} w-full`}>
                {isAdding ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                Suppress Address
              </button>

              <p className="text-xs text-slate-500">
                Suppressing protects sender reputation. Adding an address already on the list is a
                no-op.
              </p>
            </div>
          </Panel>
        </form>
      </div>

      <ConfirmationModal
        isOpen={pendingRemove !== null}
        title="Remove from suppression list?"
        message={
          pendingRemove
            ? `medai will start emailing ${pendingRemove.email} again. If it was suppressed for a hard bounce, sending to it can hurt sender reputation and it may be re-suppressed on the next bounce.`
            : ''
        }
        confirmLabel="Unsuppress"
        variant="warning"
        onConfirm={() => {
          if (pendingRemove) {
            handleRemove(pendingRemove);
          }
          setPendingRemove(null);
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
};

export default SuppressionManager;
