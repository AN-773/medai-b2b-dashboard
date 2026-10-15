import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, SearchX, ShieldAlert, ShieldCheck, Undo2 } from 'lucide-react';
import { SuppressedEmail, notificationService } from '../../services/notificationService';
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
  SearchInput,
  SectionHeader,
  StatusDot,
  cn,
  type BadgeTone,
} from '@/components/ui';
import {
  DataTable,
  LoadingRow,
  Pagination,
  TableMessage,
  Timestamp,
  errorMessage,
  plural,
  tdClass,
  useToast,
} from './shared';

const PAGE_SIZE = 25;

/** Waits this long after typing before searching the server. */
const SEARCH_DEBOUNCE_MS = 350;

const sourceLabel: Record<SuppressedEmail['source'], string> = {
  smtp_permanent: 'Hard bounce (SMTP)',
  acs_delivery_report: 'Delivery report',
  manual: 'Added manually',
};

const sourceTone: Record<SuppressedEmail['source'], BadgeTone> = {
  smtp_permanent: 'red',
  acs_delivery_report: 'amber',
  manual: 'neutral',
};

const COLUMNS = [
  { label: 'Address' },
  { label: 'Source' },
  { label: 'Suppressed' },
  { label: 'Actions', srOnly: true, className: 'w-12' },
];

const ADD_FORM_ID = 'suppression-add-form';

