<script>
  let loaded = false;
  
  async function loadData() {
    // CONFIRMED: Network promise that fails silently
    await fetch('/api/about');
    loaded = true;
    // Network fails but no loading indicator or error shown
  }
</script>

<div class="about-page">
  <h1>About</h1>
  <button on:click={loadData}>Load Data</button>
  {#if loaded}
    <p>Data loaded</p>
  {/if}
</div>

<style>
  .about-page {
    padding: 20px;
  }
</style>

