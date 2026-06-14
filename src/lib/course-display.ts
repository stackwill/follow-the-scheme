const SCIENCE_SUBJECTS = ["Biology", "Chemistry", "Physics"];

export function courseDisplayParts(course: { subject: string; qualification: string }) {
  if (SCIENCE_SUBJECTS.includes(course.subject)) {
    return {
      name: course.subject,
      detail:
        course.qualification === "GCSE Combined Science Trilogy"
          ? "combined science"
          : "(triple award)",
    };
  }

  if (course.subject === "Computer Science") {
    return {
      name: "Computer Science",
      detail: null,
    };
  }

  if (course.subject === "Business") {
    return {
      name: "Business",
      detail: null,
    };
  }

  return {
    name: course.subject,
    detail: null,
  };
}

export function courseDisplayName(course: { subject: string; qualification: string }) {
  const parts = courseDisplayParts(course);

  return parts.detail ? `${parts.name} ${parts.detail}` : parts.name;
}
