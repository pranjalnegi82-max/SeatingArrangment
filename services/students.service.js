// services/students.service.js
// Business logic for the CSV Student Import feature. Controllers stay
// thin; all parsing / validation / DB work happens here.
const Papa = require('papaparse');
const db = require('../db');
const {
  hasRequiredColumns,
  isBlankRow,
  validateRowFields,
  STATUS
} = require('../validation/students.validation');

const INSERT_BATCH_SIZE = 500; // chunk size for bulk INSERT statements

/** Parses a CSV buffer into { fields, rows }. Throws on malformed CSV. */
function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf-8');
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim()
  });

  if (parsed.errors && parsed.errors.length > 0) {
    const fatal = parsed.errors.find((e) => e.type !== 'FieldMismatch');
    if (fatal) {
      throw new Error(`CSV parse error: ${fatal.message} (row ${fatal.row})`);
    }
  }

  return { fields: parsed.meta.fields || [], rows: parsed.data };
}

/**
 * Runs field-level + intra-file duplicate validation over parsed rows.
 * Does NOT check the database (that's a separate, async step) so this
 * can be reused for the fast client-facing preview endpoint too.
 */
function validateRowsLocally(rows) {
  const seenInFile = new Set();
  const validated = [];

  for (const raw of rows) {
    if (isBlankRow(raw)) continue;

    const rollNo = String(raw['Roll Number'] ?? '').trim();
    const fieldCheck = validateRowFields(raw);

    let status = fieldCheck.status;
    let reason = fieldCheck.reason;

    if (status === STATUS.VALID) {
      if (seenInFile.has(rollNo)) {
        status = STATUS.DUPLICATE_IN_FILE;
        reason = 'Duplicate Roll Number within this CSV file.';
      } else {
        seenInFile.add(rollNo);
      }
    }

    validated.push({
      roll_no: rollNo,
      name: String(raw['Student Name'] ?? '').trim(),
      course: String(raw['Course'] ?? '').trim(),
      semester: Number(String(raw['Semester'] ?? '').trim()) || null,
      section: String(raw['Section'] ?? '').trim(),
      gender: String(raw['Gender'] ?? '').trim(),
      status,
      reason
    });
  }

  return validated;
}

/** Cross-checks roll numbers against the students table. Returns a Set of existing roll numbers. */
async function findExistingRollNumbers(rollNumbers) {
  if (rollNumbers.length === 0) return new Set();

  const [rows] = await db.promise.query(
    'SELECT roll_no FROM students WHERE roll_no IN (?)',
    [rollNumbers]
  );
  return new Set(rows.map((r) => r.roll_no));
}

/**
 * Full server-side validation pass: field rules + in-file duplicates
 * + existing-in-database duplicates. Used both by the lightweight
 * preview endpoint and as the authoritative check before import.
 */
async function validateRows(rows) {
  const locallyValidated = validateRowsLocally(rows);

  const candidateRollNos = locallyValidated
    .filter((r) => r.status === STATUS.VALID)
    .map((r) => r.roll_no);

  const existing = await findExistingRollNumbers(candidateRollNos);

  return locallyValidated.map((r) => {
    if (r.status === STATUS.VALID && existing.has(r.roll_no)) {
      return { ...r, status: STATUS.DUPLICATE_IN_DB, reason: 'Roll Number already exists in the database.' };
    }
    return r;
  });
}

/** Splits an array into chunks of `size`. */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Bulk-inserts only VALID rows inside a single transaction. Rolls back
 * everything if any batch fails, so a partial CSV never gets partially
 * committed.
 */
async function bulkInsertStudents(validRows) {
  if (validRows.length === 0) return 0;

  const connection = await db.promise.getConnection();
  let insertedCount = 0;

  try {
    await connection.beginTransaction();

    for (const batch of chunk(validRows, INSERT_BATCH_SIZE)) {
      const values = batch.map((r) => [r.roll_no, r.name, r.course, r.course, r.semester, r.section, r.gender]);
      // branch column mirrors `course` so existing seating-allocation
      // logic (which groups by `branch`) keeps working for imported
      // students without any change to that feature.
      const [result] = await connection.query(
        'INSERT INTO students (roll_no, name, branch, course, semester, section, gender) VALUES ?',
        [values]
      );
      insertedCount += result.affectedRows;
    }

    await connection.commit();
    return insertedCount;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function recordImportHistory({ filename, totalRows, importedRows, duplicateRows, failedRows }) {
  await db.promise.query(
    `INSERT INTO import_history (filename, total_rows, imported_rows, duplicate_rows, failed_rows)
     VALUES (?, ?, ?, ?, ?)`,
    [filename, totalRows, importedRows, duplicateRows, failedRows]
  );
}

async function getImportHistory() {
  const [rows] = await db.promise.query(
    'SELECT id, filename, total_rows, imported_rows, duplicate_rows, failed_rows, created_at FROM import_history ORDER BY created_at DESC LIMIT 50'
  );
  return rows;
}

async function searchStudents({ search = '', page = 1, limit = 25 }) {
  const offset = (Math.max(1, Number(page) || 1) - 1) * Math.max(1, Number(limit) || 25);
  const like = `%${search}%`;

  const [rows] = await db.promise.query(
    `SELECT roll_no, name, branch, course, semester, section, gender, created_at
     FROM students
     WHERE roll_no LIKE ? OR name LIKE ? OR course LIKE ? OR section LIKE ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [like, like, like, like, Math.max(1, Number(limit) || 25), offset]
  );

  const [[{ total }]] = await db.promise.query(
    `SELECT COUNT(*) AS total FROM students
     WHERE roll_no LIKE ? OR name LIKE ? OR course LIKE ? OR section LIKE ?`,
    [like, like, like, like]
  );

  return { rows, total };
}

async function exportStudentsCsv() {
  const [rows] = await db.promise.query(
    'SELECT roll_no, name, course, semester, section, gender FROM students ORDER BY roll_no'
  );

  return Papa.unparse({
    fields: ['Roll Number', 'Student Name', 'Course', 'Semester', 'Section', 'Gender'],
    data: rows.map((r) => [r.roll_no, r.name, r.course, r.semester, r.section, r.gender || ''])
  });
}

module.exports = {
  parseCsvBuffer,
  validateRows,
  validateRowsLocally,
  findExistingRollNumbers,
  bulkInsertStudents,
  recordImportHistory,
  getImportHistory,
  searchStudents,
  exportStudentsCsv
};
