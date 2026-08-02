import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Search, Smartphone, Trash2, X } from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import { DeviceToken, notificationService } from '../../services/notificationService';
import {
  ErrorBanner,
  LoadingRow,
  Pagination,
  Panel,
  TableMessage,
  errorMessage,
  formatTimestamp,
  inputClass,
  secondaryButtonClass,
} from './shared';

const PAGE_SIZE = 25;

const platformBadgeClass: Record<string, string> = {
  ios: 'bg-slate-900 text-white border-slate-900',
  android: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  web: 'bg-sky-50 text-sky-700 border-sky-200',
};

/** Device tokens are long and opaque; show enough to match one by eye. */
const shortenToken = (token: string): string =>
  token.length <= 24 ? token : `${token.slice(0, 12)}…${token.slice(-8)}`;

const DeviceTokenBrowser: React.FC = () => {
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

  const handleRevoke = async (token: DeviceToken) => {
    setRevokingToken(token.token);
    setError('');

    try {
      await notificationService.revokeDeviceToken(token.token);
      await load(userId, offset);
    } catch (err) {
      console.error('Failed to revoke device token:', err);
      setError(errorMessage(err, 'Unable to revoke this device token.'));
    } finally {
      setRevokingToken('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Device Tokens</h3>
        <p className="text-sm text-slate-500">
          FCM registrations used for push. A user with no token here cannot receive push
          notifications — that is usually the answer to "why didn't they get it?".
        </p>
      </div>

      <ErrorBanner message={error} />

      <Panel
        title="Registered tokens"
        description={userId ? `Scoped to user ${userId}` : `${total.toLocaleString()} across all users`}
        actions={
          <button
            type="button"
            onClick={() => load(userId, offset)}
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
              value={userIdInput}
              onChange={(event) => setUserIdInput(event.target.value)}
              placeholder="Filter by exact user ID"
              aria-label="Filter device tokens by user ID"
              className={`${inputClass} pl-11 font-mono text-xs`}
            />
          </div>
          <button type="submit" disabled={isLoading} className={secondaryButtonClass}>
            Search
          </button>
          {userId && (
            <button
              type="button"
              onClick={() => {
                setUserIdInput('');
                setUserId('');
                setOffset(0);
              }}
              className={secondaryButtonClass}
            >
              <X size={16} />
            </button>
          )}
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white">
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Token</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Platform</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Last seen</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <LoadingRow colSpan={5} label="Loading device tokens" />
              ) : tokens.length === 0 ? (
                <TableMessage colSpan={5}>
                  {userId
                    ? `No device tokens registered for "${userId}". That user cannot receive push.`
                    : 'No device tokens registered yet.'}
                </TableMessage>
              ) : (
                tokens.map((token) => (
                  <tr key={token.id || token.token} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-xs font-mono text-slate-900 break-all">{token.user_id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-mono text-slate-600" title={token.token}>
                        {shortenToken(token.token)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Registered {formatTimestamp(token.created_at)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold capitalize ${
                          platformBadgeClass[token.platform] ??
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {token.platform || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                      {formatTimestamp(token.last_seen)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setPendingRevoke(token)}
                        disabled={revokingToken === token.token}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-rose-200 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {revokingToken === token.token ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        Revoke
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

      <p className="flex items-center gap-2 text-xs text-slate-400">
        <Smartphone size={12} />
        Tokens re-register on the user's next app launch, so revoking only stops push until then.
      </p>

      <ConfirmationModal
        isOpen={pendingRevoke !== null}
        title="Revoke device token?"
        message={
          pendingRevoke
            ? `Push to this ${pendingRevoke.platform || 'device'} registration for ${pendingRevoke.user_id} stops immediately. The app re-registers on next launch.`
            : ''
        }
        confirmLabel="Revoke"
        variant="danger"
        onConfirm={() => {
          if (pendingRevoke) {
            handleRevoke(pendingRevoke);
          }
          setPendingRevoke(null);
        }}
        onCancel={() => setPendingRevoke(null)}
      />
    </div>
  );
};

export default DeviceTokenBrowser;
