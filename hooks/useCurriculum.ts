import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { testsService } from '../services/testsService';
import { PaginatedApiResponse, Topic, OrganSystem, LearningObjective, Syndrome, Subject, QuestionStats } from '../types/TestsServiceTypes';
import React from 'react';
import { useGlobal } from '../contexts/GlobalContext';

export interface UseCurriculumReturn {
  curriculumData: OrganSystem[];
  isLoading: boolean;
  areTopicsLoading: boolean;
  areSyndromesLoading: boolean;
  areObjectivesLoading: boolean;
  activeSystem: OrganSystem | undefined;
  activeTopic: Topic | undefined;
  activeSubTopic: Syndrome | undefined;
  activeSystemId: string | undefined;
  activeTopicId: string | undefined;
  activeSubTopicId: string | undefined;
  contentSearch: string;
  bloomFilter: string;
  objectivesPage: number;
  objectivesTotal: number;
  objectivesLimit: number;
  setCurriculumData: (data: OrganSystem[]) => void;
  handleSystemSelect: (id: string) => void;
  handleTopicSelect: (id: string | null) => void;
  handleSubTopicSelect: (subTopic: Syndrome | null) => void;
  updateObjective: (id: string, data: { title: string; syndromeId: string; cognitiveSkillId: string; disciplines: string[]; exam?: string }) => Promise<void>;
  handleContentSearchChange: (value: string) => void;
  handleBloomFilterChange: (value: string) => void;
  handleLoadMoreObjectives: () => void;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleExport: () => void;
  handleReset: () => void;
  setContentSearch: (value: string) => void;
  setBloomFilter: (value: string) => void;
  setObjectivesPage: (value: number) => void;
  deleteObjective: (id: string) => Promise<void>;
  createObjective: (data: { title: string; syndromeId: string; cognitiveSkillId: string; disciplines: string[]; exam?: string }) => Promise<void>;
  createOrganSystem: (name: string) => Promise<void>;
  updateOrganSystem: (id: string, name: string) => Promise<void>;
  deleteOrganSystem: (id: string) => Promise<void>;
  createTopic: (name: string, organSystemId: string) => Promise<void>;
  updateTopic: (id: string, name: string, newOrganSystemId?: string) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;
  moveTopic: (id: string, name: string, newOrganSystemId: string) => Promise<void>;
  createSubTopic: (name: string, topicId: string) => Promise<void>;
  updateSubTopic: (id: string, name: string, topicId: string) => Promise<void>;
  deleteSubTopic: (id: string) => Promise<void>;
  moveSubTopic: (id: string, name: string, newTopicId: string) => Promise<void>;
  // Step 2
  curriculumMode: 'step1' | 'step2';
  handleModeChange: (mode: 'step1' | 'step2') => void;
  subjects: Subject[];
  activeSubjectId: string | null;
  handleSubjectSelect: (id: string) => void;
  questionStats: QuestionStats | null;
  allowedSystemIds: string[];
}

