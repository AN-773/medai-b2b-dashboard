import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Megaphone, Plus, RefreshCw, Save, Trash2, Wrench } from 'lucide-react';
import { appStatusService, AppStatusSettings } from '../../services/appStatusService';

const AppStatusManager: React.FC = () => {
  const [settings, setSettings] = useState<AppStatusSettings | null>(null);
  const [published, setPublished] = useState<AppStatusSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const dirty = JSON.stringify(settings) !== JSON.stringify(published);

  const load = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await appStatusService.get();
      setSettings(result);
      setPublished(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load app status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const edit = (next: AppStatusSettings) => {
    setSettings(next);
    setSuccess('');
  };

  const move = (index: number, offset: number) => {
    if (!settings) return;
    const announcements = [...settings.announcements];
    [announcements[index], announcements[index + offset]] = [announcements[index + offset], announcements[index]];
    edit({ ...settings, announcements });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    if (settings.announcements.some(item => !item.message.trim())) {
      setError('Every announcement needs a message. Remove empty announcements before publishing.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const result = await appStatusService.update(settings);
      setSettings(result);
      setPublished(result);
      setSuccess('Published. Open apps will pick up these changes within 30 seconds.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish app status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Announcements & Maintenance</h3>
          <p className="mt-1 text-sm text-slate-500">Global controls for the MedAI web and mobile app.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || saving} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50">
          <RefreshCw size={16} /> {dirty ? 'Discard changes & reload' : 'Reload'}
        </button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</p>}
      {loading ? <p role="status" className="py-8 text-slate-500">Loading app status…</p> : settings && (
        <fieldset disabled={saving} className="space-y-6 disabled:opacity-70">
          <section className="space-y-4 rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="flex items-center gap-2 font-bold"><Wrench size={18} /> Maintenance mode</h4>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${published?.maintenance.enabled ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                Live: {published?.maintenance.enabled ? (published.maintenance.scope === 'all' ? 'Entire site under maintenance' : 'App under maintenance') : 'Online'}
              </span>
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input type="checkbox" checked={settings.maintenance.enabled} onChange={e => edit({ ...settings, maintenance: { ...settings.maintenance, enabled: e.target.checked } })} />
              Enable maintenance mode
            </label>
            <label className="block text-sm font-medium">
              Maintenance scope
              <select className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3" value={settings.maintenance.scope} onChange={e => edit({ ...settings, maintenance: { ...settings.maintenance, scope: e.target.value as 'app' | 'all' } })}>
                <option value="app">App only — keep the landing page available (default)</option>
                <option value="all">Entire site — include the landing page</option>
              </select>
            </label>
            <p className="text-sm text-slate-500">App-only mode keeps the landing page visible, with its chat disabled and marked under maintenance. Entire-site mode replaces every page with the maintenance screen.</p>
            <label className="block text-sm font-medium">
              Maintenance message (optional)
              <textarea rows={3} maxLength={2000} className="mt-2 w-full rounded-lg border border-slate-300 p-3" value={settings.maintenance.message} placeholder="Leave blank to use the app’s translated default message." onChange={e => edit({ ...settings, maintenance: { ...settings.maintenance, message: e.target.value } })} />
            </label>
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="flex items-center gap-2 font-bold"><Megaphone size={18} /> Announcements</h4>
              <button type="button" disabled={settings.announcements.length >= 50} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50" onClick={() => edit({ ...settings, announcements: [...settings.announcements, { id: crypto.randomUUID(), message: '', enabled: true, showOnLanding: false }] })}>
                <Plus size={16} /> Add announcement
              </button>
            </div>
            <p className="text-sm text-slate-500">Announcements appear in the app by default. Enable “Also show on landing page” for any announcement that should appear there too. Eligible announcements appear in this order, one top bar at a time. Closing one reveals the next. Editing a message makes it visible again to users who closed its previous version.</p>
            {settings.announcements.length === 0 && <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">No announcements yet.</p>}
            {settings.announcements.map((item, index) => (
              <div key={item.id} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={item.enabled} onChange={e => edit({ ...settings, announcements: settings.announcements.map(a => a.id === item.id ? { ...a, enabled: e.target.checked } : a) })} />
                    Announcement {index + 1} · {item.enabled ? 'Enabled' : 'Hidden'}
                  </label>
                  <div className="flex gap-1">
                    <button type="button" aria-label={`Move announcement ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded p-2 hover:bg-white disabled:opacity-30"><ArrowUp size={16} /></button>
                    <button type="button" aria-label={`Move announcement ${index + 1} down`} disabled={index === settings.announcements.length - 1} onClick={() => move(index, 1)} className="rounded p-2 hover:bg-white disabled:opacity-30"><ArrowDown size={16} /></button>
                    <button type="button" aria-label={`Remove announcement ${index + 1}`} onClick={() => edit({ ...settings, announcements: settings.announcements.filter(a => a.id !== item.id) })} className="rounded p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                  </div>
                </div>
                <textarea aria-label={`Announcement ${index + 1} message`} required rows={3} maxLength={2000} value={item.message} onChange={e => edit({ ...settings, announcements: settings.announcements.map(a => a.id === item.id ? { ...a, message: e.target.value } : a) })} className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm" placeholder="What would you like users to know?" />
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" aria-label={`Also show announcement ${index + 1} on landing page`} checked={item.showOnLanding === true} onChange={e => edit({ ...settings, announcements: settings.announcements.map(a => a.id === item.id ? { ...a, showOnLanding: e.target.checked } : a) })} />
                  Also show on landing page
                </label>
              </div>
            ))}
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{dirty ? 'You have unpublished changes.' : 'All changes are published.'}</p>
            <button type="submit" disabled={!dirty || saving} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><Save size={16} /> {saving ? 'Publishing…' : 'Publish changes'}</button>
          </div>
        </fieldset>
      )}
    </form>
  );
};

export default AppStatusManager;
