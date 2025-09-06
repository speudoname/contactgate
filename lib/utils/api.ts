// Helper to get the correct API base path
export function getApiUrl(path: string): string {
  // When accessed through proxy, we're already at /contacts
  // Check if we're already in /contacts path
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/contacts')) {
    // Already in /contacts, don't add it again
    return path
  }
  
  // In production when accessed directly (not through proxy), add /contacts
  const basePath = process.env.NODE_ENV === 'production' ? '/contacts' : ''
  return `${basePath}${path}`
}