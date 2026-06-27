import { apiClient } from './apiClient';
import { iamService } from './iamService';
import type { PaginatedApiResponse } from '@/types/TestsServiceTypes';
import type {
  CohortStudyPlanJob,
  CourseContentDraft,
  TeacherCohort,
  TeacherCourse,
  TeacherLearningObjective,
  TeacherStudent,
} from '@/types/AcademyStudioTypes';

const METADATA_STORAGE_KEY = 'msai_teacher_academy_backend_metadata_v2';
const LEGACY_METADATA_STORAGE_KEY = 'msai_teacher_academy_backend_metadata_v1';
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
  contentDrafts?: CourseContentDraft[];
}

interface CohortMetadata {
  term?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
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
  accountId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiIamUser {
  id: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  accountId?: string;
  accounts?: string[];
  role?: string;
  created?: string;
}

interface ApiItemTotals {
  total?: number;
  byType?: {
    mcq?: number;
    saq?: number;
    flashcard?: number;
    lecture?: number;
  } | null;
}

interface ApiLearningObjective {
  id: string;
  title: string;
  identifier?: string;
  source?: string;
  syndrome?: {
    topic?: {
      organSystem?: ApiReferenceEntity | null;
    } | null;
  } | null;
  cognitiveSkill?: ApiReferenceEntity | null;
  itemTotals?: ApiItemTotals | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiCourse {
  id: string;
  identifier?: string;
  title: string;
  summary?: string | null;
  teacherId?: string;
  tenantId?: string | null;
  curriculumId?: string | null;
  locked?: boolean;
  learningObjectivesTotal?: number;
  learningObjectivesWithoutItemsTotal?: number;
  pendingLearningObjectiveSuggestionsTotal?: number;
  teacher?: {
    id: string;
    name?: string;
  } | null;
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
  startDate?: string | null;
  endDate?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
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

interface AcademyStudioCatalogSnapshot {
  courses: TeacherCourse[];
  cohorts: TeacherCohort[];
}

interface PaginatedStudentsSnapshot {
  students: TeacherStudent[];
  total: number;
  page: number;
}

interface StudentRegistrySnapshot {
  students: TeacherStudent[];
  cohorts: TeacherCohort[];
  warnings: string[];
}

interface StudentRegistryPageSnapshot {
  students: TeacherStudent[];
  total: number;
  page: number;
  cohorts: TeacherCohort[];
  warnings: string[];
}

const emptyMetadata = (): AcademyBackendMetadata => ({
  learnerProfiles: {},
  courseMetadata: {},
  cohortMetadata: {},
});

const nowIso = () => new Date().toISOString();

const safeWindow = () =>
  typeof window === 'undefined' ? null : window;

const normalizeStoredCourseMetadata = (
  value: unknown,
): Record<string, CourseMetadata> => {
  if (!value || typeof value !== 'object') return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([courseId, raw]) => {
      const metadata =
        raw && typeof raw === 'object' ? (raw as Partial<CourseMetadata>) : {};

      return [
        courseId,
        {
          ...(Array.isArray(metadata.contentDrafts)
            ? { contentDrafts: metadata.contentDrafts }
            : {}),
        },
      ] as const;
    }),
  );
};

const parseMetadata = (raw: string): AcademyBackendMetadata | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<AcademyBackendMetadata>;
    return {
      learnerProfiles:
        parsed.learnerProfiles && typeof parsed.learnerProfiles === 'object'
          ? parsed.learnerProfiles
          : {},
      courseMetadata: normalizeStoredCourseMetadata(parsed.courseMetadata),
      cohortMetadata:
        parsed.cohortMetadata && typeof parsed.cohortMetadata === 'object'
          ? parsed.cohortMetadata
          : {},
    };
  } catch (error) {
    console.error('Failed to parse academy backend metadata:', error);
    return null;
  }
};

