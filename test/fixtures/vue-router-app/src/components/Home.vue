<template>
  <div>
    <h1>Home</h1>
    <router-link to="/about">About</router-link>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function goToUsers() {
  router.push('/users/profile');
}

function goToUser() {
  const userId = 42;
  router.push(`/user/${userId}`);
}

function goToDynamicSlug() {
  const slug = 'example-post';
  router.replace(`/blog/${slug}`);
}
</script>

