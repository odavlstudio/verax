<template>
  <div class="home">
    <h1>Home Page</h1>
    <button @click="navigateToAbout">Go to About</button>
    <button @click="trackAnalytics" class="analytics-btn">Track Event</button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

function navigateToAbout() {
  // Intentional silent failure: navigation promise but no actual navigation
  // This should be detected as a silent failure
  router.push('/about');
  // Note: In real scenario, navigation might fail due to route guard or error
}

function trackAnalytics() {
  // False positive trap: analytics-only call
  // Should NOT be reported as silent failure (guardrails should catch this)
  fetch('https://analytics.example.com/track', {
    method: 'POST',
    body: JSON.stringify({ event: 'button_click' })
  });
}
</script>

