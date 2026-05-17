export type CoursePreferenceInput = {
  key: string;
  subject: string;
  qualification: string;
};

export type SubjectPreferenceOption = {
  id: string;
  label: string;
  description: string;
  courseKeys: string[];
};

const SCIENCE_SUBJECTS = new Set(["Biology", "Chemistry", "Physics"]);
const COMBINED_SCIENCE_QUALIFICATION = "GCSE Combined Science Trilogy";
const PREFERENCE_IDS_KEY = "fts_subject_preferences";
const PREFERENCE_COMPLETED_KEY = "fts_subject_preferences_completed";

function optionIdForSubject(subject: string) {
  return `subject:${subject}`;
}

export function buildSubjectPreferenceOptions(courses: CoursePreferenceInput[]) {
  const options: SubjectPreferenceOption[] = [];
  const combinedScienceKeys = courses
    .filter((course) => SCIENCE_SUBJECTS.has(course.subject) && course.qualification === COMBINED_SCIENCE_QUALIFICATION)
    .map((course) => course.key);
  const tripleScienceCourses = courses.filter(
    (course) => SCIENCE_SUBJECTS.has(course.subject) && course.qualification !== COMBINED_SCIENCE_QUALIFICATION,
  );
  const nonScienceCoursesBySubject = new Map<string, CoursePreferenceInput[]>();

  if (combinedScienceKeys.length > 0) {
    options.push({
      id: "science:combined",
      label: "Combined science",
      description: "Biology, Chemistry and Physics trilogy papers",
      courseKeys: combinedScienceKeys,
    });
  }

  if (tripleScienceCourses.length > 0) {
    options.push({
      id: "science:triple",
      label: "Triple award science",
      description: tripleScienceCourses.map((course) => course.subject).join(", "),
      courseKeys: tripleScienceCourses.map((course) => course.key),
    });
  }

  for (const course of courses) {
    if (SCIENCE_SUBJECTS.has(course.subject)) {
      continue;
    }

    const existing = nonScienceCoursesBySubject.get(course.subject) ?? [];
    existing.push(course);
    nonScienceCoursesBySubject.set(course.subject, existing);
  }

  for (const [subject, subjectCourses] of [...nonScienceCoursesBySubject.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const qualifications = [...new Set(subjectCourses.map((course) => course.qualification.replace(/^GCSE\s+/, "")))];

    options.push({
      id: optionIdForSubject(subject),
      label: subject,
      description: qualifications.join(", "),
      courseKeys: subjectCourses.map((course) => course.key),
    });
  }

  return options;
}

export function subjectPreferencesCompleted(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.[PREFERENCE_COMPLETED_KEY] === true;
}

export function selectedSubjectPreferenceIds(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.[PREFERENCE_IDS_KEY];

  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export function selectedCourseKeysFromPreferenceIds(
  preferenceIds: string[],
  options: SubjectPreferenceOption[],
) {
  const selectedIds = new Set(preferenceIds);

  return new Set(
    options
      .filter((option) => selectedIds.has(option.id))
      .flatMap((option) => option.courseKeys),
  );
}

export function subjectPreferenceMetadata(preferenceIds: string[]) {
  return {
    [PREFERENCE_IDS_KEY]: preferenceIds,
    [PREFERENCE_COMPLETED_KEY]: true,
  };
}
