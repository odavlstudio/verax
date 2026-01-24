<script>
	import { goto } from '$app/navigation';
</script>

<h1>About Page</h1>

<p>This is a static about page.</p>

<!-- Filesystem route: src/routes/about/+page.svelte → /about -->

<a href="/">Back to Home</a>

<button on:click={() => goto('/contact')}>
	Go to Contact
</button>