const SuppressionManager: React.FC = () => {
  const { toast, showToast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);

  const [entries, setEntries] = useState<SuppressedEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newReason, setNewReason] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

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

  const applySearch = useCallback(
    (value: string) => {
      const next = value.trim();
      if (next === query) return;
      setQuery(next);
      setOffset(0);
    },
    [query],
  );

  // Search as you type, once typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => applySearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [applySearch, searchInput]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    applySearch(searchInput);
  };

  const openAdd = () => {
    setNewEmail('');
    setNewReason('');
    setAddError('');
    setIsAddOpen(true);
  };

  const closeAdd = () => {
    if (isAdding) return;
    setIsAddOpen(false);
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

    try {
      await notificationService.addSuppression(email, newReason.trim());
      showToast(`${email} will no longer receive email from medai.`);
      setNewEmail('');
      setNewReason('');
      setIsAddOpen(false);
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
      showToast(`${entry.email} can receive email again.`);
      await load(query, offset);
    } catch (err) {
      console.error('Failed to remove suppression:', err);
      setListError(errorMessage(err, 'Unable to remove this address.'));
    } finally {
      setRemovingEmail('');
    }
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    await handleRemove(pendingRemove);
    setPendingRemove(null);
  };

  const isFirstLoad = isLoading && entries.length === 0;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Suppression list"
        description="Addresses medai will never email again. Entries arrive automatically from hard bounces and provider delivery reports; removing one lets sending resume."
        meta={
          !isFirstLoad && !listError ? (
            <Badge className="tabular-nums">
              {plural(total, 'address', 'addresses')}
              {query ? ' matching' : ''}
            </Badge>
          ) : undefined
        }
        actions={
          <>
            <IconButton
              icon={RefreshCw}
              label="Refresh"
              onClick={() => load(query, offset)}
              disabled={isLoading}
              className={isLoading ? '[&_svg]:animate-spin' : undefined}
            />
            <Button icon={ShieldAlert} onClick={openAdd}>
              Suppress address
            </Button>
          </>
        }
      />

      <form role="search" aria-label="Search suppressed addresses" onSubmit={handleSearch}>
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by address"
          aria-label="Search suppressed addresses"
          className="w-full sm:w-80"
        />
      </form>

      {listError && (
        <InlineAlert
          className="break-words"
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={RefreshCw}
              onClick={() => load(query, offset)}
              className="-my-0.5"
            >
              Try again
            </Button>
          }
        >
          {listError}
        </InlineAlert>
      )}

      {!(listError && entries.length === 0) && (
        <DataTable
          label="Suppressed addresses"
          columns={COLUMNS}
          busy={isLoading && entries.length > 0}
          footer={
            <Pagination
              offset={offset}
              limit={PAGE_SIZE}
              total={total}
              disabled={isLoading}
              onChange={setOffset}
            />
          }
        >
          {isFirstLoad ? (
            <LoadingRow colSpan={COLUMNS.length} label="Loading suppressions…" />
          ) : entries.length === 0 ? (
            <TableMessage colSpan={COLUMNS.length}>
              {query ? (
                <EmptyState
                  compact
                  icon={SearchX}
                  title={`No suppressed address matches “${query}”`}
                  description="That address is not blocked, so medai can email it."
                />
              ) : (
                <EmptyState
                  compact
                  icon={ShieldCheck}
                  title="Nothing suppressed"
                  description="Every address is deliverable."
                />
              )}
            </TableMessage>
          ) : (
            entries.map((entry) => {
              const isRemoving = removingEmail === entry.email;
              return (
                <tr
                  key={entry.id || entry.email}
                  className={cn('transition-colors hover:bg-stone-50', isRemoving && 'opacity-50')}
                >
                  <td className={tdClass}>
                    <p className="max-w-[32rem] break-all font-medium text-stone-900">{entry.email}</p>
                    {entry.reason && (
                      <p className="mt-0.5 max-w-[32rem] break-words text-xs text-stone-500">{entry.reason}</p>
                    )}
                  </td>
                  <td className={cn(tdClass, 'whitespace-nowrap')}>
                    <StatusDot tone={sourceTone[entry.source] ?? 'neutral'}>
                      {sourceLabel[entry.source] ?? entry.source}
                    </StatusDot>
                  </td>
                  <td className={cn(tdClass, 'text-stone-600')}>
                    <Timestamp value={entry.created_at} />
                  </td>
                  <td className="w-12 py-2 pr-3 text-right">
                    <Menu
                      size="sm"
                      label={`Actions for ${entry.email}`}
                      items={[
                        {
                          label: 'Unsuppress',
                          icon: Undo2,
                          disabled: Boolean(removingEmail),
                          hint: removingEmail ? 'Wait for the current removal to finish' : undefined,
                          onSelect: () => setPendingRemove(entry),
                        },
                      ]}
                    />
                  </td>
                </tr>
              );
            })
          )}
        </DataTable>
      )}

      <Dialog
        open={isAddOpen}
        onClose={closeAdd}
        dismissible={!isAdding}
        title="Suppress an address"
        description="Blocks all future email to this address. Suppressing protects sender reputation; adding an address that's already listed changes nothing."
        footer={
          <>
            <Button variant="ghost" onClick={closeAdd} disabled={isAdding}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form={ADD_FORM_ID} loading={isAdding}>
              Suppress address
            </Button>
          </>
        }
      >
        <form id={ADD_FORM_ID} onSubmit={handleAdd} className="space-y-4">
          {addError && <InlineAlert className="break-words">{addError}</InlineAlert>}
          <Field label="Email address">
            {(id) => (
              <Input
                id={id}
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="bounced@example.com"
                autoComplete="off"
              />
            )}
          </Field>
          <Field label="Reason" hint="Optional">
            {(id) => (
              <Input
                id={id}
                value={newReason}
                onChange={(event) => setNewReason(event.target.value)}
                placeholder="Reported as spam"
              />
            )}
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pendingRemove !== null}
        tone="default"
        title="Remove from suppression list?"
        description={
          pendingRemove
            ? `medai will start emailing ${pendingRemove.email} again. If it was suppressed for a hard bounce, sending to it can hurt sender reputation and it may be re-suppressed on the next bounce.`
            : ''
        }
        confirmLabel="Unsuppress"
        busy={Boolean(removingEmail)}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setPendingRemove(null)}
      />

      {toast}
    </div>
  );
};

export default SuppressionManager;
