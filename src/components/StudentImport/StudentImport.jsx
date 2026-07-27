import { useRef, useState } from "react";
import useStudentImport, { downloadTextFile } from "../../hooks/useStudentImport";
import useStudentDirectory from "../../hooks/useStudentDirectory";
import useToasts from "../../hooks/useToasts";
import Toast from "../Toast";
import Spinner from "../Spinner";
import ProgressBar from "./ProgressBar";
import { STATUS, STATUS_LABEL, SAMPLE_CSV } from "../../utils/csvValidation";
import { API_BASE } from "../../utils/api";
import "./StudentImport.css";

export default function StudentImport({ onImportComplete }) {
  const toast = useToasts();
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);

  const {
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
  } = useStudentImport({ onToast: toast });

  const directory = useStudentDirectory({ onToast: toast });

  const handleFilePicked = (e) => {
    loadFile(e.target.files?.[0]);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    loadFile(e.dataTransfer.files?.[0]);
  };

  const handleImportClick = async () => {
    await runImport();
    directory.fetchHistory();
    if (directory.students.length > 0) directory.fetchStudents();
  };

  const handleUseForSeating = () => {
    if (!onImportComplete) return;
    const mapped = validRows.map((r) => ({
      roll_no: r.roll_no,
      name: r.name,
      branch: r.course,
    }));
    onImportComplete(mapped);
    toast.success(`Added ${mapped.length} imported student(s) to today's seating form.`);
  };

  const downloadSampleLocally = () => downloadTextFile(SAMPLE_CSV, "sample_students.csv");

  return (
    <div className="section student-import">
      <Toast toasts={toast.toasts} onDismiss={toast.dismiss} />

      <div className="section-head">
        <h2>Import Students via CSV</h2>
        <span className="count-chip">{rows.length ? `${rows.length} parsed` : "no file"}</span>
      </div>

      {/* ---------- Dropzone + actions ---------- */}
      <div
        className={`dropzone${dragActive ? " dropzone-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          hidden
          onChange={handleFilePicked}
        />
        <p className="dropzone-title">
          {file ? file.name : "Drag & drop a CSV here, or click to browse"}
        </p>
        <p className="dropzone-hint">
          Columns required: Roll Number, Student Name, Course, Semester, Section, Gender
        </p>
      </div>

      <div className="import-actions">
        <button className="add-btn" onClick={() => fileInputRef.current?.click()}>
          Upload CSV
        </button>
        <a
          className="add-btn link-btn"
          href={`${API_BASE}/api/students/sample-csv`}
          onClick={(e) => {
            // Fall back to a client-side download if the backend isn't reachable
            e.preventDefault();
            downloadSampleLocally();
          }}
        >
          Download Sample CSV
        </a>
        {file && (
          <button className="add-btn danger-btn" onClick={reset} disabled={importing}>
            Cancel
          </button>
        )}
      </div>

      {(parsing || checkingDuplicates) && (
        <p className="empty-hint">
          <Spinner label={parsing ? "Parsing CSV..." : "Checking existing roll numbers..."} />
        </p>
      )}

      {columnError && <p className="import-error-banner">{columnError}</p>}

      {/* ---------- Preview table ---------- */}
      {rows.length > 0 && !result && (
        <>
          <div className="import-summary-row">
            <span className="summary-pill valid">{validRows.length} valid</span>
            <span className="summary-pill invalid">{invalidRows.length} flagged</span>
          </div>

          <div className="table-wrap preview-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Roll Number</th>
                  <th>Student Name</th>
                  <th>Course</th>
                  <th>Semester</th>
                  <th>Section</th>
                  <th>Gender</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.roll_no}-${i}`} className={r.status !== STATUS.VALID ? "row-invalid" : ""}>
                    <td>{r.roll_no}</td>
                    <td>{r.name}</td>
                    <td>{r.course}</td>
                    <td>{r.semester}</td>
                    <td>{r.section}</td>
                    <td>{r.gender}</td>
                    <td>{STATUS_LABEL[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="import-actions">
            <button
              className="generate import-btn"
              onClick={handleImportClick}
              disabled={importing || validRows.length === 0}
            >
              {importing ? "Importing..." : `Import ${validRows.length} Student(s)`}
            </button>
            <button className="add-btn danger-btn" onClick={reset} disabled={importing}>
              Cancel
            </button>
          </div>

          {importing && <ProgressBar percent={progress} />}
        </>
      )}

      {/* ---------- Success summary ---------- */}
      {result && (
        <div className="import-result">
          <h3>Import Completed</h3>
          <div className="result-stats">
            <div className="result-stat">
              <span className="result-number">{result.totalRows}</span>
              <span className="result-label">Total Records</span>
            </div>
            <div className="result-stat good">
              <span className="result-number">{result.importedRows}</span>
              <span className="result-label">Imported</span>
            </div>
            <div className="result-stat warn">
              <span className="result-number">{result.duplicateRows}</span>
              <span className="result-label">Duplicates</span>
            </div>
            <div className="result-stat bad">
              <span className="result-number">{result.failedRows}</span>
              <span className="result-label">Failed</span>
            </div>
          </div>

          <div className="import-actions">
            {onImportComplete && validRows.length > 0 && (
              <button className="add-btn" onClick={handleUseForSeating}>
                Use Imported Students for Seating
              </button>
            )}
            {invalidRows.length > 0 && (
              <button className="add-btn" onClick={downloadErrorsCsv}>
                Download Error Report
              </button>
            )}
            <button className="add-btn" onClick={reset}>
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* ---------- Import history ---------- */}
      <div className="subsection">
        <button className="toggle-link" onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? "Hide" : "Show"} Import History
        </button>

        {showHistory && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Total</th>
                  <th>Imported</th>
                  <th>Duplicates</th>
                  <th>Failed</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {directory.history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-hint">No imports yet.</td>
                  </tr>
                ) : (
                  directory.history.map((h) => (
                    <tr key={h.id}>
                      <td>{h.filename}</td>
                      <td>{h.total_rows}</td>
                      <td>{h.imported_rows}</td>
                      <td>{h.duplicate_rows}</td>
                      <td>{h.failed_rows}</td>
                      <td>{new Date(h.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Student directory: search + export ---------- */}
      <div className="subsection">
        <button
          className="toggle-link"
          onClick={() => {
            const next = !showDirectory;
            setShowDirectory(next);
            if (next) directory.fetchStudents();
          }}
        >
          {showDirectory ? "Hide" : "Show"} Imported Students
        </button>

        {showDirectory && (
          <>
            <div className="import-actions">
              <input
                className="search-input"
                placeholder="Search by roll no, name, course, section..."
                value={directory.search}
                onChange={(e) => directory.setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && directory.fetchStudents()}
              />
              <button className="add-btn" onClick={() => directory.fetchStudents()}>
                Search
              </button>
              <button className="add-btn" onClick={directory.exportCsv}>
                Export Students to CSV
              </button>
            </div>

            {directory.loading ? (
              <Spinner label="Loading students..." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Roll No</th>
                      <th>Name</th>
                      <th>Course</th>
                      <th>Sem</th>
                      <th>Section</th>
                      <th>Gender</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directory.students.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-hint">No students found.</td>
                      </tr>
                    ) : (
                      directory.students.map((s) => (
                        <tr key={s.roll_no}>
                          <td>{s.roll_no}</td>
                          <td>{s.name}</td>
                          <td>{s.course}</td>
                          <td>{s.semester}</td>
                          <td>{s.section}</td>
                          <td>{s.gender}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {directory.total > directory.students.length && (
              <p className="empty-hint">Showing {directory.students.length} of {directory.total}. Refine your search to narrow results.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
