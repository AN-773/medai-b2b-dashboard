import React from 'react';
import type { IamInvite } from '@/services/iamService';
import { Spinner, StatusDot, cn } from '@/components/ui';
import {
  formatDate,
  getInviteRoleLabel,
  getInviteStatusLabel,
  getInviteStatusTone,
  plural,
} from './studentRegistryUtils';

interface InvitesTableProps {
  invites: IamInvite[];
  /** All visible pending invites, before the search filter. */
  totalVisible: number;
  /** Pending invites hidden because the email already belongs to a student. */
  hiddenCount: number;
  isLoading: boolean;
}

const InvitesTable: React.FC<InvitesTableProps> = ({
  invites,
  totalVisible,
  hiddenCount,
  isLoading,
}) => (
  <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-[13px]">
        <thead className="border-b border-stone-200 bg-stone-50/70 text-stone-500">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Email
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Access
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Sent
            </th>
            <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
              Expires
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody aria-busy={isLoading} className={cn('transition-opacity', isLoading && 'opacity-60')}>
          {invites.map((invite) => (
            <tr key={invite.id} className="border-b border-stone-100 last:border-b-0">
              <td className="max-w-[22rem] px-4 py-3">
                <p className="truncate text-sm font-medium text-stone-900">{invite.email}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                {getInviteRoleLabel(invite.role)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-stone-700">
                {formatDate(invite.created) ?? <span className="text-stone-400">—</span>}
              </td>
              <td className="hidden whitespace-nowrap px-4 py-3 tabular-nums text-stone-700 sm:table-cell">
                {formatDate(invite.expiresAt) ?? <span className="text-stone-400">—</span>}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusDot tone={getInviteStatusTone(invite.status)}>
                  {getInviteStatusLabel(invite.status)}
                </StatusDot>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-stone-200 px-4 py-2.5 text-[13px] text-stone-500">
      <p className="tabular-nums">
        {invites.length === totalVisible
          ? plural(totalVisible, 'pending invite')
          : `${invites.length.toLocaleString()} of ${plural(totalVisible, 'pending invite')}`}
        {hiddenCount > 0 && (
          <>
            {' · '}
            {hiddenCount.toLocaleString()} hidden because those students have already joined
          </>
        )}
      </p>
      {isLoading && <Spinner label="Refreshing…" />}
    </div>
  </div>
);

export default InvitesTable;
