import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Prompt, PromptCatalogItem } from '../../types';
import { testsService } from '../../services/testsService';
import {
  BookOpen,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
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
  SegmentedControl,
  Spinner,
} from '@/components/ui';
import PromptEditorPage from './PromptEditorPage';
import {
  displayPromptExam,
  formatPromptExam,
  getPromptScopeTone,
  serializePromptSchema,
} from './promptConfig';
import {
  Toast,
  formatDate,
  plural,
  scrollPageToTop,
  useSettingsFocus,
  useToast,
} from './SettingsKit';

type PromptFilter = 'all' | 'overridden' | 'defaults';

const buildCatalogSearchText = (item: PromptCatalogItem) => {
  const promptContent = item.configuredPrompts
    .flatMap(prompt => [
      prompt.exam,
      prompt.text,
      prompt.userTemplate || '',
      serializePromptSchema(prompt.enforcedSchema),
    ])
    .join(' ');

  return [
    item.type,
    item.label,
    item.description,
    item.defaultText || '',
    item.defaultUserTemplate || '',
    serializePromptSchema(item.defaultEnforcedSchema),
    promptContent,
  ]
    .join(' ')
    .toLowerCase();
};

const getDefaultBadges = (item: PromptCatalogItem) =>
  [
    item.defaultText ? 'system instruction' : null,
    item.defaultUserTemplate ? 'template' : null,
    item.defaultEnforcedSchema != null ? 'response schema' : null,
  ].filter(Boolean) as string[];

