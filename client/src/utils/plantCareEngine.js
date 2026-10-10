// Plant Care Engine: Species Profiles, Stage Calculations, Weather Adjustments, and Task Generation

export const PLANT_SPECIES_PRESETS = [
  {
    id: 'tomato',
    name: 'Tomato',
    gujaratiName: 'ટમેટા',
    icon: '🍅',
    wateringIntervalDays: 2,
    inspectionIntervalDays: 4,
    pruningIntervalDays: 10,
    fertilizingIntervalDays: 14,
    stages: [
      { name: 'Seedling', gujaratiName: 'ધરૂ / રોપા', minDays: 0, maxDays: 21 },
      { name: 'Vegetative', gujaratiName: 'વાનસ્પતિક વૃદ્ધિ', minDays: 22, maxDays: 45 },
      { name: 'Flowering & Fruiting', gujaratiName: 'ફૂલ અને ફળ', minDays: 46, maxDays: 80 },
      { name: 'Harvesting', gujaratiName: 'લણણી / પાક', minDays: 81, maxDays: 130 }
    ],
    pruningTip: 'Remove suckers in leaf axils; prune yellowing lower foliage to improve aeration.',
    pruningTipGu: 'ડાળીઓ વચ્ચે ફૂટતા વધારાના કૂંપળો દૂર કરો; હવા ઉજાસ માટે નીચેના પીળા પાન કાપો.',
    inspectionTip: 'Inspect leaf undersides for early blight rings, whiteflies, and aphids.',
    inspectionTipGu: 'અર્લી બ્લાઇટના ડાઘા, સફેદ માખી અને મોલોમશી માટે પાનની નીચે તપાસ કરો.',
    waterVolMm: '15-20 mm'
  },
  {
    id: 'potato',
    name: 'Potato',
    gujaratiName: 'બટાટા',
    icon: '🥔',
    wateringIntervalDays: 3,
    inspectionIntervalDays: 5,
    pruningIntervalDays: 14,
    fertilizingIntervalDays: 21,
    stages: [
      { name: 'Sprouting', gujaratiName: 'અંકુરણ', minDays: 0, maxDays: 25 },
      { name: 'Vegetative Canopy', gujaratiName: 'પર્ણસમૂહ વૃદ્ધિ', minDays: 26, maxDays: 55 },
      { name: 'Tuber Initiation', gujaratiName: 'ગાંઠ નિર્માણ', minDays: 56, maxDays: 90 },
      { name: 'Tuber Bulking & Maturity', gujaratiName: 'બટાટા પરિપક્વતા', minDays: 91, maxDays: 120 }
    ],
    pruningTip: 'Hill soil around the base to prevent tubers greening; trim damaged haulms.',
    pruningTipGu: 'બટાટા લીલા ન થાય તે માટે થડ પાસે માટી ચડાવો; ક્ષતિગ્રસ્ત ડાળીઓ કાપો.',
    inspectionTip: 'Monitor closely for Late Blight dark water-soaked lesions and Colorado potato beetle.',
    inspectionTipGu: 'પાછોતરા સુકારા (Late Blight) ના કાળા ડાઘા અને જીવાત માટે નિયમિત તપાસ કરો.',
    waterVolMm: '18-22 mm'
  },
  {
    id: 'pepper',
    name: 'Pepper / Capsicum / Chilli',
    gujaratiName: 'મરચાં / કેપ્સિકમ',
    icon: '🌶️',
    wateringIntervalDays: 3,
    inspectionIntervalDays: 4,
    pruningIntervalDays: 14,
    fertilizingIntervalDays: 14,
    stages: [
      { name: 'Seedling', gujaratiName: 'ધરૂ / રોપા', minDays: 0, maxDays: 25 },
      { name: 'Branching & Canopy', gujaratiName: 'શાખાઓનો વિકાસ', minDays: 26, maxDays: 50 },
      { name: 'Budding & Fruit Set', gujaratiName: 'ફૂલ અને ફળ ધારણ', minDays: 51, maxDays: 85 },
      { name: 'Harvesting', gujaratiName: 'ફળ તોડણી', minDays: 86, maxDays: 140 }
    ],
    pruningTip: 'Pinch top node at 20cm height to stimulate lateral branching and higher fruit yield.',
    pruningTipGu: 'છોડ ૨૦ સેમી ઊંચો થાય ત્યારે ટોચ ચૂંટો જેથી વધુ શાખાઓ ફૂટે અને ઉત્પાદન વધે.',
    inspectionTip: 'Check new shoot tips for thrips curl, mite webbing, and bacterial spot lesions.',
    inspectionTipGu: 'થ્રિપ્સથી પાન વળી જવા (કોકડવા) અને બેક્ટેરિયલ ડાઘ માટે નવી કૂંપળો તપાસો.',
    waterVolMm: '12-16 mm'
  },
  {
    id: 'eggplant',
    name: 'Eggplant / Brinjal',
    gujaratiName: 'રીંગણ',
    icon: '🍆',
    wateringIntervalDays: 2,
    inspectionIntervalDays: 4,
    pruningIntervalDays: 12,
    fertilizingIntervalDays: 14,
    stages: [
      { name: 'Seedling', gujaratiName: 'ધરૂ / રોપા', minDays: 0, maxDays: 25 },
      { name: 'Vegetative Growth', gujaratiName: 'વાનસ્પતિક વૃદ્ધિ', minDays: 26, maxDays: 50 },
      { name: 'Flowering & Fruiting', gujaratiName: 'ફૂલ અને ફળ', minDays: 51, maxDays: 95 },
      { name: 'Harvesting Cycle', gujaratiName: 'ઉતાર ચક્ર', minDays: 96, maxDays: 150 }
    ],
    pruningTip: 'Remove suckers below the first flower cluster to direct energy into primary fruit set.',
    pruningTipGu: 'પ્રથમ ફૂલ ઝૂમખા નીચેની વધારાની શાખાઓ કાપો જેથી મુખ્ય ફળોનો સારો વિકાસ થાય.',
    inspectionTip: 'Inspect shoots for shoot and fruit borer bore-holes and phomopsis blight spots.',
    inspectionTipGu: 'ડૂંખ અને ફળ કોરી ખાનાર ઈયળ તથા પાનના ડાઘા માટે નિયમિત તપાસ કરો.',
    waterVolMm: '16-20 mm'
  },
  {
    id: 'rose',
    name: 'Rose',
    gujaratiName: 'ગુલાબ',
    icon: '🌹',
    wateringIntervalDays: 3,
    inspectionIntervalDays: 5,
    pruningIntervalDays: 14,
    fertilizingIntervalDays: 21,
    stages: [
      { name: 'New Spurt', gujaratiName: 'નવી ફૂટ', minDays: 0, maxDays: 20 },
      { name: 'Bud Formation', gujaratiName: 'કળી નિર્માણ', minDays: 21, maxDays: 40 },
      { name: 'Full Bloom', gujaratiName: 'સંપૂર્ણ ખીલવું', minDays: 41, maxDays: 70 },
      { name: 'Rest / Maintenance', gujaratiName: 'વિશ્રામ / જાળવણી', minDays: 71, maxDays: 180 }
    ],
    pruningTip: 'Deadhead spent flowers at a 45-degree angle above a 5-leaflet outward-facing node.',
    pruningTipGu: 'કરમાઈ ગયેલા ફૂલને પાંચ પાંદડાવાળી ગાંઠની સહેજ ઉપર ૪૫ અંશના ખૂણેથી કાપો.',
    inspectionTip: 'Check leaves for circular Black Spot fungal rings and powdery white mildew.',
    inspectionTipGu: 'કાળા ગોળ ડાઘા (Black Spot) અને છારી (Powdery Mildew) માટે પાંદડાં જુઓ.',
    waterVolMm: '14-18 mm'
  },
  {
    id: 'tulsi',
    name: 'Tulsi / Holy Basil',
    gujaratiName: 'તુલસી',
    icon: '🌿',
    wateringIntervalDays: 2,
    inspectionIntervalDays: 6,
    pruningIntervalDays: 10,
    fertilizingIntervalDays: 28,
    stages: [
      { name: 'Seedling', gujaratiName: 'ધરૂ / રોપો', minDays: 0, maxDays: 25 },
      { name: 'Bushy Foliage', gujaratiName: 'ઘાટી પર્ણસમૃદ્ધિ', minDays: 26, maxDays: 60 },
      { name: 'Flowering Spikes', gujaratiName: 'મંજરી આવવી', minDays: 61, maxDays: 120 },
      { name: 'Perennial Maintenance', gujaratiName: 'કાયમી જાળવણી', minDays: 121, maxDays: 365 }
    ],
    pruningTip: 'Pinch off seed spikes (manjari) regularly to maintain leafy vigour and prevent woody stem aging.',
    pruningTipGu: 'છોડને ઘટાદાર અને લીલોછમ રાખવા નિયમિતપણે મંજરી ચૂંટી લો.',
    inspectionTip: 'Check for leaf spot fungus and tiny spider mites during dry periods.',
    inspectionTipGu: 'સૂકા વાતાવરણમાં પાનના ડાઘા અને ઝીણી કરોળિયા જીવાત માટે તપાસ કરો.',
    waterVolMm: '10-14 mm'
  },
  {
    id: 'cotton',
    name: 'Cotton',
    gujaratiName: 'કપાસ',
    icon: '🌱',
    wateringIntervalDays: 4,
    inspectionIntervalDays: 4,
    pruningIntervalDays: 15,
    fertilizingIntervalDays: 20,
    stages: [
      { name: 'Emergence & Seedling', gujaratiName: 'ઉગાવો અને ધરૂ', minDays: 0, maxDays: 30 },
      { name: 'Squaring (Buds)', gujaratiName: 'ચાપવા (કળી)', minDays: 31, maxDays: 60 },
      { name: 'Flowering & Boll Set', gujaratiName: 'ફૂલ અને જીંડવા', minDays: 61, maxDays: 110 },
      { name: 'Boll Opening & Harvest', gujaratiName: 'જીંડવા ખીલવા અને વીણી', minDays: 111, maxDays: 170 }
    ],
    pruningTip: 'Detop tall apical shoots at 120 days to channel assimilates into boll development.',
    pruningTipGu: '૧૨૦ દિવસે કપાસની મુખ્ય ટોચ કાપો જેથી પોષક તત્વો જીંડવાના વિકાસમાં વપરાય.',
    inspectionTip: 'Scout 20 plants across the field for pink bollworm rosette flowers and sucking pests.',
    inspectionTipGu: 'ગુલાબી ઈયળથી બંધાયેલ ફૂલ અને ચુસિયા જીવાતો માટે ખેતરમાં નિયમિત ફેરો મારો.',
    waterVolMm: '25-35 mm'
  },
  {
    id: 'wheat',
    name: 'Wheat',
    gujaratiName: 'ઘઉં',
    icon: '🌾',
    wateringIntervalDays: 6,
    inspectionIntervalDays: 6,
    pruningIntervalDays: 25,
    fertilizingIntervalDays: 25,
    stages: [
      { name: 'Crown Root Initiation (CRI)', gujaratiName: 'મૂળ ફૂટવા (CRI)', minDays: 0, maxDays: 25 },
      { name: 'Tillering & Jointing', gujaratiName: 'ફૂટ અને ગાંઠો', minDays: 26, maxDays: 55 },
      { name: 'Heading & Flowering', gujaratiName: 'ડુંડી અને ફૂલ', minDays: 56, maxDays: 85 },
      { name: 'Grain Filling & Dough Stage', gujaratiName: 'દૂધિયા દાણા અને પાકવું', minDays: 86, maxDays: 125 }
    ],
    pruningTip: 'Maintain weed-free boundaries; rogue out any off-type or diseased plants.',
    pruningTipGu: 'શેઢા-પાળા નીંદણમુક્ત રાખો; રોગિષ્ઠ કે વિજાતીય છોડ ખેતરમાંથી દૂર કરો.',
    inspectionTip: 'Inspect lower stems and flag leaves for yellow stripe rust and aphid colonies.',
    inspectionTipGu: 'ઘઉંના ગેરુ (Yellow Rust) અને મોલોમશી માટે ફ્લેગ પાંદડા તપાસો.',
    waterVolMm: '40-50 mm'
  },
  {
    id: 'custom',
    name: 'General Plant / Other Crop',
    gujaratiName: 'સામાન્ય છોડ / અન્ય પાક',
    icon: '🪴',
    wateringIntervalDays: 3,
    inspectionIntervalDays: 5,
    pruningIntervalDays: 14,
    fertilizingIntervalDays: 21,
    stages: [
      { name: 'Establishment', gujaratiName: 'સ્થાપના તબક્કો', minDays: 0, maxDays: 25 },
      { name: 'Active Growth', gujaratiName: 'સક્રિય વૃદ્ધિ', minDays: 26, maxDays: 60 },
      { name: 'Maturity / Production', gujaratiName: 'પરિપક્વતા / ઉત્પાદન', minDays: 61, maxDays: 120 },
      { name: 'Maintenance', gujaratiName: 'સામાન્ય જાળવણી', minDays: 121, maxDays: 365 }
    ],
    pruningTip: 'Remove dead, diseased, or overlapping stems to maintain good canopy airflow.',
    pruningTipGu: 'હવાના પરિભ્રમણ માટે સુકાઈ ગયેલી કે રોગિષ્ઠ ડાળીઓ સમયસર કાપી લો.',
    inspectionTip: 'Inspect foliage for unusual discoloration, spotting, or insect damage.',
    inspectionTipGu: 'પાંદડા પર કોઈ અસામાન્ય ડાઘા કે જીવાતના નુકસાન માટે તપાસ કરો.',
    waterVolMm: '15-20 mm'
  }
]

