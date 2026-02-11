import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CognitiveSkill } from '../types/TestsServiceTypes';
import { testsService } from '../services/testsService';
import { useAuth } from './AuthContext';

interface GlobalContextType {
  cognitiveSkills: CognitiveSkill[];
  isLoadingSkills: boolean;
  refreshSkills: () => Promise<void>;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [cognitiveSkills, setCognitiveSkills] = useState<CognitiveSkill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);

  const fetchSkills = async () => {
    if (!isAuthenticated) return;
    
    setIsLoadingSkills(true);
    try {
      // Fetch all skills (using a large limit to get all)
      const response = await testsService.getCognitiveSkills(1, 1000);
      setCognitiveSkills(response.items);
    } catch (error) {
      console.error('Failed to fetch cognitive skills:', error);
    } finally {
      setIsLoadingSkills(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && cognitiveSkills.length === 0) {
      fetchSkills();
    }
  }, [isAuthenticated]);

  return (
    <GlobalContext.Provider value={{ 
      cognitiveSkills, 
      isLoadingSkills,
      refreshSkills: fetchSkills 
    }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobal = () => {
  const context = useContext(GlobalContext);
  if (context === undefined) {
    throw new Error('useGlobal must be used within a GlobalProvider');
  }
  return context;
};
