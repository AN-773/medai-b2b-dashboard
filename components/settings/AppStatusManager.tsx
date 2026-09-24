import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Megaphone, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { appStatusService, AppStatusSettings } from '../../services/appStatusService';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  SectionHeader,
  Select,
  Spinner,
  SwitchRow,
  Textarea,
  cn,
} from '@/components/ui';
import {
  InlineSwitch,
  SaveBar,
  SettingsCard,
  Toast,
  useToast,
  useUnsavedChanges,
} from './SettingsKit';

const MAX_ANNOUNCEMENTS = 50;

const SCOPE_DESCRIPTIONS: Record<AppStatusSettings['maintenance']['scope'], string> = {
  app: 'The landing page stays visible, with its chat disabled and marked under maintenance.',
  all: 'Every page, including the landing page, is replaced with the maintenance screen.',
};

const AppStatusManager: React.FC = () => {
  const [settings, setSettings] = useState<AppStatusSettings | null>(null);
  const [published, setPublished] = useState<AppStatusSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [showEmptyErrors, setShowEmptyErrors] = useState(false);
  const [isConfirmingReload, setIsConfirmingReload] = useState(false);
  const toast = useToast();
  const dirty = JSON.stringify(settings) !== JSON.stringify(published);
  useUnsavedChanges(dirty);

  const load = async () => {
    setLoading(true);
    setError('');
    setLoadError('');
    setShowEmptyErrors(false);
    try {
      const result = await appStatusService.get();
      setSettings(result);
      setPublished(result);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load app status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const edit = (next: AppStatusSettings) => {
    setSettings(next);
  };

  const move = (index: number, offset: number) => {
    if (!settings) return;
    const announcements = [...settings.announcements];
    [announcements[index], announcements[index + offset]] = [announcements[index + offset], announcements[index]];
    edit({ ...settings, announcements });
  };

  const discard = () => {
    setSettings(published);
    setError('');
    setShowEmptyErrors(false);
  };

  const requestReload = () => {
    if (dirty) {
      setIsConfirmingReload(true);
      return;
    }
    void load();
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    if (settings.announcements.some(item => !item.message.trim())) {
      setShowEmptyErrors(true);
      setError('Every announcement needs a message. Remove empty announcements before publishing.');
      return;
    }
    setSaving(true);
    setError('');
    setShowEmptyErrors(false);
    try {
      const result = await appStatusService.update(settings);
      setSettings(result);
      setPublished(result);
      toast.show('Published. Open apps will pick up these changes within 30 seconds.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish app status.');
    } finally {
      setSaving(false);
    }
  };

  const liveMaintenance = published?.maintenance;
  const liveLabel = liveMaintenance?.enabled
    ? liveMaintenance.scope === 'all'
      ? 'Entire site under maintenance'
      : 'App under maintenance'
    : 'Online';

  const publishedById = new Map(published?.announcements.map(item => [item.id, item]) ?? []);

  const addAnnouncement = () => {
    if (!settings) return;
    edit({
      ...settings,
      announcements: [
        ...settings.announcements,
        { id: crypto.randomUUID(), message: '', enabled: true, showOnLanding: false },
      ],
    });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <SectionHeader
        title="App status"
        description="Maintenance mode and the announcement bars shown across the MedAI web and mobile apps."
        meta={
          published && (
            <Badge tone={liveMaintenance?.enabled ? 'amber' : 'green'} dot title="What users see right now">
              Live: {liveLabel}
            </Badge>
          )
        }
        actions={
          <IconButton
            icon={RefreshCw}
            label={dirty ? 'Discard changes and reload' : 'Reload'}
            onClick={requestReload}
            disabled={loading || saving}
            className={loading ? '[&_svg]:animate-spin' : undefined}
          />
        }
      />

      {loadError && (
        <InlineAlert
          title="Couldn't load app status"
          action={
            <Button size="sm" variant="secondary" onClick={() => void load()} loading={loading}>
              Retry
            </Button>
          }
        >
          {loadError}
        </InlineAlert>
      )}

      {loading && !settings ? (
        <Spinner label="Loading app status…" className="py-24" />
      ) : settings && (
        <form onSubmit={save} noValidate>
          <fieldset disabled={saving} className="space-y-6 disabled:opacity-70">
            <SettingsCard
              title="Maintenance"
              description="Take the app offline for users while you work on it."
            >
              <div className="space-y-5">
                <SwitchRow
                  checked={settings.maintenance.enabled}
                  onChange={enabled => edit({ ...settings, maintenance: { ...settings.maintenance, enabled } })}
                  label="Enable maintenance mode"
                  description="Users see the maintenance screen until you turn this off and publish."
                  disabled={saving}
                />
                <div className="grid gap-4 border-t border-stone-100 pt-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                  <Field label="Scope" description={SCOPE_DESCRIPTIONS[settings.maintenance.scope]}>
                    {id => (
                      <Select
                        id={id}
                        value={settings.maintenance.scope}
                        onChange={e => edit({ ...settings, maintenance: { ...settings.maintenance, scope: e.target.value as 'app' | 'all' } })}
                      >
                        <option value="app">App only (default)</option>
                        <option value="all">Entire site, including the landing page</option>
                      </Select>
                    )}
                  </Field>
                  <Field
                    label="Message"
                    hint="Optional"
                    description="Leave blank to use the app’s translated default message."
                  >
                    {id => (
                      <Textarea
                        id={id}
                        rows={3}
                        maxLength={2000}
                        value={settings.maintenance.message}
                        placeholder="We’re making improvements and will be back shortly."
                        onChange={e => edit({ ...settings, maintenance: { ...settings.maintenance, message: e.target.value } })}
                      />
                    )}
                  </Field>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Announcements"
              meta={
                settings.announcements.length > 0 && (
                  <span className="text-[13px] tabular-nums text-stone-500">
                    {settings.announcements.filter(item => item.enabled).length} of {settings.announcements.length} enabled
                  </span>
                )
              }
              description="Shown as a top bar in the app, one at a time in this order; closing one reveals the next. Editing a message shows it again to users who closed its previous version."
              actions={
                settings.announcements.length > 0 && (
                  <Button
                    size="sm"
                    icon={Plus}
                    onClick={addAnnouncement}
                    disabled={settings.announcements.length >= MAX_ANNOUNCEMENTS}
                    title={settings.announcements.length >= MAX_ANNOUNCEMENTS ? `Up to ${MAX_ANNOUNCEMENTS} announcements` : undefined}
                  >
                    Add announcement
                  </Button>
                )
              }
              bodyClassName="p-0"
            >
              {settings.announcements.length === 0 ? (
                <EmptyState
                  compact
                  icon={Megaphone}
                  title="No announcements"
                  description="Add one to show a message bar across the app."
                  action={
                    <Button size="sm" icon={Plus} onClick={addAnnouncement}>
                      Add announcement
                    </Button>
                  }
                />
              ) : (
                <ol className="divide-y divide-stone-100">
                  {settings.announcements.map((item, index) => {
                    const position = index + 1;
                    const isEmpty = showEmptyErrors && !item.message.trim();
                    const previous = publishedById.get(item.id);
                    const change = !previous
                      ? 'New'
                      : previous.message !== item.message
                        ? 'Edited'
                        : null;
                    const update = (patch: Partial<typeof item>) =>
                      edit({
                        ...settings,
                        announcements: settings.announcements.map(a => a.id === item.id ? { ...a, ...patch } : a),
                      });
                    return (
                      <li key={item.id} className="flex gap-3 px-5 py-4">
                        <span
                          className={cn(
                            'mt-1.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-medium tabular-nums',
                            item.enabled ? 'bg-stone-100 text-stone-700' : 'bg-stone-50 text-stone-400 ring-1 ring-inset ring-stone-200',
                          )}
                        >
                          {position}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Textarea
                            aria-label={`Announcement ${position} message`}
                            aria-invalid={isEmpty || undefined}
                            rows={2}
                            maxLength={2000}
                            value={item.message}
                            onChange={e => update({ message: e.target.value })}
                            placeholder="What would you like users to know?"
                            className={cn(isEmpty && 'border-red-300', !item.enabled && 'text-stone-500')}
                          />
                          {isEmpty && (
                            <p className="mt-1.5 text-xs text-red-600">Add a message or remove this announcement.</p>
                          )}
                          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
                            <InlineSwitch
                              checked={item.enabled}
                              onChange={enabled => update({ enabled })}
                              label="Enabled"
                              ariaLabel={`Announcement ${position} enabled`}
                              disabled={saving}
                            />
                            <InlineSwitch
                              checked={item.showOnLanding === true}
                              onChange={showOnLanding => update({ showOnLanding })}
                              label="Also show on landing page"
                              ariaLabel={`Also show announcement ${position} on landing page`}
                              disabled={saving}
                            />
                            {change && <Badge tone="amber">{change}</Badge>}
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-start gap-0.5 pt-1">
                          <IconButton
                            icon={ArrowUp}
                            size="sm"
                            label={`Move announcement ${position} up`}
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                          />
                          <IconButton
                            icon={ArrowDown}
                            size="sm"
                            label={`Move announcement ${position} down`}
                            disabled={index === settings.announcements.length - 1}
                            onClick={() => move(index, 1)}
                          />
                          <IconButton
                            icon={Trash2}
                            size="sm"
                            tone="danger"
                            label={`Remove announcement ${position}`}
                            onClick={() => edit({ ...settings, announcements: settings.announcements.filter(a => a.id !== item.id) })}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </SettingsCard>
          </fieldset>

          <SaveBar
            dirty={dirty}
            saving={saving}
            onDiscard={discard}
            saveLabel="Publish changes"
            dirtyText="You have unpublished changes."
            cleanText="All changes are published."
            error={error}
          />
        </form>
      )}

      <ConfirmDialog
        open={isConfirmingReload}
        title="Discard unpublished changes?"
        description="Reloading replaces your edits with the published app status."
        confirmLabel="Discard and reload"
        onConfirm={() => {
          setIsConfirmingReload(false);
          void load();
        }}
        onCancel={() => setIsConfirmingReload(false)}
      />

      <Toast message={toast.message} onDismiss={toast.dismiss} />
    </div>
  );
};

export default AppStatusManager;
