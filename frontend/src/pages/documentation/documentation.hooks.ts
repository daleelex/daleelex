import { useQuery } from '@tanstack/react-query';
import { DocsApi } from '../../services/docs.service';

export const useTechDocsIndex = () => useQuery({ queryKey: ['techdocs-index'], queryFn: DocsApi.index });