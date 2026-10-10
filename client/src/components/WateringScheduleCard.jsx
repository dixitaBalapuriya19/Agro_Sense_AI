import { useState } from 'react'
import { calculateWateringSchedule } from '../utils/wateringSchedule'
import { DropletIcon, ShieldIcon, CalendarIcon, LeafIcon } from './Icons'

export default function WateringScheduleCard({
  weatherData,
  soilData,
  plantDiagnosis = null,
  language = 'english',
  onNavigateToEnv = null,
  showEnvLink = true,
  forcePlantOnly = false,
  forceGeneral = false,
  className = ''
}) {
  const [useDiagnosis, setUseDiagnosis] = useState(!forceGeneral)

  // Compute schedule
  const activeDiagnosis = (!forceGeneral && (forcePlantOnly || useDiagnosis)) && plantDiagnosis?.disease ? plantDiagnosis : null
  const scheduleData = calculateWateringSchedule(weatherData, soilData, activeDiagnosis, language)
  const { today, plantContext, diseaseRules, sevenDaySchedule } = scheduleData

  const isGu = language === 'gujarati'

  const getStatusColor = (status) => {
    switch (status) {
      case 'urgent': return 'var(--color-warning)'
      case 'critical': return 'var(--color-error)'
      case 'delay': return 'var(--ui-text-muted)'
      case 'optimal': default: return 'var(--color-success)'
    }
  }

  // Derive title & subtext based on mode
  let cardTitle = isGu ? 'હવામાન અને માટી આધારિત સિંચાઈ સમયપત્રક' : 'Adaptive Watering Schedule'
  let cardSubtext = isGu
    ? 'હાલના હવામાન, SoilHive માટી ભેજ અને છોડના રોગના આધારે રીઅલ-ટાઇમ માર્ગદર્શન'
    : 'Real-time irrigation guidance tailored to current weather, soil moisture & plant health'

  if (forcePlantOnly && plantDiagnosis) {
    const pName = plantDiagnosis.plant_name || (isGu ? 'સ્કેન કરેલ છોડ' : 'Scanned Plant')
    cardTitle = `${pName} — ${isGu ? 'ચોક્કસ સિંચાઈ પ્રોટોકોલ' : 'Precision Watering Protocol'}`
    cardSubtext = `${isGu ? 'રોગ:' : 'Disease:'} ${plantDiagnosis.disease} • ${isGu ? 'હવામાન અને SoilHive પરિમાણો મુજબ' : 'Tailored to pathology & live environmental data'}`
  } else if (forceGeneral) {
    cardTitle = isGu ? 'સામાન્ય કૃષિ સિંચાઈ સમયપત્રક' : 'General Agricultural Watering Schedule'
    cardSubtext = isGu
      ? 'હાલના હવામાન અને SoilHive માટી ડેટા પર આધારિત સામાન્ય પાક સિંચાઈ ભલામણ'
      : 'Baseline field irrigation guidance based on current weather & SoilHive soil moisture'
  }

  return (
    <section className={`panel-card watering-schedule-card ${className}`}>
      <div className="panel-head">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DropletIcon size={20} color="var(--color-primary)" />
            {cardTitle}
          </h2>
          <p className="watering-subtext">{cardSubtext}</p>
        </div>

        {!forcePlantOnly && !forceGeneral && plantDiagnosis?.disease && (
          <div className="watering-context-switch">
            <button
              type="button"
              className={`context-pill ${useDiagnosis ? 'active' : ''}`}
              onClick={() => setUseDiagnosis(true)}
            >
              {plantDiagnosis.plant_name ? plantDiagnosis.plant_name : (isGu ? 'નિદાન કરેલ છોડ' : 'Diagnosed Plant')}
            </button>
            <button
              type="button"
              className={`context-pill ${!useDiagnosis ? 'active' : ''}`}
              onClick={() => setUseDiagnosis(false)}
            >
              {isGu ? 'સામાન્ય પાક' : 'General Standard'}
            </button>
          </div>
        )}
      </div>

      {/* Today's Irrigation Directive */}
      <div className="today-watering-banner" style={{ borderLeftColor: getStatusColor(today.status) }}>
        <div className="today-header-row">
          <div>
            <span className="today-eyebrow">
              {isGu ? 'આજની સિંચાઈ સલાહ' : "Today's Action Advisory"}
            </span>
            <h3 className="today-action-title">{today.action}</h3>
          </div>
          <span className="status-badge" style={{ backgroundColor: getStatusColor(today.status) }}>
            {today.status.toUpperCase()}
          </span>
        </div>

        <p className="today-rationale">{today.rationale}</p>

        {/* 4 Core Metrics */}
        <div className="watering-metrics-grid">
          <div className="watering-metric-cell">
            <span className="metric-label">{isGu ? 'શ્રેષ્ઠ સમય' : 'Optimal Window'}</span>
            <strong className="metric-value">{today.bestTime}</strong>
          </div>
          <div className="watering-metric-cell">
            <span className="metric-label">{isGu ? 'ભલામણ કરેલ માત્રા' : 'Target Volume'}</span>
            <strong className="metric-value">{today.volume}</strong>
          </div>
          <div className="watering-metric-cell">
            <span className="metric-label">{isGu ? 'માટીની ભેજ' : 'Soil Moisture'}</span>
            <strong className="metric-value">{today.currentMoisture} ({today.soilTexture})</strong>
          </div>
          <div className="watering-metric-cell">
            <span className="metric-label">{isGu ? 'બાષ્પીભવન દર' : 'Evaporation Rate'}</span>
            <strong className="metric-value">{today.etRate}</strong>
          </div>
        </div>

        <div className="technique-row">
          <strong>{isGu ? 'સિંચાઈ પદ્ધતિ:' : 'Application Technique:'}</strong>{' '}
          <span>{today.technique}</span>
        </div>
      </div>

      {/* Disease-Specific Precaution Box */}
      {diseaseRules.length > 0 && (
        <div className="watering-precaution-box">
          <h4 className="precaution-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldIcon size={18} color="var(--color-primary)" />
            <span>{isGu ? 'રોગ-વિશિષ્ટ સિંચાઈ નિયમો' : 'Disease-Specific Irrigation Protocol'}</span>
            {plantContext.isDiagnosed && (
              <span className="plant-tag">
                ({plantContext.plantName} — {plantContext.disease})
              </span>
            )}
          </h4>
          <ul className="precaution-list">
            {diseaseRules.map((rule, idx) => (
              <li key={idx}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 7-Day Schedule Matrix */}
      <div className="seven-day-section">
        <h4 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarIcon size={18} color="var(--color-primary)" />
          <span>{isGu ? '૭-દિવસીય અનુકૂલિત સિંચાઈ યોજના' : '7-Day Precision Irrigation Plan'}</span>
        </h4>

        <div className="schedule-table-wrap">
          <table className="schedule-table" aria-label="7-Day Watering Schedule">
            <thead>
              <tr>
                <th>{isGu ? 'દિવસ' : 'Day / Date'}</th>
                <th>{isGu ? 'પગલું' : 'Action'}</th>
                <th>{isGu ? 'સમય' : 'Target Time'}</th>
                <th>{isGu ? 'માત્રા' : 'Volume'}</th>
                <th>{isGu ? 'માર્ગદર્શન' : 'Agronomic Guidance'}</th>
              </tr>
            </thead>
            <tbody>
              {sevenDaySchedule.map((day) => (
                <tr key={day.dayIndex} className={`row-${day.type}`}>
                  <td>
                    <strong>{day.dayLabel}</strong>
                    <span className="date-sub">{day.date}</span>
                  </td>
                  <td>
                    <span className={`action-pill pill-${day.type}`}>
                      {day.action}
                    </span>
                  </td>
                  <td>{day.timeWindow}</td>
                  <td>{day.volume}</td>
                  <td className="note-cell">{day.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Link to Full Environmental Data if on Analysis page */}
      {showEnvLink && typeof onNavigateToEnv === 'function' && (
        <div className="watering-card-footer">
          <button
            type="button"
            className="btn-env-link"
            onClick={onNavigateToEnv}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <LeafIcon size={16} />
            <span>{isGu ? 'લાઇવ હવામાન અને SoilHive માટી ડેટા વિગતવાર જુઓ →' : 'View Full Live Weather & Soil Data →'}</span>
          </button>
        </div>
      )}
    </section>
  )
}