export const useCurriculum = (): UseCurriculumReturn => {
  // Data State
  const [curriculumData, setCurriculumData] = useState<OrganSystem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [areTopicsLoading, setAreTopicsLoading] = useState(false);
  const [areSyndromesLoading, setAreSyndromesLoading] = useState(false);
  const [areObjectivesLoading, setAreObjectivesLoading] = useState(false);
  const { cognitiveSkills } = useGlobal();

  // Navigation State
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeSystemId = searchParams.get('system') || curriculumData[0]?.id;
  const activeTopicId = searchParams.get('topic');
  const activeSubTopicId = searchParams.get('subtopic');

  // Step 2 state
  const curriculumMode = (searchParams.get('mode') ?? 'step1') as 'step1' | 'step2';
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const activeSubjectId = searchParams.get('subject');
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);

  // Derived: organ system IDs allowed in step2 (total > 0), matched by trailing slug
  const allowedSystemIds = useMemo<string[]>(() => {
    if (!questionStats?.bySystem) return [];
    return questionStats.bySystem
      .filter(s => s.total > 0)
      .map(s => {
        // systemId is a full URL like https://.../organ-systems/slug
        // OrganSystem.id is the full URL too — compare directly
        return s.systemId;
      });
  }, [questionStats]);

  const [contentSearch, setContentSearch] = useState('');
  const [bloomFilter, setBloomFilter] = useState<string>('All');

  // Objectives Pagination State
  const [objectivesPage, setObjectivesPage] = useState(1);
  const [objectivesTotal, setObjectivesTotal] = useState(0);
  const objectivesLimit = 20;

  // Track last fetched objectives to prevent infinite loops
  const lastFetchedObjectivesKey = useRef<string>('');

  // Fetch organ systems and subjects on mount
  useEffect(() => {
    const fetchOrganSystems = async () => {
      setIsLoading(true);
      try {
        const response: PaginatedApiResponse<OrganSystem> = await testsService.getOrganSystems();
        setCurriculumData(response.items);
      } catch (error) {
        console.error('Failed to fetch organ systems:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchSubjects = async () => {
      try {
        const response = await testsService.getSubjects();
        setSubjects(response.items);
      } catch (error) {
        console.error('Failed to fetch subjects:', error);
      }
    };

    fetchOrganSystems();
    fetchSubjects();
  }, []);

  // Fetch question stats when a subject is selected in Step 2
  useEffect(() => {
    if (!activeSubjectId) {
      setQuestionStats(null);
      return;
    }
    let active = true;
    const fetchStats = async () => {
      try {
        const subjectIds = activeSubjectId === 'all'
          ? subjects.map(s => s.id)
          : [activeSubjectId];
        if (subjectIds.length === 0) return;
        const stats = await testsService.getQuestionStats('STEP 2', subjectIds);
        if (active) setQuestionStats(stats);
      } catch (error) {
        console.error('Failed to fetch question stats:', error);
      }
    };
    fetchStats();
    return () => { active = false; };
  }, [activeSubjectId, subjects]);

  // Derived Data — declared BEFORE effects that depend on them
  const activeSystem = useMemo(() => 
    curriculumData.find(s => s.id === activeSystemId), 
  [curriculumData, activeSystemId]);

  const activeTopic = useMemo(() => 
    activeSystem?.topics?.find(t => t.id === activeTopicId), 
  [activeSystem, activeTopicId]);

  const activeSubTopic = useMemo(() => 
    activeTopic?.syndromes?.find(s => s.id === activeSubTopicId), 
  [activeTopic, activeSubTopicId]);
    
  // Fetch Topics (and Syndromes as they are now nested)

  useEffect(() => {
    let active = true;

    const fetchTopics = async () => {
      // Ensure we have the parent system loaded before fetching likely dependent data
      if (!activeSystem) return;
      // Prevent infinite loop: if topics are already loaded, don't fetch again
      if (activeSystem.topics) return;

      setAreTopicsLoading(true);
      try {
        const response = await testsService.getTopics(activeSystem.id);
        if (active) {
          setCurriculumData(prev => prev.map(sys => {
            if (sys.id === activeSystem.id) {
              return {
                ...sys,
                topics: response.items
              };
            }
            return sys;
          }));
        }

      } catch (error) {
        if (active) {
          console.error('Failed to fetch topics:', error);
        }
      } finally {
        if (active) {
          setAreTopicsLoading(false);
        }
      }
    };

    fetchTopics();

    return () => {
      active = false;
    };
  }, [activeSystem]);


  // Fetch Syndromes when a topic is selected AND topic is loaded in state
  useEffect(() => {
    let active = true;

    const fetchSyndromes = async () => {
      // Must have the topic object loaded (implies parent topics are fetched)
      if (!activeTopic) return;
      // Don't re-fetch if syndromes are already loaded for this topic
      if (activeTopic.syndromes) return;

      setAreSyndromesLoading(true);
      try {
        const response = await testsService.getSyndromes(activeTopic.id);
        if (active) {
          setCurriculumData(prev => prev.map(sys => {
            if (sys.id === activeSystemId) {
              return {
                ...sys,
                topics: sys.topics?.map(topic => {
                  if (topic.id === activeTopic.id) {
                    return {
                      ...topic,
                      syndromes: response.items
                    };
                  }
                  return topic;
                })
              };
            }
            return sys;
          }));
        }
      } catch (error) {
        if (active) {
          console.error('Failed to fetch syndromes:', error);
        }
      } finally {
        if (active) {
          setAreSyndromesLoading(false);
        }
      }
    };

    fetchSyndromes();

    return () => {
      active = false;
    };
  }, [activeTopic, activeSystemId]);

  // Fetch Learning Objectives when a subtopic (syndrome) is selected AND syndrome is loaded in state
  useEffect(() => {
    let active = true;

    const fetchLearningObjectives = async () => {
      // Must have the subtopic object loaded
      if (!activeSubTopic || !activeTopic || !activeSystemId) return;

      // Unlocking the loop: use a ref to track the last fetched combination.
      // If we already successfully fetched for this subtopic and page, don't fetch again just because data updated.
      const currentKey = `${activeSubTopic.id}-${objectivesPage}`;
      if (currentKey === lastFetchedObjectivesKey.current) return;

      setAreObjectivesLoading(true);
      try {
        const response = await testsService.getLearningObjectives(objectivesPage, objectivesLimit, activeSubTopic.id, undefined, undefined, curriculumMode === 'step2' ? 'STEP 2' : curriculumMode === 'step1' ? 'STEP 1' : undefined);

        if (active) {
          lastFetchedObjectivesKey.current = currentKey; // Mark as fetched

          setObjectivesTotal(response.total);

          // Enrich items with cognitive skills
          const enrichedItems = response.items.map(item => {
            if (item.cognitiveSkillId && !item.cognitiveSkill) {
              const skill = cognitiveSkills.find(s => s.id === item.cognitiveSkillId);
              if (skill) {
                return { ...item, cognitiveSkill: skill };
              }
            }
            return item;
          });
          
          setCurriculumData(prev => prev.map(sys => {
            if (sys.id === activeSystemId) {
              return {
                ...sys,
                topics: sys.topics?.map(topic => {
                  if (topic.id === activeTopic.id) {
                    // If page > 1, append to existing objectives; otherwise replace
                    const existingObjectives = objectivesPage > 1 ? (topic.objectives || []) : [];

                    return {
                      ...topic,
                      objectives: [...existingObjectives, ...enrichedItems]
                    };
                  }
                  return topic;
                })
              };
            }
            return sys;
          }));
        }
      } catch (error) {
        if (active) {
          console.error('Failed to fetch learning objectives:', error);
        }
      } finally {
        if (active) {
          setAreObjectivesLoading(false);
        }
      }
    };

    fetchLearningObjectives();

    return () => {
      active = false;
    };
    // Include objects to ensure we re-run when they become available/complete
  }, [activeSubTopic, activeTopic, activeSystemId, objectivesPage, cognitiveSkills]);

  // Reset pagination when subtopic changes
  useEffect(() => {
    setObjectivesPage(1);
    // Also reset the fetched key if we switch subtopics explicitly? 
    // No, the key mismatch will handle it.
  }, [activeSubTopicId]);

  // Actions
  const handleSystemSelect = (id: string) => {
    setSearchParams(params => {
      params.set('system', id);
      params.delete('topic');
      params.delete('subtopic');
      return params;
    });
    setContentSearch('');
    setBloomFilter('All');
  };

  const handleTopicSelect = (id: string | null) => {
    setSearchParams(params => {
      if (id) {
        params.set('topic', id);
      } else {
        params.delete('topic');
      }
      params.delete('subtopic');
      return params;
    });
    setContentSearch('');
  }

  const handleSubTopicSelect = (subTopic: Syndrome | null) => {
    setSearchParams(params => {
      if (subTopic) {
        params.set('subtopic', subTopic.id);
      } else {
        params.delete('subtopic');
      }
      return params;
    });
    setContentSearch('');
  };

  const updateObjective = async (id: string, data: { title: string; syndromeId: string; cognitiveSkillId: string; disciplines: string[]; exam?: string }) => {
    try {
      const updatedObjective = await testsService.upsertLearningObjective(
        data.title,
        data.syndromeId,
        data.cognitiveSkillId,
        data.disciplines,
        id,
        data.exam
      );

      if (activeSystemId && activeTopicId) {
        setCurriculumData(prev => prev.map(sys => {
          if (sys.id === activeSystemId) {
            return {
              ...sys,
              topics: sys.topics?.map(topic => {
                if (topic.id === activeTopicId) {
                  const skill = cognitiveSkills.find(s => s.id === data.cognitiveSkillId);
                  const enrichedUpdatedObjective = { ...updatedObjective, cognitiveSkill: skill };
                  return {
                    ...topic,
                    objectives: topic.objectives?.map(obj => 
                      obj.id === id ? enrichedUpdatedObjective : obj
                    ) || []
                  };
                }
                return topic;
              })
            };
          }
          return sys;
        }));
      }
    } catch (error) {
      console.error('Failed to update learning objective:', error);
      throw error;
    }
  };

  const deleteObjective = async (id: string): Promise<void> => {
    try {
      await testsService.deleteLearningObjective(id);
      setCurriculumData(prev => prev.map(system => ({
        ...system,
        topics: (system.topics || []).map(topic => ({
          ...topic,
          objectives: topic.objectives?.filter(obj => obj.id !== id) || []
        }))
      })));
    } catch (error) {
      console.error('Failed to delete learning objective:', error);
      throw error;
    }
  };

  const createObjective = async (data: { title: string; syndromeId: string; cognitiveSkillId: string; disciplines: string[]; exam?: string }) => {
    try {
      const newObjective = await testsService.upsertLearningObjective(
        data.title,
        data.syndromeId,
        data.cognitiveSkillId,
        data.disciplines,
        undefined,
        data.exam
      );

      // Force a re-fetch of objectives by mimicking a dependency change or updating the specific subtopic.
      // To simplify, we can clear the `lastFetchedObjectivesKey` and trigger a re-fetch.
      lastFetchedObjectivesKey.current = '';
      
      // We can also optimistically update the state, but re-fetching ensures consistency with IDs and refs.
      // We will trigger a refetch by clearing the cached objectives for the active topic if needed,
      // but since we cleared the key, the useEffect will re-run if we temporarily alter a dependency or just wait for the next render.
      // Easiest is to manually push it to the list if we know the parent topic.
      if (activeSystemId && activeTopicId) {
        setCurriculumData(prev => prev.map(sys => {
          if (sys.id === activeSystemId) {
            return {
              ...sys,
              topics: sys.topics?.map(topic => {
                if (topic.id === activeTopicId) {
                  // Attach full cognitive skill object if possible
                  const skill = cognitiveSkills.find(s => s.id === data.cognitiveSkillId);
                  const enrichedNewObjective = { ...newObjective, cognitiveSkill: skill };
                  
                  return {
                    ...topic,
                    objectives: [enrichedNewObjective, ...(topic.objectives || [])]
                  };
                }
                return topic;
              })
            };
          }
          return sys;
        }));
      }

    } catch (error) {
      console.error('Failed to create learning objective:', error);
      throw error;
    }
  };

  const createOrganSystem = async (name: string) => {
    try {
      const newSystem = await testsService.upsertOrganSystem(name);
      setCurriculumData(prev => [...prev, newSystem]);
    } catch (error) {
      console.error('Failed to create organ system:', error);
      throw error;
    }
  };

  const updateOrganSystem = async (id: string, name: string) => {
    try {
      await testsService.upsertOrganSystem(name, id);
      setCurriculumData(prev => prev.map(sys =>
        sys.id === id ? { ...sys, title: name } : sys
      ));
    } catch (error) {
      console.error('Failed to update organ system:', error);
      throw error;
    }
  };

  const deleteOrganSystem = async (id: string) => {
    try {
      await testsService.deleteOrganSystem(id);
      setCurriculumData(prev => prev.filter(sys => sys.id !== id));
      if (activeSystemId === id) {
        setSearchParams(params => {
          params.delete('system');
          params.delete('topic');
          params.delete('subtopic');
          return params;
        });
      }
    } catch (error) {
      console.error('Failed to delete organ system:', error);
      throw error;
    }
  };

  const createTopic = async (name: string, organSystemId: string) => {
    try {
      const newTopic = await testsService.upsertTopic(name, organSystemId);
      setCurriculumData(prev => prev.map(sys => {
        if (sys.id === organSystemId) {
          return {
            ...sys,
            topics: [...(sys.topics || []), newTopic]
          };
        }
        return sys;
      }));
    } catch (error) {
      console.error('Failed to create topic:', error);
      throw error;
    }
  };

  const updateTopic = async (id: string, name: string, newOrganSystemId?: string) => {
    if (!activeSystemId) return;
    
    // If organ system changed, use move logic
    if (newOrganSystemId && newOrganSystemId !== activeSystemId) {
      await moveTopic(id, name, newOrganSystemId);
      return;
    }

    try {
      await testsService.upsertTopic(name, activeSystemId, id);
      setCurriculumData(prev => prev.map(sys => {
        if (sys.id === activeSystemId) {
          return {
            ...sys,
            topics: sys.topics?.map(t => t.id === id ? { ...t, title: name } : t)
          };
        }
        return sys;
      }));
    } catch (error) {
      console.error('Failed to update topic:', error);
      throw error;
    }
  };

  const moveTopic = async (id: string, name: string, newOrganSystemId: string) => {
    if (!activeSystemId) return;
    try {
      const updatedTopic = await testsService.upsertTopic(name, newOrganSystemId, id);
      setCurriculumData(prev => prev.map(sys => {
        if (sys.id === activeSystemId) {
          // Remove from current system
          return { ...sys, topics: sys.topics?.filter(t => t.id !== id) };
        }
        if (sys.id === newOrganSystemId) {
          // Add to new system
          return { ...sys, topics: [...(sys.topics || []), updatedTopic] };
        }
        return sys;
      }));
    } catch (error) {
      console.error('Failed to move topic:', error);
      throw error;
    }
  };

  const deleteTopic = async (id: string) => {
    try {
      await testsService.deleteTopic(id);
      setCurriculumData(prev => prev.map(sys => {
        if (sys.id === activeSystemId) {
          return {
            ...sys,
            topics: sys.topics?.filter(t => t.id !== id)
          };
        }
        return sys;
      }));
      if (activeTopicId === id) {
        handleTopicSelect(null);
      }
    } catch (error) {
      console.error('Failed to delete topic:', error);
      throw error;
    }
  };

  const createSubTopic = async (name: string, topicId: string) => {
    try {
      const newSyndrome = await testsService.upsertSyndrome(undefined as any, name, topicId);
      setCurriculumData(prev => prev.map(sys => {
        if (sys.id === activeSystemId) {
          return {
            ...sys,
            topics: sys.topics?.map(topic => {
              if (topic.id === topicId) {
                return {
                  ...topic,
                  syndromes: [...(topic.syndromes || []), newSyndrome]
                };
              }
              return topic;
            })
          };
        }
        return sys;
      }));
    } catch (error) {
      console.error('Failed to create subtopic:', error);
      throw error;
    }
  };

  const updateSubTopic = async (id: string, name: string, topicId: string) => {
    if (!activeTopicId) return;
    try {
      await testsService.upsertSyndrome(id, name, topicId);
      if (topicId !== activeTopicId) {
        // Topic changed — move syndrome from old topic to new topic
        setCurriculumData(prev => prev.map(sys => {
          if (sys.id === activeSystemId) {
            return {
              ...sys,
              topics: sys.topics?.map(topic => {
                if (topic.id === activeTopicId) {
                  // Remove from old topic
                  return { ...topic, syndromes: topic.syndromes?.filter(s => s.id !== id) };
                }
                if (topic.id === topicId) {
                  // Add to new topic
                  return { ...topic, syndromes: [...(topic.syndromes || []), { id, title: name, topicId }] };
                }
                return topic;
              })
            };
          }
          return sys;
        }));
      } else {
        // Same topic — just update the name
        setCurriculumData(prev => prev.map(sys => {
          if (sys.id === activeSystemId) {
            return {
              ...sys,
              topics: sys.topics?.map(topic => {
                if (topic.id === activeTopicId) {
                  return {
                    ...topic,
                    syndromes: topic.syndromes?.map(s => s.id === id ? { ...s, title: name } : s)
                  };
                }
                return topic;
              })
            };
          }
          return sys;
        }));
      }
    } catch (error) {
      console.error('Failed to update subtopic:', error);
      throw error;
    }
  };

  const moveSubTopic = async (id: string, name: string, newTopicId: string) => {
    if (!activeTopicId || !activeSystemId) return;
    try {
      const updatedSyndrome = await testsService.upsertSyndrome(id, name, newTopicId);
      setCurriculumData(prev => prev.map(sys => {
        if (sys.id === activeSystemId) {
          return {
            ...sys,
            topics: sys.topics?.map(topic => {
              if (topic.id === activeTopicId) {
                // Remove from current topic
                return { ...topic, syndromes: topic.syndromes?.filter(s => s.id !== id) };
              }
              if (topic.id === newTopicId) {
                // Add to new topic
                return { ...topic, syndromes: [...(topic.syndromes || []), updatedSyndrome] };
              }
              return topic;
            })
          };
        }
        return sys;
      }));
    } catch (error) {
      console.error('Failed to move subtopic:', error);
      throw error;
    }
  };

  const deleteSubTopic = async (id: string) => {
    try {
      await testsService.deleteSyndrome(id);
      setCurriculumData(prev => prev.map(sys => {
        if (sys.id === activeSystemId) {
          return {
            ...sys,
            topics: sys.topics?.map(topic => {
                if (topic.id === activeTopicId) {
                    return {
                        ...topic,
                        syndromes: topic.syndromes?.filter(s => s.id !== id)
                    };
                }
                return topic;
            })
          };
        }
        return sys;
      }));
      if (activeSubTopicId === id) {
        handleSubTopicSelect(null);
      }
    } catch (error) {
      console.error('Failed to delete subtopic:', error);
      throw error;
    }
  };

  const handleContentSearchChange = (value: string): void => {
    setContentSearch(value);
  };

  const handleBloomFilterChange = (value: string): void => {
    setBloomFilter(value);
  };

  const handleLoadMoreObjectives = (): void => {
    if (objectivesPage * objectivesLimit < objectivesTotal) {
      setObjectivesPage(prev => prev + 1);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string) as OrganSystem[];
        setCurriculumData(importedData);
      } catch (error) {
        console.error('Failed to import curriculum data:', error);
      }
    };
    reader.readAsText(file);
  };

  const handleExport = (): void => {
    const dataStr = JSON.stringify(curriculumData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'curriculum-data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubjectSelect = (id: string): void => {
    setSearchParams(params => {
      params.set('subject', id);
      params.delete('system');
      params.delete('topic');
      params.delete('subtopic');
      return params;
    });
    setContentSearch('');
  };

  const handleModeChange = (newMode: 'step1' | 'step2'): void => {
    setSearchParams(params => {
      params.set('mode', newMode);
      params.delete('subject');
      params.delete('system');
      params.delete('topic');
      params.delete('subtopic');
      return params;
    });
    setContentSearch('');
    setBloomFilter('All');
    setObjectivesPage(1);
  };

  const handleReset = (): void => {
    setSearchParams(params => {
      params.delete('system');
      params.delete('topic');
      params.delete('subtopic');
      return params;
    });
    setContentSearch('');
    setBloomFilter('All');
    setObjectivesPage(1);
  };

  return {
    curriculumData,
    isLoading,
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
    bloomFilter,
    objectivesPage,
    objectivesTotal,
    objectivesLimit,
    setCurriculumData,
    handleSystemSelect,
    handleTopicSelect,
    handleSubTopicSelect,
    updateObjective,
    handleContentSearchChange,
    handleBloomFilterChange,
    handleLoadMoreObjectives,
    handleImport,
    handleExport,
    handleReset,
    setContentSearch,
    setBloomFilter,
    setObjectivesPage,
    deleteObjective,
    createObjective,
    createOrganSystem,
    updateOrganSystem,
    deleteOrganSystem,
    createTopic,
    updateTopic,
    deleteTopic,
    moveTopic,
    createSubTopic,
    updateSubTopic,
    deleteSubTopic,
    moveSubTopic,
    // Step 2
    curriculumMode,
    handleModeChange,
    subjects,
    activeSubjectId,
    handleSubjectSelect,
    questionStats,
    allowedSystemIds,
  };
};
