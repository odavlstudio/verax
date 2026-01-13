import { apiClient } from 'external-client';

export function handleClick() {
  apiClient.post('/api/x');
}
