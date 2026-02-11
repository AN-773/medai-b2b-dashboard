import { useState, useEffect, useMemo, useCallback } from 'react';
import { testsService } from '../services/testsService';
import { 
  OrganSystem, 
  Topic, 
  Syndrome, 
  LearningObjective, 
  PaginatedApiResponse 
} from '../types/TestsServiceTypes';

interface UseQuestionEditorDataReturn {
  // Data
  organSystems: OrganSystem[];
  topics: Topic[];
  syndromes: Syndrome[];
  objectives: LearningObjective[];
  
  // Loading States
  isLoadingOrganSystems: boolean;
  isLoadingTopics: boolean;
  isLoadingSyndromes: boolean;
  isLoadingObjectives: boolean;
  
  // Selected Values
  selectedOrganSystemId: string;
  selectedTopicId: string;
  selectedSyndromeId: string;
  selectedObjectiveId: string;
  objectiveSearchQuery: string;
  
  // Setters
  setSelectedOrganSystemId: (id: string) => void;
  setSelectedTopicId: (id: string) => void;
  setSelectedSyndromeId: (id: string) => void;
  setSelectedObjectiveId: (id: string) => void;
  setObjectiveSearchQuery: (query: string) => void;
  
  // Utilities
  searchObjectives: (query: string) => void;
  clearFilters: () => void;
  
  // Auto-fill from objective (for search path)
  fillFiltersFromObjective: (objective: LearningObjective) => void;
}

export const useQuestionEditorData = (): UseQuestionEditorDataReturn => {
  // Data State
  const [organSystems, setOrganSystems] = useState<OrganSystem[]>([]);
  const [topicsCache, setTopicsCache] = useState<Record<string, Topic[]>>({});
  const [objectives, setObjectives] = useState<LearningObjective[]>([]);
  
  // Loading States
  const [isLoadingOrganSystems, setIsLoadingOrganSystems] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isLoadingObjectives, setIsLoadingObjectives] = useState(false);
  
  // Selected Values
  const [selectedOrganSystemId, setSelectedOrganSystemId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedSyndromeId, setSelectedSyndromeId] = useState('');
  const [selectedObjectiveId, setSelectedObjectiveId] = useState('');
  const [objectiveSearchQuery, setObjectiveSearchQuery] = useState('');

  // Fetch Organ Systems on mount
  useEffect(() => {
    const fetchOrganSystems = async () => {
      setIsLoadingOrganSystems(true);
      try {
        const response = await testsService.getOrganSystems();
        setOrganSystems(response.items);
      } catch (error) {
        console.error('Failed to fetch organ systems:', error);
      } finally {
        setIsLoadingOrganSystems(false);
      }
    };
    fetchOrganSystems();
  }, []);

  // Fetch Topics when Organ System changes
  useEffect(() => {
    if (!selectedOrganSystemId) return;
    
    // Check cache first
    if (topicsCache[selectedOrganSystemId]) return;
    
    const fetchTopics = async () => {
      setIsLoadingTopics(true);
      try {
        const topics = await testsService.getTopics(selectedOrganSystemId);
        setTopicsCache(prev => ({
          ...prev,
          [selectedOrganSystemId]: topics || []
        }));
      } catch (error) {
        console.error('Failed to fetch topics:', error);
      } finally {
        setIsLoadingTopics(false);
      }
    };
    fetchTopics();
  }, [selectedOrganSystemId, topicsCache]);

  // Fetch Objectives when Syndrome changes
  useEffect(() => {
    if (!selectedSyndromeId) {
      setObjectives([]);
      return;
    }
    
    const fetchObjectives = async () => {
      setIsLoadingObjectives(true);
      try {
        const response = await testsService.getLearningObjectives(selectedSyndromeId);
        setObjectives(response.items);
      } catch (error) {
        console.error('Failed to fetch objectives:', error);
      } finally {
        setIsLoadingObjectives(false);
      }
    };
    fetchObjectives();
  }, [selectedSyndromeId]);

  // Derived data
  const topics = useMemo(() => {
    return topicsCache[selectedOrganSystemId] || [];
  }, [topicsCache, selectedOrganSystemId]);

  const syndromes = useMemo(() => {
    if (!selectedTopicId) return [];
    const topic = topics.find(t => t.id === selectedTopicId);
    return topic?.syndromes || [];
  }, [topics, selectedTopicId]);

  // Handle Organ System selection (clears children)
  const handleSetOrganSystemId = useCallback((id: string) => {
    setSelectedOrganSystemId(id);
    setSelectedTopicId('');
    setSelectedSyndromeId('');
    setSelectedObjectiveId('');
    setObjectives([]);
  }, []);

  // Handle Topic selection (clears children)
  const handleSetTopicId = useCallback((id: string) => {
    setSelectedTopicId(id);
    setSelectedSyndromeId('');
    setSelectedObjectiveId('');
    setObjectives([]);
  }, []);

  // Handle Syndrome selection (clears objective)
  const handleSetSyndromeId = useCallback((id: string) => {
    setSelectedSyndromeId(id);
    setSelectedObjectiveId('');
  }, []);

  // Search objectives by text
  const searchObjectives = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setObjectives([]);
      return;
    }
    
    setIsLoadingObjectives(true);
    try {
      const response = await testsService.getLearningObjectives(undefined, query);
      setObjectives(response.items);
    } catch (error) {
      console.error('Failed to search objectives:', error);
    } finally {
      setIsLoadingObjectives(false);
    }
  }, []);

  // Fill filters from selected objective (for search path)
  const fillFiltersFromObjective = useCallback((objective: LearningObjective) => {
    if (objective.syndrome) {
      const syndrome = objective.syndrome;
      setSelectedSyndromeId(syndrome.id);
      
      if (syndrome.topic) {
        setSelectedTopicId(syndrome.topic.id);
        
        // Find the organ system from the topic
        if (syndrome.topic.organSystemId) {
          setSelectedOrganSystemId(syndrome.topic.organSystemId);
        }
      }
    }
    setSelectedObjectiveId(objective.id);
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedOrganSystemId('');
    setSelectedTopicId('');
    setSelectedSyndromeId('');
    setSelectedObjectiveId('');
    setObjectiveSearchQuery('');
    setObjectives([]);
  }, []);

  return {
    // Data
    organSystems,
    topics,
    syndromes,
    objectives,
    
    // Loading States
    isLoadingOrganSystems,
    isLoadingTopics,
    isLoadingSyndromes: false, // Syndromes come from topics, no separate loading
    isLoadingObjectives,
    
    // Selected Values
    selectedOrganSystemId,
    selectedTopicId,
    selectedSyndromeId,
    selectedObjectiveId,
    objectiveSearchQuery,
    
    // Setters
    setSelectedOrganSystemId: handleSetOrganSystemId,
    setSelectedTopicId: handleSetTopicId,
    setSelectedSyndromeId: handleSetSyndromeId,
    setSelectedObjectiveId,
    setObjectiveSearchQuery,
    
    // Utilities
    searchObjectives,
    clearFilters,
    fillFiltersFromObjective
  };
};
