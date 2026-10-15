import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * The Notifications page keeps its sub-view in the URL (`?tab=deliveries`) so
 * a section can be linked to, survives a reload, and other sections can jump
 * into it with a filter already applied (e.g. Overview → failed deliveries).
 */
export type NotificationTab =
  | 'overview'
  | 'deliveries'
  | 'templates'
  | 'devices'
  | 'suppressions'
  | 'webhooks'
  | 'send';

export const NOTIFICATION_TABS: { id: NotificationTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'deliveries', label: 'Delivery log' },
  { id: 'templates', label: 'Templates' },
  { id: 'devices', label: 'Devices' },
  { id: 'suppressions', label: 'Suppressions' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'send', label: 'Test send' },
];

const TAB_PARAM = 'tab';

export const normalizeNotificationTab = (value: string | null): NotificationTab =>
  NOTIFICATION_TABS.some((tab) => tab.id === value) ? (value as NotificationTab) : 'overview';

/** One-shot parameters a section reads when it opens (see `useLinkParams`). */
export type TabLinkParams = Record<string, string | number | undefined | null>;

/** Delivery log deep-link keys. */
export const DELIVERY_LINK_KEYS = ['notification', 'status', 'channel', 'window'] as const;
/** Test send deep-link keys. */
export const SEND_LINK_KEYS = ['template', 'channel'] as const;

export const useNotificationTabs = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeNotificationTab(searchParams.get(TAB_PARAM));

  const openTab = useCallback(
    (tab: NotificationTab, params?: TabLinkParams) => {
      const next = new URLSearchParams();
      next.set(TAB_PARAM, tab);
      Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        next.set(key, String(value));
      });
      setSearchParams(next);
    },
    [setSearchParams],
  );

  return { activeTab, openTab };
};

/**
 * Reads the given query parameters once, when the section mounts, then strips
 * them from the URL so a later reload doesn't re-apply a stale filter.
 */
export const useLinkParams = (keys: readonly string[]): Record<string, string> => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [initial] = useState(() => {
    const values: Record<string, string> = {};
    keys.forEach((key) => {
      const value = searchParams.get(key);
      if (value !== null) values[key] = value;
    });
    return values;
  });

  useEffect(() => {
    // Guarded on the live URL: `setSearchParams` changes identity with every
    // navigation, so an unconditional strip would navigate again each time.
    const present = Object.keys(initial).filter((key) => searchParams.has(key));
    if (present.length === 0) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        present.forEach((key) => next.delete(key));
        return next;
      },
      { replace: true },
    );
  }, [initial, searchParams, setSearchParams]);

  return initial;
};
