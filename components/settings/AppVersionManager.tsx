import React, { useEffect, useState } from 'react';
import { AppVersionPlatform, AppVersionSettingsResponse } from '../../types';
import { testsService } from '../../services/testsService';
import {
  Globe,
  RefreshCw,
  Smartphone,
  TabletSmartphone,
} from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  Field,
  IconButton,
  InlineAlert,
  Input,
  SectionHeader,
  Spinner,
  SwitchRow,
} from '@/components/ui';
import { SaveBar, Toast, useToast, useUnsavedChanges } from './SettingsKit';

const defaultSettings: AppVersionSettingsResponse = {
  android: { latestVersion: '', forceUpdate: false },
  ios: { latestVersion: '', forceUpdate: false },
  web: { latestVersion: '', forceUpdate: false },
};

const versionFormatPattern = /^\d+\.\d+\.\d+$/;

const platformMeta: Array<{
  platform: AppVersionPlatform;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  {
    platform: 'android',
    label: 'Android app',
    description: 'Controls Play Store upgrade prompts for the native Android build.',
    icon: Smartphone,
  },
  {
    platform: 'ios',
    label: 'iOS app',
    description: 'Controls App Store upgrade prompts for the native iOS build.',
    icon: TabletSmartphone,
  },
  {
    platform: 'web',
    label: 'Web app',
    description: 'Outdated web clients receive a refresh snackbar instead of a blocking update flow.',
    icon: Globe,
  },
];

const mergeSettings = (incoming?: Partial<AppVersionSettingsResponse> | null): AppVersionSettingsResponse => ({
  android: {
    latestVersion: incoming?.android?.latestVersion?.trim() || '',
    forceUpdate: Boolean(incoming?.android?.forceUpdate),
  },
  ios: {
    latestVersion: incoming?.ios?.latestVersion?.trim() || '',
    forceUpdate: Boolean(incoming?.ios?.forceUpdate),
  },
  web: {
    latestVersion: incoming?.web?.latestVersion?.trim() || '',
    forceUpdate: Boolean(incoming?.web?.forceUpdate),
  },
});

type FieldErrors = Partial<Record<AppVersionPlatform, string>>;

