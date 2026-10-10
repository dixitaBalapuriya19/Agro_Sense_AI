import { useState } from 'react'
import { PLANT_SPECIES_PRESETS } from '../utils/plantCareEngine'

function getInitialFormData(plant) {
  if (plant) {
    return {
      id: plant.id,
      name: plant.name || '',
      speciesId: plant.speciesId || 'tomato',
      location: plant.location || 'outdoor',
      plantingDate: plant.plantingDate || '',
      lastWatered: plant.lastWatered || '',
      lastInspected: plant.lastInspected || '',
      lastPruned: plant.lastPruned || '',
      lastFertilized: plant.lastFertilized || '',
      healthStatus: plant.healthStatus || 'healthy',
      activeDisease: plant.activeDisease || '',
      notes: plant.notes || ''
    }
  }
  return {
    name: '',
    speciesId: 'tomato',
    location: 'outdoor',
    plantingDate: '',
    lastWatered: '',
    lastInspected: '',
    lastPruned: '',
    lastFertilized: '',
    healthStatus: 'healthy',
    activeDisease: '',
    notes: ''
  }
}

export default function PlantModal({
  isOpen,
  onClose,
  onSave,
  initialPlant = null,
  language = 'english'
}) {
  const isGu = language === 'gujarati'

  const [prevPlant, setPrevPlant] = useState(initialPlant)
  const [formData, setFormData] = useState(() => getInitialFormData(initialPlant))
  const [errors, setErrors] = useState({})

  if (prevPlant !== initialPlant) {
    setPrevPlant(initialPlant)
    setFormData(getInitialFormData(initialPlant))
    setErrors({})
  }

  if (!isOpen) return null

  const validate = () => {
    const errs = {}
    if (!formData.name.trim()) {
      errs.name = isGu ? 'છોડનું નામ લખવું જરૂરી છે' : 'Plant name is required'
    }
    const today = new Date().toISOString().split('T')[0]
    if (formData.plantingDate && formData.plantingDate > today) {
      errs.plantingDate = isGu ? 'વાવણીની તારીખ ભવિષ્યની ન હોઈ શકે' : 'Planting date cannot be in the future'
    }
    if (formData.lastWatered && formData.lastWatered > today) {
      errs.lastWatered = isGu ? 'સિંચાઈની તારીખ ભવિષ્યની ન હોઈ શકે' : 'Last watered date cannot be in the future'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    const matchedPreset = PLANT_SPECIES_PRESETS.find(p => p.id === formData.speciesId) || PLANT_SPECIES_PRESETS[0]

    const plantPayload = {
      ...formData,
      id: formData.id || `plant_${Date.now()}`,
      speciesName: matchedPreset.name,
      createdAt: initialPlant?.createdAt || new Date().toISOString()
    }

    onSave(plantPayload)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card plant-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              {initialPlant
                ? (isGu ? 'છોડની વિગત સુધારો' : 'Edit Plant Details')
                : (isGu ? 'નવો છોડ ઉમેરો' : 'Add Plant to Dashboard')}
            </h3>
            <p className="modal-subtitle">
              {isGu
                ? 'વાવણીની તારીખ અને સંભાળ રેકોર્ડ કરો જેથી અનુકૂળ સમયપત્રક મળી શકે'
                : 'Track planting date and watering to generate a personalized schedule'}
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="plant-modal-form">
          <div className="form-row">
            <div className="form-group flex-2">
              <label htmlFor="plant-name">
                {isGu ? 'છોડનું નામ / ઓળખ *' : 'Plant Nickname / Identifier *'}
              </label>
              <input
                id="plant-name"
                type="text"
                className={`form-input ${errors.name ? 'input-error' : ''}`}
                placeholder={isGu ? 'દા.ત. અગાશીના ટમેટા' : 'e.g. Terrace Roma Tomato'}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoFocus
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="form-group flex-1">
              <label htmlFor="plant-species">
                {isGu ? 'પાક / પ્રજાતિ *' : 'Crop / Species *'}
              </label>
              <select
                id="plant-species"
                className="form-select"
                value={formData.speciesId}
                onChange={(e) => setFormData({ ...formData, speciesId: e.target.value })}
              >
                {PLANT_SPECIES_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {isGu ? preset.gujaratiName : preset.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="planting-date">
                {isGu ? 'વાવણી / રોપણ તારીખ (વૈકલ્પિક)' : 'Planting Date (Optional)'}
              </label>
              <input
                id="planting-date"
                type="date"
                className={`form-input ${errors.plantingDate ? 'input-error' : ''}`}
                value={formData.plantingDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, plantingDate: e.target.value })}
              />
              {errors.plantingDate && <span className="field-error">{errors.plantingDate}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="last-watered">
                {isGu ? 'છેલ્લું પાણી આપ્યું તે તારીખ (વૈકલ્પિક)' : 'Last Watered Date (Optional)'}
              </label>
              <input
                id="last-watered"
                type="date"
                className={`form-input ${errors.lastWatered ? 'input-error' : ''}`}
                value={formData.lastWatered}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, lastWatered: e.target.value })}
              />
              {errors.lastWatered && <span className="field-error">{errors.lastWatered}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="plant-location">
                {isGu ? 'સ્થાન' : 'Location / Environment'}
              </label>
              <select
                id="plant-location"
                className="form-select"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              >
                <option value="outdoor">{isGu ? 'ખુલ્લો બગીચો / આંગણું' : 'Outdoor Garden Bed'}</option>
                <option value="field">{isGu ? 'ખેતરનો પ્લોટ' : 'Open Field Plot'}</option>
                <option value="balcony">{isGu ? 'બાલ્કની / કૂંડાં' : 'Balcony / Pots'}</option>
                <option value="greenhouse">{isGu ? 'ગ્રીનહાઉસ / પોલીહાઉસ' : 'Greenhouse'}</option>
                <option value="indoor">{isGu ? 'ઘરની અંદર' : 'Indoor Window'}</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="health-status">
                {isGu ? 'સ્વાસ્થ્ય સ્થિતિ' : 'Health Status'}
              </label>
              <select
                id="health-status"
                className="form-select"
                value={formData.healthStatus}
                onChange={(e) => setFormData({ ...formData, healthStatus: e.target.value })}
              >
                <option value="healthy">{isGu ? 'સ્વસ્થ (Healthy)' : 'Healthy'}</option>
                <option value="recovering">{isGu ? 'સુધારા પર (Recovering)' : 'Recovering from Disease'}</option>
                <option value="warning">{isGu ? 'લક્ષણો જણાય છે (At Risk)' : 'Showing Symptoms / At Risk'}</option>
                <option value="diseased">{isGu ? 'રોગિષ્ઠ (Diseased)' : 'Active Disease'}</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="active-disease">
              {isGu ? 'સક્રિય રોગ (જો કોઈ હોય તો)' : 'Active Disease / Diagnosis (Optional)'}
            </label>
            <input
              id="active-disease"
              type="text"
              className="form-input"
              placeholder={isGu ? 'દા.ત. અર્લી બ્લાઇટ (Early Blight)' : 'e.g. Early Blight, Powdery Mildew'}
              value={formData.activeDisease}
              onChange={(e) => setFormData({ ...formData, activeDisease: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="plant-notes">
              {isGu ? 'ખાસ નોંધ / ઉપચાર વિગતો' : 'Care Notes / Observations'}
            </label>
            <textarea
              id="plant-notes"
              rows={2}
              className="form-textarea"
              placeholder={isGu ? 'દા.ત. ગયા અઠવાડિયે ખાતર આપ્યું હતું...' : 'e.g. Grafted variety, mulched with straw...'}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {isGu ? 'રદ કરો' : 'Cancel'}
            </button>
            <button type="submit" className="btn-primary">
              {initialPlant
                ? (isGu ? 'ફેરફાર સાચવો' : 'Save Changes')
                : (isGu ? 'છોડ ઉમેરો' : 'Add Plant')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
