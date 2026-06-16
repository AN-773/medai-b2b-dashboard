import React, { useEffect, useState } from 'react';
import { AppVersionPlatform, AppVersionSettingsResponse } from '../../types';
import { testsService } from '../../services/testsService';
import {
  Globe,
  Loader2,
  RefreshCw,
  Save,
  Smartphone,
  TabletSmartphone,
} from 'lucide-react';

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
    label: 'Android App',
    description: 'Controls Play Store upgrade prompts for the native Android build.',
    icon: Smartphone,
  },
  {
    platform: 'ios',
    label: 'iOS App',
    description: 'Controls App Store upgrade prompts for the native iOS build.',
    icon: TabletSmartphone,
  },
  {
    platform: 'web',
    label: 'Web App',
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

const AppVersionManager: React.FC = () => {
  const [settings, setSettings] = useState<AppVersionSettingsResponse>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await testsService.getAppVersionSettings();
      setSettings(mergeSettings(response));
    } catch (err: any) {
      console.error('Failed to load app version settings:', err);
      setErrorMsg(err.message || 'Failed to load app version settings.');
    } finally {
      setIsLoading(false);
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
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    for (const platform of platformMeta) {
      const latestVersion = settings[platform.platform].latestVersion.trim();

      if (!latestVersion) {
        setErrorMsg(`Latest version is required for ${platform.label}.`);
        return;
      }

      if (!versionFormatPattern.test(latestVersion)) {
        setErrorMsg(`Latest version for ${platform.label} must use x.y.z format, for example 1.8.1.`);
        return;
      }
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
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
      setSettings(mergeSettings(response));
      setSuccessMsg('App version settings saved.');
    } catch (err: any) {
      console.error('Failed to save app version settings:', err);
      setErrorMsg(err.message || 'Failed to save app version settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white font-['Inter'] text-slate-900">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-bold">App Versions</h3>
          <p className="mt-1 text-sm text-slate-500">
            Define the latest supported versions for each client and whether native users must update before continuing.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={fetchSettings}
            disabled={isLoading || isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMsg}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        {platformMeta.map(({ platform, label, description, icon: Icon }) => (
          <div
            key={platform}
            className="grid gap-5 border-b border-slate-200 bg-white px-5 py-5 last:border-b-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,320px)_180px]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                  <Icon size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{label}</div>
                  <div className="mt-1 text-sm text-slate-500">{description}</div>
                </div>
              </div>
            </div>

            <label className="block">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Latest Version
              </div>
              <input
                type="text"
                value={settings[platform].latestVersion}
                onChange={event => updateSetting(platform, 'latestVersion', event.target.value)}
                placeholder={platform === 'web' ? '2026.06.15' : '1.8.1'}
                pattern="\d+\.\d+\.\d+"
                title="Use x.y.z format, for example 1.8.1."
                disabled={isLoading || isSaving}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Force Update</div>
                <div className="mt-1 text-xs text-slate-500">
                  Native apps block outdated versions when enabled.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings[platform].forceUpdate}
                onChange={event => updateSetting(platform, 'forceUpdate', event.target.checked)}
                disabled={isLoading || isSaving}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AppVersionManager;
