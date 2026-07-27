import { useCallback, useState } from "react";
import Papa from "papaparse";
import {
  hasRequiredColumns,
  validateRowsLocally,
  STATUS,
} from "../utils/csvValidation";
import { apiPostJson, apiUploadFile } from "../utils/api";

const PARSE_WORKER_THRESHOLD_BYTES = 500 * 1024; // ~500KB: hand off to a worker so the UI doesn't freeze on large files

/**
 * Encapsulates the full CSV import lifecycle:
 *   pick file -> parse -> validate (local + DB duplicate check)
 *   -> preview -> import (upload, tracked progress) -> result
 */
export default function useStudentImport({ onToast } = {}) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]); // validated preview rows
  const [parsing, setParsing] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [columnError, setColumnError] = useState(null);

  const reset = useCallback(() => {
    setFile(null);
    setRows([]);
    setResult(null);
    setColumnError(null);
    setProgress(0);
  }, []);

  const loadFile = useCallback(
    (selectedFile) => {
      if (!selectedFile) return;

      if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
        onToast?.error("Only .csv files are supported.");
        return;
      }

      setFile(selectedFile);
      setResult(null);
      setColumnError(null);
      setParsing(true);

      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        worker: selectedFile.size > PARSE_WORKER_THRESHOLD_BYTES,
        transformHeader: (h) => h.trim(),
        complete: async (parsed) => {
          setParsing(false);

          if (!hasRequiredColumns(parsed.meta.fields)) {
            setColumnError(
              `CSV is missing required columns. Expected: Roll Number, Student Name, Course, Semester, Section, Gender.`
            );
            setRows([]);
            return;
          }

          if (parsed.data.length === 0) {
            onToast?.error("The CSV file is empty.");
            return;
          }

          const validated = validateRowsLocally(parsed.data);
          setRows(validated);
          onToast?.info(`Parsed ${validated.length} row(s). Checking for existing roll numbers...`);

          await checkDbDuplicates(validated);
        },
        error: (err) => {
          setParsing(false);
          onToast?.error(`Failed to parse CSV: ${err.message}`);
        },
      });
    },
    [onToast]
  );

  const checkDbDuplicates = useCallback(
    async (validatedRows) => {
      const candidates = validatedRows.filter((r) => r.status === STATUS.VALID).map((r) => r.roll_no);
      if (candidates.length === 0) return;

      setCheckingDuplicates(true);
      try {
        const { existing } = await apiPostJson("/api/students/check-duplicates", {
          rollNumbers: candidates,
        });
        const existingSet = new Set(existing || []);

        setRows((prev) =>
          prev.map((r) =>
            r.status === STATUS.VALID && existingSet.has(r.roll_no)
              ? { ...r, status: STATUS.DUPLICATE_IN_DB, reason: "Roll Number already exists in the database." }
              : r
          )
        );
      } catch (err) {
        // Non-fatal: the backend re-checks duplicates authoritatively
        // on actual import, so a failed pre-check just means the
        // preview won't flag DB duplicates in advance.
        onToast?.error(`Could not check existing roll numbers: ${err.message}`);
      } finally {
        setCheckingDuplicates(false);
      }
    },
    [onToast]
  );

  const validRows = rows.filter((r) => r.status === STATUS.VALID);
  const invalidRows = rows.filter((r) => r.status !== STATUS.VALID);

  const runImport = useCallback(async () => {
    if (!file) return;
    if (validRows.length === 0) {
      onToast?.error("No valid rows to import.");
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      const data = await apiUploadFile("/api/students/import", file, setProgress);
      setResult(data);
      onToast?.success(`Import complete: ${data.importedRows} of ${data.totalRows} rows imported.`);
    } catch (err) {
      onToast?.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }, [file, validRows.length, onToast]);

  const downloadErrorsCsv = useCallback(() => {
    if (invalidRows.length === 0) return;
    const csv = Papa.unparse({
      fields: ["Roll Number", "Student Name", "Course", "Semester", "Section", "Gender", "Reason"],
      data: invalidRows.map((r) => [r.roll_no, r.name, r.course, r.semester, r.section, r.gender, r.reason]),
    });
    downloadTextFile(csv, "import_errors.csv");
  }, [invalidRows]);

  return {
    file,
    rows,
    validRows,
    invalidRows,
    parsing,
    checkingDuplicates,
    importing,
    progress,
    result,
    columnError,
    loadFile,
    runImport,
    reset,
    downloadErrorsCsv,
  };
}

export function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
