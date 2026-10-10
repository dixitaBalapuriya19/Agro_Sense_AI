import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Hero from './components/Hero'
import UploadZone from './components/UploadZone'
import AnalysisResults from './components/AnalysisResults'
import ScanHistory from './components/ScanHistory'
import Navbar from './components/Navbar'
import BasicCareTips from './components/BasicCareTips'
import SeasonalCareTips from './components/SeasonalCareTips'
import WeatherSoilData from './components/WeatherSoilData'
import PlantDashboard from './components/PlantDashboard'
import ErrorBoundary from './components/ErrorBoundary'
import AuthModal from './components/AuthModal'
import { API_BASE_URLS } from './config/api'
import { optimizeImage, getImageHash } from './utils/imageOptimizer'
import { analysisCache } from './utils/analysisCache'
import { generateTasksForPlant, PLANT_SPECIES_PRESETS } from './utils/plantCareEngine'

const ANALYZE_TIMEOUT_MS = 120000 
const ANALYZE_MAX_ATTEMPTS = 1 
const MotionDiv = motion.div

function App() {
  // Navigation State
  const [currentPage, setCurrentPage] = useState('home') 

  // Authentication State
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('agrosense_token') || null)
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('agrosense_user')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        return null
      }
    }
    return null
  })
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  // State
  const [uploadedImage, setUploadedImage] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analysisError, setAnalysisError] = useState(null)

  const [scanHistory, setScanHistory] = useState(() => {
    const hasUser = Boolean(localStorage.getItem('agrosense_token'))
    if (hasUser) {
      const saved = localStorage.getItem('agrosense_scan_history')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) return parsed
        } catch (e) {
          console.error('Failed to parse saved scan history:', e)
        }
      }
    }
    return []
  })

  useEffect(() => {
    try {
      if (authToken && currentUser?.id) {
        localStorage.setItem('agrosense_scan_history', JSON.stringify(scanHistory.slice(0, 25)))
      } else {
        localStorage.removeItem('agrosense_scan_history')
      }
    } catch (e) {
      console.warn('Failed to persist scan history to localStorage:', e)
    }
  }, [scanHistory, authToken, currentUser])

  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('language')
    return saved || 'english'
  })

  // User Plant Garden State (empty by default for clean start)
  const [plants, setPlants] = useState(() => {
    const hasUser = Boolean(localStorage.getItem('agrosense_token'))
    if (hasUser) {
      const saved = localStorage.getItem('agrosense_plants')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            return parsed.filter(p => !['plant_tomato_terrace', 'plant_pepper_garden', 'plant_tulsi_court'].includes(p.id))
          }
        } catch (e) {
          console.error('Failed to parse saved plants:', e)
        }
      }
    }
    return []
  })

  useEffect(() => {
    try {
      if (authToken && currentUser?.id) {
        localStorage.setItem('agrosense_plants', JSON.stringify(plants))
      } else {
        localStorage.removeItem('agrosense_plants')
      }
    } catch (e) {
      console.warn('Failed to persist plants to localStorage:', e)
    }
  }, [plants, authToken, currentUser])

  // Load authenticated user's database records on load or token change
  useEffect(() => {
    if (!authToken) {
      setPlants([])
      setScanHistory([])
      return
    }

    const loadUserData = async () => {
      try {
        const res = await fetch(`${API_BASE_URLS[0]}/user/data`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        })
        if (res.ok) {
          const data = await res.json()
          setPlants(Array.isArray(data.plants) ? data.plants : [])
          setScanHistory(Array.isArray(data.scan_history) ? data.scan_history : [])
        } else if (res.status === 401) {
          // Session expired
          setAuthToken(null)
          setCurrentUser(null)
          localStorage.removeItem('agrosense_token')
          localStorage.removeItem('agrosense_user')
          localStorage.removeItem('agrosense_plants')
          localStorage.removeItem('agrosense_scan_history')
          setPlants([])
          setScanHistory([])
        }
      } catch (err) {
        console.warn('Failed to load user database data:', err)
      }
    }

    loadUserData()
  }, [authToken])

  // Continuous auto-sync with backend database when user is authenticated
  useEffect(() => {
    if (!authToken || !currentUser) return

    const timeoutId = setTimeout(async () => {
      try {
        await fetch(`${API_BASE_URLS[0]}/user/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            plants,
            scan_history: scanHistory.slice(0, 50)
          })
        })
      } catch (err) {
        console.warn('Background sync error:', err)
      }
    }, 600)

    return () => clearTimeout(timeoutId)
  }, [plants, scanHistory, authToken, currentUser])

  const handleAuthSuccess = async ({ user, token, isNewRegistration = false }) => {
    setCurrentUser(user)
    setAuthToken(token)
    localStorage.setItem('agrosense_token', token)
    localStorage.setItem('agrosense_user', JSON.stringify(user))

    // Clear active diagnosis view so no lingering previous scan is visible
    setAnalysisResult(null)
    setUploadedImage(null)
    setAnalysisError(null)

    if (isNewRegistration) {
      // BRAND NEW USER: Starts 100% clean and empty! No plants, no scan history.
      setPlants([])
      setScanHistory([])
      localStorage.removeItem('agrosense_plants')
      localStorage.removeItem('agrosense_scan_history')
      return
    }

    // EXISTING USER LOGIN: Retrieve ONLY this user's cloud database records
    try {
      const dataRes = await fetch(`${API_BASE_URLS[0]}/user/data`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (dataRes.ok) {
        const cloudData = await dataRes.json()
        setPlants(Array.isArray(cloudData.plants) ? cloudData.plants : [])
        setScanHistory(Array.isArray(cloudData.scan_history) ? cloudData.scan_history : [])
      } else {
        setPlants([])
        setScanHistory([])
      }
    } catch (err) {
      console.warn('Initial auth load notice:', err)
      setPlants([])
      setScanHistory([])
    }
  }

  const handleLogout = () => {
    setAuthToken(null)
    setCurrentUser(null)
    localStorage.removeItem('agrosense_token')
    localStorage.removeItem('agrosense_user')
    // Reset to clean state for user data privacy
    setPlants([])
    setScanHistory([])
    setAnalysisResult(null)
    setUploadedImage(null)
    setAnalysisError(null)
    localStorage.removeItem('agrosense_plants')
    localStorage.removeItem('agrosense_scan_history')
    setCurrentPage('home')
  }

  // Helper to map scanned diagnosis into a tracked plant profile
  const createTrackedPlantFromScan = (diagnosis, image) => {
    if (!diagnosis) return null
    const rawPlantName = String(diagnosis.plant_name || '').toLowerCase()

    let matchedId = 'custom'
    if (rawPlantName.includes('tomato')) matchedId = 'tomato'
    else if (rawPlantName.includes('potato')) matchedId = 'potato'
    else if (rawPlantName.includes('pepper') || rawPlantName.includes('chilli') || rawPlantName.includes('capsicum')) matchedId = 'pepper'
    else if (rawPlantName.includes('eggplant') || rawPlantName.includes('brinjal')) matchedId = 'eggplant'
    else if (rawPlantName.includes('rose')) matchedId = 'rose'
    else if (rawPlantName.includes('tulsi') || rawPlantName.includes('basil')) matchedId = 'tulsi'
    else if (rawPlantName.includes('cotton')) matchedId = 'cotton'
    else if (rawPlantName.includes('wheat')) matchedId = 'wheat'

    const preset = PLANT_SPECIES_PRESETS.find(p => p.id === matchedId) || PLANT_SPECIES_PRESETS[PLANT_SPECIES_PRESETS.length - 1]
    const todayStr = new Date().toISOString().split('T')[0]
    const isHealthy = Boolean(diagnosis.disease?.toLowerCase().includes('healthy'))

    return {
      id: `scanned_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: diagnosis.plant_name ? `${diagnosis.plant_name}` : 'Scanned Plant',
      speciesId: matchedId,
      speciesName: preset.name,
      location: 'outdoor',
      plantingDate: '', // Unknown historical value left unset
      lastWatered: '',  // Do not infer plant was watered today
      lastInspected: todayStr,
      lastPruned: '',
      lastFertilized: '',
      healthStatus: isHealthy ? 'healthy' : 'diseased',
      healthStage: isHealthy ? 'recovered' : 'active_infection',
      healthVigor: isHealthy ? 5 : (diagnosis.severity === 'critical' ? 1 : diagnosis.severity === 'high' ? 2 : 3),
      healthLogs: [
        {
          id: `log_init_${Date.now()}`,
          date: todayStr,
          timestamp: new Date().toISOString(),
          status: isHealthy ? 'recovered' : 'active',
          conditionLabel: isHealthy ? 'Healthy Specimen' : `${diagnosis.disease} detected`,
          vigor: isHealthy ? 5 : (diagnosis.severity === 'critical' ? 1 : diagnosis.severity === 'high' ? 2 : 3),
          notes: isHealthy
            ? 'Initial baseline scan: No foliar infection or pathological lesions observed.'
            : `Initial diagnosis: ${diagnosis.disease} (${diagnosis.severity || 'uncertain'} severity, ${diagnosis.confidence || 0}% confidence). Treatment protocol initialized.`,
          scanBased: true
        }
      ],
      activeDisease: isHealthy ? null : diagnosis.disease,
      severity: diagnosis.severity || 'uncertain',
      confidence: diagnosis.confidence || 0,
      remedies: Array.isArray(diagnosis.remedies) ? diagnosis.remedies : [],
      treatmentSchedule: Array.isArray(diagnosis.prescribed_care?.treatment_schedule)
        ? diagnosis.prescribed_care.treatment_schedule
        : [],
      immediateActions: diagnosis.prescribed_care?.immediate_actions || [],
      prescribedCare: diagnosis.prescribed_care || null,
      completedTreatmentSteps: [],
      notes: (diagnosis.remedies || []).slice(0, 2).map(r => r.action || r).join('; ') || diagnosis.description || '',
      image: image || null,
      scannedAt: new Date().toISOString()
    }
  }

  // Shared environmental data for dashboard and adaptive features
  const [sharedWeatherData, setSharedWeatherData] = useState(null)
  const [sharedSoilData, setSharedSoilData] = useState(null)

  useEffect(() => {
    // Fetch background weather and soil data once for adaptive calculations
    const fetchEnvBackground = async () => {
      try {
        const weatherRes = await fetch(`${API_BASE_URLS[0]}/environment/weather?location=Rajkot,%20Gujarat`)
        if (weatherRes.ok) {
          const wData = await weatherRes.json()
          setSharedWeatherData({
            location: wData.location,
            temperature: wData.temperature,
            feels_like: wData.feels_like,
            humidity: wData.humidity,
            description: wData.description,
            windSpeed: wData.wind_speed,
            rainfall: wData.rainfall
          })
        }
      } catch (err) {
        console.warn('Background weather sync notice:', err)
      }

      try {
        const soilRes = await fetch(`${API_BASE_URLS[0]}/environment/soil`)
        if (soilRes.ok) {
          const sData = await soilRes.json()
          setSharedSoilData({
            ph: sData.ph,
            moisture: sData.moisture,
            texture: sData.texture,
            source: sData.source
          })
        }
      } catch (err) {
        console.warn('Background soil sync notice:', err)
      }
    }

    fetchEnvBackground()
  }, [])

  // Calculate pending tasks count (overdue + today)
  const pendingTasksCount = useMemo(() => {
    let count = 0
    plants.forEach((plant) => {
      const plantTasks = generateTasksForPlant(plant, sharedWeatherData, sharedSoilData, language)
      count += plantTasks.filter(t => t.status === 'overdue' || t.status === 'due_today').length
    })
    return count
  }, [plants, sharedWeatherData, sharedSoilData, language])

  // 1-click addition of diagnosed plant into Dashboard (with unset historical dates)
  const handleTrackPlant = (diagnosis, image = null) => {
    if (!diagnosis) return
    const rawPlantName = String(diagnosis.plant_name || '').toLowerCase()
    
    // Find closest species preset
    let matchedId = 'custom'
    if (rawPlantName.includes('tomato')) matchedId = 'tomato'
    else if (rawPlantName.includes('potato')) matchedId = 'potato'
    else if (rawPlantName.includes('pepper') || rawPlantName.includes('chilli') || rawPlantName.includes('capsicum')) matchedId = 'pepper'
    else if (rawPlantName.includes('eggplant') || rawPlantName.includes('brinjal')) matchedId = 'eggplant'
    else if (rawPlantName.includes('rose')) matchedId = 'rose'
    else if (rawPlantName.includes('tulsi') || rawPlantName.includes('basil')) matchedId = 'tulsi'
    else if (rawPlantName.includes('cotton')) matchedId = 'cotton'
    else if (rawPlantName.includes('wheat')) matchedId = 'wheat'

    const preset = PLANT_SPECIES_PRESETS.find(p => p.id === matchedId) || PLANT_SPECIES_PRESETS[PLANT_SPECIES_PRESETS.length - 1]
    const todayStr = new Date().toISOString().split('T')[0]
    const isHealthy = Boolean(diagnosis.disease?.toLowerCase().includes('healthy'))
    const newPlantId = `plant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

    const newPlant = {
      id: newPlantId,
      name: `${diagnosis.plant_name || 'Diagnosed Plant'} (Bed #${plants.length + 1})`,
      speciesId: matchedId,
      speciesName: preset.name,
      location: 'outdoor',
      plantingDate: '', // Do not fabricate planting date
      lastWatered: '',  // Do not infer plant was watered today
      lastInspected: todayStr,
      healthStatus: isHealthy ? 'healthy' : 'recovering',
      activeDisease: isHealthy ? null : diagnosis.disease,
      notes: (diagnosis.remedies || []).slice(0, 2).map(r => r.action || r).join('; '),
      image: image || null
    }

    setPlants(prev => [newPlant, ...prev])
    setCurrentPage('dashboard')
    return newPlantId
  }

  // Associate a scan diagnosis with an existing plant in garden
  const handleLinkScanToPlant = (plantId, diagnosis, image) => {
    if (!plantId || !diagnosis) return
    const todayStr = new Date().toISOString().split('T')[0]
    const isHealthy = Boolean(diagnosis.disease?.toLowerCase().includes('healthy'))

    setPlants(prevPlants => {
      return prevPlants.map(plant => {
        if (plant.id !== plantId) return plant

        const updatedLogs = [
          {
            id: `log_${Date.now()}`,
            date: todayStr,
            timestamp: new Date().toISOString(),
            status: isHealthy ? 'recovered' : 'active',
            conditionLabel: isHealthy ? 'Healthy Specimen' : `${diagnosis.disease} detected`,
            vigor: isHealthy ? 5 : (diagnosis.severity === 'critical' ? 1 : diagnosis.severity === 'high' ? 2 : 3),
            notes: isHealthy
              ? 'Scan inspection: No foliar infection or pathological lesions observed.'
              : `Scan diagnosis: ${diagnosis.disease} (${diagnosis.severity || 'uncertain'} severity, ${diagnosis.confidence || 0}% confidence).`,
            scanBased: true
          },
          ...(plant.healthLogs || [])
        ]

        return {
          ...plant,
          lastInspected: todayStr,
          healthStatus: isHealthy ? 'healthy' : 'diseased',
          healthStage: isHealthy ? 'recovered' : 'under_treatment',
          healthVigor: isHealthy ? 5 : (diagnosis.severity === 'critical' ? 1 : diagnosis.severity === 'high' ? 2 : 3),
          activeDisease: isHealthy ? null : diagnosis.disease,
          severity: diagnosis.severity || 'uncertain',
          confidence: diagnosis.confidence || 0,
          remedies: Array.isArray(diagnosis.remedies) && diagnosis.remedies.length > 0 ? diagnosis.remedies : plant.remedies,
          treatmentSchedule: Array.isArray(diagnosis.prescribed_care?.treatment_schedule)
            ? diagnosis.prescribed_care.treatment_schedule
            : plant.treatmentSchedule,
          immediateActions: diagnosis.prescribed_care?.immediate_actions || plant.immediateActions,
          prescribedCare: diagnosis.prescribed_care || plant.prescribedCare,
          healthLogs: updatedLogs,
          image: image || plant.image
        }
      })
    })

    setScanHistory(prevHistory => {
      if (prevHistory.length === 0) return prevHistory
      const first = { ...prevHistory[0], plantId }
      return [first, ...prevHistory.slice(1)]
    })
  }

  // Explicitly create a new plant from a scan
  const handleCreateNewPlantFromScan = (diagnosis, image) => {
    const newPlant = createTrackedPlantFromScan(diagnosis, image)
    if (newPlant) {
      setPlants(prev => [newPlant, ...prev])
      setScanHistory(prevHistory => {
        if (prevHistory.length === 0) return prevHistory
        const first = { ...prevHistory[0], plantId: newPlant.id }
        return [first, ...prevHistory.slice(1)]
      })
      return newPlant.id
    }
    return null
  }

  useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])

  // Theme State
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark-mode')
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.body.classList.remove('dark-mode')
      document.documentElement.setAttribute('data-theme', 'light')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const toggleTheme = () => setIsDark(!isDark)

  const PROVIDER_STATUS_MESSAGES = {
    quota_exceeded: 'quota exceeded',
    missing_gemini_api_key: 'not configured',
    missing_huggingface_api_key: 'not configured',
    timeout: 'timed out',
    model_loading_503: 'model warming up',
    failed_or_unavailable: 'unavailable',
    request_exception: 'unreachable',
    json_parse_failed: 'invalid response',
    json_missing_required_fields: 'invalid response',
    json_not_object: 'invalid response',
    api_call_failed: 'unavailable',
    disabled: 'disabled',
    unexpected_error: 'unexpected error'
  }

  const normalizeProviderCode = (status) => {
    if (typeof status !== 'string') {
      return 'failed_or_unavailable'
    }

    const normalized = status.trim().toLowerCase()

    if (normalized.includes('quota') || normalized.includes('rate limit') || normalized.includes('resource exhausted') || normalized === 'http_429') {
      return 'quota_exceeded'
    }
    if (normalized.startsWith('http_')) {
      return normalized
    }
    if (PROVIDER_STATUS_MESSAGES[normalized]) {
      return normalized
    }

    return 'failed_or_unavailable'
  }

  const hasProviderCode = (providerStatus, matcher) => {
    if (!providerStatus || typeof providerStatus !== 'object') {
      return false
    }

    const matchers = Array.isArray(matcher) ? matcher : [matcher]
    return Object.values(providerStatus).some((status) => {
      const code = normalizeProviderCode(status)
      return matchers.includes(code)
    })
  }

  const formatProviderStatus = (providerStatus) => {
    if (!providerStatus || typeof providerStatus !== 'object') {
      return ''
    }

    return Object.entries(providerStatus)
      .map(([provider, status]) => {
        const code = normalizeProviderCode(status)
        if (code.startsWith('http_')) {
          return `${provider}: service error (${code.replace('http_', 'HTTP ')})`
        }

        return `${provider}: ${PROVIDER_STATUS_MESSAGES[code] || 'unavailable'}`
      })
      .join(' | ')
  }

  const getUserFacingAnalysisError = (error) => {
    const status = error?.status

    if (status === 429 || hasProviderCode(error?.providerStatus, ['quota_exceeded', 'http_429'])) {
      return 'AI analysis quota is currently exhausted. Please try again in a few minutes.'
    }

    if (error?.isMock) {
      return 'Live AI analysis is temporarily unavailable. Please try again shortly.'
    }

    if (status === 503 || hasProviderCode(error?.providerStatus, ['api_call_failed', 'failed_or_unavailable'])) {
      return 'Plant analysis service is temporarily unavailable. Please try again shortly.'
    }

    const raw = String(error?.message || '').toLowerCase()
    if (raw.includes('all backend endpoints failed')) {
      return 'Unable to reach the analysis service right now. Please try again shortly.'
    }

    return error?.message || 'Analysis failed.'
  }

  const fetchWithApiFallback = async (path, options) => {
    const errors = []
    const endpointErrors = []

    for (const baseUrl of API_BASE_URLS) {
      try {
        const response = await fetch(`${baseUrl}${path}`, options)
        if (response.ok) {
          return response
        }

        const body = await response.text().catch(() => '')
        let parsedBody = null
        if (body) {
          try {
            parsedBody = JSON.parse(body)
          } catch {
            parsedBody = null
          }
        }

        endpointErrors.push({
          endpoint: `${baseUrl}${path}`,
          status: response.status,
          body,
          parsedBody
        })
        errors.push(`${baseUrl}${path} -> ${response.status}${body ? `: ${body}` : ''}`)
      } catch (error) {
        errors.push(`${baseUrl}${path} -> ${error.message}`)
      }
    }

    const combinedError = new Error(`All backend endpoints failed. ${errors.join(' | ')}`)
    combinedError.endpointErrors = endpointErrors

    const backendError = endpointErrors.find(({ parsedBody }) =>
      parsedBody && (parsedBody.provider_status || parsedBody.details || parsedBody.error)
    )

    if (backendError) {
      combinedError.status = backendError.status
      combinedError.backend = backendError.parsedBody
      combinedError.providerStatus = backendError.parsedBody.provider_status
    }

    throw combinedError
  }

  const analyzePlantDisease = async (imageData) => {
    const imageHash = getImageHash(imageData)
    const cachedResult = analysisCache.get(imageHash)
    if (cachedResult) {
      return cachedResult
    }

    console.log('Optimizing image...')
    const optimizedImage = await optimizeImage(imageData, 1024, 1024, 0.85)

    for (let attempt = 1; attempt <= ANALYZE_MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS)

      try {
        const response = await fetchWithApiFallback('/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: optimizedImage }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        const result = await response.json()
        if (result?.is_mock) {
          const mockError = new Error('Backend returned demo fallback data instead of real AI analysis.')
          mockError.providerStatus = result?.provider_status
          mockError.isMock = true
          throw mockError
        }

        analysisCache.set(imageHash, result)
        return result
      } catch (error) {
        clearTimeout(timeoutId)
        const timedOut = error?.name === 'AbortError' || error?.name === 'TimeoutError' || String(error?.message || '').includes('signal timed out')
        const isLastAttempt = attempt === ANALYZE_MAX_ATTEMPTS

        if (timedOut && !isLastAttempt) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          continue
        }

        const backendMessage = error?.backend?.details || error?.backend?.error
        const message = timedOut
          ? 'Backend timed out. Please try again.'
          : backendMessage || error?.message || 'Analysis failed.'

        const normalizedError = new Error(message)
        normalizedError.status = error?.status
        normalizedError.providerStatus = error?.providerStatus || error?.backend?.provider_status
        normalizedError.isMock = Boolean(error?.isMock)
        throw normalizedError
      }
    }
  }

  const performAnalysis = async (imageData) => {
    setIsAnalyzing(true)
    setAnalysisError(null)
    setAnalysisResult(null)
    try {
      const result = await analyzePlantDisease(imageData)
      setAnalysisResult(result)

      const scanItem = {
        id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        plantId: null,
        plant_name: result.plant_name,
        disease: result.disease,
        severity: result.severity || 'uncertain',
        confidence: result.confidence ?? null,
        description: result.description,
        remedies: result.remedies || [],
        prescribed_care: result.prescribed_care || null,
        seasonal_tips: result.seasonal_tips || null,
        provider: result.provider || null,
        is_mock: Boolean(result.is_mock),
        image: imageData
      }
      setScanHistory(prev => [scanItem, ...prev])

      setCurrentPage('analysis')
    } catch (error) {
      console.error('Analysis failed:', error)
      const providerStatusSummary = formatProviderStatus(error?.providerStatus)
      const userMessage = getUserFacingAnalysisError(error)
      const showDebugProviderStatus = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const bannerMessage = showDebugProviderStatus && providerStatusSummary
        ? `${userMessage} Provider status: ${providerStatusSummary}`
        : userMessage

      setAnalysisError(bannerMessage)
      setUploadedImage(null)
      setCurrentPage('analysis')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleImageSelected = (imageData) => {
    setAnalysisError(null)
    setUploadedImage(imageData)
    setCurrentPage('analysis')
    performAnalysis(imageData)
  }

  const resetAnalysis = () => {
    setUploadedImage(null)
    setAnalysisResult(null)
    setAnalysisError(null)
    setIsAnalyzing(false)
  }

  const [isDownloading, setIsDownloading] = useState(false)

  const downloadReport = async (language = 'english') => {
    if (!analysisResult) return
    setIsDownloading(true)
    let timeoutId
    try {
      const reportData = {
        disease: analysisResult.disease,
        description: analysisResult.description,
        remedies: analysisResult.remedies || [],
        confidence: analysisResult.confidence,
        severity: analysisResult.severity,
        plant_name: analysisResult.plant_name,
        seasonal_tips: analysisResult.seasonal_tips || '',
        prescribed_care: analysisResult.prescribed_care || {},
        language: language,
        image: uploadedImage || analysisResult.image || null
      }
      
      const controller = new AbortController()
      timeoutId = setTimeout(() => controller.abort(), 60000)
      
      const response = await fetchWithApiFallback('/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
        signal: controller.signal
      })
      
      if (!response.ok) {
        throw new Error('Report generation failed')
      }
      
      const blob = await response.blob()
      clearTimeout(timeoutId)
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `plant-health-report-${language}-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      clearTimeout(timeoutId)
      const msg = error.name === 'AbortError' ? 'PDF download took too long.' : 'Failed to download report.'
      alert(msg)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <>
      <Navbar 
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        language={language}
        setLanguage={setLanguage}
        isDark={isDark}
        toggleTheme={toggleTheme}
        pendingTasksCount={pendingTasksCount}
        user={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        language={language}
      />
      
      {currentPage === 'home' ? (
         <Hero language={language} isDark={isDark} onNavigate={setCurrentPage} />
      ) : (
        <div className="app-container">
          <ErrorBoundary onGoHome={() => setCurrentPage('home')}>
            <main className="content-shell">
            <AnimatePresence mode="wait">
              {currentPage === 'analysis' && (
                <MotionDiv
                  key="analysis"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {!uploadedImage && !isAnalyzing && !analysisResult && (
                    <section className="page-shell">
                      <div className="page-header">
                        <h1 className="page-title">
                          {language === 'gujarati' ? 'છોડનું નિદાન' : 'Plant Diagnosis'}
                        </h1>
                        <p className="page-subtitle">
                          {language === 'gujarati'
                            ? 'તમારા છોડનો ફોટો અપલોડ કરો અને AI તરત જ તેનું નિદાન કરશે.'
                            : 'Upload a photo of your plant and the AI will analyze its health instantly.'}
                        </p>
                      </div>

                      {analysisError && (
                        <div className="panel-card" style={{ marginBottom: 'var(--space-4)', borderColor: 'var(--color-error)' }}>
                          <p style={{ margin: 0, color: 'var(--ui-text)' }}>{analysisError}</p>
                        </div>
                      )}

                      <UploadZone onImageSelected={handleImageSelected} language={language} />

                      <ScanHistory
                        history={scanHistory}
                        onSelect={(item) => {
                          setUploadedImage(item.image)
                          setAnalysisResult(item)
                        }}
                      />
                    </section>
                  )}

                  {isAnalyzing && !analysisResult && (
                    <section className="page-shell">
                      <div className="analysis-loading">
                        <div className="analysis-spinner" aria-hidden="true" />
                        <h3>{language === 'gujarati' ? 'વિશ્લેષણ કરી રહ્યું છે...' : 'Analyzing plant health...'}</h3>
                      </div>
                    </section>
                  )}

                  {analysisResult && !isAnalyzing && (
                    <AnalysisResults
                      result={analysisResult}
                      image={uploadedImage}
                      language={language}
                      isDownloading={isDownloading}
                      onReset={() => {
                        resetAnalysis()
                        setCurrentPage('analysis')
                      }}
                      onDownload={downloadReport}
                      onBack={() => {
                        resetAnalysis()
                        setCurrentPage('home')
                      }}
                      onNavigateToEnv={() => setCurrentPage('environmental')}
                      onTrackPlant={handleTrackPlant}
                      plants={plants}
                      onLinkToExistingPlant={handleLinkScanToPlant}
                      onTrackAsNewPlant={handleCreateNewPlantFromScan}
                      onNavigateToDashboard={() => setCurrentPage('dashboard')}
                    />
                  )}
                </MotionDiv>
              )}

              {currentPage === 'dashboard' && (
                <MotionDiv
                  key="dashboard"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <PlantDashboard
                    plants={plants}
                    setPlants={setPlants}
                    weatherData={sharedWeatherData}
                    soilData={sharedSoilData}
                    language={language}
                    onBack={() => setCurrentPage('home')}
                    onScanNewPlant={() => {
                      resetAnalysis()
                      setCurrentPage('analysis')
                    }}
                    onNavigateToEnv={() => setCurrentPage('environmental')}
                  />
                </MotionDiv>
              )}

              {currentPage === 'basic' && (
                <MotionDiv
                  key="basic"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <BasicCareTips language={language} />
                </MotionDiv>
              )}

              {currentPage === 'seasonal' && (
                <MotionDiv
                  key="seasonal"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <SeasonalCareTips language={language} />
                </MotionDiv>
              )}

              {currentPage === 'environmental' && (
                <MotionDiv
                  key="environmental"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <WeatherSoilData
                    language={language}
                    activeDiagnosis={analysisResult || (scanHistory && scanHistory[0])}
                    onBack={() => setCurrentPage('home')}
                  />
                </MotionDiv>
              )}
            </AnimatePresence>
            </main>
          </ErrorBoundary>
        </div>
      )}
    </>
  )
}

export default App
