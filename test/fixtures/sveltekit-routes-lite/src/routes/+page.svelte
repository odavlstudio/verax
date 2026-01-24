<script>
	import { goto } from '$app/navigation';
	
	let dynamicPath = '/dynamic';
	
	// Static goto - should be extracted
	function navigateToAbout() {
		goto('/about');
	}
	
	// Dynamic goto - should be SKIPPED (dynamic)
	function navigateDynamic() {
		goto(dynamicPath);
	}
	
	// Template string - should be SKIPPED (dynamic)
	function navigateWithParam(id) {
		goto(`/user/${id}`);
	}
</script>

<h1>SvelteKit Routes Lite - Home</h1>

<!-- Static href - should be extracted -->
<a href="/about">About (static)</a>
<a href="/contact">Contact (static)</a>
<a href="/pricing">Pricing (static)</a>

<!-- Dynamic href - should be SKIPPED (dynamic) -->
<a href={dynamicPath}>Dynamic Link (skip - variable)</a>
<a href={condition ? '/path1' : '/path2'}>Ternary Link (skip - dynamic)</a>

<!-- Static form action - should be extracted -->
<form action="/submit-form">
	<button type="submit">Submit</button>
</form>

<!-- Dynamic form action - should be SKIPPED (dynamic) -->
<form action={getFormAction()}>
	<button type="submit">Dynamic Form (skip)</button>
</form>

<button on:click={navigateToAbout}>Go to About (static goto)</button>
<button on:click={navigateDynamic}>Go Dynamic (skip - variable)</button>
