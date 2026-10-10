import { AnimatePresence } from 'framer-motion'
import { useState } from 'react'

const ItemIcon = ({ id }) => {
  const icons = {
    overview: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
      </svg>
    ),
    immediate: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    schedule: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    environment: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    prevention: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
  }

  return icons[id] || icons.overview
}

const getScheduleTitle = (entry, idx) => {
  if (entry.week) return String(entry.week)
  if (entry.day) return `Day ${entry.day}`
  return `Phase ${idx + 1}`
}

const getScheduleActions = (entry) => {
  if (Array.isArray(entry.actions)) return entry.actions
  if (typeof entry.actions === 'string' && entry.actions.trim()) return [entry.actions]
  if (typeof entry.action === 'string' && entry.action.trim()) return [entry.action]
  return []
}

export default function Accordion({ items, defaultOpen = null }) {
  const [openId, setOpenId] = useState(defaultOpen)

  const toggle = (id) => {
    setOpenId((current) => (current === id ? null : id))
  }

  return (
    <div className="accordion-stack">
      {items.map((item, index) => {
        const isOpen = openId === item.id
        return (
          <div
            key={item.id}
            className="accordion-item"
            style={{ animation: `fadeInUp 0.32s ease ${index * 0.06}s both` }}
          >
            <button className="accordion-trigger" onClick={() => toggle(item.id)}>
              <span className="accordion-title-wrap">
                <span className="accordion-leading-icon">
                  <ItemIcon id={item.id} />
                </span>
                <span className="accordion-title">{item.title}</span>
              </span>
              <span
                className="accordion-chevron"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>

            <AnimatePresence>
              {isOpen && (
                <div
                  className="accordion-content-wrap"
                >
                  <div className="accordion-content">
                    {item.content && <p className="accordion-text">{item.content}</p>}

                    {item.items && item.items.length > 0 && (
                      <ul className="accordion-list">
                        {item.items.map((subItem, idx) => (
                          <li key={idx}>
                            <span>•</span>
                            <span>{subItem}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {item.schedule && item.schedule.length > 0 && (
                      <div className="accordion-schedule">
                        {item.schedule.map((entry, idx) => (
                          <div key={idx} className="accordion-schedule-item">
                            <h5>{getScheduleTitle(entry, idx)}</h5>
                            <ul className="accordion-list compact">
                              {getScheduleActions(entry).map((action, actionIdx) => (
                                <li key={actionIdx}>
                                  <span>•</span>
                                  <span>{action}</span>
                                </li>
                              ))}
                            </ul>
                            {entry.notes && <p className="accordion-notes">{entry.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
