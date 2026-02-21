import { useState, useEffect, useMemo, useCallback } from 'react';
import { testsService } from '../services/testsService';
import { 
  OrganSystem, 
  Topic, 
  Tag,
  Discipline,
  Competency,
  Subject,
  Difficulty,
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
  tags: Tag[];
  disciplines: Discipline[];
  competencies: Competency[];
  subjects: Subject[];
  difficulties: Difficulty[];
  
  // Loading States
  isLoadingOrganSystems: boolean;
  isLoadingTopics: boolean;
  isLoadingSyndromes: boolean;
  isLoadingObjectives: boolean;
  isLoadingTags: boolean;
  isLoadingDisciplines: boolean;
  isLoadingCompetencies: boolean;
  isLoadingSubjects: boolean;
  isLoadingDifficulties: boolean;
  
  // Selected Values
  selectedOrganSystemId: string;
  selectedTopicId: string;
  selectedSyndromeId: string;
  selectedObjectiveId: string;
  selectedSkillId: string;
  objectiveSearchQuery: string;
  
  // Setters
  setSelectedOrganSystemId: (id: string) => void;
  setSelectedTopicId: (id: string) => void;
  setSelectedSyndromeId: (id: string) => void;
  setSelectedObjectiveId: (id: string) => void;
  setSelectedSkillId: (id: string) => void;
  setObjectiveSearchQuery: (query: string) => void;
  
  // Utilities
  searchObjectives: (query: string, usingSearchQuery?: boolean) => void;
  clearFilters: () => void;
  
  // Auto-fill from objective (for search path)
  fillFiltersFromObjective: (objective: LearningObjective) => void;
  
  // Batch set all filters
  setAllFilters: (organSystemId: string, topicId: string, syndromeId: string, objectiveId: string, skillId?: string) => void;
}

