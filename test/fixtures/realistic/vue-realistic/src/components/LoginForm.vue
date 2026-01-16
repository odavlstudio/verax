<template>
  <div class="login-form">
    <h2>Login</h2>
    <form @submit.prevent="handleLogin">
      <input v-model="email" type="email" placeholder="Email" />
      <input v-model="password" type="password" placeholder="Password" />
      <!-- Intentional: No validation error display -->
      <!-- This should be detected as a validation silent failure -->
      <button type="submit">Login</button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const email = ref('');
const password = ref('');

function handleLogin() {
  // Intentional: Validation fails but no error message
  if (!email.value || !password.value) {
    // Should show validation error but doesn't
    // This should be detected as a silent failure
    return;
  }
  
  // In real scenario, would make login request
  console.log('Login attempt');
}
</script>

