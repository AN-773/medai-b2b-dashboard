import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { testsService } from '../services/testsService';
import { PaginatedApiResponse, Topic, OrganSystem, LearningObjective, Syndrome } from '../types/TestsServiceTypes';
import React from 'react';
import { useGlobal } from '../contexts/GlobalContext';

export interface UseCurriculumReturn {
  curriculumData: OrganSystem[];
  isLoading: boolean;
  areTopicsLoading: boolean;
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
  updateObjective: (id: string, text: string, bloomLevel: string) => void;
  handleContentSearchChange: (value: string) => void;
  handleBloomFilterChange: (value: string) => void;
  handleLoadMoreObjectives: () => void;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleExport: () => void;
  handleReset: () => void;
  setContentSearch: (value: string) => void;
  setBloomFilter: (value: string) => void;
  setObjectivesPage: (value: number) => void;
  deleteObjective: (id: string) => void;
}

export const useCurriculum = (): UseCurriculumReturn => {
  // Data State
  const [curriculumData, setCurriculumData] = useState<OrganSystem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [areTopicsLoading, setAreTopicsLoading] = useState(false);
  const [areObjectivesLoading, setAreObjectivesLoading] = useState(false);
  const { cognitiveSkills } = useGlobal();

  // Navigation State
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeSystemId = searchParams.get('system') || curriculumData[0]?.id;
  const activeTopicId = searchParams.get('topic');
  const activeSubTopicId = searchParams.get('subtopic');

  // Filter State
  const [contentSearch, setContentSearch] = useState('');
  const [bloomFilter, setBloomFilter] = useState<string>('All');

  // Objectives Pagination State
  const [objectivesPage, setObjectivesPage] = useState(1);
  const [objectivesTotal, setObjectivesTotal] = useState(0);
  const objectivesLimit = 20;

  // Fetch Data
  useEffect(() => {
    const fetchOrganSystems = async () => {
      setIsLoading(true);
      try {
        //Not handling pagination because it's not needed
        const response: PaginatedApiResponse<OrganSystem> = await testsService.getOrganSystems();
        
        setCurriculumData(response.items);
      } catch (error) {
        console.error('Failed to fetch organ systems:', error);
        // Fallback to mock data on error? Or just show error state
        // setCurriculumData(USMLE_2024_OUTLINE); 
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganSystems();
  }, []);

  // Fetch Topics (and Syndromes as they are now nested)

  useEffect(() => {
    let active = true;

    const fetchTopics = async () => {
      if (!activeSystemId) return;

      setAreTopicsLoading(true);
      try {
        const response: Topic[] = await testsService.getTopics(activeSystemId);
        if (active) {
          setCurriculumData(prev => prev.map(sys => {
            if (sys.id === activeSystemId) {
              return {
                ...sys,
                topics: response
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
  }, [activeSystemId]);

  // Fetch Learning Objectives when a subtopic (syndrome) is selected
  useEffect(() => {
    let active = true;

    const fetchLearningObjectives = async () => {
      if (!activeSubTopicId || !activeTopicId) return;

      setAreObjectivesLoading(true);
      try {
        console.log();
        
        const response = await testsService.getLearningObjectives(objectivesPage, objectivesLimit, activeSubTopicId);

        if (active) {
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
                  if (topic.id === activeTopicId) {
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
  }, [activeSubTopicId, activeTopicId, activeSystemId, objectivesPage, cognitiveSkills]);

  // Reset pagination when subtopic changes
  useEffect(() => {
    setObjectivesPage(1);
  }, [activeSubTopicId]);


  // Derived Data
  const activeSystem = useMemo(() => 
    curriculumData.find(s => s.id === activeSystemId), 
  [curriculumData, activeSystemId]);

  const activeTopic = useMemo(() => 
    activeSystem?.topics?.find(t => t.id === activeTopicId), 
  [activeSystem, activeTopicId]);

  const activeSubTopic = useMemo(() => 
    activeTopic?.syndromes?.find(s => s.id === activeSubTopicId), 
  [activeTopic, activeSubTopicId]);

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

  const updateObjective = (id: string, text: string, bloomLevel: string) => {
    setCurriculumData(prev => prev.map(system => ({
      ...system,
      topics: system.topics.map(topic => ({
        ...topic,
        objectives: topic.objectives?.map(obj => 
          obj.id === id ? { ...obj, text, bloomLevel } : obj
        ) || []
      }))
    })));
  };

  const deleteObjective = (id: string): void => {
    setCurriculumData(prev => prev.map(system => ({
      ...system,
      topics: system.topics.map(topic => ({
        ...topic,
        objectives: topic.objectives?.filter(obj => obj.id !== id) || []
      }))
    })));
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
  };
};
