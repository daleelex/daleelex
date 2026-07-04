import { useQuery } from '@tanstack/react-query';
import { TeamsApi } from '../../services/teams.service';

export const useTeams = () => useQuery({ queryKey: ['teams'], queryFn: TeamsApi.getAll });