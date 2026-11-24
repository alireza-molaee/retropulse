try {
  const theme = localStorage.getItem('retro:theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  // Use the system theme when local storage is unavailable.
}
