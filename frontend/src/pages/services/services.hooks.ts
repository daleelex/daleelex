import { useQuery } from '@tanstack/react-query';
import { ServicesApi } from '../../services/services.service';

export const useServices = () => useQuery({ queryKey: ['services'], queryFn: ServicesApi.getAll });