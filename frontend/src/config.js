// frontend/src/config.js
// This creates a central place for your backend URL.
// If running on Vercel, it uses the Env Variable. If local, it uses localhost.
export const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';