const AppVersionManager: React.FC = () => {
  const [settings, setSettings] = useState<AppVersionSettingsResponse>(defaultSettings);
  const [savedSettings, setSavedSettings] = useState<AppVersionSettingsResponse>(defaultSettings);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isConfirmingRefresh, setIsConfirmingRefresh] = useState(false);
  const toast = useToast();
  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  useUnsavedChanges(isDirty);

  const fetchSettings = async () => {
    setIsLoading(true);
    setLoadError(null);
    setErrorMsg(null);
    setFieldErrors({});
    try {
      const response = await testsService.getAppVersionSettings();
      const merged = mergeSettings(response);
      setSettings(merged);
      setSavedSettings(merged);
    } catch (err: any) {
      console.error('Failed to load app version settings:', err);
      setLoadError(err.message || 'Failed to load app version settings.');
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSetting = (
    platform: AppVersionPlatform,
    field: keyof AppVersionSettingsResponse[AppVersionPlatform],
    value: string | boolean,
  ) => {
    setSettings(current => ({
      ...current,
      [platform]: {
        ...current[platform],
        [field]: value,
      },
    }));
    if (field === 'latestVersion') {
      setFieldErrors(current => {
        if (!current[platform]) return current;
        const next = { ...current };
        delete next[platform];
        return next;
      });
    }
  };

  const requestRefresh = () => {
    if (isDirty) {
      setIsConfirmingRefresh(true);
      return;
    }
    void fetchSettings();
  };

  const discard = () => {
    setSettings(savedSettings);
    setFieldErrors({});
    setErrorMsg(null);
  };

  const handleSave = async () => {
    const errors: FieldErrors = {};
    for (const platform of platformMeta) {
      const latestVersion = settings[platform.platform].latestVersion.trim();

      if (!latestVersion) {
        errors[platform.platform] = 'Enter the latest version.';
      } else if (!versionFormatPattern.test(latestVersion)) {
        errors[platform.platform] = 'Use x.y.z format, for example 1.8.1.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMsg('Fix the highlighted versions before saving.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setFieldErrors({});
    try {
      const response = await testsService.updateAppVersionSettings({
        android: {
          latestVersion: settings.android.latestVersion.trim(),
          forceUpdate: settings.android.forceUpdate,
        },
        ios: {
          latestVersion: settings.ios.latestVersion.trim(),
          forceUpdate: settings.ios.forceUpdate,
        },
        web: {
          latestVersion: settings.web.latestVersion.trim(),
          forceUpdate: settings.web.forceUpdate,
        },
      });
      const merged = mergeSettings(response);
      setSettings(merged);
      setSavedSettings(merged);
      toast.show('App version settings saved.');
    } catch (err: any) {
      console.error('Failed to save app version settings:', err);
      setErrorMsg(err.message || 'Failed to save app version settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const isBusy = isLoading || isSaving;

  return (
    <div className="max-w-4xl space-y-6">
      <SectionHeader
        title="App versions"
        description="The latest supported version of each client, and whether native users must update before continuing."
        actions={
          <IconButton
            icon={RefreshCw}
            label={isDirty ? 'Discard changes and refresh' : 'Refresh'}
            onClick={requestRefresh}
            disabled={isBusy}
            className={isLoading ? '[&_svg]:animate-spin' : undefined}
          />
        }
      />

      {loadError && (
        <InlineAlert
          title="Couldn't load app versions"
          action={
            <Button size="sm" variant="secondary" onClick={() => void fetchSettings()} loading={isLoading}>
              Retry
            </Button>
          }
        >
          {loadError}
        </InlineAlert>
      )}

      {!hasLoaded ? (
        <Spinner label="Loading app versions…" className="py-24" />
      ) : (
        <>
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-card">
            {platformMeta.map(({ platform, label, description, icon: Icon }) => {
              const published = savedSettings[platform].latestVersion;
              const versionChanged = settings[platform].latestVersion.trim() !== published;
              return (
                <li
                  key={platform}
                  className="grid gap-x-6 gap-y-4 px-5 py-5 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_15rem]"
                >
                  <div className="flex min-w-0 items-start gap-3 md:col-span-2 lg:col-span-1">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-stone-900">{label}</h3>
                      <p className="mt-0.5 text-[13px] leading-5 text-stone-500">{description}</p>
                    </div>
                  </div>

                  <Field
                    label="Latest version"
                    error={fieldErrors[platform]}
                    description={versionChanged && published ? `Saved: ${published}` : undefined}
                  >
                    {id => (
                      <Input
                        id={id}
                        type="text"
                        inputMode="decimal"
                        value={settings[platform].latestVersion}
                        onChange={event => updateSetting(platform, 'latestVersion', event.target.value)}
                        placeholder={platform === 'web' ? '2026.06.15' : '1.8.1'}
                        title="Use x.y.z format, for example 1.8.1."
                        aria-invalid={Boolean(fieldErrors[platform]) || undefined}
                        disabled={isBusy}
                        className={fieldErrors[platform] ? 'border-red-300 tabular-nums' : 'tabular-nums'}
                      />
                    )}
                  </Field>

                  <div className="rounded-lg border border-stone-200 px-4 py-3 lg:self-start">
                    <SwitchRow
                      checked={settings[platform].forceUpdate}
                      onChange={checked => updateSetting(platform, 'forceUpdate', checked)}
                      label="Force update"
                      description="Native apps block outdated versions when enabled."
                      disabled={isBusy}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <SaveBar
            dirty={isDirty}
            saving={isSaving}
            onDiscard={discard}
            onSave={() => void handleSave()}
            saveLabel="Save changes"
            cleanText="All changes saved."
            error={errorMsg}
          />
        </>
      )}

      <ConfirmDialog
        open={isConfirmingRefresh}
        title="Discard unsaved changes?"
        description="Refreshing replaces your edits with the saved app versions."
        confirmLabel="Discard and refresh"
        onConfirm={() => {
          setIsConfirmingRefresh(false);
          void fetchSettings();
        }}
        onCancel={() => setIsConfirmingRefresh(false)}
      />

      <Toast message={toast.message} onDismiss={toast.dismiss} />
    </div>
  );
};

export default AppVersionManager;
