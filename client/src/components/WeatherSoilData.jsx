import { useState, useEffect, useCallback } from 'react'
import { t } from '../translations'
import { API_BASE_URL } from '../config/api'
import { WarningIcon } from './Icons'
import { CloudIcon, WindIcon, TemperatureIcon, WaterIcon } from './SeasonalIcons'
import WateringScheduleCard from './WateringScheduleCard'

const getRiskLevel = (score) => {
  if (score >= 80) return 'High'
  if (score >= 50) return 'Moderate'
  return 'Low'
}

const buildAgricultureRecommendations = (weatherData, soilData, language) => {
  const temp = Number(weatherData?.temperature ?? 0)
  const humidity = Number(weatherData?.humidity ?? 0)
  const rainfall = Number(weatherData?.rainfall ?? 0)
  const wind = Number(weatherData?.windSpeed ?? 0)
  const cloudiness = Number(weatherData?.cloudiness ?? 0)
  const ph = Number(soilData?.ph ?? 0)
  const moistureRaw = soilData?.moisture ?? ''
  const moisture = Number(String(moistureRaw).replace('%', '').trim() || 0)

  const fungalRiskScore = Math.min(100, Math.round((humidity * 0.55) + (rainfall * 6) + (cloudiness * 0.2)))
  const droughtRiskScore = Math.min(100, Math.round((Math.max(0, temp - 27) * 4) + (Math.max(0, 45 - humidity) * 1.5) + (Math.max(0, 30 - moisture))))

  const irrigation = language === 'gujarati'
    ? [
        `આજનું તાપમાન ${temp || '--'}°C અને ભેજ ${humidity || '--'}% છે, તેથી વહેલી સવારે ઊંડું પાણી આપવું યોગ્ય રહેશે.`,
        rainfall > 2
          ? `છેલ્લા કલાકમાં વરસાદ (${rainfall} mm) હોવાથી આગામી સિંચાઈ ચક્ર 12-24 કલાક મુલતવી રાખો.`
          : `વરસાદ ઓછો હોવાથી, માટીની ભેજ ${moisture || '--'}% આધારે 24 કલાકમાં ફરી હળવી સિંચાઈ કરો.`,
        moisture < 35
          ? 'માટીમાં ભેજ ઓછી હોવાથી ઓર્ગેનિક મલ્ચ 4-6 સેમી સુધી ઉમેરો.'
          : 'ભેજ યોગ્ય છે; પાણી ભરાવ ટાળવા માત્ર જરૂર પ્રમાણે પાણી આપો.'
      ]
    : [
        `Current temperature is ${temp || '--'}°C with ${humidity || '--'}% humidity, so irrigate deeply in early morning for better uptake.`,
        rainfall > 2
          ? `Rainfall in the last hour (${rainfall} mm) suggests delaying the next irrigation cycle by 12-24 hours.`
          : `With low rainfall, schedule a light follow-up irrigation within 24 hours based on soil moisture (${moisture || '--'}%).`,
        moisture < 35
          ? 'Soil moisture is low; add 4-6 cm organic mulch to reduce evapotranspiration losses.'
          : 'Moisture is acceptable; avoid over-irrigation and maintain drainage to prevent root stress.'
      ]

  const nutrition = language === 'gujarati'
    ? [
        `માટી pH ${ph || '--'} છે. આ મૂલ્ય ${ph < 6 ? 'ઓછું' : ph > 7.4 ? 'ઉંચું' : 'સમતુલિત'} છે, તેથી ખાતર વ્યવસ્થા તે મુજબ ગોઠવો.`,
        `નાઇટ્રોજન: ${soilData?.nitrogen ?? '--'}, ફોસ્ફરસ: ${soilData?.phosphorus ?? '--'}, પોટેશિયમ: ${soilData?.potassium ?? '--'} પર આધારિત તબક્કાવાર NPK આપો.`,
        `ઓર્ગેનિક મેટર ${soilData?.organicMatter ?? '--'} હોવાથી દર 15 દિવસે કમ્પોસ્ટ અથવા જીવામૃત ઉમેરો.`
      ]
    : [
        `Soil pH is ${ph || '--'}; this is ${ph < 6 ? 'acidic' : ph > 7.4 ? 'alkaline' : 'near-optimal'}, so adjust nutrient strategy accordingly.`,
        `Use staged NPK feeding based on Nitrogen (${soilData?.nitrogen ?? '--'}), Phosphorus (${soilData?.phosphorus ?? '--'}), and Potassium (${soilData?.potassium ?? '--'}).`,
        `Organic matter at ${soilData?.organicMatter ?? '--'} indicates adding compost or bio-organic inputs every 15 days for soil health.`
      ]

  const protection = language === 'gujarati'
    ? [
        `ફંગલ જોખમ: ${getRiskLevel(fungalRiskScore)} (${fungalRiskScore}%). પાંદડા સૂકા રાખો અને વાયુ પ્રવાહ વધારો.`,
        `સૂકાપણાનો જોખમ: ${getRiskLevel(droughtRiskScore)} (${droughtRiskScore}%). ગરમીમાં શેડનેટ અને મલ્ચનો ઉપયોગ કરો.`,
        wind > 20
          ? `પવનની ઝડપ ${wind} km/h છે, તેથી નાજુક છોડને ટેકો અથવા પવનરોધક આપો.`
          : `પવન સામાન્ય છે; માત્ર કેનોપી હવાની અવરજવર જાળવો.`
      ]
    : [
        `Fungal pressure risk: ${getRiskLevel(fungalRiskScore)} (${fungalRiskScore}%). Keep foliage dry and improve air circulation.`,
        `Drought stress risk: ${getRiskLevel(droughtRiskScore)} (${droughtRiskScore}%). Use mulch and temporary shade support during peak heat.`,
        wind > 20
          ? `Wind speed is ${wind} km/h; use staking or windbreak support for tender crops.`
          : `Wind load is manageable; continue canopy ventilation practices.`
      ]

  return [
    {
      title: language === 'gujarati' ? 'સિંચાઈ અને ભેજ વ્યવસ્થાપન' : 'Irrigation & Moisture Management',
      items: irrigation
    },
    {
      title: language === 'gujarati' ? 'માટી પોષણ અને pH સંભાળ' : 'Soil Nutrition & pH Care',
      items: nutrition
    },
    {
      title: language === 'gujarati' ? 'રોગ-જીવાત અને તાણ નિવારણ' : 'Disease, Pest & Stress Prevention',
      items: protection
    }
  ]
}

