import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { USMLE_2024_OUTLINE } from '../constants';
import { USMLEStandardCategory, ApiOrganSystem, ApiResponse, ApiTopic, USMLEStandardTopic, ApiSyndrome } from '../types';
import { testsService } from '../services/testsService';

export const useCurriculum = () => {
  // Data State
  const [curriculumData, setCurriculumData] = useState<USMLEStandardCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [areTopicsLoading, setAreTopicsLoading] = useState(false);
  const [areSubTopicsLoading, setAreSubTopicsLoading] = useState(false);

  // Navigation State
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeSystemId = searchParams.get('system') || curriculumData[0]?.id;
  const activeTopicId = searchParams.get('topic');
  const activeSubTopic = searchParams.get('subtopic');

  // Filter State
  const [contentSearch, setContentSearch] = useState('');
  const [bloomFilter, setBloomFilter] = useState<string>('All');

  // Fetch Data
  useEffect(() => {
    const fetchOrganSystems = async () => {
      setIsLoading(true);
      try {
        const response: ApiResponse<ApiOrganSystem> = await testsService.getOrganSystems();
        
        const mappedSystems: USMLEStandardCategory[] = response.items.map(item => ({
          id: item.id || item.identifier, // Prefer ID if available (URI), fallback to identifier
          name: item.title,
          page: 0, // Default or map if available
          topics: [] // Default to empty array as API returns null/empty
        }));

        setCurriculumData(mappedSystems);
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
        const response: ApiResponse<ApiTopic> = await testsService.getTopics(activeSystemId);
        
        if (active) {
          setCurriculumData(prev => prev.map(sys => {
            if (sys.id === activeSystemId) {
              const mappedTopics: USMLEStandardTopic[] = response.items.map(topic => ({
                id: topic.id || topic.identifier,
                name: topic.title,
                // Map nested syndromes to subTopics string array
                subTopics: topic.syndromes?.map((s: ApiSyndrome) => s.title) || [],
                objectives: [] // Initialize empty
              }));
              
              return {
                ...sys,
                topics: mappedTopics
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

  // Fetch Syndromes effect removed as they are now fetched with topics

  // Derived Data
  const activeSystem = useMemo(() => 
    curriculumData.find(s => s.id === activeSystemId), 
  [curriculumData, activeSystemId]);

  const activeTopic = useMemo(() => 
    activeSystem?.topics.find(t => t.id === activeTopicId), 
  [activeSystem, activeTopicId]);

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

  const setActiveSubTopic = (id: string | null) => {
    setSearchParams(params => {
      if (id) {
        params.set('subtopic', id);
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

  const deleteObjective = (id: string) => {
    setCurriculumData(prev => prev.map(system => ({
      ...system,
      topics: system.topics.map(topic => ({
        ...topic,
        objectives: topic.objectives?.filter(obj => obj.id !== id) || []
      }))
    })));
  };

  return {
    curriculumData,
    setCurriculumData,
    activeSystem,
    activeTopic,
    activeSystemId,
    activeTopicId,
    activeSubTopic,
    setActiveSubTopic,
    setActiveTopicId: handleTopicSelect,
    contentSearch,
    setContentSearch,
    bloomFilter,
    setBloomFilter,
    handleSystemSelect,
    updateObjective,
    deleteObjective,
    isLoading,
    areTopicsLoading,
    areSubTopicsLoading
  };
};
