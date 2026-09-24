import React from 'react';
import { PencilLine, Trash2 } from 'lucide-react';
import { Badge, Menu, StatusDot, cn, type MenuItem } from '@/components/ui';
import { MetaDot } from '@/components/academy/course-workbench/objectives/ListHelpers';
import type { BackendApiItem } from '@/types/TestsServiceTypes';
import Checkbox from './Checkbox';
import { TYPE_META, fullDate, itemId, itemStem, relativeTime, statusMeta } from './itemMeta';

interface ItemBankTableProps {
  items: BackendApiItem[];
  selectedIds: string[];
  /** Some rows are selected, so a row click toggles selection instead of opening. */
  selectionMode: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  /** Row click: toggles selection in selection mode, otherwise opens the item. */
  onActivate: (item: BackendApiItem) => void;
  /** Always opens the item in the workbench (row menu). */
  onOpen?: (item: BackendApiItem) => void;
  onDelete: (item: BackendApiItem) => void;
  cognitiveSkillName: (item: BackendApiItem) => string | null;
  /** A refetch is in flight — dim the current rows. */
  busy?: boolean;
}

const stopRowClick = (event: React.MouseEvent) => event.stopPropagation();

const headerCell = 'px-3 py-2.5 text-left text-xs font-medium text-stone-500';

const ItemBankTable: React.FC<ItemBankTableProps> = ({
  items,
  selectedIds,
  selectionMode,
  onToggle,
  onToggleAll,
  onActivate,
  onOpen,
  onDelete,
  cognitiveSkillName,
  busy = false,
}) => {
  const selectedOnPage = items.filter((item) => selectedIds.includes(item.id)).length;
  const allSelected = items.length > 0 && selectedOnPage === items.length;

  return (
    <div className="overflow-x-auto">
      <table
        aria-busy={busy}
        className={cn('w-full text-[13px] transition-opacity', busy && 'opacity-60')}
      >
        <thead>
          <tr className="border-b border-stone-200">
            <th scope="col" className="w-11 py-2.5 pl-4 pr-1 text-left">
              <Checkbox
                checked={allSelected}
                indeterminate={selectedOnPage > 0 && !allSelected}
                onChange={onToggleAll}
                aria-label={allSelected ? 'Deselect all items on this page' : 'Select all items on this page'}
              />
            </th>
            <th scope="col" className={headerCell}>
              Item
            </th>
            <th scope="col" className={cn(headerCell, 'hidden w-32 sm:table-cell')}>
              Type
            </th>
            <th scope="col" className={cn(headerCell, 'w-28')}>
              Status
            </th>
            <th scope="col" className={cn(headerCell, 'hidden w-[30%] md:table-cell')}>
              Objective
            </th>
            <th scope="col" className={cn(headerCell, 'hidden w-32 lg:table-cell')}>
              Updated
            </th>
            <th scope="col" className="w-12 py-2.5 pr-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const id = itemId(item);
            const stem = itemStem(item);
            const isSelected = selectedIds.includes(item.id);
            const type = TYPE_META[item.type];
            const status = statusMeta(item.status);
            const skill = cognitiveSkillName(item);
            const objective = item.learningObjective;
            const organSystem = objective?.syndrome?.topic?.organSystem?.title;
            const topic = objective?.syndrome?.topic?.title;
            const placement = [organSystem, topic].filter((part): part is string => Boolean(part));
            const updated = relativeTime(item.updatedAt);

            const menuItems: MenuItem[] = [
              ...(onOpen
                ? [{ label: 'Open in workbench', icon: PencilLine, onSelect: () => onOpen(item) }]
                : []),
              {
                label: 'Delete item',
                icon: Trash2,
                tone: 'danger' as const,
                onSelect: () => onDelete(item),
              },
            ];

            return (
              <tr
                key={item.id}
                onClick={() => onActivate(item)}
                className={cn(
                  'cursor-pointer border-b border-stone-100 align-top transition-colors last:border-b-0',
                  isSelected ? 'bg-brand-50/50 hover:bg-brand-50' : 'hover:bg-stone-50',
                )}
              >
                <td className="py-3 pl-4 pr-1" onClick={stopRowClick}>
                  <Checkbox
                    className="mt-0.5"
                    checked={isSelected}
                    onChange={() => onToggle(item.id)}
                    aria-label={`Select item ${id}`}
                  />
                </td>
                <td className="min-w-[16rem] px-3 py-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onActivate(item);
                    }}
                    className="block w-full rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  >
                    <span className="line-clamp-2 text-sm font-medium leading-5 text-stone-900">
                      {stem}
                    </span>
                    <span className="sr-only">
                      {selectionMode
                        ? isSelected
                          ? ' (selected, press to deselect)'
                          : ' (press to select)'
                        : ' (open in workbench)'}
                    </span>
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-stone-500">
                    <span className="tabular-nums">{id}</span>
                    {type && (
                      <span className="contents sm:hidden">
                        <MetaDot />
                        <span>{type.label}</span>
                      </span>
                    )}
                    {skill && (
                      <>
                        <MetaDot />
                        <span>{skill}</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="hidden px-3 py-3 sm:table-cell">
                  <Badge icon={type?.icon} title={type?.long}>
                    {type?.label ?? item.type}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-3.5">
                  <StatusDot tone={status.tone}>{status.label}</StatusDot>
                </td>
                <td className="hidden px-3 py-3 md:table-cell">
                  {objective?.title ? (
                    <>
                      <p className="line-clamp-2 leading-5 text-stone-700">{objective.title}</p>
                      {placement.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-stone-500">
                          {placement.join(' · ')}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-stone-400">Not linked</span>
                  )}
                </td>
                <td
                  className="hidden whitespace-nowrap px-3 py-3.5 tabular-nums text-stone-500 lg:table-cell"
                  title={fullDate(item.updatedAt)}
                >
                  {updated ?? '—'}
                </td>
                <td className="py-2.5 pr-3 text-right" onClick={stopRowClick}>
                  <Menu size="sm" label={`Actions for item ${id}`} items={menuItems} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ItemBankTable;
