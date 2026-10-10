import { t } from '../translations'
import { PlantIcon, AutumnIcon, GlobeIcon, SearchIcon } from './Icons'

export default function CareOptions({ onNavigate, language = 'english' }) {
  const options = [
    {
      id: 'basic',
      titleKey: 'fundamentalCare',
      Icon: PlantIcon,
      descKey: 'fundamentalCareDesc'
    },
    {
      id: 'seasonal',
      titleKey: 'seasonalGuidance',
      Icon: AutumnIcon,
      descKey: 'seasonalGuidanceDesc'
    },
    {
      id: 'environmental',
      titleKey: 'environmentalInsights',
      Icon: GlobeIcon,
      descKey: 'environmentalInsightsDesc'
    },
    {
      id: 'analysis',
      titleKey: 'instantDiagnosis',
      Icon: SearchIcon,
      descKey: 'instantDiagnosisDesc'
    }
  ]

  return (
    <section className="home-options">
      <div className="responsive-container home-options__inner">
        <div className="home-options__header">
          <h2>{language === 'gujarati' ? 'તમારી છોડની યાત્રા શરૂ કરો' : 'Begin Your Plant Journey'}</h2>
          <p>{language === 'gujarati' ? 'તમે તમારા વનસ્પતિ સંગ્રહની સંભાળ કેવી રીતે લેવા માંગો છો તે પસંદ કરો' : "Select how you'd like to care for your botanical collection"}</p>
        </div>

        <div className="home-options__grid">
          {options.map((option, index) => (
            <button
              key={option.id}
              className="home-options__card"
              onClick={() => onNavigate(option.id)}
            >
              <div 
                className="home-options__icon"
                style={{
                  animationDelay: `${index * 0.12}s`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <option.Icon size={40} color="var(--color-moss-deep)" />
              </div>
              <h3>{t(option.titleKey, language)}</h3>
              <p>{t(option.descKey, language)}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
