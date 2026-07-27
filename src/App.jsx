import { useState } from "react";
import "./App.css";
import StudentImport from "./components/StudentImport/StudentImport";
import { API_BASE } from "./utils/api";

function App() {
  const [students, setStudents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [result, setResult] = useState(null);

  const addStudent = () => {
    setStudents([
      ...students,
      {
        roll_no: "",
        name: "",
        branch: "",
      },
    ]);
  };

  const addRoom = () => {
    setRooms([
      ...rooms,
      {
        room_no: rooms.length + 1,
        rows: "",
        cols: "",
      },
    ]);
  };

  const updateStudent = (i, key, value) => {
    const copy = [...students];
    copy[i][key] = value;
    setStudents(copy);
  };

  const updateRoom = (i, key, value) => {
  const copy = [...rooms];
  copy[i][key] =
    key === "rows" || key === "cols"
      ? Number(value)
      : value;
  setRooms(copy);
};

  const generateSeating = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/allocate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        students,
        rooms,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || data.message || "Request failed");
      return;
    }

    setResult(data);

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};

  return (
    <div className="container">

      <header className="masthead">
        <span className="masthead-eyebrow">Examination Cell</span>
        <h1>Exam Seating Arrangement System</h1>
        <span className="stamp-badge">Official Allocation</span>
      </header>

      <div className="section">

        <div className="section-head">
          <h2>Students</h2>
          <span className="count-chip">{students.length}</span>
        </div>

        <button className="add-btn" onClick={addStudent}>+ Add Student</button>

        {students.length === 0 && (
          <p className="empty-hint">No students entered yet. Add a row to begin the roll.</p>
        )}

        {students.map((s, i) => (
          <div className="row" key={i}>
            <input
              placeholder="Roll No"
              value={s.roll_no}
              onChange={(e) =>
                updateStudent(i, "roll_no", e.target.value)
              }
            />

            <input
              placeholder="Name"
              value={s.name}
              onChange={(e) =>
                updateStudent(i, "name", e.target.value)
              }
            />

            <input
              placeholder="Branch"
              value={s.branch}
              onChange={(e) =>
                updateStudent(i, "branch", e.target.value)
              }
            />
          </div>
        ))}
      </div>

      <StudentImport
        onImportComplete={(imported) => {
          setStudents((prev) => [...prev, ...imported]);
        }}
      />

      <div className="section">

        <div className="section-head">
          <h2>Rooms</h2>
          <span className="count-chip">{rooms.length}</span>
        </div>

        <button className="add-btn" onClick={addRoom}>+ Add Room</button>

        {rooms.length === 0 && (
          <p className="empty-hint">No rooms entered yet. Add a room to define its grid.</p>
        )}

        {rooms.map((r, i) => (
          <div className="row" key={i}>
            <span className="room-tag">Room {r.room_no}</span>

            <input
              placeholder="Rows"
              value={r.rows}
              onChange={(e) =>
                updateRoom(i, "rows", e.target.value)
              }
            />

            <input
              placeholder="Columns"
              value={r.cols}
              onChange={(e) =>
                updateRoom(i, "cols", e.target.value)
              }
            />
          </div>
        ))}
      </div>

      <button className="generate" onClick={generateSeating}>
        Generate Seating
      </button>

      {result && (
        <div className="results">
          <div className="section-head">
            <h2>Room Layouts</h2>
          </div>

          <div className="room-grid">
            {result.rooms.map((room, idx) => (
              <div className="room" key={idx}>

                <h3>Room {room.room_no}</h3>

                <div className="chart">
                  {room.chart.map((row, r) => (
                    <div className="seatRow" key={r}>
                      {row.map((seat, c) => (
                        <div
                          className={`seat${seat ? " filled" : " empty"}`}
                          key={c}
                          title={seat ? `${seat.roll_no} — ${seat.branch}` : ""}
                        >
                          {seat ? (
                            <>
                              <span className="seat-roll">{seat.roll_no}</span>
                              <span className="seat-branch">{seat.branch}</span>
                            </>
                          ) : (
                            <span className="seat-empty-label">EMPTY</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="section-head">
            <h2>Student Lookup</h2>
          </div>

          <div className="table-wrap">
            <table>

              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Room</th>
                  <th>Row</th>
                  <th>Column</th>
                </tr>
              </thead>

              <tbody>
                {Object.entries(result.lookup).map(([roll, info]) => (
                  <tr key={roll}>
                    <td>{roll}</td>
                    <td>{info.room}</td>
                    <td>{info.row}</td>
                    <td>{info.col}</td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;