const WeatherSoilData = ({ onBack, language = 'english', activeDiagnosis = null }) => {
  const [weatherData, setWeatherData] = useState(null)
  const [soilData, setSoilData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const location = 'Rajkot, Gujarat' // Default location

  const fetchEnvironmentalData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Fetch weather data from backend
      await fetchWeatherData()
      // Fetch soil data from backend
      await fetchSoilData()
    } catch (err) {
      console.error('Error fetching environmental data:', err)
      setError('Failed to load environmental data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEnvironmentalData()
  }, [fetchEnvironmentalData])

  const fetchWeatherData = async () => {
    const response = await fetch(
      `${API_BASE_URL}/environment/weather?location=${encodeURIComponent(location)}`
    )

    if (!response.ok) {
      throw new Error('Weather API request failed')
    }

    const data = await response.json()
    setWeatherData({
      location: data.location,
      temperature: data.temperature,
      feels_like: data.feels_like,
      humidity: data.humidity,
      description: data.description,
      windSpeed: data.wind_speed,
      rainfall: data.rainfall,
      cloudiness: data.cloudiness,
      pressure: data.pressure,
      sunrise: data.sunrise,
      sunset: data.sunset,
      source: data.source,
      timestamp: data.timestamp,
      is_fallback: Boolean(data.is_fallback),
      is_estimated: Boolean(data.is_estimated)
    })
  }

  const fetchSoilData = async () => {
    const response = await fetch(`${API_BASE_URL}/environment/soil`)

    if (!response.ok) {
      throw new Error('Soil API request failed')
    }

    const data = await response.json()
    setSoilData({
      ph: data.ph,
      nitrogen: data.nitrogen,
      phosphorus: data.phosphorus,
      potassium: data.potassium,
      organicMatter: data.organic_matter,
      texture: data.texture,
      moisture: data.moisture,
      temperature: data.temperature,
      source: data.source,
      timestamp: data.timestamp,
      note: data.note,
      is_fallback: Boolean(data.is_fallback),
      is_estimated: Boolean(data.is_estimated)
    })
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <button className="back-chip" onClick={onBack}>← {language === 'gujarati' ? 'પાછા' : 'Back'}</button>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading environmental data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <button className="back-chip" onClick={onBack}>← {language === 'gujarati' ? 'પાછા' : 'Back'}</button>
        </div>
        <div className="error-message">
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <WarningIcon size={20} color="var(--color-warning)" />
            {error}
          </p>
          <button onClick={fetchEnvironmentalData} className="retry-btn">
            {language === 'gujarati' ? 'ફરી પ્રયાસ કરો' : 'Retry'}
          </button>
        </div>
      </div>
    )
  }

  const recommendationSections = buildAgricultureRecommendations(weatherData, soilData, language)

  return (
    <div className="page-shell">
      <div className="page-header">
        {typeof onBack === 'function' && (
          <button className="back-chip" onClick={onBack}>← {language === 'gujarati' ? 'પાછા' : 'Back'}</button>
        )}
        <div>
          <h1 className="page-title">{t('weatherSoilData', language)}</h1>
          <p className="page-subtitle">
            {language === 'gujarati' ? 'તમારા સ્થાન માટે રીઅલ-ટાઇમ પર્યાવરણીય માહિતી' : 'Real-time environmental data for your location'}
          </p>
        </div>
      </div>

      <div className="env-grid">
        <section className="panel-card env-table-card">
          <div className="panel-head">
            <h2><CloudIcon size={18} /> {t('currentWeather', language)}</h2>
            <span>{weatherData?.location || location}</span>
          </div>
          <table className="env-table" aria-label="Weather data table">
            <tbody>
              <tr><th>{language === 'gujarati' ? 'ડેટા સ્થિતિ' : 'Data Status'}</th><td>{weatherData?.is_fallback ? (language === 'gujarati' ? 'અંદાજિત આધારરેખા (લાઇવ સ્ટેશન અપ્રાપ્ય)' : 'Estimated Baseline (Live station unavailable)') : (language === 'gujarati' ? 'લાઇવ સેન્સર / સ્ટેશન ડેટા' : 'Live Station / API Measurement')}</td></tr>
              <tr><th>{language === 'gujarati' ? 'વર્ણન' : 'Condition'}</th><td>{weatherData?.description || '--'}</td></tr>
              <tr><th>{t('temperature', language)}</th><td>{weatherData?.temperature ?? '--'}°C</td></tr>
              <tr><th>{language === 'gujarati' ? 'અનુભવાય તેવું' : 'Feels Like'}</th><td>{weatherData?.feels_like ?? '--'}°C</td></tr>
              <tr><th>{t('humidity', language)}</th><td>{weatherData?.humidity ?? '--'}%</td></tr>
              <tr><th>{t('windSpeed', language)}</th><td>{weatherData?.windSpeed ?? '--'} km/h</td></tr>
              <tr><th>{language === 'gujarati' ? 'વરસાદ' : 'Rainfall'}</th><td>{weatherData?.rainfall ?? '--'} mm</td></tr>
              <tr><th>{language === 'gujarati' ? 'વાદળ આવરણ' : 'Cloud Cover'}</th><td>{weatherData?.cloudiness ?? '--'}%</td></tr>
              <tr><th>{language === 'gujarati' ? 'દબાણ' : 'Pressure'}</th><td>{weatherData?.pressure ?? '--'} hPa</td></tr>
              <tr><th>{language === 'gujarati' ? 'સૂર્યોદય' : 'Sunrise'}</th><td>{weatherData?.sunrise ?? '--'}</td></tr>
              <tr><th>{language === 'gujarati' ? 'સૂર્યાસ્ત' : 'Sunset'}</th><td>{weatherData?.sunset ?? '--'}</td></tr>
              <tr><th>{language === 'gujarati' ? 'સ્ત્રોત' : 'Source'}</th><td>{weatherData?.source ?? '--'}</td></tr>
              <tr><th>{language === 'gujarati' ? 'તાજગી (અપડેટ)' : 'Freshness'}</th><td>{weatherData?.timestamp ? new Date(weatherData.timestamp).toLocaleString() : '--'}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="panel-card env-table-card">
          <div className="panel-head">
            <h2><WaterIcon size={18} /> {t('soilData', language)}</h2>
          </div>
          <table className="env-table" aria-label="Soil data table">
            <tbody>
              <tr><th>{language === 'gujarati' ? 'ડેટા સ્થિતિ' : 'Data Status'}</th><td>{soilData?.is_fallback ? (language === 'gujarati' ? 'પ્રાદેશિક અંદાજ (ઇન-સીટુ સેન્સર કનેક્ટ નથી)' : 'Regional Baseline (In-ground sensor not connected)') : (language === 'gujarati' ? 'માપેલ સેન્સર ડેટા' : 'Measured Sensor Data')}</td></tr>
              <tr><th>{t('soilMoisture', language)}</th><td>{soilData?.moisture ?? '--'}</td></tr>
              <tr><th>{t('soilTemperature', language)}</th><td>{soilData?.temperature != null ? `${soilData.temperature}°C` : (language === 'gujarati' ? 'માપેલ નથી' : 'Not Directly Measured')}</td></tr>
              <tr><th>{t('phLevel', language)}</th><td>{soilData?.ph ?? '--'}</td></tr>
              <tr><th>{t('nitrogen', language)}</th><td>{soilData?.nitrogen ?? '--'}</td></tr>
              <tr><th>{t('phosphorus', language)}</th><td>{soilData?.phosphorus ?? '--'}</td></tr>
              <tr><th>{t('potassium', language)}</th><td>{soilData?.potassium ?? '--'}</td></tr>
              <tr><th>{language === 'gujarati' ? 'જૈવિક પદાર્થ' : 'Organic Matter'}</th><td>{soilData?.organicMatter ?? '--'}</td></tr>
              <tr><th>{language === 'gujarati' ? 'માટી રચના' : 'Texture'}</th><td>{soilData?.texture ?? '--'}</td></tr>
              <tr><th>{language === 'gujarati' ? 'સ્ત્રોત' : 'Source'}</th><td>{soilData?.source ?? '--'}</td></tr>
              <tr><th>{language === 'gujarati' ? 'તાજગી (અપડેટ)' : 'Freshness'}</th><td>{soilData?.timestamp ? new Date(soilData.timestamp).toLocaleString() : '--'}</td></tr>
              {soilData?.note && <tr><th>{language === 'gujarati' ? 'ટિપ્પણી' : 'Note'}</th><td>{soilData.note}</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <WateringScheduleCard
        weatherData={weatherData}
        soilData={soilData}
        plantDiagnosis={activeDiagnosis}
        forceGeneral={!activeDiagnosis}
        language={language}
        showEnvLink={false}
      />

      <section className="panel-card recommendation-panel">
        <div className="panel-head">
          <h2>{t('recommendations', language)}</h2>
        </div>
        <table className="recommend-table" aria-label="Agriculture recommendation table">
          <thead>
            <tr>
              <th>{language === 'gujarati' ? 'વિભાગ' : 'Category'}</th>
              <th>{language === 'gujarati' ? 'ભલામણ' : 'Recommendation'}</th>
            </tr>
          </thead>
          <tbody>
            {recommendationSections.flatMap((section) => section.items.map((item, idx) => (
              <tr key={`${section.title}-${idx}`}>
                <td>{section.title}</td>
                <td>{item}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default WeatherSoilData
