<template>
  <div class="contact-form">
    <h2>Contact Us</h2>
    <form @submit.prevent="handleSubmit">
      <input v-model="formData.name" type="text" placeholder="Name" required />
      <input v-model="formData.email" type="email" placeholder="Email" required />
      <textarea v-model="formData.message" placeholder="Message" required></textarea>
      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Submitting...' : 'Submit' }}
      </button>
    </form>
    <!-- Intentional: No success/error message display -->
    <!-- This should be detected as a silent failure -->
  </div>
</template>

<script setup>
import { ref } from 'vue';

const formData = ref({
  name: '',
  email: '',
  message: ''
});

const isSubmitting = ref(false);

async function handleSubmit() {
  isSubmitting.value = true;
  
  try {
    // Network request succeeds but no UI feedback
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData.value)
    });
    
    if (response.ok) {
      // Intentional: No success message, no redirect, no feedback
      // This should be detected as a silent failure
    }
  } catch (error) {
    // Intentional: No error message displayed
    // This should be detected as a silent failure
  } finally {
    isSubmitting.value = false;
  }
}
</script>

