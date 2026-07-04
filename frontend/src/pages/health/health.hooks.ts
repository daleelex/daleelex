import { useQuery } from '@tanstack/react-query';
import { HealthApi } from '../../services/health.service';
import { JenkinsApi } from '../../services/jenkins.service';

export const useSystemHealth = () =>
  useQuery({ 
    queryKey: ['system-health'], 
    queryFn: async () => {
      const response:any = await HealthApi.check();
      return response.result; 
    }, 
    refetchInterval: 30_000 
  });

export const useJenkinsHealth = () =>
  useQuery({ 
    queryKey: ['jenkins-health'], 
    queryFn: JenkinsApi.health, 
    refetchInterval: 30_000 
  });