import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, Smartphone, SmartphoneNfc, Trash2 } from 'lucide-react';
import { DeviceToken, notificationService } from '../../services/notificationService';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  InlineAlert,
  Menu,
  SearchInput,
  SectionHeader,
  cn,
} from '@/components/ui';
import {
  CopyButton,
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

const PLATFORM_LABEL: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  web: 'Web',
};

/** Device tokens are long and opaque; show enough to match one by eye. */
const shortenToken = (token: string): string =>
  token.length <= 24 ? token : `${token.slice(0, 12)}…${token.slice(-8)}`;

const COLUMNS = [
  { label: 'User' },
  { label: 'Token' },
  { label: 'Platform' },
  { label: 'Registered' },
  { label: 'Last seen' },
  { label: 'Actions', srOnly: true, className: 'w-12' },
];

const DeviceTokenBrowser: React.FC = () => {
  const { toast, showToast } = useToast();
  const [userIdInput, setUserIdInput] = useState('');
  const [userId, setUserId] = useState('');
  const [offset, setOffset] = useState(0);

  const [tokens, setTokens] = useState<DeviceToken[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [pendingRevoke, setPendingRevoke] = useState<DeviceToken | null>(null);
  const [revokingToken, setRevokingToken] = useState('');

  const load = useCallback(async (activeUserId: string, nextOffset: number) => {
    setIsLoading(true);
    setError('');

    try {
      const page = await notificationService.searchDeviceTokens(
        activeUserId,
        PAGE_SIZE,
        nextOffset
      );
      setTokens(page.items || []);
      setTotal(page.total || 0);
    } catch (err) {
      console.error('Failed to load device tokens:', err);
      setTokens([]);
      setTotal(0);
      setError(errorMessage(err, 'Unable to load device tokens.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(userId, offset);
  }, [load, userId, offset]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setUserId(userIdInput.trim());
    setOffset(0);
  };

  const clearUser = () => {
    setUserIdInput('');
    setUserId('');
    setOffset(0);
  };

  const handleRevoke = async (token: DeviceToken) => {
    setRevokingToken(token.token);
    setError('');

    try {
      await notificationService.revokeDeviceToken(token.token);
      showToast(
        `Revoked the ${PLATFORM_LABEL[token.platform] ?? 'device'} token for ${token.user_id}.`,
      );
      await load(userId, offset);
    } catch (err) {
      console.error('Failed to revoke device token:', err);
      setError(errorMessage(err, 'Unable to revoke this device token.'));
    } finally {
      setRevokingToken('');
    }
  };

  const confirmRevoke = async () => {
    if (!pendingRevoke) return;
    await handleRevoke(pendingRevoke);
    setPendingRevoke(null);
  };

  const isFirstLoad = isLoading && tokens.length === 0;
  const hasPendingSearch = userIdInput.trim() !== userId;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Device tokens"
        description="FCM registrations used for push. A user with no token here cannot receive push notifications — that is usually the answer to “why didn’t they get it?”."
        meta={
          !isFirstLoad && !error ? (
            <Badge className="tabular-nums">
              {plural(total, 'token')}
              {userId ? ' for this user' : ''}
            </Badge>
          ) : undefined
        }
        actions={
          <IconButton
            icon={RefreshCw}
            label="Refresh"
            onClick={() => load(userId, offset)}
            disabled={isLoading}
            className={isLoading ? '[&_svg]:animate-spin' : undefined}
          />
        }
      />

      <form
        role="search"
        aria-label="Filter device tokens"
        onSubmit={handleSearch}
        className="flex flex-wrap items-center gap-2"
      >
        <SearchInput
          value={userIdInput}
          onChange={(value) => (value === '' && userId ? clearUser() : setUserIdInput(value))}
          placeholder="Exact user ID, e.g. users/42"
          aria-label="Filter device tokens by user ID"
          spellCheck={false}
          className="w-full sm:w-80"
        />
        <Button type="submit" icon={Search} disabled={isLoading || !hasPendingSearch}>
          Search
        </Button>
        {userId && (
          <p className="text-[13px] text-stone-500">
            Showing tokens for <span className="font-mono text-stone-800">{userId}</span>
          </p>
        )}
      </form>

      {error && (
        <InlineAlert
          className="break-words"
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={RefreshCw}
              onClick={() => load(userId, offset)}
              className="-my-0.5"
            >
              Try again
            </Button>
          }
        >
          {error}
        </InlineAlert>
      )}

      {!(error && tokens.length === 0) && (
        <DataTable
          label="Registered device tokens"
          columns={COLUMNS}
          busy={isLoading && tokens.length > 0}
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
            <LoadingRow colSpan={COLUMNS.length} label="Loading device tokens…" />
          ) : tokens.length === 0 ? (
            <TableMessage colSpan={COLUMNS.length}>
              {userId ? (
                <EmptyState
                  compact
                  icon={SmartphoneNfc}
                  title={`No device tokens registered for “${userId}”`}
                  description="That user cannot receive push until the app registers a device."
                  action={
                    <Button size="sm" onClick={clearUser}>
                      Show all users
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  compact
                  icon={Smartphone}
                  title="No device tokens registered yet"
                  description="Tokens appear when a signed-in user opens the app with push allowed."
                />
              )}
            </TableMessage>
          ) : (
            tokens.map((token) => {
              const isRevoking = revokingToken === token.token;
              return (
                <tr
                  key={token.id || token.token}
                  className={cn('transition-colors hover:bg-stone-50', isRevoking && 'opacity-50')}
                >
                  <td className={tdClass}>
                    <p className="max-w-[16rem] break-all font-mono text-[13px] text-stone-900">{token.user_id}</p>
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center gap-1">
                      <code
                        className="whitespace-nowrap font-mono text-xs text-stone-600"
                        title={token.token}
                      >
                        {shortenToken(token.token)}
                      </code>
                      <CopyButton value={token.token} label="Copy full token" />
                    </div>
                  </td>
                  <td className={tdClass}>
                    <Badge>{PLATFORM_LABEL[token.platform] ?? (token.platform || 'Unknown')}</Badge>
                  </td>
                  <td className={cn(tdClass, 'text-stone-600')}>
                    <Timestamp value={token.created_at} />
                  </td>
                  <td className={cn(tdClass, 'text-stone-600')}>
                    <Timestamp value={token.last_seen} />
                  </td>
                  <td className="w-12 py-2 pr-3 text-right">
                    <Menu
                      size="sm"
                      label={`Actions for ${token.user_id}'s ${PLATFORM_LABEL[token.platform] ?? 'device'} token`}
                      items={[
                        {
                          label: 'Revoke token',
                          icon: Trash2,
                          tone: 'danger',
                          disabled: Boolean(revokingToken),
                          hint: revokingToken ? 'Wait for the current revoke to finish' : undefined,
                          onSelect: () => setPendingRevoke(token),
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

      <p className="text-xs text-stone-500">
        Tokens re-register on the user’s next app launch, so revoking only stops push until then.
      </p>

      <ConfirmDialog
        open={pendingRevoke !== null}
        title="Revoke device token?"
        description={
          pendingRevoke
            ? `Push to this ${pendingRevoke.platform || 'device'} registration for ${pendingRevoke.user_id} stops immediately. The app re-registers on next launch.`
            : ''
        }
        confirmLabel="Revoke token"
        busy={Boolean(revokingToken)}
        onConfirm={() => void confirmRevoke()}
        onCancel={() => setPendingRevoke(null)}
      />

      {toast}
    </div>
  );
};

export default DeviceTokenBrowser;
