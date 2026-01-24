// Cross-file wrapper function
import { saveUser } from './api/saveUser';

export function handleSubmit() {
  return saveUser();
}


