import { useState, useEffect, useCallback } from 'react';
import { HomeService } from './home.service';
import type { DashboardData } from './home.types';

const EMPTY_DATA: DashboardData = {
  stats: { totalServices: 0, totalTeams: 0, tier1Count: 0, docsCount: 0 },
  recentServices: [],
  teams: [],
};

export const useDashboardData = () => {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await HomeService.getDashboard());
    } catch (err) {
      setError('Failed to load dashboard data. Please try again.');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
};