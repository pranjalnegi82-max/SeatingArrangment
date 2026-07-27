// server.js - Exam Seating Arrangement System
const express = require('express');
const db = require('./db');

const cors = require("cors");

const studentsRouter = require('./routes/students.routes');

const app = express();
app.use(express.json());
app.use(cors());

// CSV Student Import module (upload, preview validation, bulk
// import, history, search, export). See routes/students.routes.js.
app.use('/api/students', studentsRouter);

// Seating allocation function
// Groups students by branch/course so that every COLUMN is occupied by a
// single branch (e.g. Column 1 is all BTech, Column 2 is all BCA), AND
// makes sure two adjacent columns are never the same branch (so left/right
// neighbours in any given row are always from different courses). Rooms
// are filled in order; for each column we greedily pick whichever branch
// still has the most students remaining, as long as it isn't the branch
// used in the immediately previous column (a repeat is only allowed if
// it's the only branch left with students).
function allocateSeats(students, rooms) {
  const branches = {};
  students.forEach((s) => {
    if (!branches[s.branch]) branches[s.branch] = [];
    branches[s.branch].push(s);
  });
  // stable, alphabetical branch order just breaks ties deterministically
  const branchNames = Object.keys(branches).sort((a, b) => a.localeCompare(b));

  const roomState = rooms.map((r) => ({
    room_no: r.room_no,
    rows: r.rows,
    cols: r.cols,
    chart: Array.from({ length: r.rows }, () => new Array(r.cols).fill(null))
  }));

  const lookup = [];
  let lastBranch = null;

  function remainingCount() {
    return branchNames.reduce((sum, b) => sum + branches[b].length, 0);
  }

  // pick the branch with the most students left, skipping lastBranch
  // unless it's the only branch that still has anyone in it
  function pickBranch() {
    const candidates = branchNames.filter((b) => branches[b].length > 0);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => branches[b].length - branches[a].length);
    return candidates.find((b) => b !== lastBranch) || candidates[0];
  }

  outer:
  for (const room of roomState) {
    for (let c = 0; c < room.cols; c++) {
      if (remainingCount() === 0) break outer;

      const branch = pickBranch();
      if (!branch) break outer;

      const queue = branches[branch];
      let placedAny = false;

      for (let r = 0; r < room.rows && queue.length > 0; r++) {
        const student = queue.shift();
        room.chart[r][c] = student;
        lookup.push({
          roll_no: student.roll_no,
          name: student.name,
          branch: student.branch,
          room_no: room.room_no,
          row: r + 1,
          col: c + 1
        });
        placedAny = true;
      }

      if (placedAny) lastBranch = branch;
    }
  }

  // anyone left over ran out of rooms/columns entirely
  const unassigned = [];
  branchNames.forEach((b) => unassigned.push(...branches[b]));

  const roomCharts = roomState.map((r) => ({ room_no: r.room_no, chart: r.chart }));
  return { roomCharts, lookup, unassigned };
}

// POST /api/allocate - takes students + rooms, saves to DB, returns seating chart
app.post('/api/allocate', (req, res) => {
  const { students, rooms } = req.body;

  const totalSeats = rooms.reduce((sum, r) => sum + r.rows * r.cols, 0);
  if (totalSeats < students.length) {
    return res.status(400).json({ error: 'Insufficient seats available.' });
  }

  const result = allocateSeats(students, rooms);

  if (result.unassigned.length > 0) {
    return res.status(400).json({
      error:
        `Could not seat ${result.unassigned.length} student(s): each row is reserved for a ` +
        `single branch, so available seats didn't line up with room capacity. Add more rows/rooms ` +
        `or rebalance room sizes and try again.`,
      unassigned: result.unassigned.map((s) => ({ roll_no: s.roll_no, name: s.name, branch: s.branch }))
    });
  }

  // clear old data
  db.query('DELETE FROM seat_assignments', () => {
    db.query('DELETE FROM rooms', () => {
      db.query('DELETE FROM students', () => {
        // insert students
        students.forEach((s) => {
          db.query('INSERT INTO students (roll_no, name, branch) VALUES (?, ?, ?)', [
            s.roll_no,
            s.name,
            s.branch
          ]);
        });

        // insert rooms and seat assignments
        rooms.forEach((r) => {
          db.query(
            'INSERT INTO rooms (room_no, rows_count, cols_count) VALUES (?, ?, ?)',
            [r.room_no, r.rows, r.cols],
            (err, roomResult) => {
              if (err) return;
              const roomId = roomResult.insertId;

              result.lookup
                .filter((l) => l.room_no === r.room_no)
                .forEach((l) => {
                  db.query(
                    'INSERT INTO seat_assignments (roll_no, room_id, row_no, col_no) VALUES (?, ?, ?, ?)',
                    [l.roll_no, roomId, l.row, l.col]
                  );
                });
            }
          );
        });
      });
    });
  });

  // return result immediately (basic version, not waiting on DB inserts)
  res.json({
    message: 'Seating allocated successfully.',
    rooms: result.roomCharts.map((r) => ({
      room_no: r.room_no,
      chart: r.chart.map((row) => row.map((seat) => (seat ? { roll_no: seat.roll_no, branch: seat.branch } : null)))
    })),
    lookup: result.lookup
  });
});

// GET /api/student/:rollNo - lookup a student's seat
app.get('/api/student/:rollNo', (req, res) => {
  const sql = `
    SELECT s.roll_no, s.name, s.branch, r.room_no, sa.row_no, sa.col_no
    FROM seat_assignments sa
    JOIN students s ON s.roll_no = sa.roll_no
    JOIN rooms r ON r.room_id = sa.room_id
    WHERE s.roll_no = ?
  `;
  db.query(sql, [req.params.rollNo], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    res.json(rows[0]);
  });
});

app.listen(3000, () => console.log('Server running on port 3000'));