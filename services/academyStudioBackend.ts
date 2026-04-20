import { apiClient } from './apiClient';
import { iamService } from './iamService';
import type { PaginatedApiResponse } from '@/types/TestsServiceTypes';
import type {
  CohortStudyPlanJob,
  CourseContentDraft,
  CourseSourceFile,
  TeacherCohort,
  TeacherCourse,
  TeacherLearningObjective,
  TeacherStudent,
} from '@/types/AcademyStudioTypes';

const METADATA_STORAGE_KEY = 'msai_teacher_academy_backend_metadata_v1';
const DEFAULT_PAGE_LIMIT = 200;

interface LearnerProfile {
  name?: string;
  email?: string;
  accountId?: string;
  learnerCode?: string;
  program?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CourseMetadata {
  code?: string;
  summary?: string;
  sourceFiles?: CourseSourceFile[];
  contentDrafts?: CourseContentDraft[];
}

interface CohortMetadata {
  term?: string;
  description?: string;
}

interface AcademyBackendMetadata {
  learnerProfiles: Record<string, LearnerProfile>;
  courseMetadata: Record<string, CourseMetadata>;
  cohortMetadata: Record<string, CohortMetadata>;
}

interface ApiReferenceEntity {
  id: string;
  title?: string;
}

interface ApiUser {
  id: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiIamUser {
  id: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  accounts?: string[];
  role?: string;
  created?: string;
}

interface ApiLearningObjective {
  id: string;
  title: string;
  identifier?: string;
  source?: string;
  organSystem?: ApiReferenceEntity | null;
  cognitiveSkill?: ApiReferenceEntity | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiCourse {
  id: string;
  identifier?: string;
  title: string;
  learningObjectives?: ApiLearningObjective[];
  createdAt?: string;
  updatedAt?: string;
}

interface ApiCohortCourseSelection {
  courseId: string;
  learningObjectives?: ApiLearningObjective[];
}

interface ApiCohort {
  id: string;
  identifier?: string;
  title: string;
  learners?: ApiUser[];
  courses?: ApiCourse[];
  courseSelections?: ApiCohortCourseSelection[];
  createdAt?: string;
  updatedAt?: string;
}

interface AcademyStudioSnapshot {
  students: TeacherStudent[];
  courses: TeacherCourse[];
  cohorts: TeacherCohort[];
}

const emptyMetadata = (): AcademyBackendMetadata => ({
  learnerProfiles: {},
  courseMetadata: {},
  cohortMetadata: {},
});

const nowIso = () => new Date().toISOString();

const safeWindow = () =>
  typeof window === 'undefined' ? null : window;

const readMetadata = (): AcademyBackendMetadata => {
  const browserWindow = safeWindow();
  if (!browserWindow) return emptyMetadata();

  const raw = browserWindow.localStorage.getItem(METADATA_STORAGE_KEY);
  if (!raw) return emptyMetadata();

  try {
    const parsed = JSON.parse(raw) as Partial<AcademyBackendMetadata>;
    return {
      learnerProfiles:
        parsed.learnerProfiles && typeof parsed.learnerProfiles === 'object'
          ? parsed.learnerProfiles
          : {},
      courseMetadata:
        parsed.courseMetadata && typeof parsed.courseMetadata === 'object'
          ? parsed.courseMetadata
          : {},
      cohortMetadata:
        parsed.cohortMetadata && typeof parsed.cohortMetadata === 'object'
          ? parsed.cohortMetadata
          : {},
    };
  } catch (error) {
    console.error('Failed to parse academy backend metadata:', error);
    return emptyMetadata();
  }
};

const writeMetadata = (metadata: AcademyBackendMetadata) => {
  const browserWindow = safeWindow();
  if (!browserWindow) return;
  browserWindow.localStorage.setItem(
    METADATA_STORAGE_KEY,
    JSON.stringify(metadata),
  );
};

const updateMetadata = (
  updater: (current: AcademyBackendMetadata) => AcademyBackendMetadata,
) => {
  const next = updater(readMetadata());
  writeMetadata(next);
  return next;
};

const sortByTitle = <T extends { title: string }>(items: T[]) =>
  [...items].sort((left, right) => left.title.localeCompare(right.title));

const sortByName = <T extends { name: string }>(items: T[]) =>
  [...items].sort((left, right) => left.name.localeCompare(right.name));

const getIdSuffix = (value: string) => value.split('/').pop() || value;

const buildLearnerCode = (name: string, id: string) => {
  const normalizedName = name
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 6)
    .toUpperCase();
  const normalizedId = id
    .replace(/[^a-z0-9]/gi, '')
    .slice(-6)
    .toUpperCase();

