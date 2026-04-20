import {
  AcademyStudioState,
  CourseContentDraft,
  CourseSourceFile,
  TeacherCohort,
  TeacherCourse,
  TeacherLearningObjective,
  TeacherStudent,
} from '@/types/AcademyStudioTypes';

const STORAGE_KEY = 'msai_teacher_academy_studio_v1';

const emptyState: AcademyStudioState = {
  students: [],
  courses: [],
  cohorts: [],
};

const nowIso = () => new Date().toISOString();

const makeId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const safeStorage = {
  load(): AcademyStudioState {
    if (typeof window === 'undefined') return emptyState;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;

    try {
      const parsed = JSON.parse(raw) as Partial<AcademyStudioState>;
      return {
        students: Array.isArray(parsed.students) ? parsed.students : [],
        courses: Array.isArray(parsed.courses)
          ? parsed.courses.map((course) =>
              normalizeCourse(
                course as Partial<TeacherCourse> & {
                  modules?: CourseContentDraft[];
                },
              ),
            )
          : [],
        cohorts: Array.isArray(parsed.cohorts) ? parsed.cohorts : [],
      };
    } catch (error) {
      console.error('Failed to parse academy studio state:', error);
      return emptyState;
    }
  },
  save(state: AcademyStudioState) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
};

const updateState = (updater: (current: AcademyStudioState) => AcademyStudioState) => {
  const next = updater(safeStorage.load());
  safeStorage.save(next);
  return next;
};

