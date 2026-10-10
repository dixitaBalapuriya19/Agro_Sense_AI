import { motion } from 'framer-motion' // eslint-disable-line no-unused-vars

export default function ScanHistory({ history, onSelect }) {
    if (!history || history.length === 0) return null

    return (
        <section className="history-section">
            <div className="history-wrap">
                <h3 className="history-title">Specimen Archive</h3>

                <div className="history-grid">
                    {history.map((scan, idx) => (
                        <motion.button
                            key={idx}
                            whileHover={{ y: -4 }}
                            onClick={() => onSelect(scan)}
                            className="history-card"
                        >
                            <div className="history-image-wrap">
                                <img src={scan.image} alt={scan.disease} className="history-image" />
                            </div>
                            <div className="history-body">
                                <h4>{scan.disease}</h4>
                                <span>{new Date(scan.timestamp).toLocaleDateString()}</span>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </div>
        </section>
    )
}
