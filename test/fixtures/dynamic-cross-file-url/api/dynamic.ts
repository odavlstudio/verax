import axios from 'axios';

export function saveDynamic(id: string) {
  return axios.post(`/api/${id}`);
}
