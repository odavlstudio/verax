<template>
  <div class="app">
    <nav>
      <router-link to="/about">About</router-link>
      <router-link to="/contact">Contact</router-link>
      <button @click="goToDashboard">Dashboard (Dynamic - should skip)</button>
    </nav>
    
    <form @submit.prevent="handleSubmit" action="/submit-form">
      <input v-model="name" type="text" placeholder="Name" />
      <button type="submit">Submit</button>
    </form>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      name: '',
      dynamicPath: '/dashboard'
    };
  },
  methods: {
    goToDashboard() {
      // Dynamic route - should be skipped
      this.$router.push(this.dynamicPath);
    },
    handleSubmit() {
      // Static form action
      this.$router.push('/contact');
    }
  }
};
</script>

<style>
.app {
  padding: 20px;
}
</style>
