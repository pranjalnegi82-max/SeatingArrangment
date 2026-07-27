// validation/students.validation.js
// Row-level validation rules for the CSV Student Import feature.
// Mirrors the rules enforced client-side in
// src/utils/csvValidation.js -- the backend re-validates everything
// itself and never trusts client-side validation alone.

const REQUIRED_COLUMNS = [
  'Roll Number',
  'Student Name',
  'Course',
  'Semester',
  'Section',
  'Gender'
];

const VALID_GENDERS = ['Male', 'Female', 'Other'];

const STATUS = {
  VALID: 'VALID',
  DUPLICATE_IN_FILE: 'DUPLICATE_IN_FILE',
  DUPLICATE_IN_DB: 'DUPLICATE_IN_DB',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_SEMESTER: 'INVALID_SEMESTER',
  INVALID_GENDER: 'INVALID_GENDER'
};

/** True if every required column name is present in the parsed CSV header. */
function hasRequiredColumns(fields) {
  if (!Array.isArray(fields)) return false;
  return REQUIRED_COLUMNS.every((col) => fields.includes(col));
}

/** True if a row is entirely blank (PapaParse can emit these for trailing newlines). */
function isBlankRow(row) {
  return Object.values(row).every((v) => String(v ?? '').trim() === '');
}

/**
 * Validates a single raw CSV row (field-level checks only -- does not
 * know about duplicates, which require the full row set / DB access).
 * Returns { status, reason } where status is 'VALID' or one of the
 * STATUS error codes above.
 */
function validateRowFields(row) {
  const rollNo = String(row['Roll Number'] ?? '').trim();
  const name = String(row['Student Name'] ?? '').trim();
  const course = String(row['Course'] ?? '').trim();
  const semesterRaw = String(row['Semester'] ?? '').trim();
  const section = String(row['Section'] ?? '').trim();
  const gender = String(row['Gender'] ?? '').trim();

  if (!rollNo || !name || !course || !semesterRaw || !section || !gender) {
    return { status: STATUS.MISSING_FIELD, reason: 'One or more required fields are empty.' };
  }

  if (!/^\d+$/.test(semesterRaw) || Number(semesterRaw) < 1 || Number(semesterRaw) > 12) {
    return { status: STATUS.INVALID_SEMESTER, reason: 'Semester must be a whole number between 1 and 12.' };
  }

  if (!VALID_GENDERS.includes(gender)) {
    return { status: STATUS.INVALID_GENDER, reason: 'Gender must be Male, Female, or Other.' };
  }

  return { status: STATUS.VALID, reason: null };
}

module.exports = {
  REQUIRED_COLUMNS,
  VALID_GENDERS,
  STATUS,
  hasRequiredColumns,
  isBlankRow,
  validateRowFields
};
