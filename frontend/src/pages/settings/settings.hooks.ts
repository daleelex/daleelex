import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { JenkinsApi } from '../../services/jenkins.service';
import type { JenkinsConfigRequest } from '../../types/jenkins.types';

export const useJenkinsConfig = () => useQuery({ queryKey: ['jenkins-config'], queryFn: JenkinsApi.getConfig });

export const useJenkinsMutations = () => {
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: (payload: JenkinsConfigRequest) => JenkinsApi.saveConfig(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jenkins-config'] });
      qc.invalidateQueries({ queryKey: ['jenkins-health'] });
    },
  });

  const test = useMutation({ mutationFn: (payload: JenkinsConfigRequest) => JenkinsApi.testConnection(payload) });

  return { save, test };
};