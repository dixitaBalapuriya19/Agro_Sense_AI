import { motion } from 'framer-motion' // eslint-disable-line no-unused-vars
import { useEffect, useMemo, useState } from 'react'
import { t } from '../translations'
import { SunIcon, WaterIcon, TemperatureIcon, SnowflakeIcon } from './SeasonalIcons'
import { API_BASE_URL } from '../config/api'
import { WarningIcon } from './Icons'

const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'fall'
  return 'winter'
}

const levelText = (score) => {
  if (score >= 80) return 'High'
  if (score >= 50) return 'Moderate'
  return 'Low'
}

const buildSeasonData = (language, weatherData, soilData) => {
  const temp = Number(weatherData?.temperature ?? 0)
  const humidity = Number(weatherData?.humidity ?? 0)
  const rainfall = Number(weatherData?.rainfall ?? 0)
  const ph = Number(soilData?.ph ?? 0)
  const moisture = Number(String(soilData?.moisture ?? '').replace('%', '').trim() || 0)

  const fungalRisk = Math.min(100, Math.round((humidity * 0.6) + (rainfall * 5) + 10))
  const pestRisk = Math.min(100, Math.round((temp * 2) + (humidity * 0.3) + 5))
  const droughtRisk = Math.min(100, Math.round((Math.max(0, temp - 27) * 4) + (Math.max(0, 45 - humidity) * 1.4) + (Math.max(0, 35 - moisture))))

  const seasonMeta = [
    { id: 'spring', titleKey: 'springRenewal', Icon: SunIcon },
    { id: 'summer', titleKey: 'summerVitality', Icon: WaterIcon },
    { id: 'fall', titleKey: 'fallPreparation', Icon: TemperatureIcon },
    { id: 'winter', titleKey: 'winterDormancy', Icon: SnowflakeIcon }
  ]

  return seasonMeta.map((season) => {
    const commonContext = language === 'gujarati'
      ? `સ્થિતિ આધાર: ${temp || '--'}°C, ભેજ ${humidity || '--'}%, માટી pH ${ph || '--'}, ભેજ ${moisture || '--'}%`
      : `Current condition basis: ${temp || '--'}°C, humidity ${humidity || '--'}%, soil pH ${ph || '--'}, moisture ${moisture || '--'}%`

    if (season.id === 'spring') {
      return {
        ...season,
        context: commonContext,
        tips: language === 'gujarati'
          ? [
              'નવી વૃદ્ધિ શરૂ થાય ત્યારે હળવી કાપણી કરો અને હવા પસાર થાય તે રીતે છોડ ગોઠવો.',
              `માટીનું pH ${ph || '--'} હોવાથી બેલેન્સ્ડ NPK ખાતર દર 12-15 દિવસે આપો.`,
              `ફંગલ જોખમ ${levelText(fungalRisk)} હોવાથી પાંદડાને રાત્રે ભીના ન રહેવા દો.`
            ]
          : [
              'Start with structural pruning and spacing to improve airflow during early growth flush.',
              `With soil pH at ${ph || '--'}, apply balanced NPK feeding every 12-15 days for active growth.`,
              `Fungal pressure is ${levelText(fungalRisk)}; keep foliage dry overnight and increase morning ventilation.`
            ],
        threats: language === 'gujarati'
          ? [
              { name: 'Leaf Spot & Powdery Mildew', prevention: 'સવારે સિંચાઈ કરો, સાંજે પાંદડા ભીના ન રહે.' },
              { name: 'Aphids', prevention: 'નવા કુમળા પાનની 3 દિવસના અંતરે તપાસ કરો અને નીમ આધારિત સ્પ્રે કરો.' }
            ]
          : [
              { name: 'Leaf Spot and Powdery Mildew', prevention: 'Water in the morning and keep foliage dry by evening.' },
              { name: 'Aphids', prevention: 'Inspect tender shoots every 3 days and use neem-based preventive spray.' }
            ]
      }
    }

    if (season.id === 'summer') {
      return {
        ...season,
        context: commonContext,
        tips: language === 'gujarati'
          ? [
              `ઉંચા તાપમાન (${temp || '--'}°C)માં વહેલી સવાર + સાંજનું વિભાજિત સિંચાઈ શેડ્યૂલ રાખો.`,
              'મલ્ચિંગ 5-7 સેમી રાખીને મૂળ વિસ્તારનું તાપમાન અને પાણી નુકસાન ઘટાડો.',
              `સૂકાપણાનો જોખમ ${levelText(droughtRisk)} હોવાથી મધ્યાહ્નમાં 35% શેડનેટ વાપરો.`
            ]
          : [
              `At elevated heat (${temp || '--'}°C), switch to split irrigation in early morning and late evening.`,
              'Maintain 5-7 cm mulch to reduce root-zone heat stress and moisture loss.',
              `Drought stress risk is ${levelText(droughtRisk)}; use 35% shade support during peak afternoon heat.`
            ],
        threats: language === 'gujarati'
          ? [
              { name: 'Spider Mites', prevention: 'પાંદડાની નીચેની સપાટી પર નિયત તપાસ અને ભેજ સંતુલન જાળવો.' },
              { name: 'Whiteflies', prevention: 'પીળા સ્ટીકી ટ્રેપ્સ સાથે સાવચેતીમૂલક નીમ સ્પ્રે ચક્ર ચલાવો.' }
            ]
          : [
              { name: 'Spider Mites', prevention: 'Inspect leaf undersides routinely and maintain balanced humidity.' },
              { name: 'Whiteflies', prevention: 'Use yellow sticky traps and a preventive neem spray cycle.' }
            ]
      }
    }

    if (season.id === 'fall') {
      return {
        ...season,
        context: commonContext,
        tips: language === 'gujarati'
          ? [
              'વૃદ્ધિ ધીમી પડે ત્યારે નાઇટ્રોજન ઘટાડીને રૂટ-સપોર્ટ પોષણ આપો.',
              `ભેજ ${humidity || '--'}% અને વરસાદ ${rainfall || '--'} mm પર આધારિત સિંચાઈ ઇન્ટરવલ ફરી ગોઠવો.`,
              'શિયાળાની તૈયારી માટે નબળા ભાગો દૂર કરીને રોગમુક્ત કેનોપી જાળવો.'
            ]
          : [
              'As growth slows, reduce nitrogen-heavy feeding and shift to root-strength nutrition.',
              `Recalibrate irrigation intervals using humidity (${humidity || '--'}%) and rainfall (${rainfall || '--'} mm).`,
              'Prepare for winter by removing weak growth and maintaining a disease-free canopy.'
            ],
        threats: language === 'gujarati'
          ? [
              { name: 'Downy Mildew', prevention: 'ઉંચી ભેજ દરમિયાન હવાપ્રવાહ અને ડ્રેનેજમાં સુધારો કરો.' },
              { name: 'Snails/Slugs', prevention: 'સાંજના સમયમાં બેસલ વિસ્તાર તપાસો અને ભેજ નિયંત્રિત રાખો.' }
            ]
          : [
              { name: 'Downy Mildew', prevention: 'Improve airflow and drainage during humid transitions.' },
              { name: 'Snails/Slugs', prevention: 'Inspect root-zone in evenings and avoid prolonged wet mulch.' }
            ]
      }
    }

    return {
      ...season,
      context: commonContext,
      tips: language === 'gujarati'
        ? [
            'તાપમાન ઘટે ત્યારે સિંચાઈ વચ્ચેનો અંતર વધારો અને પાણી ભરાવ ટાળો.',
            `માટી ભેજ ${moisture || '--'}% હોવાથી માત્ર ટોપ-સોઇલ સૂકાય ત્યારે જ પાણી આપો.`,
            `પેસ્ટ દબાણ ${levelText(pestRisk)} હોય તો સાપ્તાહિક નિરીક્ષણ + સેનિટેશન જાળવો.`
          ]
        : [
            'Increase interval between watering cycles in colder periods and prevent root-zone waterlogging.',
            `With soil moisture at ${moisture || '--'}%, irrigate only after top-soil dryness confirmation.`,
            `When pest pressure is ${levelText(pestRisk)}, keep weekly scouting and hygiene checks active.`
          ],
      threats: language === 'gujarati'
        ? [
            { name: 'Root Rot', prevention: 'ઠંડકમાં વધારે પાણી ન આપો અને ડ્રેનેજ હોળ્સ ખુલ્લા રાખો.' },
            { name: 'Fungal Crown Rot', prevention: 'બેઝ એરિયાને સૂકો રાખો અને ભીના અવશેષો સમયસર દૂર કરો.' }
          ]
        : [
            { name: 'Root Rot', prevention: 'Avoid excess irrigation in cool weather and ensure open drainage paths.' },
            { name: 'Fungal Crown Rot', prevention: 'Keep crown area dry and remove wet debris quickly.' }
          ]
    }
  })
}

