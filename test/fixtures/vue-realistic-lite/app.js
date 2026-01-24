(function(){
  function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
    document.title = id;
  }

  // Working link: change history + DOM
  document.getElementById('ok-link')?.addEventListener('click', function(e){
    e.preventDefault();
    const path = '/about';
    window.history.pushState({ path }, '', path);
    showPage('ok');
  });

  // Broken link: prevent navigation and do not change state
  document.getElementById('broken-link')?.addEventListener('click', function(e){
    e.preventDefault();
    // No history.pushState, no DOM swap -> should be detected as broken_navigation_promise
  });

  // Handle back/forward
  window.addEventListener('popstate', function(){
    const path = window.location.pathname.replace(/^\//,'') || 'home';
    showPage(path);
  });
})();
