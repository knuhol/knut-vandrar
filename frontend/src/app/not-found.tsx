import GlobalNotFound, { generateMetadata as globalMetadata } from './global-not-found'

export const generateMetadata = globalMetadata

// Invalid top-level locale segments can throw before a locale layout renders.
// Use the same complete document as the routing-level 404 in that case.
export default GlobalNotFound
