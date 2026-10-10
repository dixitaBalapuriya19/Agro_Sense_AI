import { motion } from 'framer-motion' // eslint-disable-line no-unused-vars
import { t } from '../translations'
import { SunIcon, WaterIcon, EarthIcon, TemperatureIcon, NutritionIcon, BugIcon } from './SeasonalIcons'

const getBasicTips = (language) => [
  {
    category: language === 'gujarati' ? 'પ્રકાશ' : 'Lighting',
    Icon: SunIcon,
    tips: language === 'gujarati' ? [
      'છોડને દરરોજ 6-8 કલાક માટે તેજસ્વી, પરોક્ષ પ્રકાશમાં મૂકો',
      'બધી બાજુએ સમાન વૃદ્ધિ સુનિશ્ચિત કરવા માટે સાપ્તાહિક પોટ ફેરવો',
      'પાંદડાને બળીથી બચાવવા માટે છોડને સીધા કઠોર બપોરના સૂર્યથી દૂર રાખો',
      'ઓછા પ્રકાશ વિસ્તારો માટે, ગ્રો લાઇટ્સ અથવા ઓછા પ્રકાશ સહન કરતા છોડનો વિચાર કરો'
    ] : [
      'Place plants in bright, indirect light for 6-8 hours daily',
      'Rotate pots weekly to ensure even growth on all sides',
      'Keep plants away from direct harsh afternoon sun to prevent leaf burn',
      'For low-light areas, consider grow lights or low-light tolerant plants',
      'Track leaf color and internode length to detect light stress early and adjust placement'
    ]
  },
  {
    category: language === 'gujarati' ? 'પાણી આપવું' : 'Watering',
    Icon: WaterIcon,
    tips: language === 'gujarati' ? [
      'જ્યારે માટીનો ઉપરનો ઇંચ સૂકો લાગે ત્યારે પાણી આપો',
      'મૂળને આઘાત ટાળવા માટે ઓરડાના તાપમાનનું પાણી વાપરો',
      'જ્યાં સુધી તે તળિયેના છિદ્રોમાંથી બહાર ન નીકળે ત્યાં સુધી પાણી આપો',
      'સવારે પાણી આપવું આદર્શ છે; ફંગલ સમસ્યાઓ અટકાવવા માટે પાંદડાને ભીંજવવાનું ટાળો'
    ] : [
      'Water when the top inch of soil feels dry to the touch',
      'Use room-temperature water to avoid shocking the roots',
      'Water until it drains from the bottom holes, then empty the saucer',
      'Morning watering is ideal; avoid wetting leaves to prevent fungal issues',
      'Use a fixed weekly observation routine: soil check, leaf firmness, and pot weight before watering'
    ]
  },
  {
    category: language === 'gujarati' ? 'માટી અને પોટિંગ' : 'Soil & Potting',
    Icon: EarthIcon,
    tips: language === 'gujarati' ? [
      'પર્લાઇટ અથવા ઓર્કિડ છાલ સાથે સારી ડ્રેનેજ પોટિંગ મિશ્રણનો ઉપયોગ કરો',
      'મૂળ સડો અટકાવવા માટે ડ્રેનેજ છિદ્રો સાથેના પોટ પસંદ કરો',
      'વસંતમાં છોડને ફરીથી પોટ કરો જ્યારે તેઓ તેમના કન્ટેનરથી વધી જાય'
    ] : [
      'Use well-draining potting mix with added perlite or orchid bark',
      'Choose pots with drainage holes to prevent root rot',
      'Repot plants in spring when they outgrow their containers',
      'Refresh top 2-3 cm soil monthly to improve aeration and reduce salt buildup from fertilizers'
    ]
  },
  {
    category: language === 'gujarati' ? 'ભેજ અને તાપમાન' : 'Humidity & Temperature',
    Icon: TemperatureIcon,
    tips: language === 'gujarati' ? [
      'મોટાભાગના ઘરના છોડ 40-60% ભેજ સ્તર પસંદ કરે છે',
      'સાપ્તાહિક પાંદડાને ધુમ્મસ આપો અથવા પાણીથી ભરેલા કાંકરા ટ્રે પર મૂકો',
      'છોડને હીટિંગ વેન્ટ્સ, એર કન્ડીશનર અને ઠંડા ડ્રાફ્ટથી દૂર રાખો'
    ] : [
      'Most houseplants prefer 40-60% humidity levels',
      'Mist leaves weekly or place on pebble trays filled with water',
      'Keep plants away from heating vents, air conditioners, and cold drafts',
      'Stabilize room temperature swings by keeping plants away from windows with direct night chill'
    ]
  },
  {
    category: language === 'gujarati' ? 'ખોરાક અને પોષક તત્વો' : 'Feeding & Nutrients',
    Icon: NutritionIcon,
    tips: language === 'gujarati' ? [
      'વૃદ્ધિ સીઝન દરમિયાન દર 2-4 અઠવાડિયામાં છોડને ખવડાવો',
      'સામાન્ય સંભાળ માટે સંતુલિત ખાતર (10-10-10) નો ઉપયોગ કરો',
      'પાનખર અને શિયાળાની નિષ્ક્રિયતામાં ખાતર ઘટાડો અથવા બંધ કરો'
    ] : [
      'Feed plants during growing season (spring/summer) every 2-4 weeks',
      'Use balanced fertilizer (like 10-10-10) for general care',
      'Reduce or stop fertilizing in fall and winter dormancy',
      'Flush soil every 4-6 weeks with plain water to prevent nutrient salt accumulation'
    ]
  },
  {
    category: language === 'gujarati' ? 'જીવાત નિવારણ' : 'Pest Prevention',
    Icon: BugIcon,
    tips: language === 'gujarati' ? [
      'જીવાતો ટાળવા માટે છોડને ઘરે લાવતા પહેલા તપાસો',
      'ધૂળ દૂર કરવા માટે મહિનામાં એકવાર પાંદડા સાફ કરો',
      'કોઈપણ ચેપગ્રસ્ત છોડને તરત જ અલગ કરો'
    ] : [
      'Inspect new plants before bringing them home to avoid pests',
      'Wipe leaves monthly with a soft, damp cloth to remove dust',
      'Isolate any infested plant immediately from other plants',
      'Use yellow sticky traps during humid periods to monitor early pest activity'
    ]
  }
]