// Determine growth stage based on species and age
export function calculatePlantAgeAndStage(plantingDate, speciesId = 'custom', language = 'english') {
  const isGu = language === 'gujarati'
  if (!plantingDate) {
    return {
      ageDays: 0,
      stageName: isGu ? 'વૃદ્ધિ તબક્કો' : 'Active Growth',
      stageIndex: 1,
      totalStages: 4,
      progressPercent: 25
    }
  }

  const planted = new Date(plantingDate)
  const now = new Date()
  const diffTime = Math.max(0, now - planted)
  const ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  const preset = PLANT_SPECIES_PRESETS.find(p => p.id === speciesId) || PLANT_SPECIES_PRESETS[PLANT_SPECIES_PRESETS.length - 1]
  const stages = preset.stages || []

  let matchedStage = stages[0]
  let stageIndex = 0

  for (let i = 0; i < stages.length; i++) {
    if (ageDays >= stages[i].minDays && ageDays <= stages[i].maxDays) {
      matchedStage = stages[i]
      stageIndex = i
      break
    }
    if (i === stages.length - 1 && ageDays > stages[i].maxDays) {
      matchedStage = stages[i]
      stageIndex = i
    }
  }

  const stageName = isGu ? (matchedStage.gujaratiName || matchedStage.name) : matchedStage.name
  const progressPercent = Math.min(100, Math.round(((stageIndex + 1) / Math.max(stages.length, 1)) * 100))

  return {
    ageDays,
    stageName,
    stageIndex,
    totalStages: stages.length,
    progressPercent
  }
}