export const useQuestionEditorData = (): UseQuestionEditorDataReturn => {
  // Data State
  const [organSystems, setOrganSystems] = useState<OrganSystem[]>([]);
  const [topicsCache, setTopicsCache] = useState<Record<string, Topic[]>>({});
  const [syndromes, setSyndromes] = useState<Syndrome[]>([]);
  const [objectives, setObjectives] = useState<LearningObjective[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  
  // Loading States
  const [isLoadingOrganSystems, setIsLoadingOrganSystems] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isLoadingSyndromes, setIsLoadingSyndromes] = useState(false);
  const [isLoadingObjectives, setIsLoadingObjectives] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isLoadingDisciplines, setIsLoadingDisciplines] = useState(false);
  const [isLoadingCompetencies, setIsLoadingCompetencies] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingDifficulties, setIsLoadingDifficulties] = useState(false);
  
  // Selected Values
  const [selectedOrganSystemId, setSelectedOrganSystemId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedSyndromeId, setSelectedSyndromeId] = useState('');
  const [selectedObjectiveId, setSelectedObjectiveId] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState('');
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

  // Fetch Metadata (Tags, Disciplines, Competencies, Subjects, Difficulties) on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      setIsLoadingTags(true);
      setIsLoadingDisciplines(true);
      setIsLoadingCompetencies(true);
      setIsLoadingSubjects(true);
      setIsLoadingDifficulties(true);

      try {
        const [tagsRes, disciplinesRes, competenciesRes, subjectsRes, difficultiesRes] = await Promise.all([
          testsService.getTags(),
          testsService.getDisciplines(),
          testsService.getCompetencies(),
          testsService.getSubjects(),
          testsService.getDifficultyLevels()
        ]);

        setTags(tagsRes.items);
        setDisciplines(disciplinesRes.items);
        setCompetencies(competenciesRes.items);
        setSubjects(subjectsRes.items);
        setDifficulties(difficultiesRes.items);
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
      } finally {
        setIsLoadingTags(false);
        setIsLoadingDisciplines(false);
        setIsLoadingCompetencies(false);
        setIsLoadingSubjects(false);
        setIsLoadingDifficulties(false);
      }
    };
    fetchMetadata();
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

  // Fetch Objectives when Syndrome or Skill changes
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
        const response = await testsService.getLearningObjectives(1, 200, selectedSyndromeId, undefined, selectedSkillId);
        setObjectives(response.items);
      } catch (error) {
        console.error('Failed to fetch objectives:', error);
      } finally {
        setIsLoadingObjectives(false);
      }
    };
    fetchObjectives();
  }, [selectedSyndromeId, selectedSkillId]);

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
  const searchObjectives = useCallback(async (query: string , usingSearchQuery: boolean = false) => {
    if (!query || query.length < 2) {
      // If a syndrome is selected, re-fetch its objectives; otherwise clear
      if (!usingSearchQuery) {
        try {
          const response = await testsService.getLearningObjectives(1, 200, selectedSyndromeId, undefined, selectedSkillId);
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
      const response = await testsService.getLearningObjectives(1, 200, undefined, query, undefined);
      setObjectives(response.items);
    } catch (error) {
      console.error('Failed to search objectives:', error);
    } finally {
      setIsLoadingObjectives(false);
    }
  }, [selectedSyndromeId, selectedSkillId]);

  // Fill filters from selected objective (for search path)
  const fillFiltersFromObjective = useCallback(async (objective: LearningObjective) => {
    let syndromeId = objective.syndromeId || objective.syndrome?.id || '';
    let topicId = objective.syndrome?.topicId || objective.syndrome?.topic?.id || '';
    let organSystemId = objective.syndrome?.topic?.organSystemId || objective.syndrome?.topic?.organSystem?.id || '';

    // If we have syndromeId but are missing topicId, fetch the syndrome to get topicId
    if (syndromeId && !topicId) {
      try {
        const synRes = await testsService.getSyndromes(undefined, 1, 1, syndromeId);
        if (synRes.items && synRes.items.length > 0) {
          topicId = synRes.items[0].topicId || '';
          
          // The returned syndrome might also have the nested topic
          if (!organSystemId && synRes.items[0].topic?.organSystemId) {
            organSystemId = synRes.items[0].topic.organSystemId;
          }
        }
      } catch (e) {
        console.error("Failed to fetch syndrome for hierarchy:", e);
      }
    }

    // If we have topicId but are missing organSystemId, fetch the topic to get organSystemId
    if (topicId && !organSystemId) {
      try {
        const topRes = await testsService.getTopics(undefined, 1, 1, topicId);
        if (topRes.items && topRes.items.length > 0) {
          organSystemId = topRes.items[0].organSystemId || '';
        }
      } catch (e) {
        console.error("Failed to fetch topic for hierarchy:", e);
      }
    }

    // We need to fetch the intermediate data to populate the options properly,
    // assuming we just know the IDs, but the easiest path is just setting 
    // the selected IDs, and the existing `useEffects` will trigger fetching Topics and Syndromes.
    if (organSystemId) setSelectedOrganSystemId(organSystemId);
    if (topicId) setSelectedTopicId(topicId);
    if (syndromeId) setSelectedSyndromeId(syndromeId);
    
    // Also extract the cognitive skill ID
    const skillId = objective.cognitiveSkillId || objective.cognitiveSkill?.id || '';
    if (skillId) setSelectedSkillId(skillId);
    
    setSelectedObjectiveId(objective.id);
  }, []);

  // Batch set all filters (for initialization)
  const setAllFilters = useCallback((
    organSystemId: string, 
    topicId: string, 
    syndromeId: string, 
    objectiveId: string,
    skillId?: string
  ) => {
    // Set values directly to avoid cascading clears
    setSelectedOrganSystemId(organSystemId);
    setSelectedTopicId(topicId);
    setSelectedSyndromeId(syndromeId);
    setSelectedObjectiveId(objectiveId);
    if (skillId) setSelectedSkillId(skillId);
    
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
    setSelectedSkillId('');
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
    tags,
    disciplines,
    competencies,
    subjects,
    difficulties,
    
    // Loading States
    isLoadingOrganSystems,
    isLoadingTopics,
    isLoadingSyndromes,
    isLoadingObjectives,
    isLoadingTags,
    isLoadingDisciplines,
    isLoadingCompetencies,
    isLoadingSubjects,
    isLoadingDifficulties,
    
    // Selected Values
    selectedOrganSystemId,
    selectedTopicId,
    selectedSyndromeId,
    selectedObjectiveId,
    selectedSkillId,
    objectiveSearchQuery,
    
    // Setters
    setSelectedOrganSystemId: handleSetOrganSystemId,
    setSelectedTopicId: handleSetTopicId,
    setSelectedSyndromeId: handleSetSyndromeId,
    setSelectedObjectiveId,
    setSelectedSkillId,
    setObjectiveSearchQuery,
    setAllFilters,    
    // Utilities
    searchObjectives,
    clearFilters,
    fillFiltersFromObjective
  };
};