const uniqueById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const normalizeCourse = (
  course: Partial<TeacherCourse> & { modules?: CourseContentDraft[] },
): TeacherCourse => {
  const timestamp = nowIso();
  return {
    id: course.id || makeId('course'),
    title: course.title?.trim() || 'Untitled Course',
    code:
      course.code?.trim() ||
      `CRS-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    summary: course.summary?.trim() || '',
    learningObjectives: Array.isArray(course.learningObjectives)
      ? course.learningObjectives
      : [],
    sourceFiles: Array.isArray(course.sourceFiles) ? course.sourceFiles : [],
    contentDrafts: Array.isArray(course.contentDrafts)
      ? course.contentDrafts
      : Array.isArray(course.modules)
        ? course.modules
        : [],
    createdAt: course.createdAt || timestamp,
    updatedAt: course.updatedAt || timestamp,
  };
};

const generateCourseContentDrafts = (
  courseTitle: string,
  fileName: string,
  objectives: TeacherLearningObjective[],
): CourseContentDraft[] => {
  const cleanCourseTitle = courseTitle.trim() || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
  const moduleThemes = [
    `Foundations of ${cleanCourseTitle}`,
    `Core Workflows in ${cleanCourseTitle}`,
    `Applied Practice for ${cleanCourseTitle}`,
    `Advanced Scenarios in ${cleanCourseTitle}`,
  ];

  const groupedObjectives: string[][] = [];
  if (objectives.length > 0) {
    for (let index = 0; index < objectives.length; index += 3) {
      groupedObjectives.push(objectives.slice(index, index + 3).map((objective) => objective.title));
    }
  } else {
    groupedObjectives.push(
      [
        `Identify the high-yield concepts introduced in ${cleanCourseTitle}.`,
        `Explain how the uploaded source material supports the course goals.`,
        `Translate the content into teaching moments for the assigned cohort.`,
      ],
      [
        `Apply the concepts from ${cleanCourseTitle} to realistic teaching scenarios.`,
        `Connect the source material to assessment and cohort support decisions.`,
      ],
    );
  }

  return groupedObjectives.map((objectivesGroup, index) => ({
    id: makeId('content-draft'),
    title:
      moduleThemes[index] ||
      `Learning Objective Set ${index + 1}: ${cleanCourseTitle}`,
    objectives: objectivesGroup,
  }));
};

export const academyStudioService = {
  makeId,
  getState: (): AcademyStudioState => safeStorage.load(),
  getStudents: (): TeacherStudent[] => safeStorage.load().students,
  getCourses: (): TeacherCourse[] => safeStorage.load().courses,
  getCohorts: (): TeacherCohort[] => safeStorage.load().cohorts,

  saveStudent: (student: Omit<TeacherStudent, 'id' | 'createdAt'> & { id?: string }) => {
    const timestamp = nowIso();
    const normalized: TeacherStudent = {
      id: student.id || makeId('student'),
      createdAt: timestamp,
      ...student,
    };

    return updateState((current) => ({
      ...current,
      students: uniqueById(
        [normalized, ...current.students.filter((existing) => existing.id !== normalized.id)].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      ),
    })).students;
  },

  importStudents: (students: Array<Omit<TeacherStudent, 'id' | 'createdAt'>>) => {
    const timestamp = nowIso();
    return updateState((current) => {
      const existingByEmail = new Map(
        current.students
          .filter((student) => student.email)
          .map((student) => [student.email.toLowerCase(), student]),
      );

      const mergedStudents = [...current.students];
      students.forEach((student) => {
        const existing = existingByEmail.get(student.email.toLowerCase());
        const nextStudent: TeacherStudent = {
          id: existing?.id || makeId('student'),
          createdAt: existing?.createdAt || timestamp,
          ...student,
        };

        const existingIndex = mergedStudents.findIndex((candidate) => candidate.id === nextStudent.id);
        if (existingIndex >= 0) {
          mergedStudents[existingIndex] = nextStudent;
        } else {
          mergedStudents.push(nextStudent);
        }
      });

      return {
        ...current,
        students: mergedStudents.sort((left, right) => left.name.localeCompare(right.name)),
      };
    }).students;
  },

  removeStudent: (studentId: string) =>
    updateState((current) => ({
      ...current,
      students: current.students.filter((student) => student.id !== studentId),
      cohorts: current.cohorts.map((cohort) => ({
        ...cohort,
        studentIds: cohort.studentIds.filter((id) => id !== studentId),
      })),
    })),

  saveCourse: (course: Partial<TeacherCourse> & Pick<TeacherCourse, 'title'>) => {
    const timestamp = nowIso();
    const normalized: TeacherCourse = {
      ...normalizeCourse(
        course as Partial<TeacherCourse> & { modules?: CourseContentDraft[] },
      ),
      title: course.title,
      updatedAt: timestamp,
    };

    return updateState((current) => ({
      ...current,
      courses: uniqueById([normalized, ...current.courses.filter((existing) => existing.id !== normalized.id)]).sort((left, right) =>
        left.title.localeCompare(right.title),
      ),
    })).courses;
  },

  removeCourse: (courseId: string) =>
    updateState((current) => ({
      ...current,
      courses: current.courses.filter((course) => course.id !== courseId),
      cohorts: current.cohorts.map((cohort) => ({
        ...cohort,
        courseIds: cohort.courseIds.filter((id) => id !== courseId),
        courseSelections: cohort.courseSelections.filter((selection) => selection.courseId !== courseId),
      })),
    })),

  saveCourseLearningObjectives: (courseId: string, learningObjectives: TeacherLearningObjective[]) =>
    updateState((current) => ({
      ...current,
      courses: current.courses.map((course) =>
        course.id === courseId
          ? {
              ...course,
              learningObjectives,
              updatedAt: nowIso(),
            }
          : course,
      ),
    })).courses,

  appendCourseLearningObjective: (
    courseId: string,
    learningObjective: Omit<TeacherLearningObjective, 'id' | 'createdAt'> & { id?: string },
  ) => {
    const objective: TeacherLearningObjective = {
      id: learningObjective.id || makeId('lo'),
      createdAt: nowIso(),
      ...learningObjective,
    };

    return updateState((current) => ({
      ...current,
      courses: current.courses.map((course) =>
        course.id === courseId
          ? {
              ...course,
              learningObjectives: [...course.learningObjectives, objective],
              updatedAt: nowIso(),
            }
          : course,
      ),
    })).courses;
  },

  removeCourseLearningObjective: (courseId: string, learningObjectiveId: string) =>
    updateState((current) => ({
      ...current,
      courses: current.courses.map((course) =>
        course.id === courseId
          ? {
              ...course,
              learningObjectives: course.learningObjectives.filter((objective) => objective.id !== learningObjectiveId),
              contentDrafts: course.contentDrafts.map((draft) => ({
                ...draft,
                objectives: draft.objectives.filter((objectiveTitle) =>
                  course.learningObjectives.find(
                    (objective) => objective.id === learningObjectiveId && objective.title === objectiveTitle,
                  )
                    ? false
                    : true,
                ),
              })),
              updatedAt: nowIso(),
            }
          : course,
      ),
      cohorts: current.cohorts.map((cohort) => ({
        ...cohort,
        courseSelections: cohort.courseSelections.map((selection) =>
          selection.courseId === courseId
            ? {
                ...selection,
                learningObjectiveIds: selection.learningObjectiveIds.filter((id) => id !== learningObjectiveId),
              }
            : selection,
        ),
      })),
    })),

  saveCourseContentDraft: (
    courseId: string,
    file: CourseSourceFile,
    contentDrafts: CourseContentDraft[],
  ) =>
    updateState((current) => ({
      ...current,
      courses: current.courses.map((course) =>
        course.id === courseId
          ? {
              ...course,
              sourceFiles: [file, ...course.sourceFiles.filter((sourceFile) => sourceFile.id !== file.id)],
              contentDrafts,
              updatedAt: nowIso(),
            }
          : course,
      ),
    })).courses,

  generateContentDraftsFromSource: (course: TeacherCourse, fileName: string) =>
    generateCourseContentDrafts(course.title, fileName, course.learningObjectives),

  saveCohort: (cohort: Partial<TeacherCohort> & Pick<TeacherCohort, 'title'>) => {
    const timestamp = nowIso();
    const normalized: TeacherCohort = {
      id: cohort.id || makeId('cohort'),
      title: cohort.title,
      term: cohort.term?.trim() || '',
      description: cohort.description?.trim() || '',
      studentIds: cohort.studentIds || [],
      courseIds: cohort.courseIds || [],
      courseSelections: cohort.courseSelections || [],
      createdAt: cohort.createdAt || timestamp,
      updatedAt: timestamp,
    };

    return updateState((current) => ({
      ...current,
      cohorts: uniqueById([normalized, ...current.cohorts.filter((existing) => existing.id !== normalized.id)]).sort((left, right) =>
        left.title.localeCompare(right.title),
      ),
    })).cohorts;
  },

  removeCohort: (cohortId: string) =>
    updateState((current) => ({
      ...current,
      cohorts: current.cohorts.filter((cohort) => cohort.id !== cohortId),
    })),
};