  return normalizedName || normalizedId || 'LEARNR';
};

const normalizeLearningObjective = (
  learningObjective: ApiLearningObjective,
): TeacherLearningObjective => ({
  id: learningObjective.id,
  title: learningObjective.title,
  organSystem: learningObjective.organSystem?.title || undefined,
  cognitiveSkill: learningObjective.cognitiveSkill?.title || undefined,
  source: learningObjective.source === 'ai' ? 'ai' : 'manual',
  createdAt: learningObjective.createdAt || nowIso(),
});

const normalizeCourse = (
  course: ApiCourse,
  metadata: AcademyBackendMetadata,
): TeacherCourse => {
  const courseMetadata = metadata.courseMetadata[course.id] || {};

  return {
    id: course.id,
    backendIdentifier: course.identifier,
    title: course.title || 'Untitled Course',
    code: courseMetadata.code || course.identifier || '',
    summary: courseMetadata.summary || '',
    learningObjectives: (course.learningObjectives || []).map(
      normalizeLearningObjective,
    ),
    sourceFiles: courseMetadata.sourceFiles || [],
    contentDrafts: courseMetadata.contentDrafts || [],
    createdAt: course.createdAt || nowIso(),
    updatedAt: course.updatedAt || nowIso(),
  };
};

const normalizeStudent = (
  studentId: string,
  profile: LearnerProfile,
): TeacherStudent => {
  const name = profile.name?.trim() || 'Unnamed learner';

  return {
    id: studentId,
    name,
    email: profile.email?.trim() || '',
    learnerCode:
      profile.learnerCode?.trim() || buildLearnerCode(name, studentId),
    program: profile.program?.trim() || '',
    notes: profile.notes?.trim() || '',
    source: 'backend',
    createdAt: profile.createdAt || nowIso(),
  };
};

const buildDisplayName = (user: ApiIamUser) => {
  const parts = [user.givenName, user.familyName]
    .map((value) => value?.trim())
    .filter(Boolean);

  if (parts.length > 0) {
    return parts.join(' ');
  }

  return user.email?.trim() || 'Unnamed learner';
};

const buildLearnerIdBySuffix = (
  users: ApiIamUser[],
) => new Map(users.map((user) => [getIdSuffix(user.id), user.id] as const));

const findCanonicalLearnerId = (
  learnerId: string,
  learnerIdBySuffix: ReadonlyMap<string, string>,
) => learnerIdBySuffix.get(getIdSuffix(learnerId)) || learnerId;

const findLearnerProfile = (
  metadata: AcademyBackendMetadata,
  learnerId: string,
) => {
  const directProfile = metadata.learnerProfiles[learnerId];
  if (directProfile) {
    return directProfile;
  }

  const learnerIdSuffix = getIdSuffix(learnerId);
  const matchedProfileId = Object.keys(metadata.learnerProfiles).find(
    (profileId) => getIdSuffix(profileId) === learnerIdSuffix,
  );

  return matchedProfileId
    ? metadata.learnerProfiles[matchedProfileId]
    : undefined;
};

const buildLearnerRequestPayload = (
  learnerIds: string[],
  metadata: AcademyBackendMetadata,
) =>
  learnerIds.map((learnerId) => {
    const profile = findLearnerProfile(metadata, learnerId);

    return {
      userId: learnerId,
      accountId:
        profile?.accountId ||
        `/accounts/${getIdSuffix(learnerId)}`,
    };
  });

const normalizeCohort = (
  cohort: ApiCohort,
  metadata: AcademyBackendMetadata,
  learnerIdBySuffix: ReadonlyMap<string, string> = new Map(),
): TeacherCohort => {
  const cohortMetadata = metadata.cohortMetadata[cohort.id] || {};

  return {
    id: cohort.id,
    backendIdentifier: cohort.identifier,
    title: cohort.title || 'Untitled Cohort',
    term: cohortMetadata.term || '',
    description: cohortMetadata.description || '',
    studentIds: (cohort.learners || []).map((learner) =>
      findCanonicalLearnerId(learner.id, learnerIdBySuffix),
    ),
    courseIds: (cohort.courses || []).map((course) => course.id),
    courseSelections: (cohort.courseSelections || []).map((selection) => ({
      courseId: selection.courseId,
      learningObjectiveIds: (selection.learningObjectives || []).map(
        (learningObjective) => learningObjective.id,
      ),
    })),
    createdAt: cohort.createdAt || nowIso(),
    updatedAt: cohort.updatedAt || nowIso(),
  };
};

const syncLearnerProfilesFromCohorts = (
  metadata: AcademyBackendMetadata,
  cohorts: ApiCohort[],
) => {
  let changed = false;
  const nextProfiles = { ...metadata.learnerProfiles };
  const profileKeyBySuffix = new Map(
    Object.keys(nextProfiles).map((profileId) => [
      getIdSuffix(profileId),
      profileId,
    ] as const),
  );

  cohorts.forEach((cohort) => {
    (cohort.learners || []).forEach((learner) => {
      const learnerProfileKey =
        profileKeyBySuffix.get(getIdSuffix(learner.id)) || learner.id;
      const existingProfile = nextProfiles[learnerProfileKey] || {};
      const nextProfile: LearnerProfile = {
        ...existingProfile,
        name: learner.name || existingProfile.name || 'Unnamed learner',
        createdAt: existingProfile.createdAt || learner.createdAt || nowIso(),
        updatedAt: learner.updatedAt || existingProfile.updatedAt || nowIso(),
      };

      if (JSON.stringify(existingProfile) !== JSON.stringify(nextProfile)) {
        nextProfiles[learnerProfileKey] = nextProfile;
        profileKeyBySuffix.set(getIdSuffix(learner.id), learnerProfileKey);
        changed = true;
      }
    });
  });

  if (!changed) {
    return metadata;
  }

  const nextMetadata = {
    ...metadata,
    learnerProfiles: nextProfiles,
  };
  writeMetadata(nextMetadata);
  return nextMetadata;
};

const syncLearnerProfilesFromIamUsers = (
  metadata: AcademyBackendMetadata,
  users: ApiIamUser[],
) => {
  let changed = false;
  const nextProfiles = { ...metadata.learnerProfiles };

  users.forEach((user) => {
    const existingProfile = nextProfiles[user.id] || {};
    const nextProfile: LearnerProfile = {
      ...existingProfile,
      name: buildDisplayName(user),
      accountId: user.accounts?.[0]?.trim() || existingProfile.accountId,
      email: user.email?.trim() || existingProfile.email || '',
      createdAt: existingProfile.createdAt || user.created || nowIso(),
      updatedAt: user.created || existingProfile.updatedAt || nowIso(),
    };

    if (JSON.stringify(existingProfile) !== JSON.stringify(nextProfile)) {
      nextProfiles[user.id] = nextProfile;
      changed = true;
    }
  });

  if (!changed) {
    return metadata;
  }

  const nextMetadata = {
    ...metadata,
    learnerProfiles: nextProfiles,
  };
  writeMetadata(nextMetadata);
  return nextMetadata;
};

const fetchAllPages = async <T>(endpoint: string): Promise<T[]> => {
  const items: T[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (items.length < total) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await apiClient.get<PaginatedApiResponse<T>>(
      'TESTS',
      `${endpoint}${separator}page=${page}&limit=${DEFAULT_PAGE_LIMIT}`,
    );

    items.push(...response.items);
    total = response.total || response.items.length;

    if (response.items.length < DEFAULT_PAGE_LIMIT) {
      break;
    }

    page += 1;
  }

  return items;
};

const findCourseIdentifier = (course: Pick<TeacherCourse, 'id' | 'backendIdentifier'>) =>
  course.backendIdentifier || course.id.split('/').pop() || course.id;

const findCohortIdentifier = (cohort: Pick<TeacherCohort, 'id' | 'backendIdentifier'>) =>
  cohort.backendIdentifier || cohort.id.split('/').pop() || cohort.id;

const buildStudyPlanExamDate = (baseDate = new Date()) => {
  const examDate = new Date(
    Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth() + 3,
      baseDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  return examDate.toISOString().replace('.000Z', 'Z');
};

const loadSnapshot = async (): Promise<AcademyStudioSnapshot> => {
  const [coursesResponse, cohortsResponse, iamUsersResponse] = await Promise.all([
    fetchAllPages<ApiCourse>('/courses'),
    fetchAllPages<ApiCohort>('/cohorts'),
    iamService.listUsers('user'),
  ]);
  const learnerIdBySuffix = buildLearnerIdBySuffix(
    iamUsersResponse.items as ApiIamUser[],
  );

  const iamSyncedMetadata = syncLearnerProfilesFromIamUsers(
    readMetadata(),
    iamUsersResponse.items as ApiIamUser[],
  );
  const syncedMetadata = syncLearnerProfilesFromCohorts(
    iamSyncedMetadata,
    cohortsResponse,
  );

  const courses = sortByTitle(
    coursesResponse.map((course) => normalizeCourse(course, syncedMetadata)),
  );
  const cohorts = sortByTitle(
    cohortsResponse.map((cohort) =>
      normalizeCohort(cohort, syncedMetadata, learnerIdBySuffix),
    ),
  );

  const studentsById = new Map<string, TeacherStudent>();

  iamUsersResponse.items.forEach((user) => {
    const profile = syncedMetadata.learnerProfiles[user.id] || {};
    studentsById.set(user.id, normalizeStudent(user.id, profile));
  });

  cohortsResponse.forEach((cohort) => {
    (cohort.learners || []).forEach((learner) => {
      const studentId = findCanonicalLearnerId(learner.id, learnerIdBySuffix);

      if (!studentsById.has(studentId)) {
        const profile =
          syncedMetadata.learnerProfiles[studentId] ||
          syncedMetadata.learnerProfiles[learner.id] ||
          {};
        studentsById.set(studentId, normalizeStudent(studentId, profile));
      }
    });
  });

  return {
    students: sortByName(Array.from(studentsById.values())),
    courses,
    cohorts,
  };
};

const saveCourseMetadata = (
  courseId: string,
  nextMetadata: CourseMetadata,
) => {
  updateMetadata((current) => ({
    ...current,
    courseMetadata: {
      ...current.courseMetadata,
      [courseId]: {
        ...current.courseMetadata[courseId],
        ...nextMetadata,
      },
    },
  }));
};

const saveCohortMetadata = (
  cohortId: string,
  nextMetadata: CohortMetadata,
) => {
  updateMetadata((current) => ({
    ...current,
    cohortMetadata: {
      ...current.cohortMetadata,
      [cohortId]: {
        ...current.cohortMetadata[cohortId],
        ...nextMetadata,
      },
    },
  }));
};

const removeCourseMetadata = (courseId: string) => {
  updateMetadata((current) => {
    const courseMetadata = { ...current.courseMetadata };
    delete courseMetadata[courseId];

    return {
      ...current,
      courseMetadata,
    };
  });
};

const removeCohortMetadata = (cohortId: string) => {
  updateMetadata((current) => {
    const cohortMetadata = { ...current.cohortMetadata };
    delete cohortMetadata[cohortId];

    return {
      ...current,
      cohortMetadata,
    };
  });
};

const upsertCourse = async (
  course: Pick<TeacherCourse, 'title'> &
    Partial<
      Pick<
        TeacherCourse,
        | 'id'
        | 'backendIdentifier'
        | 'code'
        | 'summary'
        | 'learningObjectives'
        | 'sourceFiles'
        | 'contentDrafts'
      >
    >,
) => {
  const response = await apiClient.post<ApiCourse>(
    'TESTS',
    '/courses',
    {
      course: {
        ...(course.id ? { id: course.id } : {}),
        title: course.title.trim(),
      },
      ...(course.learningObjectives
        ? {
            learningObjectiveIds: course.learningObjectives.map(
              (learningObjective) => learningObjective.id,
            ),
          }
        : {}),
    },
  );

  saveCourseMetadata(response.id, {
    code: course.code || '',
    summary: course.summary || '',
    sourceFiles: course.sourceFiles || [],
    contentDrafts: course.contentDrafts || [],
  });

  return normalizeCourse(response, readMetadata());
};

const upsertCohort = async (
  cohort: Pick<TeacherCohort, 'title' | 'studentIds' | 'courseIds' | 'courseSelections'> &
    Partial<
      Pick<
        TeacherCohort,
        'id' | 'backendIdentifier' | 'term' | 'description'
      >
    >,
) => {
  const metadata = readMetadata();
  const response = await apiClient.post<ApiCohort>(
    'TESTS',
    '/cohorts',
    {
      cohort: {
        ...(cohort.id ? { id: cohort.id } : {}),
        title: cohort.title.trim(),
      },
      learners: buildLearnerRequestPayload(cohort.studentIds, metadata),
      courseIds: cohort.courseIds,
      courseSelections: cohort.courseSelections,
    },
  );

  saveCohortMetadata(response.id, {
    term: cohort.term || '',
    description: cohort.description || '',
  });

  const learnerIdBySuffix = new Map(
    cohort.studentIds.map((studentId) => [getIdSuffix(studentId), studentId] as const),
  );

  return normalizeCohort(response, readMetadata(), learnerIdBySuffix);
};

export const academyStudioBackend = {
  loadSnapshot,

  saveCourse: upsertCourse,

  deleteCourse: async (course: Pick<TeacherCourse, 'id' | 'backendIdentifier'>) => {
    await apiClient.delete<void>(
      'TESTS',
      `/courses/${findCourseIdentifier(course)}`,
    );
    removeCourseMetadata(course.id);
  },

  saveCourseLearningObjectives: async (
    course: Pick<
      TeacherCourse,
      | 'id'
      | 'backendIdentifier'
      | 'title'
      | 'code'
      | 'summary'
      | 'sourceFiles'
      | 'contentDrafts'
    >,
    learningObjectives: TeacherLearningObjective[],
  ) =>
    upsertCourse({
      ...course,
      learningObjectives,
    }),

  saveCourseContentDraftMetadata: (
    courseId: string,
    sourceFile: CourseSourceFile,
    contentDrafts: CourseContentDraft[],
  ) => {
    const currentMetadata = readMetadata().courseMetadata[courseId] || {};
    const existingSourceFiles = currentMetadata.sourceFiles || [];

    saveCourseMetadata(courseId, {
      sourceFiles: [
        sourceFile,
        ...existingSourceFiles.filter((existing) => existing.id !== sourceFile.id),
      ],
      contentDrafts,
    });
  },

  saveCohort: upsertCohort,

  publishCohortStudyPlanTemplate: async (
    cohort: Pick<TeacherCohort, 'id' | 'backendIdentifier'>,
  ) =>
    apiClient.post<void>(
      'TESTS',
      `/cohorts/${findCohortIdentifier(cohort)}/study-plan-template`,
      {
        studyPlanTemplate: {
          autoCreateStudyPlans: true,
          studyPlanTitleTemplate: '{{cohortTitle}} - {{courseTitle}}',
          studyPlanExamDate: buildStudyPlanExamDate(),
          studyPlanStudyDays: [1, 3, 5],
          studyPlanSessionLength: 40,
          studyPlanStatus: 'active',
        },
      },
    ),

  getLatestCohortStudyPlanJob: async (
    cohort: Pick<TeacherCohort, 'id' | 'backendIdentifier'>,
  ) => {
    const response = await apiClient.get<PaginatedApiResponse<CohortStudyPlanJob>>(
      'TESTS',
      `/cohorts/${findCohortIdentifier(cohort)}/study-plan-jobs?limit=1`,
    );

    return response.items[0] || null;
  },

  deleteCohort: async (cohort: Pick<TeacherCohort, 'id' | 'backendIdentifier'>) => {
    await apiClient.delete<void>(
      'TESTS',
      `/cohorts/${findCohortIdentifier(cohort)}`,
    );
    removeCohortMetadata(cohort.id);
  },
};
