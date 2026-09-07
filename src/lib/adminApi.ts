// Helper for authenticated admin client-side fetch calls
export async function adminFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});

  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });
}
