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
  
  // Batch set all filters
  setAllFilters: (organSystemId: string, topicId: string, syndromeId: string, objectiveId: string) => void;
}

export const useQuestionEditorData = (): UseQuestionEditorDataReturn => {
  // Data State
  const [organSystems, setOrganSystems] = useState<OrganSystem[]>([]);
  const [topicsCache, setTopicsCache] = useState<Record<string, Topic[]>>({});
  const [syndromes, setSyndromes] = useState<Syndrome[]>([]);
  const [objectives, setObjectives] = useState<LearningObjective[]>([]);
  
  // Loading States
  const [isLoadingOrganSystems, setIsLoadingOrganSystems] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isLoadingSyndromes, setIsLoadingSyndromes] = useState(false);
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
        const response = await testsService.getTopics(selectedOrganSystemId);
        setTopicsCache(prev => ({
          ...prev,
          [selectedOrganSystemId]: response.items || []
        }));
      } catch (error) {
        console.error('Failed to fetch topics:', error);
      } finally {
        setIsLoadingTopics(false);
      }
    };
    fetchTopics();
  }, [selectedOrganSystemId, topicsCache]);

  // Fetch Syndromes when Topic changes
  useEffect(() => {
    if (!selectedTopicId) {
      // setSyndromes([]);
      return;
    }
    
    const fetchSyndromes = async () => {
      setIsLoadingSyndromes(true);
      try {
        const response = await testsService.getSyndromes(selectedTopicId);
        setSyndromes(response.items);
      } catch (error) {
        console.error('Failed to fetch syndromes:', error);
      } finally {
        setIsLoadingSyndromes(false);
      }
    };
    fetchSyndromes();
  }, [selectedTopicId]);

  // Fetch Objectives when Syndrome changes
  useEffect(() => {
    if (!selectedSyndromeId) {
      // Only clear objectives if not in search mode
      // if (!objectiveSearchQuery) {
      //   setObjectives([]);
      // }
      return;
    }
    
    const fetchObjectives = async () => {
      setIsLoadingObjectives(true);
      try {
        const response = await testsService.getLearningObjectives(1, 200, selectedSyndromeId);
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

  // Handle Organ System selection (clears children)
  const handleSetOrganSystemId = useCallback((id: string) => {
    setSelectedOrganSystemId(id);
    setSelectedTopicId('');
    setSelectedSyndromeId('');
    setSelectedObjectiveId('');
    setSyndromes([]);
    setObjectives([]);
  }, []);

  // Handle Topic selection (clears children)
  const handleSetTopicId = useCallback((id: string) => {
    setSelectedTopicId(id);
    setSelectedSyndromeId('');
    setSelectedObjectiveId('');
    setSyndromes([]);
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
      // If a syndrome is selected, re-fetch its objectives; otherwise clear
      if (selectedSyndromeId) {
        try {
          const response = await testsService.getLearningObjectives(1, 200, selectedSyndromeId);
          setObjectives(response.items);
        } catch (error) {
          console.error('Failed to fetch objectives:', error);
        }
      } else {
        setObjectives([]);
      }
      return;
    }
    
    setIsLoadingObjectives(true);
    try {
      const response = await testsService.getLearningObjectives(1, 200, undefined, query);
      setObjectives(response.items);
    } catch (error) {
      console.error('Failed to search objectives:', error);
    } finally {
      setIsLoadingObjectives(false);
    }
  }, [selectedSyndromeId]);

  // Fill filters from selected objective (for search path)
  const fillFiltersFromObjective = useCallback((objective: LearningObjective) => {
    // Reset hierarchy filters when selecting from search
    setSelectedOrganSystemId('');
    setSelectedTopicId('');
    setSelectedSyndromeId('');
    setSyndromes([]);
    setSelectedObjectiveId(objective.id);
  }, []);

  // Batch set all filters (for initialization)
  const setAllFilters = useCallback((
    organSystemId: string, 
    topicId: string, 
    syndromeId: string, 
    objectiveId: string
  ) => {
    // Set values directly to avoid cascading clears
    setSelectedOrganSystemId(organSystemId);
    setSelectedTopicId(topicId);
    setSelectedSyndromeId(syndromeId);
    setSelectedObjectiveId(objectiveId);
    
    // We also need to ensure data is fetched for these levels if not already
    // The existing useEffects will react to the ID changes and fetch data
    // but providing the IDs immediately prevents race conditions validation
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedOrganSystemId('');
    setSelectedTopicId('');
    setSelectedSyndromeId('');
    setSelectedObjectiveId('');
    setObjectiveSearchQuery('');
    setSyndromes([]);
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
    isLoadingSyndromes,
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
    setAllFilters,    
    // Utilities
    searchObjectives,
    clearFilters,
    fillFiltersFromObjective
  };
};
