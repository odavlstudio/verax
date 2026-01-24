<template>
  <div id="app">
    <h1>Vue SFC Lite</h1>
    <!-- Static router links (should be extracted) -->
    <router-link to="/pricing">Pricing</router-link>
    <RouterLink to="/about">About</RouterLink>
    <!-- Dynamic router link (must be skipped) -->
    <router-link :to="`/user/${userId}`">Profile</router-link>
    <router-link to="/user/:id">User Dynamic</router-link>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return { userId: 42 };
  },
  methods: {
    goCheckout() {
      // local router variable
      const router = this.$router;
      router.push('/checkout');
    },
    goAbout() {
      // replace navigation via this.$router
      this.$router.replace('/about');
    },
    goDynamic() {
      // dynamic should be skipped
      this.$router.push(`/user/${this.userId}`);
    },
    goDollar() {
      // $router push variant
      $router.push('/contact');
    },
    goDollarReplace() {
      // $router replace variant
      $router.replace('/settings');
    }
  }
}
</script>

<style scoped>
#app { padding: 1rem; }
</style>
