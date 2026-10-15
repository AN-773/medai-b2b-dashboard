import { createContext } from 'react';
import type { Syndrome } from '@/types/TestsServiceTypes';

/**
 * The deeper levels of the Curricula outline rail — the curriculum root plus the
 * topics and subtopics of the open organ system. `WorkbenchSidebar` owns the
 * organ-system level through its props; the workbench view provides this
 * context so the rail can also navigate the rest of the path. Without a
 * provider the rail simply lists organ systems.
 */
export interface WorkbenchTreeState {
  /** True while the curriculum itself (no organ system) is the selected node. */
  isRootActive: boolean;
  onSelectRoot: () => void;
  activeTopicId: string | null;
  activeSubTopicId: string | null;
  areTopicsLoading: boolean;
  areSubTopicsLoading: boolean;
  onSelectTopic: (topicId: string) => void;
  onSelectSubTopic: (subTopic: Syndrome) => void;
}

export const WorkbenchTreeContext = createContext<WorkbenchTreeState | null>(null);