// Compute weather-adjusted cadence and advisory
export function calculateWeatherAdjustments(weatherData, soilData, locationType = 'outdoor') {
  const isIndoor = locationType === 'indoor'
  const temp = Number(weatherData?.temperature ?? 28)
  const humidity = Number(weatherData?.humidity ?? 55)
  const rainfall = Number(weatherData?.rainfall ?? 0)
  const desc = String(weatherData?.description || '').toLowerCase()
  const isRaining = !isIndoor && (rainfall > 1 || desc.includes('rain') || desc.includes('drizzle') || desc.includes('shower'))
  
  // Soil moisture
  let soilMoisturePercent = 45
  if (soilData?.moisture) {
    const raw = String(soilData.moisture).replace('%', '').trim()
    const parsed = parseFloat(raw)
    if (!isNaN(parsed)) soilMoisturePercent = parsed
  }

  // Adjustments
  let wateringIntervalDelta = 0
  let wateringVolumeMultiplier = 1.0
  let isWateringDeferredToday = false
  let weatherAlerts = []

  if (isRaining) {
    isWateringDeferredToday = true
    wateringIntervalDelta += 1
    weatherAlerts.push({
      type: 'rain',
      level: 'info',
      titleEn: 'Rain Delay Advisory',
      titleGu: 'વરસાદને લીધે સિંચાઈ મુલતવી',
      descEn: `Natural precipitation detected (${rainfall > 0 ? rainfall + ' mm' : 'rainy condition'}). Outdoor irrigation is deferred today to conserve water and prevent root rot.`,
      descGu: `કુદરતી વરસાદ નોંધાયેલ છે (${rainfall > 0 ? rainfall + ' મીમી' : 'વરસાદી હવામાન'}). પાણીની બચત અને મૂળિયાના સડાથી બચવા માટે આજની સિંચાઈ મુલતવી રાખો.`
    })
  } else if (!isIndoor && temp > 34 && humidity < 40) {
    wateringIntervalDelta -= 1 // water sooner
    wateringVolumeMultiplier = 1.25
    weatherAlerts.push({
      type: 'heat',
      level: 'warning',
      titleEn: 'Heatwave Hydration Alert',
      titleGu: 'સખત ગરમી અને બાષ્પીભવન ચેતવણી',
      descEn: `High ambient temperature (${temp}°C) and dry air. Inspect moisture levels closely and irrigate early morning before peak sun.`,
      descGu: `વધારે તાપમાન (${temp}°C) અને શુષ્ક હવા. સવારે વહેલા સિંચાઈ કરો જેથી બાષ્પીભવન ઓછું થાય.`
    })
  }

  // High humidity fungal precaution
  if (humidity > 80 && temp > 22) {
    weatherAlerts.push({
      type: 'fungal_risk',
      level: 'warning',
      titleEn: 'High Fungal Spore Risk',
      titleGu: 'ફૂગજન્ય રોગનું ઊંચું જોખમ',
      descEn: `Relative humidity is elevated at ${humidity}%. Scout foliage closely for early blight, mildew, and rust spores. Do NOT overhead water.`,
      descGu: `હવામાં ભેજનું પ્રમાણ ${humidity}% જેટલું વધારે છે. પાન પર બ્લાઇટ, છારી કે ગેરુના ડાઘા માટે તપાસ કરો. પાંદડા ભીના ન થાય તેની કાળજી રાખો.`
    })
  }

  // Soil saturation alert
  if (!isIndoor && soilMoisturePercent >= 65) {
    weatherAlerts.push({
      type: 'soil_saturated',
      level: 'info',
      titleEn: 'High Soil Moisture Buffer',
      titleGu: 'માટીમાં પૂરતો ભેજ સંગ્રહ',
      descEn: `SoilHive records ${soilMoisturePercent}% soil moisture. Soil is well-buffered; delay irrigation until top 3 cm dries.`,
      descGu: `SoilHive મુજબ માટીમાં ${soilMoisturePercent}% ભેજ સંગ્રહાયેલ છે. માટી સુકાઈ ન જાય ત્યાં સુધી વધુ પાણી આપવાનું ટાળો.`
    })
  }

  return {
    wateringIntervalDelta,
    wateringVolumeMultiplier,
    isWateringDeferredToday,
    soilMoisturePercent,
    weatherAlerts
  }
}

