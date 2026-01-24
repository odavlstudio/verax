<script>
  import { goto } from '$app/navigation';

  let name = '';
  let dynamicPath = '/dashboard';

  async function navigateToDashboard() {
    // Dynamic navigation - should be skipped
    await goto(dynamicPath);
  }

  async function navigateToAbout() {
    // Static navigation - should be extracted
    await goto('/about');
  }

  async function handleSubmit() {
    await goto('/contact');
  }
</script>

<div class="container">
  <nav>
    <a href="/about">About</a>
    <a href="/contact">Contact</a>
    <button on:click={navigateToDashboard}>Dashboard</button>
  </nav>
  
  <form action="/submit-form">
    <input bind:value={name} type="text" placeholder="Name" />
    <button type="submit">Submit</button>
  </form>
</div>

<style>
  .container {
    padding: 20px;
  }
</style>
