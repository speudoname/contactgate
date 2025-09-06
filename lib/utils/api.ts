// Helper to get the correct API base path
export function getApiUrl(path: string): string {
  // In production, we're served from /contacts subpath
  const basePath = process.env.NODE_ENV === 'production' ? '/contacts' : ''
  return `${basePath}${path}`
}