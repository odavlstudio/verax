<script>
  import { writable } from 'svelte/store';
  
  let email = '';
  let errorMessage = '';
  
  // Reactive store for form state
  const formState = writable({ submitted: false });
  
  async function handleSubmit() {
    // CONFIRMED: Network promise that fails silently
    const response = await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    // Network request fails but no error message shown
  }
  
  function validateEmail() {
    // CONFIRMED: Validation that should block but doesn't
    if (!email.includes('@')) {
      // Validation error should be shown but isn't
      return false;
    }
    return true;
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <input type="email" bind:value={email} placeholder="Email" />
  {#if errorMessage}
    <div class="error">{errorMessage}</div>
  {/if}
  <button type="submit">Submit</button>
</form>

<style>
  .error {
    color: red;
    margin-top: 5px;
  }
</style>

