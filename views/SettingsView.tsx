import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Megaphone, Smartphone, type LucideIcon } from 'lucide-react';
import PromptManager from '../components/settings/PromptManager';
import AppVersionManager from '../components/settings/AppVersionManager';
import AppStatusManager from '../components/settings/AppStatusManager';
import {
  SettingsSectionContext,
  scrollPageToTop,
  type SettingsSectionContextValue,
} from '../components/settings/SettingsKit';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, cn } from '@/components/ui';

type SettingsSection = 'versions' | 'prompts' | 'status';

const SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  render: () => React.ReactNode;
}> = [
  { id: 'status', label: 'App status', icon: Megaphone, render: () => <AppStatusManager /> },
  { id: 'versions', label: 'App versions', icon: Smartphone, render: () => <AppVersionManager /> },
  { id: 'prompts', label: 'AI prompts', icon: BookOpen, render: () => <PromptManager /> },
];

const DEFAULT_SECTION: SettingsSection = 'versions';

const isSection = (value: string | null): value is SettingsSection =>
  SECTIONS.some((section) => section.id === value);

const SettingsView: React.FC = () => {
  const { isSuperadmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const activeTab: SettingsSection = isSection(sectionParam) ? sectionParam : DEFAULT_SECTION;

  // Sections stay mounted once opened, so switching sections never throws
  // away unpublished edits.
  const [visited, setVisited] = useState<Set<SettingsSection>>(() => new Set([activeTab]));
  const [dirtySections, setDirtySections] = useState<Set<SettingsSection>>(() => new Set());
  const [focusedSection, setFocusedSection] = useState<SettingsSection | null>(null);

  useEffect(() => {
    setVisited((current) =>
      current.has(activeTab) ? current : new Set([...current, activeTab]),
    );
  }, [activeTab]);

  const sectionContexts = useMemo(() => {
    const create = (id: SettingsSection): SettingsSectionContextValue => ({
      setDirty: (dirty) =>
        setDirtySections((current) => {
          if (current.has(id) === dirty) return current;
          const next = new Set(current);
          if (dirty) next.add(id);
          else next.delete(id);
          return next;
        }),
      setFocused: (focused) =>
        setFocusedSection((current) => (focused ? id : current === id ? null : current)),
    });
    return {
      status: create('status'),
      versions: create('versions'),
      prompts: create('prompts'),
    } satisfies Record<SettingsSection, SettingsSectionContextValue>;
  }, []);

  const selectSection = useCallback(
    (section: SettingsSection) => {
      if (section === activeTab) return;
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set('section', section);
          return next;
        },
        { replace: true },
      );
      scrollPageToTop();
    },
    [activeTab, setSearchParams],
  );

  if (!isSuperadmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const mountedSections = new Set([...visited, activeTab]);
  const isFocused = focusedSection !== null && focusedSection === activeTab;

  return (
    <div className="space-y-6">
      {!isFocused && (
        <PageHeader
          title="Settings"
          description="Platform-wide controls for the MedAI apps: maintenance and announcements, release versions and the shared AI prompts."
        />
      )}

      <div
        className={cn(
          !isFocused && 'grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10',
        )}
      >
        {!isFocused && (
          <nav aria-label="Settings sections" className="lg:sticky lg:top-6 lg:self-start">
            <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
              {SECTIONS.map(({ id, label, icon: Icon }) => {
                const active = id === activeTab;
                const dirty = dirtySections.has(id);
                return (
                  <li key={id} className="flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => selectSection(id)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex h-9 w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
                        active
                          ? 'bg-stone-100 text-stone-900'
                          : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900',
                      )}
                    >
                      <Icon
                        size={16}
                        className={cn(
                          'flex-shrink-0',
                          active ? 'text-brand-600' : 'text-stone-400 group-hover:text-stone-600',
                        )}
                      />
                      <span className="flex-1 text-left">{label}</span>
                      {dirty && (
                        <>
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500"
                            title="Unsaved changes"
                            aria-hidden="true"
                          />
                          <span className="sr-only">(unsaved changes)</span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <div className="min-w-0">
          {SECTIONS.filter((section) => mountedSections.has(section.id)).map((section) => (
            <div key={section.id} hidden={section.id !== activeTab}>
              <SettingsSectionContext.Provider value={sectionContexts[section.id]}>
                {section.render()}
              </SettingsSectionContext.Provider>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