// Generate Personalized Tasks for a given plant
export function generateTasksForPlant(plant, weatherData, soilData, language = 'english') {
  const isGu = language === 'gujarati'
  const preset = PLANT_SPECIES_PRESETS.find(p => p.id === plant.speciesId) || PLANT_SPECIES_PRESETS[PLANT_SPECIES_PRESETS.length - 1]
  const weatherAdj = calculateWeatherAdjustments(weatherData, soilData, plant.location)
  const ageAndStage = calculatePlantAgeAndStage(plant.plantingDate, plant.speciesId, language)

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const parseDaysSince = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    const diff = now - d
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
  }

  // Calculate base effective intervals
  const effectiveWaterInterval = Math.max(1, (preset.wateringIntervalDays || 3) + weatherAdj.wateringIntervalDelta)
  const effectiveInspectInterval = preset.inspectionIntervalDays || 4
  const effectivePruneInterval = preset.pruningIntervalDays || 14
  const effectiveFertilizeInterval = preset.fertilizingIntervalDays || 21

  const daysSinceWatered = parseDaysSince(plant.lastWatered)
  const daysSinceInspected = parseDaysSince(plant.lastInspected)
  const daysSincePruned = parseDaysSince(plant.lastPruned)
  const daysSinceFertilized = parseDaysSince(plant.lastFertilized)

  const tasks = []

  // 1. WATERING TASK
  {
    const isCompletedToday = plant.lastWatered && plant.lastWatered.startsWith(todayStr)
    let status = 'upcoming'
    let daysOverdue = 0

    if (isCompletedToday) {
      status = 'completed_today'
    } else if (daysSinceWatered === null) {
      status = 'due_today'
      daysOverdue = 0
    } else if (daysSinceWatered > effectiveWaterInterval) {
      status = 'overdue'
      daysOverdue = daysSinceWatered - effectiveWaterInterval
    } else if (daysSinceWatered === effectiveWaterInterval) {
      status = 'due_today'
    }

    const dueInDays = daysSinceWatered === null ? 0 : Math.max(0, effectiveWaterInterval - daysSinceWatered)
    const dueDate = new Date(now)
    dueDate.setDate(dueDate.getDate() + (status === 'overdue' ? 0 : dueInDays))

    let reminderText = isGu
      ? `પદ્ધતિ: મૂળ પાસે ડ્રિપ દ્વારા ${preset.waterVolMm || '15 mm'} આપો. પાંદડા સૂકા રાખો.`
      : `Method: Base irrigation with target ${preset.waterVolMm || '15 mm'}. Keep foliage dry.`

    if (daysSinceWatered === null) {
      reminderText = isGu
        ? 'સિંચાઈનો ઇતિહાસ નોંધાયેલ નથી: માટીની ભેજ તપાસીને જરૂર મુજબ પ્રથમ સિંચાઈ કરો.'
        : 'No prior watering recorded. Check soil moisture and initiate baseline hydration.'
    } else if (weatherAdj.isWateringDeferredToday && (status === 'due_today' || status === 'overdue')) {
      reminderText = isGu
        ? '🌧️ વરસાદી વાતાવરણ: કુદરતી ભેજ પર્યાપ્ત છે. આજની સિંચાઈ મુલતવી રાખવાની ભલામણ.'
        : '🌧️ Rain Alert: Natural precipitation sufficient today. Watering deferred.'
    }

    // Disease pathology constraint on watering
    if (plant.activeDisease && plant.activeDisease.toLowerCase().includes('blight')) {
      reminderText += isGu
        ? ' (સાવચેતી: અર્લી બ્લાઇટ છે, ઉપરથી પાણી બિલકુલ ન છાંટવું)'
        : ' (Pathology: Active Blight infection - strictly no overhead watering)'
    }

    tasks.push({
      id: `${plant.id}_water`,
      plantId: plant.id,
      plantName: plant.name,
      plantIcon: preset.icon,
      type: 'water',
      typeLabel: isGu ? 'સિંચાઈ / પાણી' : 'Watering',
      title: isGu ? `${plant.name} ને પાણી આપો` : `Irrigate ${plant.name}`,
      status,
      daysOverdue,
      dueInDays: status === 'overdue' ? 0 : dueInDays,
      dueDateFormatted: dueDate.toLocaleDateString(isGu ? 'gu-IN' : 'en-US', { month: 'short', day: 'numeric' }),
      reminder: reminderText,
      urgency: status === 'overdue' ? 'high' : status === 'due_today' ? 'medium' : 'normal',
      weatherDeferred: weatherAdj.isWateringDeferredToday,
      stageContext: ageAndStage.stageName
    })
  }

  // 2. INSPECTION TASK
  {
    const isCompletedToday = plant.lastInspected && plant.lastInspected.startsWith(todayStr)
    let status = 'upcoming'
    let daysOverdue = 0

    if (isCompletedToday) {
      status = 'completed_today'
    } else if (daysSinceInspected === null) {
      status = 'due_today'
      daysOverdue = 0
    } else if (daysSinceInspected > effectiveInspectInterval) {
      status = 'overdue'
      daysOverdue = daysSinceInspected - effectiveInspectInterval
    } else if (daysSinceInspected === effectiveInspectInterval) {
      status = 'due_today'
    }

    const dueInDays = daysSinceInspected === null ? 0 : Math.max(0, effectiveInspectInterval - daysSinceInspected)
    const dueDate = new Date(now)
    dueDate.setDate(dueDate.getDate() + (status === 'overdue' ? 0 : dueInDays))

    const reminderText = isGu
      ? (preset.inspectionTipGu || 'પાંદડાના તળિયે અને નવી કૂંપળો પર જીવાત માટે તપાસ કરો.')
      : (preset.inspectionTip || 'Inspect leaf undersides and apical growth for pest/disease symptoms.')

    tasks.push({
      id: `${plant.id}_inspect`,
      plantId: plant.id,
      plantName: plant.name,
      plantIcon: preset.icon,
      type: 'inspect',
      typeLabel: isGu ? 'નિરીક્ષણ / રોગ તપાસ' : 'Health Inspection',
      title: isGu ? `${plant.name} નું નિરીક્ષણ કરો` : `Inspect ${plant.name}`,
      status,
      daysOverdue,
      dueInDays: status === 'overdue' ? 0 : dueInDays,
      dueDateFormatted: dueDate.toLocaleDateString(isGu ? 'gu-IN' : 'en-US', { month: 'short', day: 'numeric' }),
      reminder: reminderText,
      urgency: plant.activeDisease ? 'high' : status === 'overdue' ? 'high' : 'normal',
      stageContext: ageAndStage.stageName
    })
  }

  // 3. PRUNING TASK (Skip for seedlings or non-prunable stages)
  if (ageAndStage.ageDays > 20) {
    const isCompletedToday = plant.lastPruned && plant.lastPruned.startsWith(todayStr)
    let status = 'upcoming'
    let daysOverdue = 0

    if (isCompletedToday) {
      status = 'completed_today'
    } else if (daysSincePruned === null) {
      status = 'upcoming'
      daysOverdue = 0
    } else if (daysSincePruned > effectivePruneInterval) {
      status = 'overdue'
      daysOverdue = daysSincePruned - effectivePruneInterval
    } else if (daysSincePruned === effectivePruneInterval) {
      status = 'due_today'
    }

    const dueInDays = daysSincePruned === null ? effectivePruneInterval : Math.max(0, effectivePruneInterval - daysSincePruned)
    const dueDate = new Date(now)
    dueDate.setDate(dueDate.getDate() + (status === 'overdue' ? 0 : dueInDays))

    const reminderText = isGu
      ? (preset.pruningTipGu || 'પીળા કે સુકાયેલા પાન દૂર કરો જેથી છોડને પૂરતો સૂર્યપ્રકાશ મળે.')
      : (preset.pruningTip || 'Remove yellow foliage and lateral suckers to optimize canopy airflow.')

    tasks.push({
      id: `${plant.id}_prune`,
      plantId: plant.id,
      plantName: plant.name,
      plantIcon: preset.icon,
      type: 'prune',
      typeLabel: isGu ? 'છાંટણી / સફાઈ' : 'Pruning & Trimming',
      title: isGu ? `${plant.name} ની છાંટણી કરો` : `Prune ${plant.name}`,
      status,
      daysOverdue,
      dueInDays: status === 'overdue' ? 0 : dueInDays,
      dueDateFormatted: dueDate.toLocaleDateString(isGu ? 'gu-IN' : 'en-US', { month: 'short', day: 'numeric' }),
      reminder: reminderText,
      urgency: status === 'overdue' ? 'medium' : 'normal',
      stageContext: ageAndStage.stageName
    })
  }

  // 4. FERTILIZING / NUTRITION TASK
  {
    const isCompletedToday = plant.lastFertilized && plant.lastFertilized.startsWith(todayStr)
    let status = 'upcoming'
    let daysOverdue = 0

    if (isCompletedToday) {
      status = 'completed_today'
    } else if (daysSinceFertilized === null) {
      status = 'upcoming'
      daysOverdue = 0
    } else if (daysSinceFertilized > effectiveFertilizeInterval) {
      status = 'overdue'
      daysOverdue = daysSinceFertilized - effectiveFertilizeInterval
    } else if (daysSinceFertilized === effectiveFertilizeInterval) {
      status = 'due_today'
    }

    const dueInDays = daysSinceFertilized === null ? effectiveFertilizeInterval : Math.max(0, effectiveFertilizeInterval - daysSinceFertilized)
    const dueDate = new Date(now)
    dueDate.setDate(dueDate.getDate() + (status === 'overdue' ? 0 : dueInDays))

    const reminderText = isGu
      ? `તબક્કો: ${ageAndStage.stageName}. સેન્દ્રિય ખાતર અથવા પોષક દ્રાવણ આપો.`
      : `Stage: ${ageAndStage.stageName}. Apply balanced organic compost or micronutrient foliar spray.`

    tasks.push({
      id: `${plant.id}_fertilize`,
      plantId: plant.id,
      plantName: plant.name,
      plantIcon: preset.id,
      type: 'fertilize',
      typeLabel: isGu ? 'ખાતર / પોષણ' : 'Nutrition & Fertilizer',
      title: isGu ? `${plant.name} ને ખાતર આપો` : `Feed ${plant.name}`,
      status,
      daysOverdue,
      dueInDays: status === 'overdue' ? 0 : dueInDays,
      dueDateFormatted: dueDate.toLocaleDateString(isGu ? 'gu-IN' : 'en-US', { month: 'short', day: 'numeric' }),
      reminder: reminderText,
      urgency: status === 'overdue' ? 'medium' : 'normal',
      stageContext: ageAndStage.stageName
    })
  }

  // 5. TREATMENT PROTOCOL TASKS (Reflects the exact treatment schedule from plant scanning)
  const completedSteps = Array.isArray(plant.completedTreatmentSteps) ? plant.completedTreatmentSteps : []
  const daysSinceScanned = plant.scannedAt ? parseDaysSince(plant.scannedAt) : 0

  if (Array.isArray(plant.treatmentSchedule) && plant.treatmentSchedule.length > 0) {
    plant.treatmentSchedule.forEach((step, idx) => {
      const stepId = `${plant.id}_treatment_${idx}`
      const isCompleted = completedSteps.includes(stepId)

      let offsetDays = 0
      const rawTiming = String(step.day || step.week || '').toLowerCase()
      if (rawTiming.includes('1') || rawTiming.includes('immediate')) offsetDays = 0
      else if (rawTiming.includes('2')) offsetDays = 1
      else if (rawTiming.includes('3') || rawTiming.includes('4')) offsetDays = 3
      else if (rawTiming.includes('5') || rawTiming.includes('6') || rawTiming.includes('7') || rawTiming.includes('week 1')) offsetDays = 6
      else if (rawTiming.includes('week 2')) offsetDays = 14
      else if (rawTiming.includes('week 3')) offsetDays = 21
      else offsetDays = (idx + 1) * 3

      let status = 'upcoming'
      let daysOverdue = 0

      if (isCompleted) {
        status = 'completed_today'
      } else if (daysSinceScanned > offsetDays + 1) {
        status = 'overdue'
        daysOverdue = daysSinceScanned - offsetDays
      } else if (daysSinceScanned >= offsetDays) {
        status = 'due_today'
      }

      const dueInDays = Math.max(0, offsetDays - daysSinceScanned)
      const dueDate = new Date(now)
      dueDate.setDate(dueDate.getDate() + (status === 'overdue' ? 0 : dueInDays))

      const stepAction = step.action || (Array.isArray(step.actions) ? step.actions.join('; ') : '') || 'Treatment application'

      tasks.push({
        id: stepId,
        plantId: plant.id,
        plantName: plant.name,
        type: 'treatment',
        typeLabel: isGu ? 'રોગ સારવાર' : 'Treatment Step',
        title: `${plant.name}: ${stepAction}`,
        actionDescription: stepAction,
        timeframe: step.day || step.week || (isGu ? 'તાત્કાલિક' : 'Immediate'),
        notes: step.notes || '',
        status,
        daysOverdue,
        dueInDays: status === 'overdue' ? 0 : dueInDays,
        dueDateFormatted: dueDate.toLocaleDateString(isGu ? 'gu-IN' : 'en-US', { month: 'short', day: 'numeric' }),
        reminder: isGu
          ? `રોગ: ${plant.activeDisease || 'અજ્ઞાત'}. સમય: ${step.day || step.week || 'તાત્કાલિક'}. સૂચના: ${stepAction}${step.notes ? ` (${step.notes})` : ''}`
          : `Pathology: ${plant.activeDisease || 'Active'}. Window: ${step.day || step.week || 'Immediate'}. Directive: ${stepAction}${step.notes ? ` (${step.notes})` : ''}`,
        urgency: status === 'overdue' ? 'high' : 'high',
        isTreatment: true,
        diseaseName: plant.activeDisease
      })
    })
  } else if (Array.isArray(plant.remedies) && plant.remedies.length > 0 && plant.activeDisease) {
    plant.remedies.forEach((remedy, idx) => {
      const stepId = `${plant.id}_remedy_${idx}`
      const isCompleted = completedSteps.includes(stepId)

      let offsetDays = idx * 2
      const rawTf = String(remedy.timeframe || '').toLowerCase()
      if (rawTf.includes('immediate') || rawTf.includes('24')) offsetDays = 0

      let status = 'upcoming'
      let daysOverdue = 0

      if (isCompleted) {
        status = 'completed_today'
      } else if (daysSinceScanned > offsetDays + 1) {
        status = 'overdue'
        daysOverdue = daysSinceScanned - offsetDays
      } else if (daysSinceScanned >= offsetDays) {
        status = 'due_today'
      }

      const dueInDays = Math.max(0, offsetDays - daysSinceScanned)
      const dueDate = new Date(now)
      dueDate.setDate(dueDate.getDate() + (status === 'overdue' ? 0 : dueInDays))

      tasks.push({
        id: stepId,
        plantId: plant.id,
        plantName: plant.name,
        type: 'treatment',
        typeLabel: isGu ? 'રોગ સારવાર' : 'Treatment Step',
        title: `${plant.name}: ${remedy.action}`,
        actionDescription: remedy.action,
        timeframe: remedy.timeframe || (isGu ? 'તાત્કાલિક' : 'Immediate'),
        effectiveness: remedy.effectiveness,
        status,
        daysOverdue,
        dueInDays: status === 'overdue' ? 0 : dueInDays,
        dueDateFormatted: dueDate.toLocaleDateString(isGu ? 'gu-IN' : 'en-US', { month: 'short', day: 'numeric' }),
        reminder: isGu
          ? `અસરકારકતા: ${remedy.effectiveness || 85}%. ${remedy.action} (${remedy.timeframe || 'તાત્કાલિક'})`
          : `Effectiveness: ${remedy.effectiveness || 85}%. ${remedy.action} (${remedy.timeframe || 'Immediate'})`,
        urgency: 'high',
        isTreatment: true,
        diseaseName: plant.activeDisease
      })
    })
  }

  return tasks
}

