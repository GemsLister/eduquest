import { useState, useEffect, useCallback } from "react";
import * as ItemAnalysisService from "../../services/item-analysis/itemAnalysisService";
import { useAuth } from "../../context/AuthContext";

export const useFetchData = () => {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingSections(true);

      const { data: sectionsData, error: sectionsError } =
        await ItemAnalysisService.getInstructorsSection(user.id);

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);
    } catch (err) {
      console.error("Error in useFetchData:", err);
    } finally {
      setLoadingSections(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { user, sections, loadingSections, refresh: fetchData };
};