const readMetadata = (): AcademyBackendMetadata => {
  const browserWindow = safeWindow();
  if (!browserWindow) return emptyMetadata();

  const raw = browserWindow.localStorage.getItem(METADATA_STORAGE_KEY);
  if (raw) {
    return parseMetadata(raw) || emptyMetadata();
  }

  const legacyRaw = browserWindow.localStorage.getItem(LEGACY_METADATA_STORAGE_KEY);
  if (!legacyRaw) return emptyMetadata();

  const migrated = parseMetadata(legacyRaw) || emptyMetadata();
  writeMetadata(migrated);
  try {
    browserWindow.localStorage.removeItem(LEGACY_METADATA_STORAGE_KEY);
  } catch {
    // Ignore migration cleanup failures; the v2 key is the source of truth.
  }
  return migrated;
};

const writeMetadata = (metadata: AcademyBackendMetadata) => {
  const browserWindow = safeWindow();
  if (!browserWindow) return;
  try {
    browserWindow.localStorage.setItem(
      METADATA_STORAGE_KEY,
      JSON.stringify(metadata),
    );
  } catch (error) {
    console.error('Failed to persist academy backend metadata:', error);
  }
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

const normalizeDateValue = (value: string | null | undefined) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.includes('T') ? trimmed.slice(0, 10) : trimmed;
};

const toRfc3339DateTime = (value: string | null | undefined) => {
  const normalizedDate = normalizeDateValue(value);
  if (!normalizedDate) return undefined;

  return `${normalizedDate}T00:00:00Z`;
};

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

const normalizeItemTotals = (
  totals: ApiItemTotals | null | undefined,
): TeacherLearningObjective['itemTotals'] => {
  if (!totals) return undefined;
  const byType = totals.byType || {};
  return {
    total: totals.total ?? 0,
    byType: {
      mcq: byType.mcq ?? 0,
      saq: byType.saq ?? 0,
      flashcard: byType.flashcard ?? 0,
      lecture: byType.lecture ?? 0,
    },
  };
};

const normalizeLearningObjective = (
  learningObjective: ApiLearningObjective,
): TeacherLearningObjective => ({
  id: learningObjective.id,
  title: learningObjective.title,
  organSystem:
    learningObjective.syndrome?.topic?.organSystem?.title || undefined,
  cognitiveSkill: learningObjective.cognitiveSkill?.title || undefined,
  source: learningObjective.source === 'ai' ? 'ai' : 'manual',
  createdAt: learningObjective.createdAt || nowIso(),
  itemTotals: normalizeItemTotals(learningObjective.itemTotals),
});

const normalizeCourse = (
  course: ApiCourse,
  metadata: AcademyBackendMetadata,
): TeacherCourse => {
  const courseMetadata = metadata.courseMetadata[course.id] || {};
  const learningObjectives = (course.learningObjectives || []).map(
    normalizeLearningObjective,
  );

  return {
    id: course.id,
    backendIdentifier: course.identifier,
    title: course.title || 'Untitled Course',
    summary: course.summary?.trim() || '',
    teacherId: course.teacherId || course.teacher?.id,
    tenantId: course.tenantId ?? null,
    curriculumId: course.curriculumId ?? null,
    locked: Boolean(course.locked),
    learningObjectivesTotal:
      typeof course.learningObjectivesTotal === 'number'
        ? course.learningObjectivesTotal
        : learningObjectives.length,
    learningObjectivesWithoutItemsTotal:
      typeof course.learningObjectivesWithoutItemsTotal === 'number'
        ? course.learningObjectivesWithoutItemsTotal
        : learningObjectives.filter(
            (learningObjective) => (learningObjective.itemTotals?.total ?? 0) === 0,
          ).length,
    pendingLearningObjectiveSuggestionsTotal:
      course.pendingLearningObjectiveSuggestionsTotal || 0,
    learningObjectivesLoaded: Array.isArray(course.learningObjectives),
    learningObjectives,
    contentDrafts: courseMetadata.contentDrafts || [],
    createdAt: course.createdAt || nowIso(),
    updatedAt: course.updatedAt || nowIso(),
  };
};

const applyLoadedCourseLearningObjectives = (
  course: TeacherCourse,
  learningObjectives: ApiLearningObjective[],
): TeacherCourse => {
  const normalizedLearningObjectives = learningObjectives.map(
    normalizeLearningObjective,
  );

  return {
    ...course,
    learningObjectives: normalizedLearningObjectives,
    learningObjectivesLoaded: true,
    learningObjectivesTotal: normalizedLearningObjectives.length,
    learningObjectivesWithoutItemsTotal: normalizedLearningObjectives.filter(
      (learningObjective) => (learningObjective.itemTotals?.total ?? 0) === 0,
    ).length,
  };
};