export default function SeasonalCareTips({ onBack, language = 'english' }) {
  const [activeSeason, setActiveSeason] = useState(getCurrentSeason())
  const [weatherData, setWeatherData] = useState(null)
  const [soilData, setSoilData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadLiveData = async () => {
      setLoading(true)
      setError('')
      try {
        const [weatherRes, soilRes] = await Promise.all([
          fetch(`${API_BASE_URL}/environment/weather`),
          fetch(`${API_BASE_URL}/environment/soil`)
        ])

        if (!weatherRes.ok || !soilRes.ok) {
          throw new Error('Unable to load live seasonal context')
        }

        const [weather, soil] = await Promise.all([weatherRes.json(), soilRes.json()])
        setWeatherData(weather)
        setSoilData(soil)
      } catch (err) {
        setError(err.message || 'Unable to load seasonal data')
      } finally {
        setLoading(false)
      }
    }

    loadLiveData()
  }, [])

  const seasons = useMemo(() => {
    if (!weatherData || !soilData) return []
    return buildSeasonData(language, weatherData, soilData)
  }, [language, weatherData, soilData])

  const currentSeason = seasons.find((s) => s.id === activeSeason) || seasons[0]

  if (loading) {
    return (
      <motion.div className="page-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>{language === 'gujarati' ? 'મોસમી માહિતી લોડ થઈ રહી છે...' : 'Loading seasonal care data...'}</p>
        </div>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div className="page-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="error-message">
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <WarningIcon size={20} color="var(--color-warning)" />
            {error}
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div className="page-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="page-header">
        {typeof onBack === 'function' && (
          <button className="back-chip" onClick={onBack}>
            ← {language === 'gujarati' ? 'પાછા' : 'Back'}
          </button>
        )}
        <div>
          <h1 className="page-title">{t('seasonalCareGuide', language)}</h1>
          <p className="page-subtitle">
            {language === 'gujarati' ? 'દરેક મોસમ માટે ચોક્કસ સંભાળ ભલામણો' : 'Specific care recommendations for each season'}
          </p>
        </div>
      </div>

      <div className="season-tabs">
        {seasons.map((season) => {
          const Icon = season.Icon
          return (
            <button
              key={season.id}
              onClick={() => setActiveSeason(season.id)}
              className={`season-tab ${activeSeason === season.id ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{t(season.id, language)}</span>
            </button>
          )
        })}
      </div>

      <motion.section className="season-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="season-panel-head">
          <span className="care-icon-wrap">
            <currentSeason.Icon size={22} />
          </span>
          <h2>{t(currentSeason.titleKey, language)}</h2>
        </div>
        <p className="season-context">{currentSeason.context}</p>
        <div className="season-tip-stack">
          {currentSeason.tips.map((tip, idx) => (
            <div key={idx} className="season-tip-row">
              <span>{(idx + 1).toString().padStart(2, '0')}</span>
              <p>{tip}</p>
            </div>
          ))}
        </div>

        <div className="season-risk-panel">
          <h3>{language === 'gujarati' ? 'જોખમ અને નિવારણ' : 'Diseases, Pests, and Prevention'}</h3>
          <div className="season-risk-grid">
            {currentSeason.threats.map((threat) => (
              <article key={threat.name} className="season-risk-card">
                <h4>{threat.name}</h4>
                <p>{threat.prevention}</p>
              </article>
            ))}
          </div>
        </div>
      </motion.section>
    </motion.div>
  )
}
