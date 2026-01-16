<script>
  import { goto } from '$app/navigation';
  
  let count = 0;
  let isOpen = false;
  
  function navigateToAbout() {
    // CONFIRMED: Navigation promise that fails silently
    goto('/about');
    // Navigation fails but no error feedback
  }
  
  async function handleSubmit() {
    // CONFIRMED: Network promise that fails silently
    try {
      const response = await fetch('/api/contact', { method: 'POST' });
      // Network request fails but no UI feedback
    } catch (error) {
      // Error is silently swallowed
    }
  }
  
  function trackAnalytics() {
    // FALSE POSITIVE TRAP: Analytics-only call
    fetch('/api/analytics/track', { method: 'POST' });
    // Should NOT be reported as silent failure
  }
  
  function toggleModal() {
    // CONFIRMED: State mutation that fails silently
    isOpen = !isOpen;
    // State doesn't actually change (bug)
  }
  
  function incrementCount() {
    // CONFIRMED: State mutation that fails silently
    count = count + 1;
    // Count doesn't actually increment (bug)
  }
</script>

<div class="home-page">
  <h1>Welcome</h1>
  
  <button on:click={navigateToAbout}>Go to About</button>
  
  <form on:submit|preventDefault={handleSubmit}>
    <input type="email" placeholder="Email" />
    <button type="submit">Submit</button>
  </form>
  
  <button on:click={trackAnalytics}>Track Event</button>
  
  <button on:click={toggleModal}>Toggle Modal</button>
  {#if isOpen}
    <div class="modal">Modal Content</div>
  {/if}
  
  <button on:click={incrementCount}>Count: {count}</button>
</div>

<style>
  .home-page {
    padding: 20px;
  }
  
  button {
    margin: 10px;
    padding: 10px 20px;
  }
  
  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border: 1px solid #ccc;
  }
</style>

