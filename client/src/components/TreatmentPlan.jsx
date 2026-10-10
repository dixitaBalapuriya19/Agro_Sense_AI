import { motion } from 'framer-motion' // eslint-disable-line no-unused-vars
import { t } from '../translations'
import { CalendarIcon, CheckCircleIcon } from './Icons'

export default function TreatmentPlan({ remedies, language = 'english' }) {
    if (!remedies || remedies.length === 0) return null

    return (
        <div className="treatment-plan-shell">
            <h3 className="treatment-plan-title">
                {t('quickActionSteps', language)}
            </h3>

            <div className="remedies-list custom-scrollbar">
                {remedies.map((remedy, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 + 0.3 }}
                        className="remedy-card"
                    >
                        <span className="remedy-index">
                            {(idx + 1).toString().padStart(2, '0')}
                        </span>

                        <div className="remedy-content">
                            <h4 className="remedy-title">
                                {remedy.action}
                            </h4>
                            <div className="remedy-meta">
                                {remedy.timeframe && (
                                    <span>
                                      <span className="meta-icon"><CalendarIcon size={14} /></span>
                                      {language === 'gujarati' ? 'સમય' : 'Timeline'}: {remedy.timeframe}
                                    </span>
                                )}
                                <span>
                                  <span className="meta-icon"><CheckCircleIcon size={14} /></span>
                                  {language === 'gujarati' ? 'ભલામણ કરેલ માર્ગદર્શન' : 'Recommended Protocol'}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
