import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { testsService } from '../services/testsService';
import {
  PaginatedApiResponse,
  Topic,
  OrganSystem,
  Syndrome,
} from '../types/TestsServiceTypes';
import { useGlobal } from '../contexts/GlobalContext';

export interface ObjectiveInput {
  title: string;
  syndromeId: string;
  cognitiveSkillId: string;
  disciplines: string[];
  exam?: string;
  subjectId?: string;
}

export interface UseCurriculumContentReturn {
  organSystems: OrganSystem[];
  isLoadingOrganSystems: boolean;
  areTopicsLoading: boolean;
  areSyndromesLoading: boolean;
  areObjectivesLoading: boolean;
  activeSystem: OrganSystem | undefined;
  activeTopic: Topic | undefined;
  activeSubTopic: Syndrome | undefined;
  activeSystemId: string | null;
  activeTopicId: string | null;
  activeSubTopicId: string | null;
  contentSearch: string;
  setContentSearch: (v: string) => void;
  bloomFilter: string;
  setBloomFilter: (v: string) => void;
  objectivesPage: number;
  objectivesTotal: number;
  objectivesLimit: number;
  setObjectivesPage: (v: number) => void;
  handleSystemSelect: (id: string) => void;
  handleTopicSelect: (id: string | null) => void;
  handleSubTopicSelect: (subTopic: Syndrome | null) => void;
  refreshOrganSystems: () => void;
  createOrganSystem: (name: string) => Promise<void>;
  attachOrganSystems: (systems: { id: string; title: string }[]) => Promise<void>;
  updateOrganSystem: (id: string, name: string) => Promise<void>;
  deleteOrganSystem: (id: string) => Promise<void>;
  createTopic: (name: string, organSystemId: string) => Promise<void>;
  updateTopic: (id: string, name: string, newOrganSystemId?: string) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;
  createSubTopic: (name: string, topicId: string) => Promise<void>;
  updateSubTopic: (id: string, name: string, topicId: string) => Promise<void>;
  deleteSubTopic: (id: string) => Promise<void>;
  createObjective: (data: ObjectiveInput) => Promise<void>;
  updateObjective: (id: string, data: ObjectiveInput) => Promise<void>;
  deleteObjective: (id: string) => Promise<void>;
  refreshObjectives: () => void;
}

/**
 * Curriculum-scoped hierarchy editor (organ system → topic → syndrome → learning
 * objective), the curriculum-scoped analog of `useCurriculum` (which scopes by
 * USMLE Step / subject). Organ systems are filtered by `curriculumId`; created /
 * attached organ systems and created / edited learning objectives are stamped
 * with the curriculum's absolute id so they appear in the published snapshot.
 *
 * @param curriculumId absolute curriculum URL id (see entity-id-url-format), or null.
 */
