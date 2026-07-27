-- Exam Seating Arrangement System - Database Schema
-- DSA Project: Exam Seating Arrangement System using 2D Arrays

CREATE DATABASE IF NOT EXISTS exam_seating;
USE exam_seating;

-- Students table
-- roll_no is VARCHAR to support alphanumeric roll numbers (e.g. "CSE24001")
-- coming from the CSV import feature. course/semester/section/gender are
-- populated by CSV import; branch remains for the manual seating form.
CREATE TABLE IF NOT EXISTS students (
  roll_no     VARCHAR(20) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  branch      VARCHAR(20)  NOT NULL DEFAULT '',
  course      VARCHAR(50)  NOT NULL DEFAULT '',
  semester    TINYINT      NOT NULL DEFAULT 1,
  section     VARCHAR(10)  NOT NULL DEFAULT '',
  gender      ENUM('Male', 'Female', 'Other') NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  room_id     INT AUTO_INCREMENT PRIMARY KEY,
  room_no     INT NOT NULL,
  rows_count  INT NOT NULL CHECK (rows_count BETWEEN 1 AND 20),
  cols_count  INT NOT NULL CHECK (cols_count BETWEEN 1 AND 20)
);

-- Seat assignments (student-wise lookup: roll_no -> room, row, col)
CREATE TABLE IF NOT EXISTS seat_assignments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  roll_no     VARCHAR(20) NOT NULL,
  room_id     INT NOT NULL,
  row_no      INT NOT NULL,
  col_no      INT NOT NULL,
  FOREIGN KEY (roll_no) REFERENCES students(roll_no) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  UNIQUE KEY unique_seat (room_id, row_no, col_no)
);

-- Import history log for the CSV Student Import feature
CREATE TABLE IF NOT EXISTS import_history (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  filename        VARCHAR(255) NOT NULL,
  total_rows      INT NOT NULL DEFAULT 0,
  imported_rows   INT NOT NULL DEFAULT 0,
  duplicate_rows  INT NOT NULL DEFAULT 0,
  failed_rows     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  degree VARCHAR(20) NOT NULL DEFAULT 'B.Tech'
);

INSERT INTO courses (code, name) VALUES
  ('CSE', 'Computer Science & Engineering'),
  ('ECE', 'Electronics & Communication Engineering'),
  ('ME', 'Mechanical Engineering'),
  ('CE', 'Civil Engineering'),
  ('AI', 'Artificial Intelligence'),
  ('DS', 'Data Science');

ALTER TABLE students
  ADD COLUMN course_id INT,
  ADD CONSTRAINT fk_students_course FOREIGN KEY (course_id) REFERENCES courses(id);
