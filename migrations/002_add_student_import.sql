-- Migration 002: CSV Student Import support
-- ------------------------------------------------------------
-- The original schema defined roll_no as INT and students with
-- only (roll_no, name, branch). The CSV import feature requires
-- alphanumeric roll numbers (e.g. "CSE24001") plus course,
-- semester, section and gender. This migration widens the
-- existing `students` table in place -- no new students table
-- is created, per the "use existing Students table" requirement.
--
-- Run this once against the exam_seating database:
--   mysql -u root -p exam_seating < migrations/002_add_student_import.sql
-- ------------------------------------------------------------

USE exam_seating;

-- 1. seat_assignments.roll_no must change type in lockstep with
--    students.roll_no (it's an FK), so drop the FK first.
ALTER TABLE seat_assignments DROP FOREIGN KEY seat_assignments_ibfk_1;

-- 2. Widen roll_no on both tables to alphanumeric roll numbers.
ALTER TABLE students
  MODIFY COLUMN roll_no VARCHAR(20) NOT NULL;

ALTER TABLE seat_assignments
  MODIFY COLUMN roll_no VARCHAR(20) NOT NULL;

-- 3. Re-add the foreign key with the new column type.
ALTER TABLE seat_assignments
  ADD CONSTRAINT seat_assignments_ibfk_1
  FOREIGN KEY (roll_no) REFERENCES students(roll_no) ON DELETE CASCADE;

-- 4. Add the new CSV columns. Existing rows get sensible defaults
--    so old data keeps working with the seating-allocation feature.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS course     VARCHAR(50)  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS semester   TINYINT      NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS section    VARCHAR(10)  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gender     ENUM('Male', 'Female', 'Other') NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 5. Import history log (new supporting table -- this is import
--    metadata, not student data, so it doesn't conflict with the
--    "don't create a new students table" requirement).
CREATE TABLE IF NOT EXISTS import_history (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  filename        VARCHAR(255) NOT NULL,
  total_rows      INT NOT NULL DEFAULT 0,
  imported_rows   INT NOT NULL DEFAULT 0,
  duplicate_rows  INT NOT NULL DEFAULT 0,
  failed_rows     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
