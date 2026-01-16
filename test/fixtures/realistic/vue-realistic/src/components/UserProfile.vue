<template>
  <div class="user-profile">
    <h2>User Profile</h2>
    <p v-if="user">User ID: {{ user.id }}</p>
    <p v-if="user">Name: {{ user.name }}</p>
    <button @click="loadUser">Load User</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const user = ref(null);

function loadUser() {
  const userId = 123; // In real scenario, this would be dynamic
  
  // Ambiguous case: Dynamic route navigation with object form
  // Should be marked as SUSPECTED with medium confidence
  router.push({
    name: 'user',
    params: { id: userId }
  });
  
  // Partial state update (some UI change but route unclear)
  user.value = { id: userId, name: 'Test User' };
}
</script>