const PromptManager: React.FC = () => {
  const [catalogItems, setCatalogItems] = useState<PromptCatalogItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<PromptFilter>('all');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const toast = useToast();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const [promptToDelete, setPromptToDelete] = useState<{ prompt: Prompt; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // The editor takes the full width of the settings page.
  useSettingsFocus(isEditorOpen);

  const fetchPromptCatalog = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await testsService.getPromptCatalog();
      setCatalogItems(response.items || []);
    } catch (err: any) {
      console.error('Failed to fetch prompt catalog:', err);
      setErrorMsg(err.message || 'Failed to load prompt catalog.');
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    fetchPromptCatalog();
  }, []);

  const allPrompts = useMemo(
    () => catalogItems.flatMap(item => item.configuredPrompts || []),
    [catalogItems],
  );

  const normalizedSearchTerm = deferredSearchTerm.trim().toLowerCase();
  const searchedCatalogItems = useMemo(() => {
    if (!normalizedSearchTerm) {
      return catalogItems;
    }

    return catalogItems.filter(item => buildCatalogSearchText(item).includes(normalizedSearchTerm));
  }, [catalogItems, normalizedSearchTerm]);

  const filteredCatalogItems = useMemo(
    () =>
      filter === 'all'
        ? searchedCatalogItems
        : searchedCatalogItems.filter(item =>
            filter === 'overridden'
              ? item.configuredPrompts.length > 0
              : item.configuredPrompts.length === 0,
          ),
    [filter, searchedCatalogItems],
  );

  const configuredTypeCount = useMemo(
    () => catalogItems.filter(item => item.configuredPrompts.length > 0).length,
    [catalogItems],
  );

  const handleEdit = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setSelectedType(null);
    setIsEditorOpen(true);
    scrollPageToTop();
  };

  const handleCreate = (type?: string) => {
    setSelectedPrompt(null);
    setSelectedType(type || catalogItems[0]?.type || null);
    setIsEditorOpen(true);
    scrollPageToTop();
  };

  const handleDelete = async () => {
    if (!promptToDelete) {
      return;
    }

    setIsDeleting(true);
    setActionError(null);
    try {
      await testsService.deletePrompt(promptToDelete.prompt.id);
      setPromptToDelete(null);
      toast.show('Prompt deleted.');
      await fetchPromptCatalog();
    } catch (err: any) {
      console.error('Failed to delete prompt:', err);
      setPromptToDelete(null);
      setActionError(err.message || 'Failed to delete prompt');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditorClose = async (didChange: boolean) => {
    setIsEditorOpen(false);
    setSelectedPrompt(null);
    setSelectedType(null);
    scrollPageToTop();

    if (didChange) {
      await fetchPromptCatalog();
    }
  };

  if (isEditorOpen) {
    return (
      <PromptEditorPage
        prompt={selectedPrompt}
        initialType={selectedType}
        catalogItems={catalogItems}
        existingPrompts={allPrompts}
        onClose={handleEditorClose}
      />
    );
  }

  const renderPromptRow = (item: PromptCatalogItem, prompt: Prompt) => {
    const name = item.label || item.type;
    const examLabel = formatPromptExam(item.requiresExam, prompt.exam);
    const scopeName = displayPromptExam(examLabel);
    const previewText =
      prompt.text || prompt.userTemplate || serializePromptSchema(prompt.enforcedSchema) || 'Saved override';
    const updated = formatDate(prompt.updatedAt || prompt.createdAt);
    const fileCount = prompt.files?.length || 0;
    const meta = [
      updated ? `Updated ${updated}` : null,
      fileCount > 0 ? plural(fileCount, 'context file') : null,
    ].filter(Boolean);

    return (
      <li key={prompt.id} className="flex items-start gap-1 pr-2 transition-colors hover:bg-stone-50">
        <button
          type="button"
          onClick={() => handleEdit(prompt)}
          className="group flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left focus-visible:bg-stone-50 focus-visible:outline-none"
        >
          <span className="min-w-[4rem] flex-shrink-0 pt-px">
            <Badge tone={getPromptScopeTone(examLabel)}>{displayPromptExam(examLabel)}</Badge>
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-[13px] leading-5 text-stone-700" title={previewText}>
              {previewText}
            </span>
            {meta.length > 0 && (
              <span className="mt-0.5 block text-xs text-stone-500">{meta.join(' · ')}</span>
            )}
          </span>
          <ChevronRight
            size={16}
            className="mt-0.5 flex-shrink-0 text-stone-300 transition-colors group-hover:text-stone-500"
          />
        </button>
        <div className="pt-1.5">
          <Menu
            size="sm"
            label={`Actions for ${name} (${scopeName})`}
            items={[
              { label: 'Edit prompt', icon: Pencil, onSelect: () => handleEdit(prompt) },
              {
                label: 'Delete prompt',
                icon: Trash2,
                tone: 'danger',
                onSelect: () => setPromptToDelete({ prompt, name: `${name} (${scopeName})` }),
              },
            ]}
          />
        </div>
      </li>
    );
  };

  const renderCatalogItem = (item: PromptCatalogItem) => {
    const configuredPrompts = item.configuredPrompts || [];
    const isConfigured = configuredPrompts.length > 0;
    const defaultBadges = getDefaultBadges(item);
    const canAddVariant = item.requiresExam && configuredPrompts.length < 3;
    const defaultPreview =
      item.defaultText || item.defaultUserTemplate || serializePromptSchema(item.defaultEnforcedSchema) || 'No built-in default defined';

    return (
      <li key={item.type} className="px-5 py-4">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-[min(100%,18rem)] flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-sm font-medium text-stone-900">{item.label || item.type}</h3>
              <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-500">
                {item.type}
              </code>
            </div>
            {item.description && (
              <p className="mt-0.5 line-clamp-2 max-w-3xl text-[13px] leading-5 text-stone-500">
                {item.description}
              </p>
            )}
            <p className="mt-1 text-xs text-stone-500">
              {item.requiresExam ? 'One prompt per exam' : 'Global'}
              {' · '}
              {defaultBadges.length > 0
                ? `Built-in defaults: ${defaultBadges.join(', ')}`
                : 'No built-in defaults'}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {isConfigured ? (
              <Badge tone="green" dot>
                {configuredPrompts.length > 1 ? `${configuredPrompts.length} overrides` : 'Override'}
              </Badge>
            ) : (
              <Badge>Default</Badge>
            )}
            {!isConfigured ? (
              <Button size="sm" icon={Plus} onClick={() => handleCreate(item.type)}>
                Configure
              </Button>
            ) : canAddVariant ? (
              <Button size="sm" variant="ghost" icon={Plus} onClick={() => handleCreate(item.type)}>
                Add exam variant
              </Button>
            ) : null}
          </div>
        </div>

        {isConfigured ? (
          <ul className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200">
            {configuredPrompts.map(prompt => renderPromptRow(item, prompt))}
          </ul>
        ) : (
          <p
            className="mt-3 line-clamp-2 max-w-3xl border-l-2 border-stone-200 pl-3 text-[13px] leading-5 text-stone-500"
            title={defaultPreview}
          >
            {defaultPreview}
          </p>
        )}
      </li>
    );
  };

  const isFiltered = Boolean(normalizedSearchTerm) || filter !== 'all';

  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI prompts"
        meta={
          hasLoaded && (
            <span className="text-[13px] tabular-nums text-stone-500">
              {plural(catalogItems.length, 'type')} · {plural(allPrompts.length, 'saved override')}
            </span>
          )
        }
        description="Saved prompt overrides and the full backend catalog, including built-in types still using their defaults."
        actions={
          <>
            <IconButton
              icon={RefreshCw}
              label="Refresh catalog"
              onClick={() => void fetchPromptCatalog()}
              disabled={isLoading}
              className={isLoading ? '[&_svg]:animate-spin' : undefined}
            />
            <Button variant="primary" icon={Plus} onClick={() => handleCreate()}>
              New prompt
            </Button>
          </>
        }
      />

      {errorMsg && (
        <InlineAlert
          title="Couldn't load the prompt catalog"
          action={
            <Button size="sm" variant="secondary" onClick={() => void fetchPromptCatalog()} loading={isLoading}>
              Retry
            </Button>
          }
        >
          {errorMsg}
        </InlineAlert>
      )}

      {actionError && <InlineAlert onDismiss={() => setActionError(null)}>{actionError}</InlineAlert>}

      {!hasLoaded || (isLoading && catalogItems.length === 0) ? (
        <Spinner label="Loading prompts…" className="py-24" />
      ) : catalogItems.length === 0 ? (
        !errorMsg && (
          <div className="rounded-xl border border-dashed border-stone-300">
            <EmptyState
              icon={BookOpen}
              title="The prompt catalog is empty"
              description="No prompt types came back from the backend. You can still create a prompt for a custom type."
              action={
                <Button variant="primary" icon={Plus} onClick={() => handleCreate()}>
                  New prompt
                </Button>
              }
            />
          </div>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search types, exams or prompt text"
              className="w-full sm:w-80"
            />
            <SegmentedControl
              label="Filter prompt types"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: catalogItems.length },
                { value: 'overridden', label: 'Overridden', count: configuredTypeCount },
                { value: 'defaults', label: 'Using defaults', count: catalogItems.length - configuredTypeCount },
              ]}
            />
          </div>

          {filteredCatalogItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300">
              <EmptyState
                icon={BookOpen}
                title="No matching prompt types"
                description="Adjust the search or filter, or create a custom prompt type from the editor."
                action={
                  isFiltered ? (
                    <Button
                      onClick={() => {
                        setSearchTerm('');
                        setFilter('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-card">
              {filteredCatalogItems.map(renderCatalogItem)}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(promptToDelete)}
        title="Delete prompt?"
        description={
          <>
            The saved override for{' '}
            <span className="font-medium text-stone-900">{promptToDelete?.name}</span> will be
            deleted and the feature falls back to its built-in default. This can't be undone.
          </>
        }
        confirmLabel="Delete prompt"
        busy={isDeleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPromptToDelete(null)}
      />

      <Toast message={toast.message} onDismiss={toast.dismiss} />
    </div>
  );
};

export default PromptManager;
