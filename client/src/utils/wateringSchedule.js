/**
 * Adaptive Watering Schedule Engine
 * Calculates precision irrigation plans based on real-time weather metrics,
 * SoilHive soil properties (moisture, texture, pH), and diagnosed plant pathology.
 */

export function calculateWateringSchedule(weatherData, soilData, plantDiagnosis, language = 'english') {
  // Normalize Weather inputs
  const temp = Number(weatherData?.temperature ?? 28)
  const humidity = Number(weatherData?.humidity ?? 60)
  const rainfall = Number(weatherData?.rainfall ?? 0)
  const windSpeed = Number(weatherData?.windSpeed ?? 12)
  const condition = weatherData?.description || 'Normal'

  // Normalize Soil inputs
  const moistureRaw = soilData?.moisture ?? '45%'
  const moisture = Number(String(moistureRaw).replace('%', '').trim()) || 45
  const texture = String(soilData?.texture || 'Clay Loam').toLowerCase()
  const ph = Number(soilData?.ph ?? 6.8)

  // Normalize Plant Diagnosis
  const disease = String(plantDiagnosis?.disease || '').toLowerCase()
  const plantName = plantDiagnosis?.plant_name || plantDiagnosis?.plant || ''
  const severity = String(plantDiagnosis?.severity || '').toLowerCase()
  const isIndoor = String(plantDiagnosis?.location || '').toLowerCase() === 'indoor'

  const isFungal = disease.includes('mildew') || disease.includes('blight') || disease.includes('rust') ||
                   disease.includes('spot') || disease.includes('mold') || disease.includes('fung') || disease.includes('scab')
  const isRootRot = disease.includes('rot') || disease.includes('damping')
  const isBacterial = disease.includes('bacterial') || disease.includes('wilt')

  // Soil texture properties
  const isClay = texture.includes('clay')
  const isSand = texture.includes('sand')

  // Evaporative Demand Index (mm/day estimate)
  // Higher temp + lower humidity + higher wind = higher evapotranspiration
  const tempFactor = Math.max(0, temp - 15) * 0.18
  const humidityFactor = Math.max(0, 100 - humidity) * 0.04
  const windFactor = windSpeed * 0.05
  const etEstimate = Math.min(8.5, Math.max(1.8, Number((tempFactor + humidityFactor + windFactor).toFixed(1))))

  // Decide Today's Watering Advisory
  let todayAction = ''
  let todayStatus = 'optimal' // 'urgent' | 'optimal' | 'delay' | 'critical'
  let bestTime = ''
  let volume = ''
  let technique = ''
  let rationale = ''

  const isGu = language === 'gujarati'

  if (isRootRot) {
    todayStatus = 'critical'
    todayAction = isGu ? 'સિંચાઈ સંપૂર્ણપણે સ્થગિત કરો' : 'Halt All Watering Immediately'
    bestTime = isGu ? 'પાણી ન આપવું' : 'Do Not Irrigate'
    volume = '0 mm / 0 ml'
    technique = isGu ? 'મૂળના વિસ્તારને સૂકાવા દો' : 'Dry-down cycle: Aerate soil & let root zone dry'
    rationale = isGu
      ? `મૂળના સડા (Root Rot) ની સ્થિતિમાં વધારાનું પાણી નુકસાનકારક છે. માટી ઉપરથી 2-3 ઇંચ સંપૂર્ણપણે સૂકાય ત્યાં સુધી પાણી આપશો નહીં.`
      : `Root rot is aggravated by excess moisture. Current soil moisture (${moisture}%) requires a strict dry-down cycle before any water is applied.`
  } else if (rainfall >= 3 && !isIndoor) {
    todayStatus = 'delay'
    todayAction = isGu ? 'તાજેતરના વરસાદને કારણે પાણી મુલતવી રાખો' : 'Skip Watering (Recent Rain Sufficient)'
    bestTime = isGu ? '૨૪-૪૮ કલાક પછી ફરી ચકાસો' : 'Hold for 24-48 hours'
    volume = '0 mm'
    technique = isGu ? 'કુદરતી નિતાર જાળવો' : 'Monitor field drainage'
    rationale = isGu
      ? `તાજેતરમાં ${rainfall} mm વરસાદ થયો છે અને માટીમાં ભેજ ${moisture}% છે. વધુ પાણી આપવાથી મૂળ ગૂંગળાઈ શકે છે.`
      : `Recent outdoor rainfall (${rainfall} mm) combined with ${moisture}% soil moisture provides ample outdoor hydration. Postpone irrigation to prevent root asphyxiation.`
  } else if (moisture >= 62) {
    todayStatus = 'delay'
    todayAction = isGu ? 'માટી પૂરતી ભેજવાળી છે — સિંચાઈ મુલતવી રાખો' : 'Skip Watering (High Soil Moisture)'
    bestTime = isGu ? 'આવતીકાલે સવારે ચકાસો' : 'Recheck tomorrow morning'
    volume = '0 mm'
    technique = isGu ? 'માટીની સપાટીનું નિરીક્ષણ' : 'Surface aeration & drainage check'
    rationale = isGu
      ? `માટીમાં ભેજનું પ્રમાણ ${moisture}% છે, જે પર્યાપ્ત કરતાં વધુ છે. પાણી ભરાવાથી બચવા આજે સિંચાઈ ટાળો.`
      : `Soil moisture is elevated at ${moisture}%. Delay watering to let capillary water equilibrate and maintain soil oxygen levels.`
  } else if (moisture < 32) {
    todayStatus = 'urgent'
    todayAction = isGu ? 'ઊંડી સિંચાઈની તાત્કાલિક જરૂર છે' : 'Deep Root Watering Recommended'
    bestTime = isGu ? 'વહેલી સવારે ૦૬:૦૦ - ૦૭:૩૦' : 'Early Morning (06:00 - 07:30 AM)'
    volume = isClay ? '20-25 mm (~750ml - 1L / plant)' : '15-20 mm (~500 - 750ml / plant)'
    technique = isFungal
      ? (isGu ? 'માટીના થડ પાસે ડ્રીપથી આપો (પાંદડા ભીના ન કરવા)' : 'Basal / Drip line only (strictly keep leaves dry)')
      : (isGu ? 'ઊંડું પાણી સીધું મૂળ વિસ્તારમાં આપો' : 'Deep soak around drip line')
    rationale = isGu
      ? `માટીમાં ભેજ માત્ર ${moisture}% છે અને તાપમાન ${temp}°C છે. છોડ તણાવમાં ન આવે તે માટે સવારે ઊંડું પાણી આપો.`
      : `Soil moisture has dropped to ${moisture}% under ${temp}°C conditions. Apply deep root-zone irrigation early to replenish depletion without leaf scalding.`
  } else {
    // Moderate moisture (32% - 61%)
    if (temp >= 31 && humidity < 45) {
      todayStatus = 'optimal'
      todayAction = isGu ? 'ગરમીના લીધે હળવી સવારની સિંચાઈ કરો' : 'Light Morning Irrigation Recommended'
      bestTime = isGu ? 'સવારે ૦૬:૩૦ - ૦૮:૦૦' : 'Early Morning (06:30 - 08:00 AM)'
      volume = '12-15 mm (~400 - 600ml / plant)'
      technique = isFungal
        ? (isGu ? 'ફક્ત થડના મૂળિયાંમાં પાણી આપો' : 'Sub-surface / Root zone drip (zero foliage splash)')
        : (isGu ? 'સમતુલિત ડ્રીપ સિંચાઈ' : 'Steady ground-level soaking')
      rationale = isGu
        ? `તાપમાન ${temp}°C અને ભેજ ${humidity}% હોવાથી બાષ્પીભવન દર વધારે (${etEstimate} mm/દિવસ) છે. હળવી સિંચાઈ ફાયદાકારક રહેશે.`
        : `Warm temperature (${temp}°C) and low humidity (${humidity}%) increase evaporative demand (${etEstimate} mm/day). Light basal hydration will protect vigor.`
    } else {
      todayStatus = 'optimal'
      todayAction = isGu ? 'માટી સામાન્ય છે — નિયમિત દેખરેખ રાખો' : 'Optimal Moisture — Maintain Schedule'
      bestTime = isGu ? 'સવારે ૦૭:૦૦ - ૦૮:૩૦' : 'Morning (07:00 - 08:30 AM)'
      volume = '10-12 mm (~350 - 500ml / plant)'
      technique = isFungal
        ? (isGu ? 'પાંદડા સૂકા રહે તેવી ડ્રીપ સિસ્ટમ' : 'Drip irrigation, keep foliage dry')
        : (isGu ? 'નિયમિત સવારનું પાણી' : 'Standard root-zone watering')
      rationale = isGu
        ? `હાલની ભેજ (${moisture}%) અને વાતાવરણ સ્થિર છે. વધુ પડતું પાણી ન આપો, માત્ર જરૂરિયાત મુજબ આપો.`
        : `Soil moisture (${moisture}%) is well-buffered. Continue controlled root hydration; avoid over-saturation.`
    }
  }

  // Disease-specific irrigation precautions
  const diseaseRules = []
  if (isFungal) {
    diseaseRules.push(
      isGu
        ? 'ફંગલ રોગ (Fungal Infection): પાંદડાં કે ફૂલો પર ક્યારેય પાણી છાંટશો નહીં; પાણી માત્ર માટીના સ્તરે આપો જેથી ફૂગના બીજકણ ન ફેલાય.'
        : 'Fungal Precaution: Never overhead water or mist foliage. Water strictly at the soil base to deny spores the surface moisture needed to germinate.'
    )
    diseaseRules.push(
      isGu
        ? 'સાંજની સિંચાઈ ટાળો: રાત્રે પાંદડાં ભીના રહેવાથી ફંગસ બમણી ઝડપે ફેલાય છે.'
        : 'Timing Constraint: Avoid late evening watering. Prolonged nocturnal dampness accelerates spore multiplication.'
    )
  }
  if (isRootRot) {
    diseaseRules.push(
      isGu
        ? 'મૂળ સુરક્ષા: કૂંડા કે કયારીના નીચેના નિતાર કાણાં ખુલ્લા રાખો અને વધારાનું પાણી જમા ન થવા દો.'
        : 'Root Protection: Ensure free drainage from container holes; never allow the container to sit in pooled runoff.'
    )
  }
  if (isBacterial) {
    diseaseRules.push(
      isGu
        ? 'બેક્ટેરિયલ નિયંત્રણ: ધીમા દબાણે પાણી આપો જેથી માટીના છાંટા પાંદડાં પર ન ઉડે.'
        : 'Bacterial Shield: Apply water with low pressure directly into soil to prevent splash-back of contaminated soil particles.'
    )
  }
  if (!isFungal && !isRootRot && !isBacterial) {
    diseaseRules.push(
      isGu
        ? 'સંતુલિત સિંચાઈ: માટીની ઉપલી ૨ ઇંચ સપાટી સુકાય ત્યારે જ ફરીથી ઊંડું પાણી આપો.'
        : 'Balanced Regimen: Allow the top 2 inches of topsoil to dry moderately before the next deep watering cycle.'
    )
  }

  // Build 7-Day Plan
  // Frequency varies with Soil Texture & Evaporative Rate & Plant condition
  // Clay: water every 3-4 days
  // Loam: water every 2-3 days
  // Sand: water every 1-2 days
  const baseInterval = isSand ? 2 : isClay ? 4 : 3
  const adjustedInterval = isFungal || isRootRot ? baseInterval + 1 : baseInterval

  const sevenDaySchedule = []
  const now = new Date()

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(now)
    dayDate.setDate(now.getDate() + i)
    const dayName = i === 0
      ? (isGu ? 'આજે (દિવસ ૧)' : 'Today (Day 1)')
      : i === 1
        ? (isGu ? 'આવતીકાલે (દિવસ ૨)' : 'Tomorrow (Day 2)')
        : isGu
          ? `દિવસ ${i + 1}`
          : `Day ${i + 1}`

    const dateStr = dayDate.toLocaleDateString(isGu ? 'gu-IN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    let dayAction = ''
    let dayType = 'skip' // 'water' | 'skip' | 'check'
    let dayVolume = '--'
    let dayWindow = '--'
    let dayNote = ''

    if (i === 0) {
      if (todayStatus === 'urgent' || todayStatus === 'optimal') {
        dayAction = isGu ? 'પાણી આપો (ઊંડું)' : 'Water (Root Soak)'
        dayType = 'water'
        dayVolume = volume
        dayWindow = bestTime
        dayNote = isGu ? 'આજના નિર્ધારિત સમયગાળામાં આપો' : 'Execute at scheduled morning window'
      } else {
        dayAction = isGu ? 'વિરામ / સૂકવણી' : 'Rest / Aerate'
        dayType = 'skip'
        dayVolume = '0 mm'
        dayWindow = isGu ? 'સિંચાઈ મુલતવી' : 'Hold'
        dayNote = isGu ? 'માટીની સપાટી સૂકાવા દો' : 'Allow soil profile to drain & breathe'
      }
    } else {
      const isWaterDay = i % adjustedInterval === 0

      if (isRootRot && i < 3) {
        dayAction = isGu ? 'સંપૂર્ણ સૂકવણી' : 'Complete Dry-Down'
        dayType = 'skip'
        dayVolume = '0 mm'
        dayWindow = '--'
        dayNote = isGu ? 'મૂળના સડાને રોકવા માટી સૂકી રાખો' : 'Halt moisture to starve anaerobic pathogens'
      } else if (isWaterDay) {
        dayAction = isGu ? 'નિયમિત સિંચાઈ' : 'Scheduled Irrigation'
        dayType = 'water'
        dayVolume = isClay ? '18-22 mm' : isSand ? '12-15 mm' : '15-18 mm'
        dayWindow = isGu ? '૦૬:૩૦ - ૦૮:૦૦ AM' : '06:30 - 08:00 AM'
        dayNote = isFungal
          ? (isGu ? 'મૂળના સ્તરે આપો (પાંદડા સૂકા રાખો)' : 'Ground level only; keep foliage dry')
          : (isGu ? 'ઊંડા મૂળિયાં સુધી પહોંચે તેમ આપો' : 'Deep soak targeting full active root zone')
      } else if (i % adjustedInterval === 1) {
        dayAction = isGu ? 'ભેજ ચકાસણી' : 'Inspect Soil Moisture'
        dayType = 'check'
        dayVolume = '0 mm'
        dayWindow = isGu ? 'સવારે નિરીક્ષણ' : 'Morning check'
        dayNote = isGu ? 'આંગળી વડે ૨ ઇંચ ઊંડાઈએ ભેજ તપાસો' : 'Perform 2-inch finger/moisture probe check'
      } else {
        dayAction = isGu ? 'વિરામ ચક્ર' : 'Aeration Cycle'
        dayType = 'skip'
        dayVolume = '0 mm'
        dayWindow = '--'
        dayNote = isGu ? 'ઓક્સિજનનું પરિભ્રમણ જળવાય છે' : 'Root oxygenation & capillary equilibrium'
      }
    }

    sevenDaySchedule.push({
      dayIndex: i + 1,
      dayLabel: dayName,
      date: dateStr,
      action: dayAction,
      type: dayType,
      volume: dayVolume,
      timeWindow: dayWindow,
      note: dayNote
    })
  }

  return {
    today: {
      action: todayAction,
      status: todayStatus,
      bestTime,
      volume,
      technique,
      rationale,
      etRate: `${etEstimate} mm/day`,
      currentMoisture: `${moisture}%`,
      soilTexture: soilData?.texture || 'Clay Loam',
      soilPh: ph,
      temp: `${temp}°C`,
      humidity: `${humidity}%`,
      rainfall: `${rainfall} mm`,
      condition
    },
    plantContext: {
      plantName: plantName || (isGu ? 'સામાન્ય પાક' : 'General Crop'),
      disease: plantDiagnosis?.disease || (isGu ? 'સ્વસ્થ' : 'Healthy'),
      severity: severity || 'normal',
      isDiagnosed: Boolean(plantDiagnosis?.disease)
    },
    diseaseRules,
    sevenDaySchedule
  }
}
