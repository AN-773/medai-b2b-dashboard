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
  selectedExam: 'STEP 1' | 'STEP 2' | '';
  
  // Setters
  setSelectedOrganSystemId: (id: string) => void;
  setSelectedTopicId: (id: string) => void;
  setSelectedSyndromeId: (id: string) => void;
  setSelectedObjectiveId: (id: string) => void;
  setSelectedSkillId: (id: string) => void;
  setObjectiveSearchQuery: (query: string) => void;
  setSelectedExam: (exam: 'STEP 1' | 'STEP 2' | '') => void;
  
  // Utilities
  searchObjectives: (query: string, usingSearchQuery?: boolean) => void;
  clearFilters: () => void;
  refreshTopics: () => Promise<void>;
  refreshSyndromes: () => Promise<void>;
  
  // Auto-fill from objective (for search path)
  fillFiltersFromObjective: (objective: LearningObjective) => Promise<LearningObjective>;
  
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
  const [selectedExam, setSelectedExam] = useState<'STEP 1' | 'STEP 2' | ''>('STEP 1');

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
        setSubjects(subjectsRes.items.filter(s => s.title !== ''));
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
        const response = await testsService.getLearningObjectives(1, 200, selectedSyndromeId, undefined, selectedSkillId, selectedExam);
        setObjectives(response.items);
      } catch (error) {
        console.error('Failed to fetch objectives:', error);
      } finally {
        setIsLoadingObjectives(false);
      }
    };
    fetchObjectives();
  }, [selectedSyndromeId, selectedSkillId, selectedExam]);

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

  const refreshTopics = useCallback(async () => {
    if (!selectedOrganSystemId) return;
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
  }, [selectedOrganSystemId]);

  const refreshSyndromes = useCallback(async () => {
    if (!selectedTopicId) return;
    setIsLoadingSyndromes(true);
    try {
      const response = await testsService.getSyndromes(selectedTopicId);
      setSyndromes(response.items);
    } catch (error) {
      console.error('Failed to fetch syndromes:', error);
    } finally {
      setIsLoadingSyndromes(false);
    }
  }, [selectedTopicId]);

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
      const response = await testsService.getLearningObjectives(1, 200, undefined, query);
      setObjectives(response.items);
    } catch (error) {
      console.error('Failed to search objectives:', error);
    } finally {
      setIsLoadingObjectives(false);
    }
  }, [selectedSyndromeId, selectedSkillId]);

  // Fill filters from selected objective (for search path)
  const fillFiltersFromObjective = useCallback(async (objective: LearningObjective) => {
    let fullObjective = objective;
    try {
      fullObjective = await testsService.getLearningObjective(objective.id.split('/').pop() || '');
    } catch (e) {
      console.error("Failed to fetch full objective details:", e);
    }

    let syndromeId = fullObjective.syndromeId || fullObjective.syndrome?.id || '';
    let topicId = fullObjective.syndrome?.topicId || fullObjective.syndrome?.topic?.id || '';
    let organSystemId = fullObjective.syndrome?.topic?.organSystemId || fullObjective.syndrome?.topic?.organSystem?.id || '';

    // We need to fetch the intermediate data to populate the options properly,
    // assuming we just know the IDs, but the easiest path is just setting 
    // the selected IDs, and the existing `useEffects` will trigger fetching Topics and Syndromes.
    if (organSystemId) setSelectedOrganSystemId(organSystemId);
    if (topicId) setSelectedTopicId(topicId);
    if (syndromeId) setSelectedSyndromeId(syndromeId);
    
    // Also extract the cognitive skill ID
    const skillId = fullObjective.cognitiveSkillId || fullObjective.cognitiveSkill?.id || '';
    if (skillId) setSelectedSkillId(skillId);

    // Also extract the exam
    if (fullObjective.exam === 'STEP 1' || fullObjective.exam === 'STEP 2') {
      setSelectedExam(fullObjective.exam);
    }
    
    setSelectedObjectiveId(fullObjective.id);

    return fullObjective;
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
    selectedExam,
    
    // Setters
    setSelectedOrganSystemId: handleSetOrganSystemId,
    setSelectedTopicId: handleSetTopicId,
    setSelectedSyndromeId: handleSetSyndromeId,
    setSelectedObjectiveId,
    setSelectedSkillId,
    setObjectiveSearchQuery,
    setSelectedExam,
    setAllFilters,    
    // Utilities
    searchObjectives,
    clearFilters,
    fillFiltersFromObjective,
    refreshTopics,
    refreshSyndromes
  };
};
