import axios from 'axios';

export function saveUser() {
  return axios.post('/api/save', { name: 'Test' });
}


