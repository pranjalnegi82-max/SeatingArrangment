import { useCallback, useEffect, useState } from "react";
import { apiGet, API_BASE } from "../utils/api";

export default function useStudentDirectory({ onToast } = {}) {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const fetchStudents = useCallback(
    async (searchTerm = search) => {
      setLoading(true);
      try {
        const data = await apiGet(`/api/students?search=${encodeURIComponent(searchTerm)}&page=1&limit=25`);
        setStudents(data.students);
        setTotal(data.total);
      } catch (err) {
        onToast?.error(`Failed to load students: ${err.message}`);
      } finally {
        setLoading(false);
      }
    },
    [search, onToast]
  );

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiGet("/api/students/import-history");
      setHistory(data.history);
    } catch {
      // silent -- history panel is supplementary, not worth a toast
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const exportCsv = useCallback(() => {
    window.open(`${API_BASE}/api/students/export`, "_blank");
  }, []);

  return {
    search,
    setSearch,
    students,
    total,
    loading,
    history,
    fetchStudents,
    fetchHistory,
    exportCsv,
  };
}
