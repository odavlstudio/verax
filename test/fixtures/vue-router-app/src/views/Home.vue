<template>
  <div class="home">
    <h1>Home</h1>
    <nav>
      <RouterLink to="/about">About</RouterLink>
      <RouterLink to="/users">Users</RouterLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goToUsers = () => {
  router.push('/users')
}

const goToProfile = () => {
  router.push('/users/profile')
}

const navigateToAbout = () => {
  router.replace('/about')
}
</script>