export default function BasicCareTips({ onBack, language = 'english' }) {
  const tips = getBasicTips(language)

  return (
    <motion.div className="page-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="page-header">
        {typeof onBack === 'function' && (
          <button className="back-chip" onClick={onBack}>
            ← {language === 'gujarati' ? 'પાછા' : 'Back'}
          </button>
        )}
        <div>
          <h1 className="page-title">{t('essentialPlantCare', language)}</h1>
          <p className="page-subtitle">
            {language === 'gujarati'
              ? 'તમારા છોડને સ્વસ્થ અને સુંદર રાખવા માટેની આવશ્યક માર્ગદર્શિકા'
              : 'Essential guide to keeping your plants healthy and beautiful'}
          </p>
        </div>
      </div>

      <div className="care-grid">
        {tips.map((category, idx) => {
          const Icon = category.Icon
          return (
            <motion.article
              key={category.category}
              className="care-card"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: idx * 0.03 }}
              viewport={{ once: true, margin: '-60px' }}
            >
              <div className="care-card-head">
                <span className="care-icon-wrap">
                  <Icon size={22} />
                </span>
                <h2>{category.category}</h2>
              </div>
              <ul className="care-list">
                {category.tips.map((tip, tipIdx) => (
                  <li key={tipIdx} className="care-row">
                    <span aria-hidden="true">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </motion.article>
          )
        })}
      </div>
    </motion.div>
  )
}
