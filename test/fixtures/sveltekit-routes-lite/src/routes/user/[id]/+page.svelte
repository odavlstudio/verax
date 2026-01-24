<script>
	import { page } from '$app/stores';
</script>

<h1>User Profile: {$page.params.id}</h1>

<!-- This route should be SKIPPED (params) -->
<!-- Path contains [id] dynamic segment -->

<p>This is a dynamic route and should not be extracted.</p>

<a href="/">Home</a>
