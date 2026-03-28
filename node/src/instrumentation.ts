export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startHubScheduler } = await import('./lib/hub-sync');
    startHubScheduler();
  }
}
