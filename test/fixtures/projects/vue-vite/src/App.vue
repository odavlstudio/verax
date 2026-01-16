<template>
  <div class="app">
    <h1>Vue Vite Fixture</h1>
    <button id="test-button" @click="count++">Count: {{ count }}</button>
    <form id="test-form" @submit.prevent="handleSubmit">
      <input v-model="message" placeholder="Enter message" />
      <button type="submit">Submit</button>
    </form>
    <p v-if="submitted">Message: {{ message }}</p>
    <nav>
      <a href="/">Home</a>
    </nav>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      count: 0,
      message: '',
      submitted: false,
    }
  },
  methods: {
    handleSubmit() {
      this.submitted = true
    }
  }
}
</script>

<style scoped>
.app {
  padding: 20px;
}
button, input {
  padding: 8px 12px;
  margin: 5px;
  font-size: 16px;
}
</style>
