import { apiClient } from './apiClient';
import { CurriculumObjective, StudentMastery, LectureMetrics, LectureAsset } from '../types';

export const tutorService = {
  getCurriculumObjectives: async (): Promise<CurriculumObjective[]> => {
    return apiClient.get<CurriculumObjective[]>('TUTOR', '/curriculum/objectives');
  },

  getStudentMastery: async (studentId?: string): Promise<StudentMastery[]> => {
    const endpoint = studentId ? `/students/${studentId}/mastery` : '/students/mastery';
    return apiClient.get<StudentMastery[]>('TUTOR', endpoint);
  },

  getLectures: async (): Promise<LectureAsset[]> => {
    return apiClient.get<LectureAsset[]>('TUTOR', '/lectures');
  },
  
  getLectureMetrics: async (lectureId: string): Promise<LectureMetrics> => {
      return apiClient.get<LectureMetrics>('TUTOR', `/lectures/${lectureId}/metrics`);
  }
};
