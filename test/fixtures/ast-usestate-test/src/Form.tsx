
import React, { useState } from 'react';

interface FormData {
  email: string;
  valid: boolean;
}

export default function EmailForm() {
  const [form, setForm] = useState<FormData>({ email: '', valid: false });
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  const handleSubmit = async () => {
    setSubmitting(true);
    await api.submit(form);
    setSubmitting(false);
  };
  
  return (
    <div>
      <input 
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <button onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </div>
  );
}
