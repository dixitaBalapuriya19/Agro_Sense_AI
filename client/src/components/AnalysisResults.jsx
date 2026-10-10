import { useState, useEffect } from 'react'
import { motion } from 'framer-motion' // eslint-disable-line no-unused-vars
import TreatmentPlan from './TreatmentPlan'
import DetailedCareGuide from './DetailedCareGuide'
import WateringScheduleCard from './WateringScheduleCard'
import { API_BASE_URL } from '../config/api'
import { t } from '../translations'
import { WarningIcon, GlobeIcon } from './Icons'

// SVG Icon Components
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>
)

const DownloadIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

export default function AnalysisResults({
  result,
  image,
  onReset,
  onDownload,
  onBack,
  onNavigateToEnv,
  onTrackPlant,
  onNavigateToDashboard,
  plants = [],
  onLinkToExistingPlant = null,
  onTrackAsNewPlant = null,
  weatherData: propWeatherData,
  soilData: propSoilData,
  language = 'english',
  isDownloading = false
}) {
  const [fetchedWeatherData, setFetchedWeatherData] = useState(null)
  const [fetchedSoilData, setFetchedSoilData] = useState(null)
  const [trackedPlantId, setTrackedPlantId] = useState(null)
  const [selectedExistingPlantId, setSelectedExistingPlantId] = useState(() => (plants && plants.length > 0 ? plants[0].id : ''))

  const effectiveWeatherData = propWeatherData || fetchedWeatherData
  const effectiveSoilData = propSoilData || fetchedSoilData

  useEffect(() => {
    let isMounted = true
    const loadEnvData = async () => {
      try {
        if (!propWeatherData) {
          const wRes = await fetch(`${API_BASE_URL}/environment/weather?location=Rajkot,%20Gujarat`)
          if (wRes.ok && isMounted) {
            const wData = await wRes.json()
            setFetchedWeatherData(wData)
          }
        }
        if (!propSoilData) {
          const sRes = await fetch(`${API_BASE_URL}/environment/soil`)
          if (sRes.ok && isMounted) {
            const sData = await sRes.json()
            setFetchedSoilData(sData)
          }
        }
      } catch (err) {
        console.warn('Could not auto-fetch environmental data for analysis watering card:', err)
      }
    }

    if (!propWeatherData || !propSoilData) {
      loadEnvData()
    }

    return () => { isMounted = false }
  }, [propWeatherData, propSoilData])

  if (!result) return null

  const getSeverityColor = (imp) => {
    switch (imp) {
      case 'critical': return '#E05D44'; // Red-orange
      case 'high': return '#E8A891';     // Clay-soft
      case 'medium': return '#D4AF6F';   // Gold
      case 'low': return '#2d6a4f';      // Forest green
      case 'uncertain':
      case 'unknown':
      default: return '#8C8C82';         // Stone
    }
  }

  const rawSeverity = String(result.severity || 'uncertain').toLowerCase()
  const severityDisplay = (rawSeverity === 'uncertain' || rawSeverity === 'unknown')
    ? (language === 'gujarati' ? 'અનિશ્ચિત' : 'Uncertain')
    : (t(rawSeverity, language) || rawSeverity)

  const handleCreateNew = () => {
    if (onTrackAsNewPlant) {
      const newId = onTrackAsNewPlant(result, image)
      setTrackedPlantId(newId || 'new')
    } else if (onTrackPlant) {
      onTrackPlant(result)
      setTrackedPlantId('new')
    }
  }

  const handleLinkExisting = () => {
    if (onLinkToExistingPlant && selectedExistingPlantId) {
      onLinkToExistingPlant(selectedExistingPlantId, result, image)
      setTrackedPlantId(selectedExistingPlantId)
    }
  }

  const linkedPlant = plants.find(p => p.id === trackedPlantId)

  return (
    <motion.section
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="analysis-shell"
    >
      <div className="page-header compact">
        <button className="back-chip" onClick={onBack}>← {t('backToHome', language)}</button>
        <button className="back-chip muted" onClick={onReset}><RefreshIcon /> {t('scanAnother', language)}</button>
      </div>

      <div className="analysis-layout">
        <aside className="analysis-side panel-card">
          <button className="analysis-reset-btn" onClick={onReset}>{t('scanAnother', language)}</button>
          <div className="analysis-image-wrap">
            <img src={image} alt="Analyzed specimen" />
          </div>
          <div className="analysis-controls">
            <label>
              <GlobeIcon size={16} /> {t('reportLanguage', language)}
            </label>
            <div className="analysis-report-language">English</div>
            <button className="btn-download" onClick={() => onDownload('english')} disabled={isDownloading}>
              {isDownloading ? (
                <><RefreshIcon /> {language === 'gujarati' ? 'તૈયાર કરી રહ્યા છીએ...' : 'Generating...'}</>
              ) : (
                <><DownloadIcon size={16} /> {language === 'gujarati' ? 'હેલ્થ રિપોર્ટ ડાઉનલોડ (English)' : 'Download Health Report (English)'}</>
              )}
            </button>
          </div>
        </aside>

        <div className="analysis-main">
          {/* Plant Tracking Association Card */}
          <div className="auto-track-notification panel-card" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            padding: '14px 18px',
            borderLeft: '4px solid var(--ui-accent, #2d6a4f)',
            marginBottom: 'var(--space-3)'
          }}>
            {trackedPlantId ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    background: 'var(--ui-accent, #2d6a4f)',
                    color: '#fff',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>✓</span>
                  <div>
                    <strong style={{ fontSize: '13px', color: 'var(--ui-text)' }}>
                      {language === 'gujarati'
                        ? `${linkedPlant ? linkedPlant.name : 'છોડ'} ડેશબોર્ડમાં સાચવેલ છે`
                        : `Linked to ${linkedPlant ? linkedPlant.name : 'Plant'} in Care Dashboard`}
                    </strong>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--ui-text-muted)' }}>
                      {language === 'gujarati'
                        ? 'સ્વાસ્થ્ય લોગ અને સિંચાઈ કેલેન્ડર અપડેટ કરવામાં આવ્યા છે.'
                        : 'Health log and adaptive care tasks are now synchronized.'}
                    </p>
                  </div>
                </div>

                {typeof onNavigateToDashboard === 'function' && (
                  <button
                    type="button"
                    className="btn-open-dashboard"
                    onClick={onNavigateToDashboard}
                    style={{
                      background: 'var(--ui-accent, #2d6a4f)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm, 4px)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {language === 'gujarati' ? 'ડેશબોર્ડ જુઓ →' : 'View in Dashboard →'}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--ui-text)' }}>
                  {language === 'gujarati' ? 'છોડ ટ્રેકિંગ અને હેલ્થ રેકોર્ડ' : 'Garden Tracking & Health Journal'}
                </strong>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--ui-text-muted)' }}>
                  {language === 'gujarati'
                    ? 'આ સ્કેનને તમારા બગીચાના વર્તમાન છોડ સાથે જોડો અથવા નવો છોડ ઉમેરો:'
                    : 'Associate this scan with an existing garden plant or track as a new plant:'}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {plants && plants.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <select
                        value={selectedExistingPlantId}
                        onChange={(e) => setSelectedExistingPlantId(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid var(--ui-border, #ccc)',
                          fontSize: '12px',
                          background: 'var(--ui-surface, #fff)',
                          color: 'var(--ui-text, #222)'
                        }}
                      >
                        {plants.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.speciesName || p.speciesId})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleLinkExisting}
                        style={{
                          background: 'var(--ui-accent, #2d6a4f)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {language === 'gujarati' ? 'આ છોડમાં નોંધો' : 'Update Existing Plant'}
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCreateNew}
                    style={{
                      background: 'var(--ui-surface-muted, #f1f5f9)',
                      color: 'var(--ui-accent, #2d6a4f)',
                      border: '1px solid var(--ui-accent, #2d6a4f)',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    + {language === 'gujarati' ? 'નવા છોડ તરીકે ઉમેરો' : 'Add as New Plant'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <section className="panel-card">
            <div className="analysis-head">
              <h2>{language === 'gujarati' ? 'AI આંતરદૃષ્ટિ' : 'AI insights'}</h2>
              <span className="severity-chip" style={{ backgroundColor: getSeverityColor(result.severity) }}>
                {severityDisplay}
              </span>
            </div>

              {result.is_mock && (
                <div className="demo-chip">
                  <WarningIcon size={14} />
                  <span>{t('demoMode', language)}</span>
                </div>
              )}

              <h3 className="analysis-disease">{result.disease}</h3>
              {result.plant_name && (
                <p className="analysis-plant">{t('identifiedAs', language)}: <strong>{result.plant_name}</strong></p>
              )}

              <div className="analysis-confidence">
                <div className="analysis-confidence-bar">
                  <motion.div
                    className="analysis-confidence-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${result.confidence}%` }}
                    transition={{ duration: 1, ease: 'circOut' }}
                  />
                </div>
                <div className="analysis-confidence-meta">
                  <span>{t('aiConfidence', language)}</span>
                  <span>{result.confidence}% {t('match', language)}</span>
                </div>
              </div>

              <p className="analysis-description">{result.description}</p>

              {result.seasonal_tips && (
                <div className="analysis-seasonal-tip">
                  <h4>{t('seasonalCareTip', language)}</h4>
                  <p>"{result.seasonal_tips}"</p>
                </div>
              )}
            </section>

            <section className="panel-card">
              <TreatmentPlan remedies={result.remedies} language={language} />
              {result.prescribed_care && <DetailedCareGuide prescribedCare={result.prescribed_care} language={language} />}
            </section>

            <WateringScheduleCard
              weatherData={effectiveWeatherData}
              soilData={effectiveSoilData}
              plantDiagnosis={result}
              forcePlantOnly={true}
              language={language}
              onNavigateToEnv={onNavigateToEnv}
              showEnvLink={true}
              className="analysis-watering-card"
            />
          </div>
        </div>
      </motion.section>
    )
}