// Starter seed plants for new users
export function getInitialSeedPlants() {
  const today = new Date()
  
  const formatDateOffset = (daysAgo) => {
    const d = new Date(today)
    d.setDate(d.getDate() - daysAgo)
    return d.toISOString().split('T')[0]
  }

  return [
    {
      id: 'plant_tomato_terrace',
      name: 'Terrace Tomato',
      speciesId: 'tomato',
      speciesName: 'Tomato',
      location: 'balcony',
      locationLabel: 'Balcony / Pots',
      plantingDate: formatDateOffset(38), // Vegetative / Flowering
      lastWatered: formatDateOffset(3),   // Overdue! (Interval is 2 days)
      lastInspected: formatDateOffset(2),
      lastPruned: formatDateOffset(12),
      lastFertilized: formatDateOffset(10),
      healthStatus: 'recovering',
      activeDisease: 'Early Blight',
      notes: 'Recovering nicely from early blight after copper spray; keep foliage completely dry during watering.'
    },
    {
      id: 'plant_pepper_garden',
      name: 'Front Yard Bell Pepper',
      speciesId: 'pepper',
      speciesName: 'Pepper / Capsicum',
      location: 'outdoor',
      locationLabel: 'Garden Bed',
      plantingDate: formatDateOffset(52), // Flowering & Fruit Set
      lastWatered: formatDateOffset(1),   // Due in 2 days
      lastInspected: formatDateOffset(5), // Overdue for inspection
      lastPruned: formatDateOffset(14),   // Due today
      lastFertilized: formatDateOffset(12),
      healthStatus: 'healthy',
      activeDisease: null,
      notes: 'Heavy flowering stage. Requires steady moisture and potassium boost.'
    },
    {
      id: 'plant_tulsi_court',
      name: 'Courtyard Holy Basil',
      speciesId: 'tulsi',
      speciesName: 'Tulsi',
      location: 'outdoor',
      locationLabel: 'Courtyard Pot',
      plantingDate: formatDateOffset(90),
      lastWatered: formatDateOffset(2),   // Due today
      lastInspected: formatDateOffset(4),
      lastPruned: formatDateOffset(8),
      lastFertilized: formatDateOffset(25),
      healthStatus: 'healthy',
      activeDisease: null,
      notes: 'Pinch seed heads regularly to encourage bushy foliage.'
    }
  ]
}
