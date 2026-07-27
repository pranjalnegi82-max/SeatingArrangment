// controllers/students.controller.js
// Thin request/response handlers -- all real logic lives in
// services/students.service.js.
const service = require('../services/students.service');
const { STATUS, hasRequiredColumns } = require('../validation/students.validation');
const { SAMPLE_CSV } = require('../utils/csvTemplate');

/** POST /api/students/check-duplicates
 *  Body: { rollNumbers: string[] }
 *  Lets the frontend mark ❌ Duplicate rows in the live preview
 *  table before the user commits to importing. */
async function checkDuplicates(req, res) {
  try {
    const rollNumbers = Array.isArray(req.body.rollNumbers) ? req.body.rollNumbers : [];
    const existing = await service.findExistingRollNumbers(rollNumbers);
    res.json({ existing: Array.from(existing) });
  } catch (err) {
    console.error('check-duplicates error:', err);
    res.status(500).json({ error: 'Failed to check duplicates.' });
  }
}

/** POST /api/students/import
 *  multipart/form-data, field name "file".
 *  Re-parses and re-validates the CSV server-side (never trusts the
 *  client), inserts only valid rows in a transaction, logs history. */
async function importStudents(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file was uploaded. Attach it under the "file" field.' });
    }

    let parsed;
    try {
      parsed = service.parseCsvBuffer(req.file.buffer);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    if (parsed.rows.length === 0) {
      return res.status(400).json({ error: 'The CSV file is empty.' });
    }

    if (!hasRequiredColumns(parsed.fields)) {
      return res.status(400).json({
        error: 'CSV is missing required columns.',
        expected: ['Roll Number', 'Student Name', 'Course', 'Semester', 'Section', 'Gender'],
        found: parsed.fields
      });
    }

    const validated = await service.validateRows(parsed.rows);

    const validRows = validated.filter((r) => r.status === STATUS.VALID);
    const duplicateRows = validated.filter(
      (r) => r.status === STATUS.DUPLICATE_IN_FILE || r.status === STATUS.DUPLICATE_IN_DB
    );
    const failedRows = validated.filter(
      (r) => r.status === STATUS.MISSING_FIELD || r.status === STATUS.INVALID_SEMESTER || r.status === STATUS.INVALID_GENDER
    );

    let importedRows = 0;
    try {
      importedRows = await service.bulkInsertStudents(validRows);
    } catch (err) {
      console.error('bulk insert failed, transaction rolled back:', err);
      return res.status(500).json({ error: 'Database error during import. No rows were saved.' });
    }

    await service.recordImportHistory({
      filename: req.file.originalname,
      totalRows: validated.length,
      importedRows,
      duplicateRows: duplicateRows.length,
      failedRows: failedRows.length
    });

    res.json({
      totalRows: validated.length,
      importedRows,
      duplicateRows: duplicateRows.length,
      failedRows: failedRows.length,
      errors: [...duplicateRows, ...failedRows].map((r) => ({
        roll_no: r.roll_no,
        reason: r.reason
      }))
    });
  } catch (err) {
    console.error('import error:', err);
    res.status(500).json({ error: 'Unexpected server error during import.' });
  }
}

/** GET /api/students/sample-csv */
function downloadSample(req, res) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sample_students.csv"');
  res.send(SAMPLE_CSV);
}

/** GET /api/students/export */
async function exportStudents(req, res) {
  try {
    const csv = await service.exportStudentsCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="students_export.csv"');
    res.send(csv);
  } catch (err) {
    console.error('export error:', err);
    res.status(500).json({ error: 'Failed to export students.' });
  }
}

/** GET /api/students?search=&page=&limit= */
async function listStudents(req, res) {
  try {
    const { search = '', page = 1, limit = 25 } = req.query;
    const { rows, total } = await service.searchStudents({ search, page, limit });
    res.json({ students: rows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('list students error:', err);
    res.status(500).json({ error: 'Failed to fetch students.' });
  }
}

/** GET /api/students/import-history */
async function importHistory(req, res) {
  try {
    const history = await service.getImportHistory();
    res.json({ history });
  } catch (err) {
    console.error('import history error:', err);
    res.status(500).json({ error: 'Failed to fetch import history.' });
  }
}

module.exports = {
  checkDuplicates,
  importStudents,
  downloadSample,
  exportStudents,
  listStudents,
  importHistory
};