const normalizeStudent = (
  studentId: string,
  profile: LearnerProfile,
): TeacherStudent => {
  const name = profile.name?.trim() || 'Unnamed user';

  return {
    id: studentId,
    accountId: profile.accountId?.trim() || undefined,
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

const getLearnerProfileForId = (
  metadata: AcademyBackendMetadata,
  learnerId: string,
): LearnerProfile => {
  if (metadata.learnerProfiles[learnerId]) {
    return metadata.learnerProfiles[learnerId];
  }

  const matchingKey = Object.keys(metadata.learnerProfiles).find(
    (profileId) => getIdSuffix(profileId) === getIdSuffix(learnerId),
  );

  return matchingKey ? metadata.learnerProfiles[matchingKey] || {} : {};
};

const buildDisplayName = (user: ApiIamUser) => {
  const parts = [user.givenName, user.familyName]
    .map((value) => value?.trim())
    .filter(Boolean);

  if (parts.length > 0) {
    return parts.join(' ');
  }

  return user.email?.trim() || 'Unnamed user';
};

const getPrimaryAccountId = (user: Pick<ApiIamUser, 'accountId' | 'accounts'>) =>
  user.accountId?.trim() || user.accounts?.[0]?.trim() || undefined;

const buildLearnerIdBySuffix = <T extends { id: string }>(
  users: T[],
) => new Map(users.map((user) => [getIdSuffix(user.id), user.id] as const));

const buildPreferredLearnerIdBySuffix = (...groups: string[][]) => {
  const learnerIdBySuffix = new Map<string, string>();

  groups.forEach((group) => {
    group.forEach((learnerId) => {
      const suffix = getIdSuffix(learnerId);
      if (!suffix || learnerIdBySuffix.has(suffix)) return;
      learnerIdBySuffix.set(suffix, learnerId);
    });
  });

  return learnerIdBySuffix;
};

const findCanonicalLearnerId = (
  learnerId: string,
  learnerIdBySuffix: ReadonlyMap<string, string>,
) => learnerIdBySuffix.get(getIdSuffix(learnerId)) || learnerId;

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
    startDate: normalizeDateValue(
      cohort.startDate || cohort.startsAt || cohortMetadata.startDate,
    ),
    endDate: normalizeDateValue(
      cohort.endDate || cohort.endsAt || cohortMetadata.endDate,
    ),
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
        name: learner.name || existingProfile.name || 'Unnamed user',
        accountId: learner.accountId || existingProfile.accountId,
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
      accountId: getPrimaryAccountId(user) || existingProfile.accountId,
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

const getCourseIdentifier = (course: Pick<ApiCourse, 'id' | 'identifier'>) =>
  course.identifier || getIdSuffix(course.id);

const fetchCourseLearningObjectives = (course: Pick<ApiCourse, 'id' | 'identifier'>) =>
  fetchAllPages<ApiLearningObjective>(
    `/courses/${getCourseIdentifier(course)}/learning-objectives`,
  );

const fetchAllIamUsers = async (): Promise<ApiIamUser[]> => {
  const items: ApiIamUser[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (items.length < total) {
    const response = await iamService.listUsers({
      page,
      limit: DEFAULT_PAGE_LIMIT,
    });

    items.push(...(response.items as ApiIamUser[]));
    total = response.total || response.items.length;

    if (response.items.length < DEFAULT_PAGE_LIMIT) {
      break;
    }

    page += 1;
  }

  return items;
};

const loadCatalogSnapshot = async (): Promise<AcademyStudioCatalogSnapshot> => {
  const [coursesResponse, cohortsResponse] = await Promise.all([
    fetchAllPages<ApiCourse>('/courses'),
    fetchAllPages<ApiCohort>('/cohorts'),
  ]);

  const syncedMetadata = syncLearnerProfilesFromCohorts(
    readMetadata(),
    cohortsResponse,
  );
  const cohortLearners = cohortsResponse.flatMap(
    (cohort) => cohort.learners || [],
  );
  const learnerIdBySuffix = buildLearnerIdBySuffix(cohortLearners);

  return {
    courses: sortByTitle(
      coursesResponse.map((course) => normalizeCourse(course, syncedMetadata)),
    ),
    cohorts: sortByTitle(
      cohortsResponse.map((cohort) =>
        normalizeCohort(cohort, syncedMetadata, learnerIdBySuffix),
      ),
    ),
  };
};

const findCourseIdentifier = (course: Pick<TeacherCourse, 'id' | 'backendIdentifier'>) =>
  course.backendIdentifier || course.id.split('/').pop() || course.id;

const findCohortIdentifier = (cohort: Pick<TeacherCohort, 'id' | 'backendIdentifier'>) =>
  cohort.backendIdentifier || cohort.id.split('/').pop() || cohort.id;

const normalizeCourseWriteResult = (
  response: ApiCourse,
  learningObjectives?: TeacherLearningObjective[],
): TeacherCourse => {
  const normalizedCourse = normalizeCourse(response, readMetadata());

  if (!learningObjectives) {
    return normalizedCourse;
  }

  return {
    ...normalizedCourse,
    learningObjectives,
    learningObjectivesLoaded: true,
    learningObjectivesTotal:
      typeof response.learningObjectivesTotal === 'number'
        ? response.learningObjectivesTotal
        : learningObjectives.length,
    learningObjectivesWithoutItemsTotal:
      typeof response.learningObjectivesWithoutItemsTotal === 'number'
        ? response.learningObjectivesWithoutItemsTotal
        : learningObjectives.filter(
            (learningObjective) => (learningObjective.itemTotals?.total ?? 0) === 0,
          ).length,
  };
};

const normalizeCohortWriteResult = (
  response: ApiCohort,
  preferredLearnerIds: string[] = [],
) =>
  normalizeCohort(
    response,
    readMetadata(),
    buildPreferredLearnerIdBySuffix(
      preferredLearnerIds,
      (response.learners || []).map((learner) => learner.id),
    ),
  );

const buildLearnerAttachPayload = (learnerIds: string[]) => {
  const metadata = readMetadata();
  const uniqueLearnerIds = Array.from(
    new Map(
      learnerIds.map((learnerId) => [getIdSuffix(learnerId), learnerId] as const),
    ).values(),
  );

  const learners = uniqueLearnerIds.map((learnerId) => {
    const profile = getLearnerProfileForId(metadata, learnerId);

    return {
      userId: learnerId,
      ...(profile.name?.trim() ? { name: profile.name.trim() } : {}),
      ...(profile.accountId?.trim()
        ? { accountId: profile.accountId.trim() }
        : {}),
    };
  });

  return {
    learnerIds: uniqueLearnerIds,
    ...(learners.length > 0 ? { learners } : {}),
  };
};

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
  const [coursesResponse, cohortsResponse, iamUsers] = await Promise.all([
    fetchAllPages<ApiCourse>('/courses'),
    fetchAllPages<ApiCohort>('/cohorts'),
    fetchAllIamUsers(),
  ]);
  const learnerIdBySuffix = buildLearnerIdBySuffix(
    iamUsers,
  );

  const iamSyncedMetadata = syncLearnerProfilesFromIamUsers(
    readMetadata(),
    iamUsers,
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

  iamUsers.forEach((user) => {
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

const loadPagedStudents = async ({
  page,
  limit,
  search,
}: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<PaginatedStudentsSnapshot> => {
  const response = await iamService.listUsers({
    page,
    limit,
    search,
  });
  const metadata = syncLearnerProfilesFromIamUsers(
    readMetadata(),
    response.items as ApiIamUser[],
  );

  return {
    students: response.items.map((user) =>
      normalizeStudent(user.id, metadata.learnerProfiles[user.id] || {}),
    ),
    total: response.total || 0,
    page: response.page || page || 1,
  };
};

const loadStudentRegistryPage = async ({
  page,
  limit,
  search,
}: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<StudentRegistryPageSnapshot> => {
  const [studentsResult, cohortsResult] = await Promise.allSettled([
    loadPagedStudents({
      page,
      limit,
      search,
    }),
    fetchAllPages<ApiCohort>('/cohorts'),
  ]);

  if (studentsResult.status !== 'fulfilled') {
    throw studentsResult.reason;
  }

  const pagedStudents = studentsResult.value;
  const warnings: string[] = [];
  let cohortsResponse: ApiCohort[] = [];
  let metadata = readMetadata();

  if (cohortsResult.status === 'fulfilled') {
    cohortsResponse = cohortsResult.value;
    metadata = syncLearnerProfilesFromCohorts(metadata, cohortsResponse);
  } else {
    console.error(
      'Failed to load cohorts for paged student registry:',
      cohortsResult.reason,
    );
    warnings.push(
      toErrorMessage(
        cohortsResult.reason,
        'Unable to load cohorts. Learners are shown without cohort assignments.',
      ),
    );
  }

  const learnerIdBySuffix = buildLearnerIdBySuffix(pagedStudents.students);
  const cohorts = sortByTitle(
    cohortsResponse.map((cohort) =>
      normalizeCohort(cohort, metadata, learnerIdBySuffix),
    ),
  );

  return {
    students: pagedStudents.students,
    total: pagedStudents.total,
    page: pagedStudents.page,
    cohorts,
    warnings,
  };
};

const toErrorMessage = (
  error: unknown,
  fallback: string,
) => (error instanceof Error ? error.message : fallback);

const loadStudentRegistrySnapshot = async (): Promise<StudentRegistrySnapshot> => {
  const [cohortsResult, usersResult] = await Promise.allSettled([
    fetchAllPages<ApiCohort>('/cohorts'),
    fetchAllIamUsers(),
  ]);

  if (usersResult.status !== 'fulfilled') {
    throw usersResult.reason;
  }

  const iamUsers = usersResult.value;
  const warnings: string[] = [];
  let metadata = syncLearnerProfilesFromIamUsers(readMetadata(), iamUsers);
  let cohortsResponse: ApiCohort[] = [];

  if (cohortsResult.status === 'fulfilled') {
    cohortsResponse = cohortsResult.value;
    metadata = syncLearnerProfilesFromCohorts(metadata, cohortsResponse);
  } else {
    console.error('Failed to load cohorts for registry:', cohortsResult.reason);
    warnings.push(
      toErrorMessage(
        cohortsResult.reason,
        'Unable to load cohorts. Users are shown without cohort assignments.',
      ),
    );
  }

  const learnerIdBySuffix = buildLearnerIdBySuffix(iamUsers);
  const cohorts = sortByTitle(
    cohortsResponse.map((cohort) =>
      normalizeCohort(cohort, metadata, learnerIdBySuffix),
    ),
  );

  const studentsById = new Map<string, TeacherStudent>();

  iamUsers.forEach((user) => {
    const profile = metadata.learnerProfiles[user.id] || {};
    studentsById.set(user.id, normalizeStudent(user.id, profile));
  });

  cohortsResponse.forEach((cohort) => {
    (cohort.learners || []).forEach((learner) => {
      const studentId = findCanonicalLearnerId(learner.id, learnerIdBySuffix);

      if (!studentsById.has(studentId)) {
        const profile =
          metadata.learnerProfiles[studentId] ||
          metadata.learnerProfiles[learner.id] ||
          {};
        studentsById.set(studentId, normalizeStudent(studentId, profile));
      }
    });
  });

  return {
    students: sortByName(Array.from(studentsById.values())),
    cohorts,
    warnings,
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
        | 'teacherId'
        | 'curriculumId'
        | 'locked'
        | 'summary'
        | 'learningObjectives'
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
        ...(course.summary !== undefined
          ? { summary: course.summary.trim() }
          : {}),
        ...(course.teacherId ? { teacherId: course.teacherId } : {}),
        ...(course.curriculumId ? { curriculumId: course.curriculumId } : {}),
        ...(course.locked !== undefined ? { locked: course.locked } : {}),
      },
      ...(course.teacherId ? { teacherId: course.teacherId } : {}),
    },
  );

  if (course.contentDrafts !== undefined) {
    saveCourseMetadata(response.id, {
      contentDrafts: course.contentDrafts,
    });
  }

  return normalizeCourseWriteResult(response, course.learningObjectives);
};

const upsertCohort = async (
  cohort: Pick<TeacherCohort, 'title'> &
    Partial<
      Pick<
        TeacherCohort,
        | 'id'
        | 'backendIdentifier'
        | 'term'
        | 'description'
        | 'startDate'
        | 'endDate'
        | 'studentIds'
      >
    >,
) => {
  const startsAt = toRfc3339DateTime(cohort.startDate);
  const endsAt = toRfc3339DateTime(cohort.endDate);
  const response = await apiClient.post<ApiCohort>(
    'TESTS',
    '/cohorts',
    {
      cohort: {
        ...(cohort.id ? { id: cohort.id } : {}),
        title: cohort.title.trim(),
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
      },
    },
  );

  saveCohortMetadata(response.id, {
    term: cohort.term || '',
    description: cohort.description || '',
    startDate: normalizeDateValue(cohort.startDate),
    endDate: normalizeDateValue(cohort.endDate),
  });

  return normalizeCohortWriteResult(response, cohort.studentIds || []);
};

const syncCourseLearningObjectives = async (
  course: TeacherCourse,
  learningObjectives: TeacherLearningObjective[],
) => {
  const desiredLearningObjectives = Array.from(
    new Map(
      learningObjectives.map((learningObjective) => [
        learningObjective.id,
        learningObjective,
      ] as const),
    ).values(),
  );
  const currentLearningObjectiveIds = new Set(
    course.learningObjectives.map((learningObjective) => learningObjective.id),
  );
  const desiredLearningObjectiveIds = new Set(
    desiredLearningObjectives.map((learningObjective) => learningObjective.id),
  );
  const learningObjectiveIdsToAdd = desiredLearningObjectives
    .filter((learningObjective) => !currentLearningObjectiveIds.has(learningObjective.id))
    .map((learningObjective) => learningObjective.id);
  const learningObjectiveIdsToRemove = course.learningObjectives
    .filter((learningObjective) => !desiredLearningObjectiveIds.has(learningObjective.id))
    .map((learningObjective) => learningObjective.id);

  let latestResponse: ApiCourse | null = null;

  if (learningObjectiveIdsToAdd.length > 0) {
    latestResponse = await apiClient.post<ApiCourse>(
      'TESTS',
      `/courses/${findCourseIdentifier(course)}/learning-objectives`,
      {
        learningObjectiveIds: learningObjectiveIdsToAdd,
      },
    );
  }

  for (const learningObjectiveId of learningObjectiveIdsToRemove) {
    latestResponse = await apiClient.delete<ApiCourse>(
      'TESTS',
      `/courses/${findCourseIdentifier(course)}/learning-objectives/${encodeURIComponent(
        getIdSuffix(learningObjectiveId),
      )}`,
    );
  }

  if (latestResponse) {
    return normalizeCourseWriteResult(latestResponse, desiredLearningObjectives);
  }

  return {
    ...course,
    learningObjectives: desiredLearningObjectives,
    learningObjectivesLoaded: true,
    learningObjectivesTotal: desiredLearningObjectives.length,
    learningObjectivesWithoutItemsTotal: desiredLearningObjectives.filter(
      (learningObjective) => (learningObjective.itemTotals?.total ?? 0) === 0,
    ).length,
  };
};

const attachCohortLearners = async (
  cohort: TeacherCohort,
  learnerIds: string[],
) => {
  if (learnerIds.length === 0) {
    return cohort;
  }

  const response = await apiClient.post<ApiCohort>(
    'TESTS',
    `/cohorts/${findCohortIdentifier(cohort)}/learners`,
    buildLearnerAttachPayload(learnerIds),
  );

  return normalizeCohortWriteResult(response, [...cohort.studentIds, ...learnerIds]);
};

const removeCohortLearner = async (
  cohort: TeacherCohort,
  learnerId: string,
) => {
  const response = await apiClient.delete<ApiCohort>(
    'TESTS',
    `/cohorts/${findCohortIdentifier(cohort)}/learners/${encodeURIComponent(
      getIdSuffix(learnerId),
    )}`,
  );

  return normalizeCohortWriteResult(
    response,
    cohort.studentIds.filter((studentId) => getIdSuffix(studentId) !== getIdSuffix(learnerId)),
  );
};

const attachCohortCourses = async (
  cohort: TeacherCohort,
  courseIds: string[],
) => {
  if (courseIds.length === 0) {
    return cohort;
  }

  const response = await apiClient.post<ApiCohort>(
    'TESTS',
    `/cohorts/${findCohortIdentifier(cohort)}/courses`,
    {
      courseIds,
    },
  );

  return normalizeCohortWriteResult(response, cohort.studentIds);
};

const removeCohortCourse = async (
  cohort: TeacherCohort,
  courseId: string,
) => {
  const response = await apiClient.delete<ApiCohort>(
    'TESTS',
    `/cohorts/${findCohortIdentifier(cohort)}/courses/${encodeURIComponent(
      getIdSuffix(courseId),
    )}`,
  );

  return normalizeCohortWriteResult(response, cohort.studentIds);
};

const appendCohortCourseLearningObjectives = async (
  cohort: TeacherCohort,
  courseId: string,
  learningObjectiveIds: string[],
) => {
  if (learningObjectiveIds.length === 0) {
    return cohort;
  }

  const response = await apiClient.post<ApiCohort>(
    'TESTS',
    `/cohorts/${findCohortIdentifier(cohort)}/courses/${encodeURIComponent(
      getIdSuffix(courseId),
    )}/learning-objectives`,
    {
      learningObjectiveIds,
    },
  );

  return normalizeCohortWriteResult(response, cohort.studentIds);
};

const removeCohortCourseLearningObjective = async (
  cohort: TeacherCohort,
  courseId: string,
  learningObjectiveId: string,
) => {
  const response = await apiClient.delete<ApiCohort>(
    'TESTS',
    `/cohorts/${findCohortIdentifier(cohort)}/courses/${encodeURIComponent(
      getIdSuffix(courseId),
    )}/learning-objectives/${encodeURIComponent(getIdSuffix(learningObjectiveId))}`,
  );

  return normalizeCohortWriteResult(response, cohort.studentIds);
};

const clearCohortCourseLearningObjectives = async (
  cohort: TeacherCohort,
  courseId: string,
) => {
  const response = await apiClient.delete<ApiCohort>(
    'TESTS',
    `/cohorts/${findCohortIdentifier(cohort)}/courses/${encodeURIComponent(
      getIdSuffix(courseId),
    )}/learning-objectives`,
  );

  return normalizeCohortWriteResult(response, cohort.studentIds);
};

export const academyStudioBackend = {
  loadCatalogSnapshot,
  loadSnapshot,
  loadPagedStudents,
  loadStudentRegistryPage,
  loadStudentRegistrySnapshot,

  loadCourseWithLearningObjectives: async (
    course: TeacherCourse,
  ): Promise<TeacherCourse> =>
    applyLoadedCourseLearningObjectives(
      course,
      await fetchCourseLearningObjectives({
        id: course.id,
        identifier: course.backendIdentifier,
      }),
    ),

  saveCourse: upsertCourse,

  deleteCourse: async (course: Pick<TeacherCourse, 'id' | 'backendIdentifier'>) => {
    await apiClient.delete<void>(
      'TESTS',
      `/courses/${findCourseIdentifier(course)}`,
    );
    removeCourseMetadata(course.id);
  },

  saveCourseLearningObjectives: syncCourseLearningObjectives,

  attachCourseLearningObjectives: async (
    course: TeacherCourse,
    learningObjectives: TeacherLearningObjective[],
  ) =>
    syncCourseLearningObjectives(course, [
      ...course.learningObjectives,
      ...learningObjectives,
    ]),

  removeCourseLearningObjective: async (
    course: TeacherCourse,
    learningObjectiveId: string,
  ) =>
    syncCourseLearningObjectives(
      course,
      course.learningObjectives.filter(
        (learningObjective) => learningObjective.id !== learningObjectiveId,
      ),
    ),

  saveCohort: upsertCohort,

  attachCohortLearners,
  removeCohortLearner,
  attachCohortCourses,
  removeCohortCourse,
  appendCohortCourseLearningObjectives,
  removeCohortCourseLearningObjective,
  clearCohortCourseLearningObjectives,

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
