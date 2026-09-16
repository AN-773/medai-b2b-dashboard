import { apiClient } from './apiClient';
import type { StudentMastery, LectureAsset } from '../types';

export const tutorService = {
  // Legacy endpoints have no response DTO/consumer in this repository. Keep the
  // transport available, but require future callers to validate its response.
  getCurriculumObjectives: async (): Promise<unknown> => {
    return apiClient.get<unknown>('TUTOR', '/curriculum/objectives');
  },

  getStudentMastery: async (studentId?: string): Promise<StudentMastery[]> => {
    const endpoint = studentId ? `/students/${studentId}/mastery` : '/students/mastery';
    return apiClient.get<StudentMastery[]>('TUTOR', endpoint);
  },

  getLectures: async (): Promise<LectureAsset[]> => {
    return apiClient.get<LectureAsset[]>('TUTOR', '/lectures');
  },
  
  getLectureMetrics: async (lectureId: string): Promise<unknown> => {
      return apiClient.get<unknown>('TUTOR', `/lectures/${lectureId}/metrics`);
  }
};
