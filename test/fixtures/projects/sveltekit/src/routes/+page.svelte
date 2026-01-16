<script>
  let count = 0;
  let message = '';
  let submitted = false;

  function handleSubmit() {
    submitted = true;
  }
</script>

<svelte:head>
  <title>SvelteKit Fixture</title>
</svelte:head>

<div class="app">
  <h1>SvelteKit Fixture</h1>
  <button id="test-button" on:click={() => count++}>Count: {count}</button>
  
  <form id="test-form" on:submit|preventDefault={handleSubmit}>
    <input bind:value={message} placeholder="Enter message" />
    <button type="submit">Submit</button>
  </form>
  
  {#if submitted}
    <p>Message: {message}</p>
  {/if}

  <nav>
    <a href="/">Home</a>
  </nav>
</div>

<style>
  .app {
    padding: 20px;
    font-family: Arial, sans-serif;
  }
  
  button, input {
    padding: 8px 12px;
    margin: 5px;
    font-size: 16px;
  }
</style>
