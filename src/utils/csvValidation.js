// src/utils/csvValidation.js
// Client-side validation for the CSV Student Import preview table.
// Mirrors validation/students.validation.js on the backend -- the
// backend re-validates everything itself before inserting, this copy
// only exists to give the user instant feedback without a round trip.

export const REQUIRED_COLUMNS = [
  "Roll Number",
  "Student Name",
  "Course",
  "Semester",
  "Section",
  "Gender",
];

export const VALID_GENDERS = ["Male", "Female", "Other"];

export const STATUS = {
  VALID: "VALID",
  DUPLICATE_IN_FILE: "DUPLICATE_IN_FILE",
  DUPLICATE_IN_DB: "DUPLICATE_IN_DB",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_SEMESTER: "INVALID_SEMESTER",
  INVALID_GENDER: "INVALID_GENDER",
};

export const STATUS_LABEL = {
  [STATUS.VALID]: "✔ Valid",
  [STATUS.DUPLICATE_IN_FILE]: "❌ Duplicate",
  [STATUS.DUPLICATE_IN_DB]: "❌ Duplicate",
  [STATUS.MISSING_FIELD]: "❌ Missing Field",
  [STATUS.INVALID_SEMESTER]: "❌ Invalid Semester",
  [STATUS.INVALID_GENDER]: "❌ Invalid Gender",
};

export function hasRequiredColumns(fields) {
  if (!Array.isArray(fields)) return false;
  return REQUIRED_COLUMNS.every((col) => fields.includes(col));
}

export function isBlankRow(row) {
  return Object.values(row).every((v) => String(v ?? "").trim() === "");
}

function validateRowFields(row) {
  const rollNo = String(row["Roll Number"] ?? "").trim();
  const name = String(row["Student Name"] ?? "").trim();
  const course = String(row["Course"] ?? "").trim();
  const semesterRaw = String(row["Semester"] ?? "").trim();
  const section = String(row["Section"] ?? "").trim();
  const gender = String(row["Gender"] ?? "").trim();

  if (!rollNo || !name || !course || !semesterRaw || !section || !gender) {
    return { status: STATUS.MISSING_FIELD, reason: "One or more required fields are empty." };
  }
  if (!/^\d+$/.test(semesterRaw) || Number(semesterRaw) < 1 || Number(semesterRaw) > 12) {
    return { status: STATUS.INVALID_SEMESTER, reason: "Semester must be a whole number between 1 and 12." };
  }
  if (!VALID_GENDERS.includes(gender)) {
    return { status: STATUS.INVALID_GENDER, reason: "Gender must be Male, Female, or Other." };
  }
  return { status: STATUS.VALID, reason: null };
}

/**
 * Validates parsed CSV rows: field rules + duplicate-within-file.
 * DB-duplicate detection is applied afterwards (async, see
 * useStudentImport) since it needs a server round trip.
 */
export function validateRowsLocally(rows) {
  const seen = new Set();
  const out = [];

  for (const raw of rows) {
    if (isBlankRow(raw)) continue;

    const rollNo = String(raw["Roll Number"] ?? "").trim();
    const { status: fieldStatus, reason: fieldReason } = validateRowFields(raw);

    let status = fieldStatus;
    let reason = fieldReason;

    if (status === STATUS.VALID) {
      if (seen.has(rollNo)) {
        status = STATUS.DUPLICATE_IN_FILE;
        reason = "Duplicate Roll Number within this CSV file.";
      } else {
        seen.add(rollNo);
      }
    }

    out.push({
      roll_no: rollNo,
      name: String(raw["Student Name"] ?? "").trim(),
      course: String(raw["Course"] ?? "").trim(),
      semester: String(raw["Semester"] ?? "").trim(),
      section: String(raw["Section"] ?? "").trim(),
      gender: String(raw["Gender"] ?? "").trim(),
      status,
      reason,
    });
  }

  return out;
}

export const SAMPLE_CSV = [
  "Roll Number,Student Name,Course,Semester,Section,Gender",
  "CSE24001,Rahul Sharma,B.Tech CSE,4,A,Male",
  "CSE24002,Priya Singh,B.Tech CSE,4,A,Female",
  "CSE24003,Aman Verma,B.Tech CSE,4,B,Male",
].join("\n");
