const LOCAL_API_URL = 'http://localhost:8000/api'
const PRODUCTION_API_URL = 'https://agrosense-backend-otb9.onrender.com/api'

const normalizeApiUrl = (url) => url.replace(/\/+$/, '')

const uniqueUrls = (urls) => [...new Set(urls.map(normalizeApiUrl))]

export const getApiBaseUrl = () => {
  return getApiBaseUrls()[0]
}

export const getApiBaseUrls = () => {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim()

  if (configuredUrl) {
    return uniqueUrls([configuredUrl])
  }

  const { hostname, protocol } = window.location

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return uniqueUrls([LOCAL_API_URL, PRODUCTION_API_URL])
  }

  if (hostname.includes('ngrok')) {
    return uniqueUrls([`${protocol}//${hostname}/api`, LOCAL_API_URL, PRODUCTION_API_URL])
  }

  return uniqueUrls([PRODUCTION_API_URL])
}

export const API_BASE_URL = getApiBaseUrl()
export const API_BASE_URLS = getApiBaseUrls()