export const useCurriculumContent = (
  curriculumId: string | null,
): UseCurriculumContentReturn => {
  const { cognitiveSkills } = useGlobal();

  const [organSystems, setOrganSystems] = useState<OrganSystem[]>([]);
  const [isLoadingOrganSystems, setIsLoadingOrganSystems] = useState(false);
  const [areTopicsLoading, setAreTopicsLoading] = useState(false);
  const [areSyndromesLoading, setAreSyndromesLoading] = useState(false);
  const [areObjectivesLoading, setAreObjectivesLoading] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeSystemId = searchParams.get('system');
  const activeTopicId = searchParams.get('topic');
  const activeSubTopicId = searchParams.get('subtopic');

  const [contentSearch, setContentSearch] = useState('');
  const [bloomFilter, setBloomFilter] = useState('All');

  const [objectivesPage, setObjectivesPage] = useState(1);
  const [objectivesTotal, setObjectivesTotal] = useState(0);
  const objectivesLimit = 20;

  const [orgRefreshKey, setOrgRefreshKey] = useState(0);
  const lastFetchedObjectivesKey = useRef<string>('');

  // Fetch organ systems linked to the curriculum.
  useEffect(() => {
    if (!curriculumId) {
      setOrganSystems([]);
      return;
    }
    let active = true;
    const fetchOrganSystems = async () => {
      setIsLoadingOrganSystems(true);
      try {
        const response: PaginatedApiResponse<OrganSystem> =
          await testsService.getOrganSystems(1, 200, undefined, curriculumId);
        if (active) setOrganSystems(response.items.filter((i) => !!i.title));
      } catch (error) {
        if (active) {
          console.error('Failed to fetch organ systems:', error);
          setOrganSystems([]);
        }
      } finally {
        if (active) setIsLoadingOrganSystems(false);
      }
    };
    fetchOrganSystems();
    return () => {
      active = false;
    };
  }, [curriculumId, orgRefreshKey]);

  const activeSystem = useMemo(
    () => organSystems.find((s) => s.id === activeSystemId),
    [organSystems, activeSystemId],
  );
  const activeTopic = useMemo(
    () => activeSystem?.topics?.find((t) => t.id === activeTopicId),
    [activeSystem, activeTopicId],
  );
  const activeSubTopic = useMemo(
    () => activeTopic?.syndromes?.find((s) => s.id === activeSubTopicId),
    [activeTopic, activeSubTopicId],
  );

  // Fetch topics for the active organ system.
  useEffect(() => {
    let active = true;
    const fetchTopics = async () => {
      if (!activeSystem || activeSystem.topics) return;
      setAreTopicsLoading(true);
      try {
        const response = await testsService.getTopics(activeSystem.id);
        if (active) {
          setOrganSystems((prev) =>
            prev.map((sys) =>
              sys.id === activeSystem.id ? { ...sys, topics: response.items } : sys,
            ),
          );
        }
      } catch (error) {
        if (active) console.error('Failed to fetch topics:', error);
      } finally {
        if (active) setAreTopicsLoading(false);
      }
    };
    fetchTopics();
    return () => {
      active = false;
    };
  }, [activeSystem]);

  // Fetch syndromes for the active topic.
  useEffect(() => {
    let active = true;
    const fetchSyndromes = async () => {
      if (!activeTopic || activeTopic.syndromes) return;
      setAreSyndromesLoading(true);
      try {
        const response = await testsService.getSyndromes(activeTopic.id);
        if (active) {
          setOrganSystems((prev) =>
            prev.map((sys) =>
              sys.id === activeSystemId
                ? {
                    ...sys,
                    topics: sys.topics?.map((topic) =>
                      topic.id === activeTopic.id
                        ? { ...topic, syndromes: response.items }
                        : topic,
                    ),
                  }
                : sys,
            ),
          );
        }
      } catch (error) {
        if (active) console.error('Failed to fetch syndromes:', error);
      } finally {
        if (active) setAreSyndromesLoading(false);
      }
    };
    fetchSyndromes();
    return () => {
      active = false;
    };
  }, [activeTopic, activeSystemId]);

  // Fetch learning objectives for the active syndrome.
  useEffect(() => {
    let active = true;
    const fetchObjectives = async () => {
      if (!activeSubTopic || !activeTopic || !activeSystemId) return;
      const currentKey = `${curriculumId ?? 'unscoped'}-${activeSubTopic.id}-${objectivesPage}`;
      if (currentKey === lastFetchedObjectivesKey.current) return;

      setAreObjectivesLoading(true);
      try {
        const response = await testsService.getLearningObjectives(
          objectivesPage,
          objectivesLimit,
          activeSubTopic.id,
          undefined,
          undefined,
          undefined,
          undefined,
          curriculumId,
        );
        if (active) {
          lastFetchedObjectivesKey.current = currentKey;
          setObjectivesTotal(response.total);
          const enrichedItems = response.items.map((item) => {
            if (item.cognitiveSkillId && !item.cognitiveSkill) {
              const skill = cognitiveSkills.find((s) => s.id === item.cognitiveSkillId);
              if (skill) return { ...item, cognitiveSkill: skill };
            }
            return item;
          });
          setOrganSystems((prev) =>
            prev.map((sys) =>
              sys.id === activeSystemId
                ? {
                    ...sys,
                    topics: sys.topics?.map((topic) =>
                      topic.id === activeTopic.id
                        ? {
                            ...topic,
                            objectives: [
                              ...(objectivesPage > 1 ? topic.objectives || [] : []),
                              ...enrichedItems,
                            ],
                          }
                        : topic,
                    ),
                  }
                : sys,
            ),
          );
        }
      } catch (error) {
        if (active) console.error('Failed to fetch learning objectives:', error);
      } finally {
        if (active) setAreObjectivesLoading(false);
      }
    };
    fetchObjectives();
    return () => {
      active = false;
    };
  }, [
    activeSubTopic,
    activeTopic,
    activeSystemId,
    objectivesPage,
    cognitiveSkills,
    curriculumId,
  ]);

  // Reset objective pagination when the subtopic changes.
  useEffect(() => {
    setObjectivesPage(1);
  }, [activeSubTopicId]);

  // --- Navigation -----------------------------------------------------------

  const handleSystemSelect = (id: string) => {
    if (activeSystemId && activeSystemId !== id) {
      setOrganSystems((prev) =>
        prev.map((sys) =>
          sys.id === activeSystemId ? { ...sys, topics: undefined } : sys,
        ),
      );
    }
    lastFetchedObjectivesKey.current = '';
    setSearchParams((params) => {
      params.set('system', id);
      params.delete('topic');
      params.delete('subtopic');
      return params;
    });
    setContentSearch('');
    setBloomFilter('All');
  };

  const handleTopicSelect = (id: string | null) => {
    if (!id && activeTopicId && activeSystemId) {
      setOrganSystems((prev) =>
        prev.map((sys) =>
          sys.id === activeSystemId
            ? {
                ...sys,
                topics: sys.topics?.map((topic) =>
                  topic.id === activeTopicId ? { ...topic, syndromes: undefined } : topic,
                ),
              }
            : sys,
        ),
      );
    }
    lastFetchedObjectivesKey.current = '';
    setSearchParams((params) => {
      if (id) params.set('topic', id);
      else params.delete('topic');
      params.delete('subtopic');
      return params;
    });
    setContentSearch('');
  };

  const handleSubTopicSelect = (subTopic: Syndrome | null) => {
    if (!subTopic && activeTopicId && activeSystemId) {
      setOrganSystems((prev) =>
        prev.map((sys) =>
          sys.id === activeSystemId
            ? {
                ...sys,
                topics: sys.topics?.map((topic) =>
                  topic.id === activeTopicId ? { ...topic, objectives: undefined } : topic,
                ),
              }
            : sys,
        ),
      );
    }
    lastFetchedObjectivesKey.current = '';
    setSearchParams((params) => {
      if (subTopic) params.set('subtopic', subTopic.id);
      else params.delete('subtopic');
      return params;
    });
    setContentSearch('');
  };

  const refreshOrganSystems = () => setOrgRefreshKey((k) => k + 1);

  // --- Organ system mutations (curriculum-linked) ---------------------------

  const createOrganSystem = async (name: string) => {
    if (!curriculumId) return;
    const newSystem = await testsService.upsertOrganSystem(name, undefined, curriculumId);
    setOrganSystems((prev) => [...prev, newSystem]);
  };

  const attachOrganSystems = async (systems: { id: string; title: string }[]) => {
    if (!curriculumId) return;
    await Promise.all(
      systems.map((s) => testsService.upsertOrganSystem(s.title, s.id, curriculumId)),
    );
    refreshOrganSystems();
  };

  const updateOrganSystem = async (id: string, name: string) => {
    // Keep the curriculum link on rename.
    await testsService.upsertOrganSystem(name, id, curriculumId ?? undefined);
    setOrganSystems((prev) => prev.map((sys) => (sys.id === id ? { ...sys, title: name } : sys)));
  };

  const deleteOrganSystem = async (id: string) => {
    await testsService.deleteOrganSystem(id);
    setOrganSystems((prev) => prev.filter((sys) => sys.id !== id));
    if (activeSystemId === id) {
      setSearchParams((params) => {
        params.delete('system');
        params.delete('topic');
        params.delete('subtopic');
        return params;
      });
    }
  };

  // --- Topic mutations ------------------------------------------------------

  const createTopic = async (name: string, organSystemId: string) => {
    const newTopic = await testsService.upsertTopic(name, organSystemId);
    setOrganSystems((prev) =>
      prev.map((sys) =>
        sys.id === organSystemId ? { ...sys, topics: [...(sys.topics || []), newTopic] } : sys,
      ),
    );
  };

  const updateTopic = async (id: string, name: string, newOrganSystemId?: string) => {
    if (!activeSystemId) return;
    const targetSystemId = newOrganSystemId || activeSystemId;
    const updatedTopic = await testsService.upsertTopic(name, targetSystemId, id);
    if (targetSystemId !== activeSystemId) {
      setOrganSystems((prev) =>
        prev.map((sys) => {
          if (sys.id === activeSystemId)
            return { ...sys, topics: sys.topics?.filter((t) => t.id !== id) };
          if (sys.id === targetSystemId)
            return { ...sys, topics: [...(sys.topics || []), updatedTopic] };
          return sys;
        }),
      );
    } else {
      setOrganSystems((prev) =>
        prev.map((sys) =>
          sys.id === activeSystemId
            ? { ...sys, topics: sys.topics?.map((t) => (t.id === id ? { ...t, title: name } : t)) }
            : sys,
        ),
      );
    }
  };

  const deleteTopic = async (id: string) => {
    await testsService.deleteTopic(id);
    setOrganSystems((prev) =>
      prev.map((sys) =>
        sys.id === activeSystemId
          ? { ...sys, topics: sys.topics?.filter((t) => t.id !== id) }
          : sys,
      ),
    );
    if (activeTopicId === id) handleTopicSelect(null);
  };

  // --- Subtopic (syndrome) mutations ----------------------------------------

  const createSubTopic = async (name: string, topicId: string) => {
    const newSyndrome = await testsService.upsertSyndrome(undefined as any, name, topicId);
    setOrganSystems((prev) =>
      prev.map((sys) =>
        sys.id === activeSystemId
          ? {
              ...sys,
              topics: sys.topics?.map((topic) =>
                topic.id === topicId
                  ? { ...topic, syndromes: [...(topic.syndromes || []), newSyndrome] }
                  : topic,
              ),
            }
          : sys,
      ),
    );
  };

  const updateSubTopic = async (id: string, name: string, topicId: string) => {
    if (!activeTopicId) return;
    await testsService.upsertSyndrome(id, name, topicId);
    setOrganSystems((prev) =>
      prev.map((sys) => {
        if (sys.id !== activeSystemId) return sys;
        return {
          ...sys,
          topics: sys.topics?.map((topic) => {
            if (topicId !== activeTopicId && topic.id === activeTopicId) {
              return { ...topic, syndromes: topic.syndromes?.filter((s) => s.id !== id) };
            }
            if (topicId !== activeTopicId && topic.id === topicId) {
              return {
                ...topic,
                syndromes: [...(topic.syndromes || []), { id, title: name, topicId } as Syndrome],
              };
            }
            if (topicId === activeTopicId && topic.id === activeTopicId) {
              return {
                ...topic,
                syndromes: topic.syndromes?.map((s) =>
                  s.id === id ? ({ ...s, title: name } as Syndrome) : s,
                ),
              };
            }
            return topic;
          }),
        };
      }),
    );
  };

  const deleteSubTopic = async (id: string) => {
    await testsService.deleteSyndrome(id);
    setOrganSystems((prev) =>
      prev.map((sys) =>
        sys.id === activeSystemId
          ? {
              ...sys,
              topics: sys.topics?.map((topic) =>
                topic.id === activeTopicId
                  ? { ...topic, syndromes: topic.syndromes?.filter((s) => s.id !== id) }
                  : topic,
              ),
            }
          : sys,
      ),
    );
    if (activeSubTopicId === id) handleSubTopicSelect(null);
  };

  // --- Learning objective mutations (curriculum-linked) ---------------------

  const createObjective = async (data: ObjectiveInput) => {
    const newObjective = await testsService.upsertLearningObjective(
      data.title,
      data.syndromeId,
      data.cognitiveSkillId,
      data.disciplines,
      undefined,
      undefined, // exam (Step) is the old scope — not used here
      data.subjectId,
      curriculumId ?? undefined,
    );
    lastFetchedObjectivesKey.current = '';
    if (activeSystemId && activeTopicId) {
      setOrganSystems((prev) =>
        prev.map((sys) =>
          sys.id === activeSystemId
            ? {
                ...sys,
                topics: sys.topics?.map((topic) => {
                  if (topic.id !== activeTopicId) return topic;
                  const skill = cognitiveSkills.find((s) => s.id === data.cognitiveSkillId);
                  return {
                    ...topic,
                    objectives: [{ ...newObjective, cognitiveSkill: skill }, ...(topic.objectives || [])],
                  };
                }),
              }
            : sys,
        ),
      );
    }
  };

  const updateObjective = async (id: string, data: ObjectiveInput) => {
    const updatedObjective = await testsService.upsertLearningObjective(
      data.title,
      data.syndromeId,
      data.cognitiveSkillId,
      data.disciplines,
      id,
      undefined,
      data.subjectId,
      curriculumId ?? undefined,
    );
    if (activeSystemId && activeTopicId) {
      setOrganSystems((prev) =>
        prev.map((sys) =>
          sys.id === activeSystemId
            ? {
                ...sys,
                topics: sys.topics?.map((topic) => {
                  if (topic.id !== activeTopicId) return topic;
                  const skill = cognitiveSkills.find((s) => s.id === data.cognitiveSkillId);
                  return {
                    ...topic,
                    objectives:
                      topic.objectives?.map((obj) =>
                        obj.id === id ? { ...updatedObjective, cognitiveSkill: skill } : obj,
                      ) || [],
                  };
                }),
              }
            : sys,
        ),
      );
    }
  };

  const deleteObjective = async (id: string) => {
    await testsService.deleteLearningObjective(id);
    setOrganSystems((prev) =>
      prev.map((sys) => ({
        ...sys,
        topics: (sys.topics || []).map((topic) => ({
          ...topic,
          objectives: topic.objectives?.filter((obj) => obj.id !== id) || [],
        })),
      })),
    );
  };

  const refreshObjectives = () => {
    lastFetchedObjectivesKey.current = '';
    if (activeSystemId && activeTopicId) {
      setOrganSystems((prev) =>
        prev.map((sys) =>
          sys.id === activeSystemId
            ? {
                ...sys,
                topics: sys.topics?.map((topic) =>
                  topic.id === activeTopicId ? { ...topic, objectives: undefined } : topic,
                ),
              }
            : sys,
        ),
      );
    }
  };

  return {
    organSystems,
    isLoadingOrganSystems,
    areTopicsLoading,
    areSyndromesLoading,
    areObjectivesLoading,
    activeSystem,
    activeTopic,
    activeSubTopic,
    activeSystemId,
    activeTopicId,
    activeSubTopicId,
    contentSearch,
    setContentSearch,
    bloomFilter,
    setBloomFilter,
    objectivesPage,
    objectivesTotal,
    objectivesLimit,
    setObjectivesPage,
    handleSystemSelect,
    handleTopicSelect,
    handleSubTopicSelect,
    refreshOrganSystems,
    createOrganSystem,
    attachOrganSystems,
    updateOrganSystem,
    deleteOrganSystem,
    createTopic,
    updateTopic,
    deleteTopic,
    createSubTopic,
    updateSubTopic,
    deleteSubTopic,
    createObjective,
    updateObjective,
    deleteObjective,
    refreshObjectives,
  };
};
