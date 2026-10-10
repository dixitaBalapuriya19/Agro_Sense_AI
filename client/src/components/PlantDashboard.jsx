import { useState, useMemo } from 'react'
import {
  PLANT_SPECIES_PRESETS,
  calculatePlantAgeAndStage,
  calculateWeatherAdjustments,
  generateTasksForPlant
} from '../utils/plantCareEngine'
import {
  PlantIcon,
  DropletIcon,
  SearchIcon,
  ScissorsIcon,
  ShieldIcon,
  FlaskIcon,
  CalendarIcon,
  WarningIcon,
  CheckCircleIcon,
  CheckIcon,
  UndoIcon,
  CameraIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CloudRainIcon,
  WeatherIcon,
  SoilIcon,
  SeedlingIcon,
  ClipboardIcon,
  ActivityIcon,
  TrendingUpIcon,
  ArrowLeftIcon
} from './Icons'
import PlantModal from './PlantModal'

function calculateDaysSinceScan(scannedAt) {
  if (!scannedAt) return 1
  const scanTime = new Date(scannedAt).getTime()
  if (isNaN(scanTime)) return 1
  return Math.max(1, Math.floor((Date.now() - scanTime) / (1000 * 60 * 60 * 24)))
}

export default function PlantDashboard({
  plants = [],
  setPlants,
  weatherData = null,
  soilData = null,
  language = 'english',
  onBack = null,
  onScanNewPlant = null,
  onNavigateToEnv = null
}) {
  const isGu = language === 'gujarati'

  // Tabs: 'tasks' (Daily Actions) | 'treatment' (Treatment Protocols & Health) | 'upcoming' | 'plants'
  const [activeTab, setActiveTab] = useState('tasks')
  const [taskFilter, setTaskFilter] = useState('all') // 'all' | 'treatment' | 'water' | 'inspect' | 'prune' | 'fertilize'
  const [selectedPlantFilter, setSelectedPlantFilter] = useState('all')

  // Treatment & Health Tracking States
  const [treatmentStatusFilter, setTreatmentStatusFilter] = useState('all') // 'all' | 'active' | 'responding' | 'recovered'
  const [activeCheckInPlantId, setActiveCheckInPlantId] = useState(null)
  const [checkInForm, setCheckInForm] = useState({ status: 'improving', vigor: 4, notes: '' })
  const [expandedTimelines, setExpandedTimelines] = useState({})

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlant, setEditingPlant] = useState(null)

  // Weather adjustments & alerts
  const weatherAdj = useMemo(() => {
    return calculateWeatherAdjustments(weatherData, soilData, 'outdoor')
  }, [weatherData, soilData])

  // Aggregate all tasks across all plants (including treatment tasks)
  const allTasks = useMemo(() => {
    let tasksList = []
    plants.forEach((plant) => {
      const plantTasks = generateTasksForPlant(plant, weatherData, soilData, language)
      tasksList = tasksList.concat(plantTasks)
    })
    return tasksList
  }, [plants, weatherData, soilData, language])

  // All plants eligible for treatment & health tracking
  const allTreatedPlants = useMemo(() => {
    return plants.filter((p) => p.activeDisease || (p.remedies && p.remedies.length > 0) || (p.treatmentSchedule && p.treatmentSchedule.length > 0) || (p.healthLogs && p.healthLogs.length > 0) || p.healthStage)
  }, [plants])

  // Filtered treated plants
  const treatedPlants = useMemo(() => {
    if (treatmentStatusFilter === 'all') return allTreatedPlants
    if (treatmentStatusFilter === 'recovered') {
      return allTreatedPlants.filter(p => p.healthStage === 'recovered' || p.healthStatus === 'healthy')
    }
    if (treatmentStatusFilter === 'responding') {
      return allTreatedPlants.filter(p => p.healthStage === 'responding')
    }
    if (treatmentStatusFilter === 'active') {
      return allTreatedPlants.filter(p => p.healthStage === 'active_infection' || p.healthStage === 'under_treatment' || (!p.healthStage && p.healthStatus !== 'healthy'))
    }
    return allTreatedPlants
  }, [allTreatedPlants, treatmentStatusFilter])

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      const matchesType = taskFilter === 'all' || task.type === taskFilter
      const matchesPlant = selectedPlantFilter === 'all' || task.plantId === selectedPlantFilter
      return matchesType && matchesPlant
    })
  }, [allTasks, taskFilter, selectedPlantFilter])

  // Categorize tasks
  const overdueTasks = useMemo(() => filteredTasks.filter(t => t.status === 'overdue'), [filteredTasks])
  const todayTasks = useMemo(() => filteredTasks.filter(t => t.status === 'due_today'), [filteredTasks])
  const upcomingTasks = useMemo(() => filteredTasks.filter(t => t.status === 'upcoming'), [filteredTasks])
  const completedTodayTasks = useMemo(() => filteredTasks.filter(t => t.status === 'completed_today'), [filteredTasks])

  // Task Completion Handler (handles regular care AND treatment steps)
  const handleCompleteTask = (task) => {
    const todayStr = new Date().toISOString().split('T')[0]
    setPlants((prevPlants) => {
      return prevPlants.map((plant) => {
        if (plant.id !== task.plantId) return plant

        const updated = { ...plant }

        if (task.type === 'treatment') {
          const currentCompleted = Array.isArray(plant.completedTreatmentSteps) ? plant.completedTreatmentSteps : []
          if (!currentCompleted.includes(task.id)) {
            updated.completedTreatmentSteps = [...currentCompleted, task.id]
          }
        } else if (task.type === 'water') {
          updated.lastWatered = todayStr
        } else if (task.type === 'inspect') {
          updated.lastInspected = todayStr
        } else if (task.type === 'prune') {
          updated.lastPruned = todayStr
        } else if (task.type === 'fertilize') {
          updated.lastFertilized = todayStr
        }

        return updated
      })
    })
  }

  // Undo task completion
  const handleUndoComplete = (task) => {
    // eslint-disable-next-line react-hooks/purity
    const prevDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    setPlants((prevPlants) => {
      return prevPlants.map((plant) => {
        if (plant.id !== task.plantId) return plant

        const updated = { ...plant }

        if (task.type === 'treatment') {
          const currentCompleted = Array.isArray(plant.completedTreatmentSteps) ? plant.completedTreatmentSteps : []
          updated.completedTreatmentSteps = currentCompleted.filter(id => id !== task.id)
        } else if (task.type === 'water') {
          updated.lastWatered = prevDate
        } else if (task.type === 'inspect') {
          updated.lastInspected = prevDate
        } else if (task.type === 'prune') {
          updated.lastPruned = prevDate
        } else if (task.type === 'fertilize') {
          updated.lastFertilized = prevDate
        }

        return updated
      })
    })
  }

  // Health Tracking Handlers
  const handleSaveHealthCheckIn = (plantId) => {
    const todayStr = new Date().toISOString().split('T')[0]
    setPlants((prevPlants) => {
      return prevPlants.map((plant) => {
        if (plant.id !== plantId) return plant
        const updated = { ...plant }
        const currentLogs = Array.isArray(plant.healthLogs) ? plant.healthLogs : []

        const newLog = {
          id: `log_${Date.now()}`,
          date: todayStr,
          timestamp: new Date().toISOString(),
          status: checkInForm.status,
          vigor: Number(checkInForm.vigor) || 4,
          notes: checkInForm.notes.trim() || (isGu ? 'સ્વાસ્થ્ય ચકાસણી સંપન્ન' : 'Foliar observation recorded'),
          conditionLabel: checkInForm.status === 'resolved'
            ? (isGu ? 'સંપૂર્ણ મટી ગયું' : 'Pathology Cleared')
            : checkInForm.status === 'improving'
              ? (isGu ? 'સુધારો જોવા મળ્યો' : 'Condition Improving')
              : checkInForm.status === 'worsening'
                ? (isGu ? 'લક્ષણો વધ્યા' : 'Symptoms Persisting')
                : (isGu ? 'સ્થિતિ સ્થિર' : 'Condition Stable')
        }

        updated.healthLogs = [newLog, ...currentLogs]
        updated.healthVigor = Number(checkInForm.vigor) || 4

        if (checkInForm.status === 'resolved') {
          updated.healthStage = 'recovered'
          updated.healthStatus = 'healthy'
          updated.activeDisease = null
        } else if (checkInForm.status === 'improving') {
          updated.healthStage = 'responding'
        } else if (checkInForm.status === 'worsening') {
          updated.healthStage = 'active_infection'
        } else {
          updated.healthStage = updated.healthStage || 'under_treatment'
        }

        return updated
      })
    })

    setActiveCheckInPlantId(null)
    setCheckInForm({ status: 'improving', vigor: 4, notes: '' })
  }

  const handleMarkAsRecovered = (plantId) => {
    const todayStr = new Date().toISOString().split('T')[0]
    setPlants((prevPlants) => {
      return prevPlants.map((plant) => {
        if (plant.id !== plantId) return plant
        const updated = { ...plant }
        const currentLogs = Array.isArray(plant.healthLogs) ? plant.healthLogs : []

        const recoveryLog = {
          id: `log_recov_${Date.now()}`,
          date: todayStr,
          timestamp: new Date().toISOString(),
          status: 'recovered',
          vigor: 5,
          conditionLabel: isGu ? 'સંપૂર્ણ સ્વસ્થ' : 'Full Recovery Confirmed',
          notes: isGu
            ? 'છોડ સફળતાપૂર્વક સાજો થઈ ગયો છે. રોગના લક્ષણો દૂર થયા અને સામાન્ય જાળવણી શરૂ.'
            : 'Specimen fully recovered. Foliar lesions cleared and plant transitioned to routine maintenance.'
        }

        updated.healthLogs = [recoveryLog, ...currentLogs]
        updated.healthStage = 'recovered'
        updated.healthStatus = 'healthy'
        updated.activeDisease = null
        updated.healthVigor = 5
        return updated
      })
    })
  }

  const handleQuickStatusChange = (plantId, newStage) => {
    setPlants((prevPlants) => {
      return prevPlants.map((plant) => {
        if (plant.id !== plantId) return plant
        const updated = { ...plant, healthStage: newStage }
        if (newStage === 'recovered') {
          updated.healthStatus = 'healthy'
          updated.activeDisease = null
          updated.healthVigor = 5
        } else if (newStage === 'responding') {
          updated.healthStatus = 'recovering'
        } else if (newStage === 'active_infection' || newStage === 'under_treatment') {
          updated.healthStatus = 'diseased'
        }
        return updated
      })
    })
  }

  const toggleTimeline = (plantId) => {
    setExpandedTimelines((prev) => ({
      ...prev,
      [plantId]: !prev[plantId]
    }))
  }

  const computePlantVitality = (plant, scheduleSteps, completedCount) => {
    if (plant.healthStage === 'recovered' || plant.healthStatus === 'healthy') return 100
    const totalSteps = scheduleSteps.length || 1
    const stepWeight = (completedCount / totalSteps) * 55 // Up to 55% from treatment protocol

    let base = 25
    const sev = String(plant.severity || '').toLowerCase()
    if (sev === 'low') base = 40
    else if (sev === 'medium') base = 30
    else if (sev === 'high') base = 20
    else if (sev === 'critical') base = 10

    let checkinBonus = 0
    if (plant.healthStage === 'responding') checkinBonus = 15
    else if (plant.healthStage === 'active_infection') checkinBonus = -5

    const latestLog = Array.isArray(plant.healthLogs) && plant.healthLogs[0]
    if (latestLog) {
      if (latestLog.status === 'improving') checkinBonus += 10
      else if (latestLog.status === 'worsening') checkinBonus -= 10
    }

    return Math.min(95, Math.max(15, Math.round(base + stepWeight + checkinBonus)))
  }

  // Quick water from plant card
  const handleQuickWater = (plantId) => {
    const todayStr = new Date().toISOString().split('T')[0]
    setPlants((prevPlants) => {
      return prevPlants.map((plant) => {
        if (plant.id === plantId) {
          return { ...plant, lastWatered: todayStr }
        }
        return plant
      })
    })
  }

  // Save (Add or Edit) Plant
  const handleSavePlant = (plantData) => {
    setPlants((prevPlants) => {
      const exists = prevPlants.some(p => p.id === plantData.id)
      if (exists) {
        return prevPlants.map(p => p.id === plantData.id ? plantData : p)
      }
      return [plantData, ...prevPlants]
    })
    setEditingPlant(null)
  }

  // Delete Plant
  const handleDeletePlant = (plantId, plantName) => {
    const confirmMsg = isGu
      ? `શું તમે "${plantName}" ને ટ્રેકિંગમાંથી કાઢી નાખવા માંગો છો?`
      : `Remove "${plantName}" from care tracking?`
    if (window.confirm(confirmMsg)) {
      setPlants((prevPlants) => prevPlants.filter(p => p.id !== plantId))
    }
  }

  const renderTaskIcon = (type) => {
    switch (type) {
      case 'treatment': return <ShieldIcon size={14} color="var(--color-error)" />
      case 'water': return <DropletIcon size={14} color="var(--color-success)" />
      case 'inspect': return <SearchIcon size={14} color="var(--color-warning)" />
      case 'prune': return <ScissorsIcon size={14} color="var(--ui-text)" />
      case 'fertilize': return <FlaskIcon size={14} color="var(--ui-accent)" />
      default: return <PlantIcon size={14} color="var(--ui-text-muted)" />
    }
  }

  const getHealthBadge = (status) => {
    switch (status) {
      case 'healthy':
        return { label: isGu ? 'સ્વસ્થ' : 'Healthy', cls: 'badge-success' }
      case 'recovering':
        return { label: isGu ? 'સુધારા પર' : 'Recovering', cls: 'badge-info' }
      case 'warning':
        return { label: isGu ? 'જોખમમાં' : 'At Risk', cls: 'badge-warning' }
      case 'diseased':
        return { label: isGu ? 'રોગિષ્ઠ' : 'Active Disease', cls: 'badge-error' }
      default:
        return { label: status, cls: 'badge-default' }
    }
  }

  return (
    <div className="page-shell plant-dashboard-shell">
      {/* Top Navigation & Breadcrumb with Back Button */}
      <div className="dashboard-navigation-bar">
        <button
          type="button"
          className="dashboard-back-btn"
          onClick={() => {
            if (typeof onBack === 'function') {
              onBack()
            } else {
              window.history.back()
            }
          }}
          aria-label={isGu ? 'મુખ્ય પૃષ્ઠ પર પાછા જાઓ' : 'Back to Home'}
        >
          <ArrowLeftIcon size={16} />
          <span>{isGu ? 'પાછા જાઓ' : 'Back to Home'}</span>
        </button>
        <div className="dashboard-breadcrumb">
          <span className="breadcrumb-muted">{isGu ? 'એગ્રોસેન્સ' : 'AgroSense'}</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{isGu ? 'ડેશબોર્ડ' : 'Dashboard'}</span>
        </div>
      </div>

      {/* Top Header */}
      <div className="dashboard-header-row">
        <div className="dashboard-header-info">
          <div className="dashboard-title-wrap">
            <h1 className="page-title" style={{ margin: 0 }}>
              {isGu ? 'છોડ સંભાળ અને સારવાર ડેશબોર્ડ' : 'Plant Care & Treatment Dashboard'}
            </h1>
            <span className="clean-count-badge">{plants.length} {isGu ? 'છોડ' : 'Plants'}</span>
          </div>
          <p className="page-subtitle" style={{ marginTop: '6px' }}>
            {isGu
              ? 'રોગ નિદાન સારવાર, દૈનિક સિંચાઈ અને હવામાન આધારિત સંભાળનું કેન્દ્રિય આયોજન'
              : 'Synchronized disease treatment protocols, adaptive irrigation, and precision plant care.'}
          </p>
        </div>

        <div className="dashboard-top-actions">
          {typeof onScanNewPlant === 'function' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onScanNewPlant}
            >
              <CameraIcon size={16} />
              <span>{isGu ? 'પાન સ્કેન કરો' : 'Scan Leaf'}</span>
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setEditingPlant(null)
              setIsModalOpen(true)
            }}
          >
            <PlusIcon size={16} />
            <span>{isGu ? 'છોડ ઉમેરો' : 'Add Plant'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row (No Emojis, Sharp 1px Border) */}
      <div className="dashboard-metrics-strip">
        <div className="dash-metric-card">
          <span className="dash-metric-label">{isGu ? 'કુલ નોંધાયેલા છોડ' : 'Tracked Plants'}</span>
          <strong className="dash-metric-value">{plants.length}</strong>
          <span className="dash-metric-sub">{isGu ? 'સક્રિય બગીચો પ્રોફાઇલ' : 'Active garden profiles'}</span>
        </div>

        <div className={`dash-metric-card ${treatedPlants.length > 0 ? 'card-alert' : ''}`}>
          <span className="dash-metric-label">{isGu ? 'સક્રિય સારવાર પ્રોટોકોલ' : 'Active Treatments'}</span>
          <strong className="dash-metric-value" style={{ color: treatedPlants.length > 0 ? 'var(--color-error)' : 'inherit' }}>
            {treatedPlants.length}
          </strong>
          <span className="dash-metric-sub">
            {treatedPlants.length > 0
              ? (isGu ? 'રોગગ્રસ્ત છોડ સારવાર હેઠળ' : 'Diagnosed plants in recovery')
              : (isGu ? 'બધા છોડ સ્વસ્થ છે' : 'No active diseases')}
          </span>
        </div>

        <div className="dash-metric-card">
          <span className="dash-metric-label">{isGu ? 'આજના નિર્ધારિત કાર્યો' : "Due Today"}</span>
          <strong className="dash-metric-value" style={{ color: 'var(--color-warning)' }}>
            {todayTasks.length}
          </strong>
          <span className="dash-metric-sub">{isGu ? 'આજે પૂર્ણ કરવાના પગલાં' : 'Scheduled routine actions'}</span>
        </div>

        <div className={`dash-metric-card ${overdueTasks.length > 0 ? 'card-alert' : ''}`}>
          <span className="dash-metric-label">{isGu ? 'બાકી રહેલા કાર્યો' : 'Overdue Tasks'}</span>
          <strong className="dash-metric-value" style={{ color: overdueTasks.length > 0 ? 'var(--color-error)' : 'inherit' }}>
            {overdueTasks.length}
          </strong>
          <span className="dash-metric-sub">
            {overdueTasks.length > 0
              ? (isGu ? 'તાત્કાલિક ધ્યાન જરૂરી' : 'Requires prompt attention')
              : (isGu ? 'બધું સમયસર છે' : 'All caught up')}
          </span>
        </div>
      </div>

      {/* Empty Garden State */}
      {plants.length === 0 ? (
        <div className="empty-garden-hero panel-card">
          <div className="empty-icon-wrap">
            <SeedlingIcon size={36} color="var(--ui-accent)" />
          </div>
          <h3>{isGu ? 'હજી સુધી કોઈ છોડ ટ્રેકિંગમાં નથી' : 'No Plants in Your Care Journal Yet'}</h3>
          <p>
            {isGu
              ? 'જ્યારે તમે છોડનું પાન સ્કેન કરશો, ત્યારે રોગ નિદાન અને સારવાર શેડ્યૂલ સાથે તે આપોઆપ અહીં ઉમેરાશે. અથવા તમે જાતે પણ છોડ ઉમેરી શકો છો.'
              : 'Scan a leaf to automatically import disease diagnostics, treatments, and watering schedules. You can also manually add plants at any time.'}
          </p>

          <div className="empty-garden-actions">
            {typeof onScanNewPlant === 'function' && (
              <button
                type="button"
                className="btn-primary"
                onClick={onScanNewPlant}
              >
                <CameraIcon size={16} />
                <span>{isGu ? 'છોડનું પાન સ્કેન કરો' : 'Scan a Plant Leaf'}</span>
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEditingPlant(null)
                setIsModalOpen(true)
              }}
            >
              <PlusIcon size={16} />
              <span>{isGu ? 'જાતે છોડ ઉમેરો' : 'Add Plant Manually'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Organized 2-Column Dashboard Layout */
        <div className="dashboard-grid-layout">
          {/* Main Column */}
          <div className="dashboard-main-col">
            {/* Tab Bar */}
            <div className="dashboard-tab-bar">
              <div className="tab-buttons-group">
                <button
                  type="button"
                  className={`dash-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tasks')}
                >
                  <ClipboardIcon size={16} />
                  <span>{isGu ? 'આજના અને બાકી કાર્યો' : 'Action Required'}</span>
                  {(overdueTasks.length + todayTasks.length) > 0 && (
                    <span className="tab-count-pill">{overdueTasks.length + todayTasks.length}</span>
                  )}
                </button>

                <button
                  type="button"
                  className={`dash-tab-btn ${activeTab === 'treatment' ? 'active' : ''}`}
                  onClick={() => setActiveTab('treatment')}
                >
                  <ActivityIcon size={16} />
                  <span>{isGu ? 'સારવાર અને સ્વાસ્થ્ય ટ્રેકિંગ' : 'Treatment & Health Tracking'}</span>
                  {allTreatedPlants.length > 0 && (
                    <span className="tab-count-pill pill-alert">{allTreatedPlants.length}</span>
                  )}
                </button>

                <button
                  type="button"
                  className={`dash-tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
                  onClick={() => setActiveTab('upcoming')}
                >
                  <CalendarIcon size={16} />
                  <span>{isGu ? 'આગામી ૭ દિવસ' : 'Upcoming (7 Days)'}</span>
                </button>

                <button
                  type="button"
                  className={`dash-tab-btn ${activeTab === 'plants' ? 'active' : ''}`}
                  onClick={() => setActiveTab('plants')}
                >
                  <PlantIcon size={16} />
                  <span>{isGu ? 'મારા છોડ પ્રોફાઇલ' : 'Plant Directory'}</span>
                </button>
              </div>

              {/* Task Filter */}
              {activeTab === 'tasks' && (
                <div className="dashboard-filters-row">
                  <select
                    className="filter-select"
                    value={selectedPlantFilter}
                    onChange={(e) => setSelectedPlantFilter(e.target.value)}
                    aria-label="Filter by Plant"
                  >
                    <option value="all">{isGu ? 'બધા છોડ' : 'All Plants'}</option>
                    {plants.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <div className="task-type-pills">
                    <button
                      type="button"
                      className={`type-pill ${taskFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setTaskFilter('all')}
                    >
                      {isGu ? 'બધા' : 'All'}
                    </button>
                    <button
                      type="button"
                      className={`type-pill ${taskFilter === 'treatment' ? 'active' : ''}`}
                      onClick={() => setTaskFilter('treatment')}
                    >
                      {isGu ? 'સારવાર' : 'Treatment'}
                    </button>
                    <button
                      type="button"
                      className={`type-pill ${taskFilter === 'water' ? 'active' : ''}`}
                      onClick={() => setTaskFilter('water')}
                    >
                      {isGu ? 'પાણી' : 'Water'}
                    </button>
                    <button
                      type="button"
                      className={`type-pill ${taskFilter === 'inspect' ? 'active' : ''}`}
                      onClick={() => setTaskFilter('inspect')}
                    >
                      {isGu ? 'તપાસ' : 'Inspect'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* TAB 1: DAILY ACTION ITEMS */}
            {activeTab === 'tasks' && (
              <div className="tasks-view-container">
                {/* Overdue Section */}
                {overdueTasks.length > 0 && (
                  <div className="task-group overdue-group">
                    <div className="group-title-row">
                      <h3 className="group-title title-overdue">
                        <WarningIcon size={16} />
                        <span>{isGu ? 'બાકી રહેલા કાર્યો' : 'Overdue Tasks'}</span>
                        <span className="group-badge badge-overdue">{overdueTasks.length}</span>
                      </h3>
                      <span className="group-hint">
                        {isGu ? 'વહેલી તકે પૂર્ણ કરો' : 'Action recommended as soon as possible'}
                      </span>
                    </div>

                    <div className="task-cards-list">
                      {overdueTasks.map((task) => (
                        <div key={task.id} className="task-card task-card-overdue">
                          <div className="task-status-bar bar-overdue" />
                          <div className="task-main-info">
                            <div className="task-type-badge">
                              {renderTaskIcon(task.type)}
                              <span>{task.typeLabel}</span>
                              {task.isTreatment && (
                                <span className="prescription-chip">{isGu ? 'પ્રિસ્ક્રિપ્શન' : 'Prescription'}</span>
                              )}
                            </div>
                            <h4 className="task-title">{task.title}</h4>
                            <p className="task-reminder">{task.reminder}</p>
                            <div className="task-meta-tags">
                              <span className="meta-tag tag-plant">{task.plantName}</span>
                              {task.stageContext && <span className="meta-tag tag-stage">{task.stageContext}</span>}
                              <span className="meta-tag tag-overdue">
                                {isGu ? `${task.daysOverdue} દિવસ મોડું` : `${task.daysOverdue}d overdue`}
                              </span>
                            </div>
                          </div>

                          <div className="task-actions">
                            <button
                              type="button"
                              className="btn-complete"
                              onClick={() => handleCompleteTask(task)}
                            >
                              <CheckIcon size={14} />
                              <span>{isGu ? 'પૂર્ણ' : 'Mark Done'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Due Today Section */}
                <div className="task-group today-group">
                  <div className="group-title-row">
                    <h3 className="group-title title-today">
                      <CalendarIcon size={16} />
                      <span>{isGu ? 'આજના નિર્ધારિત કાર્યો' : 'Scheduled for Today'}</span>
                      <span className="group-badge badge-today">{todayTasks.length}</span>
                    </h3>
                  </div>

                  {todayTasks.length === 0 ? (
                    <div className="empty-tasks-panel">
                      <CheckCircleIcon size={24} color="var(--color-success)" />
                      <h4>{isGu ? 'આજ માટે કોઈ બાકી કાર્ય નથી' : 'No pending tasks for today'}</h4>
                      <p>
                        {isGu
                          ? 'આજના તમામ સંભાળ અને સારવાર પગલાં પૂર્ણ થઈ ગયા છે.'
                          : 'All scheduled irrigation and treatment directives are complete.'}
                      </p>
                    </div>
                  ) : (
                    <div className="task-cards-list">
                      {todayTasks.map((task) => (
                        <div key={task.id} className={`task-card task-card-today ${task.isTreatment ? 'task-treatment-active' : ''}`}>
                          <div className="task-status-bar bar-today" />
                          <div className="task-main-info">
                            <div className="task-type-badge">
                              {renderTaskIcon(task.type)}
                              <span>{task.typeLabel}</span>
                              {task.isTreatment && (
                                <span className="prescription-chip">{isGu ? 'સારવાર' : 'Treatment'}</span>
                              )}
                            </div>
                            <h4 className="task-title">{task.title}</h4>
                            <p className="task-reminder">{task.reminder}</p>
                            <div className="task-meta-tags">
                              <span className="meta-tag tag-plant">{task.plantName}</span>
                              {task.stageContext && <span className="meta-tag tag-stage">{task.stageContext}</span>}
                              {task.weatherDeferred && (
                                <span className="meta-tag tag-weather">{isGu ? 'વરસાદને લીધે મુલતવી' : 'Rain Deferred'}</span>
                              )}
                            </div>
                          </div>

                          <div className="task-actions">
                            <button
                              type="button"
                              className="btn-complete"
                              onClick={() => handleCompleteTask(task)}
                            >
                              <CheckIcon size={14} />
                              <span>{isGu ? 'પૂર્ણ' : 'Mark Done'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Completed Today Section */}
                {completedTodayTasks.length > 0 && (
                  <div className="task-group completed-group">
                    <div className="group-title-row">
                      <h4 className="group-title title-completed">
                        <CheckCircleIcon size={14} color="var(--color-success)" />
                        <span>{isGu ? 'આજે પૂર્ણ થયેલા કાર્યો' : 'Completed Today'}</span>
                        <span className="group-badge badge-completed">{completedTodayTasks.length}</span>
                      </h4>
                    </div>

                    <div className="task-cards-list">
                      {completedTodayTasks.map((task) => (
                        <div key={task.id} className="task-card task-card-completed">
                          <div className="task-main-info">
                            <div className="completed-title-row">
                              <CheckIcon size={14} color="var(--color-success)" />
                              <span className="completed-name">{task.title}</span>
                              <span className="meta-tag tag-plant">{task.plantName}</span>
                            </div>
                          </div>
                          <div className="task-actions">
                            <button
                              type="button"
                              className="btn-undo"
                              onClick={() => handleUndoComplete(task)}
                              title={isGu ? 'રદ કરો' : 'Undo completion'}
                            >
                              <UndoIcon size={12} />
                              <span>{isGu ? 'રદ કરો' : 'Undo'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TREATMENT & HEALTH TRACKING (Treatment protocols + comprehensive recovery tracking) */}
            {activeTab === 'treatment' && (
              <div className="treatment-view-container">
                <div className="group-title-row" style={{ marginBottom: 'var(--space-3)', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 className="group-title">
                      <ActivityIcon size={18} color="var(--color-error)" />
                      <span>{isGu ? 'રોગ સારવાર અને સ્વાસ્થ્ય ટ્રેકિંગ' : 'Treatment Protocols & Health Tracking'}</span>
                    </h3>
                    <p className="group-hint" style={{ marginTop: '4px' }}>
                      {isGu
                        ? 'સ્કેન કરેલા રોગગ્રસ્ત છોડની સારવાર યોજના, સ્વાસ્થ્ય સુધારા સ્કોર અને દૈનિક નિરીક્ષણ નોંધ.'
                        : 'Actionable treatment schedules from leaf scans coupled with vitality scores, health check-ins, and recovery timelines.'}
                    </p>
                  </div>

                  {/* Filter Pills for Treatment Status */}
                  <div className="task-type-pills">
                    <button
                      type="button"
                      className={`type-pill ${treatmentStatusFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setTreatmentStatusFilter('all')}
                    >
                      {isGu ? 'બધા' : 'All'} ({allTreatedPlants.length})
                    </button>
                    <button
                      type="button"
                      className={`type-pill ${treatmentStatusFilter === 'active' ? 'active' : ''}`}
                      onClick={() => setTreatmentStatusFilter('active')}
                    >
                      {isGu ? 'સક્રિય ચેપ' : 'Active'}
                    </button>
                    <button
                      type="button"
                      className={`type-pill ${treatmentStatusFilter === 'responding' ? 'active' : ''}`}
                      onClick={() => setTreatmentStatusFilter('responding')}
                    >
                      {isGu ? 'સુધારા પર' : 'Responding'}
                    </button>
                    <button
                      type="button"
                      className={`type-pill ${treatmentStatusFilter === 'recovered' ? 'active' : ''}`}
                      onClick={() => setTreatmentStatusFilter('recovered')}
                    >
                      {isGu ? 'સાજા થયેલા' : 'Recovered'}
                    </button>
                  </div>
                </div>

                {treatedPlants.length === 0 ? (
                  <div className="empty-tasks-panel panel-card">
                    <CheckCircleIcon size={28} color="var(--color-success)" />
                    <h4>{isGu ? 'કોઈ સારવાર અથવા સ્વાસ્થ્ય ટ્રેકિંગ ડેટા નથી' : 'No Active Treatment or Health Tracking Entries'}</h4>
                    <p>
                      {isGu
                        ? 'જ્યારે તમે કોઈ છોડ સ્કેન કરશો, ત્યારે તેનું સારવાર શેડ્યૂલ અને સ્વાસ્થ્ય પ્રોફાઇલ આપોઆપ અહીં ઉમેરાશે.'
                        : 'When you scan a plant, its prescribed treatment roadmap and recovery tracking profile will automatically appear here.'}
                    </p>
                    {typeof onScanNewPlant === 'function' && (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={onScanNewPlant}
                        style={{ marginTop: '12px' }}
                      >
                        <CameraIcon size={16} />
                        <span>{isGu ? 'નવો છોડ સ્કેન કરો' : 'Scan Plant to Track'}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="treatment-plants-stack">
                    {treatedPlants.map((plant) => {
                      const completedSteps = Array.isArray(plant.completedTreatmentSteps) ? plant.completedTreatmentSteps : []
                      const scheduleSteps = Array.isArray(plant.treatmentSchedule) && plant.treatmentSchedule.length > 0
                        ? plant.treatmentSchedule
                        : (Array.isArray(plant.remedies) ? plant.remedies.map(r => ({ day: r.timeframe || 'Immediate', action: r.action, notes: r.effectiveness ? `Effectiveness: ${r.effectiveness}%` : '' })) : [])

                      const completedCount = scheduleSteps.filter((_, idx) => {
                        const stepId = `${plant.id}_treatment_${idx}`
                        const remedyId = `${plant.id}_remedy_${idx}`
                        return completedSteps.includes(stepId) || completedSteps.includes(remedyId)
                      }).length

                      const vitalityScore = computePlantVitality(plant, scheduleSteps, completedCount)
                      const isRecovered = plant.healthStage === 'recovered' || plant.healthStatus === 'healthy'
                      const isResponding = plant.healthStage === 'responding' || (!isRecovered && vitalityScore >= 60)
                      const stageKey = isRecovered ? 'recovered' : isResponding ? 'responding' : (plant.healthStage || 'active')

                      const stageLabels = {
                        active: isGu ? 'સક્રિય ચેપ' : 'Active Infection',
                        treatment: isGu ? 'સારવાર હેઠળ' : 'Under Treatment',
                        responding: isGu ? 'સુધારો થઈ રહ્યો છે' : 'Responding & Improving',
                        recovered: isGu ? 'સંપૂર્ણ સાજો થયેલ' : 'Fully Recovered'
                      }

                      const daysSinceScan = calculateDaysSinceScan(plant.scannedAt)

                      const healthLogs = Array.isArray(plant.healthLogs) ? plant.healthLogs : []
                      const isTimelineOpen = Boolean(expandedTimelines[plant.id])
                      const isCheckingIn = activeCheckInPlantId === plant.id

                      return (
                        <div key={plant.id} className="treatment-health-card">
                          {/* 1. Header Row */}
                          <div className="health-card-top-row">
                            <div className="health-plant-identity">
                              {plant.image ? (
                                <img src={plant.image} alt={plant.name} className="health-plant-thumb" />
                              ) : (
                                <div className="health-plant-thumb-placeholder">
                                  <PlantIcon size={24} />
                                </div>
                              )}
                              <div className="health-meta-cluster">
                                <h4 className="health-plant-heading">
                                  <span>{plant.name}</span>
                                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ui-text-muted)' }}>
                                    ({plant.speciesName || plant.name})
                                  </span>
                                </h4>
                                <div className="health-badges-row">
                                  {plant.activeDisease ? (
                                    <span className="disease-status-pill">
                                      {plant.activeDisease}
                                    </span>
                                  ) : (
                                    <span className="disease-status-pill" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a' }}>
                                      {isGu ? 'સ્વસ્થ / નિરામય' : 'Healthy Specimen'}
                                    </span>
                                  )}
                                  {plant.severity && (
                                    <span className={`severity-tag severity-${String(plant.severity).toLowerCase()}`}>
                                      {plant.severity.toUpperCase()}
                                    </span>
                                  )}
                                  <span className={`health-stage-badge stage-${stageKey}`}>
                                    <ActivityIcon size={12} />
                                    <span>{stageLabels[stageKey] || stageLabels.active}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="health-quick-actions">
                              {!isRecovered && (
                                <button
                                  type="button"
                                  className="btn-health-action btn-mark-recovered"
                                  onClick={() => handleMarkAsRecovered(plant.id)}
                                  title={isGu ? 'છોડને સ્વસ્થ જાહેર કરો' : 'Mark plant as fully recovered'}
                                >
                                  <CheckIcon size={14} />
                                  <span>{isGu ? 'સ્વસ્થ જાહેર કરો' : 'Mark Recovered'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn-health-action"
                                onClick={() => {
                                  if (isCheckingIn) {
                                    setActiveCheckInPlantId(null)
                                  } else {
                                    setActiveCheckInPlantId(plant.id)
                                    setCheckInForm({ status: 'improving', vigor: plant.healthVigor || 4, notes: '' })
                                  }
                                }}
                              >
                                <PlusIcon size={14} />
                                <span>{isCheckingIn ? (isGu ? 'બંધ કરો' : 'Close Form') : (isGu ? 'સ્વાસ્થ્ય નોંધ ઉમેરો' : 'Log Health Check-in')}</span>
                              </button>

                              {typeof onScanNewPlant === 'function' && (
                                <button
                                  type="button"
                                  className="btn-health-action"
                                  onClick={onScanNewPlant}
                                  title={isGu ? 'ચકાસણી માટે નવો ફોટો સ્કેન કરો' : 'Scan leaf to verify health'}
                                >
                                  <CameraIcon size={14} />
                                  <span>{isGu ? 'પુનઃ સ્કેન' : 'Re-Scan'}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 2. Health & Recovery Metrics Row */}
                          <div className="health-metrics-row">
                            <div className="health-metric-tile">
                              <span className="health-metric-label">{isGu ? 'સ્વાસ્થ્ય સુધારા સ્કોર' : 'Vitality & Recovery'}</span>
                              <div className="health-metric-value" style={{ color: isRecovered ? 'var(--color-success)' : vitalityScore >= 60 ? '#0284c7' : 'var(--color-warning)' }}>
                                <TrendingUpIcon size={16} />
                                <span>{vitalityScore}%</span>
                              </div>
                            </div>

                            <div className="health-metric-tile">
                              <span className="health-metric-label">{isGu ? 'છોડનું જોમ / શક્તિ' : 'Foliage Vigor'}</span>
                              <div className="health-metric-value">
                                <div className="vigor-pips">
                                  {[1, 2, 3, 4, 5].map((level) => (
                                    <span
                                      key={level}
                                      className={`vigor-pip ${(plant.healthVigor || 3) >= level ? 'active' : ''}`}
                                    />
                                  ))}
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>
                                  ({plant.healthVigor || 3}/5)
                                </span>
                              </div>
                            </div>

                            <div className="health-metric-tile">
                              <span className="health-metric-label">{isGu ? 'સારવાર સમયગાળો' : 'Protocol Progress'}</span>
                              <div className="health-metric-value" style={{ fontSize: '12px' }}>
                                <span>{isGu ? `દિવસ ${daysSinceScan}` : `Day ${daysSinceScan}`}</span>
                                <span style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>
                                  ({completedCount}/{scheduleSteps.length} {isGu ? 'પગલાં' : 'steps'})
                                </span>
                              </div>
                            </div>

                            <div className="health-metric-tile">
                              <span className="health-metric-label">{isGu ? 'સ્થિતિ બદલો' : 'Status Switcher'}</span>
                              <select
                                className="filter-select"
                                style={{ padding: '2px 8px', fontSize: '11px', height: '26px' }}
                                value={plant.healthStage || (isRecovered ? 'recovered' : 'active_infection')}
                                onChange={(e) => handleQuickStatusChange(plant.id, e.target.value)}
                              >
                                <option value="active_infection">{isGu ? 'સક્રિય ચેપ' : 'Active Infection'}</option>
                                <option value="under_treatment">{isGu ? 'સારવાર હેઠળ' : 'Under Treatment'}</option>
                                <option value="responding">{isGu ? 'સુધારો થઈ રહ્યો છે' : 'Responding / Improving'}</option>
                                <option value="recovered">{isGu ? 'સંપૂર્ણ સાજો થયેલ' : 'Fully Recovered'}</option>
                              </select>
                            </div>
                          </div>

                          {/* Vitality Progress Track */}
                          <div className="recovery-progress-track">
                            <div
                              className="recovery-progress-fill"
                              style={{
                                width: `${vitalityScore}%`,
                                background: isRecovered
                                  ? 'var(--color-success)'
                                  : vitalityScore >= 60
                                    ? '#0284c7'
                                    : 'var(--ui-accent)'
                              }}
                            />
                          </div>

                          {/* 3. Inline Health Check-in Form */}
                          {isCheckingIn && (
                            <div className="health-checkin-panel">
                              <div className="checkin-panel-title">
                                <ActivityIcon size={14} color="var(--color-primary)" />
                                <span>{isGu ? 'નવી સ્વાસ્થ્ય ચકાસણી અને અવલોકન નોંધ' : 'Record Plant Health Check-in'}</span>
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: 'var(--ui-text-muted)' }}>
                                  {isGu ? 'રોગના લક્ષણોમાં ફેરફાર:' : 'Pathological Symptom Response:'}
                                </label>
                                <div className="checkin-status-selector">
                                  {[
                                    { id: 'improving', label: isGu ? 'સુધારો થયો (Improving)' : 'Improving' },
                                    { id: 'stable', label: isGu ? 'સ્થિર (Stable)' : 'Stable' },
                                    { id: 'worsening', label: isGu ? 'વધારો થયો (Worsening)' : 'Worsening' },
                                    { id: 'resolved', label: isGu ? 'સંપૂર્ણ સાજો થયો (Cleared)' : 'Resolved / Healthy' }
                                  ].map((st) => (
                                    <button
                                      key={st.id}
                                      type="button"
                                      className={`status-choice-btn ${checkInForm.status === st.id ? 'selected' : ''}`}
                                      onClick={() => setCheckInForm({ ...checkInForm, status: st.id })}
                                    >
                                      {st.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: 'var(--ui-text-muted)' }}>
                                  {isGu ? 'છોડનું જોમ રેટિંગ (૧-૫):' : 'Overall Foliage Vigor (1-5):'}
                                </label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {[1, 2, 3, 4, 5].map((v) => (
                                    <button
                                      key={v}
                                      type="button"
                                      className={`status-choice-btn ${checkInForm.vigor === v ? 'selected' : ''}`}
                                      onClick={() => setCheckInForm({ ...checkInForm, vigor: v })}
                                      style={{ minWidth: '36px' }}
                                    >
                                      {v}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--ui-text-muted)' }}>
                                  {isGu ? 'ખેડૂત / માળીની અવલોકન નોંધ:' : 'Observation Notes & Field Comments:'}
                                </label>
                                <textarea
                                  className="checkin-notes-input"
                                  rows={2}
                                  placeholder={isGu ? 'દા.ત., પાન પરના ડાઘ સુકાવા લાગ્યા છે, નવી કૂંપળો લીલીછમ છે...' : 'e.g., Fungal spots stopped spreading, new apical leaves are vibrant and healthy...'}
                                  value={checkInForm.notes}
                                  onChange={(e) => setCheckInForm({ ...checkInForm, notes: e.target.value })}
                                />
                              </div>

                              <div className="checkin-actions-row">
                                <button
                                  type="button"
                                  className="btn-undo"
                                  onClick={() => setActiveCheckInPlantId(null)}
                                >
                                  {isGu ? 'રદ કરો' : 'Cancel'}
                                </button>
                                <button
                                  type="button"
                                  className="btn-complete"
                                  onClick={() => handleSaveHealthCheckIn(plant.id)}
                                >
                                  <CheckIcon size={14} />
                                  <span>{isGu ? 'નોંધ સાચવો' : 'Save Health Entry'}</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 4. Prescribed Treatment Schedule Roadmap */}
                          <div style={{ marginTop: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <h5 style={{ margin: 0, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ui-text-muted)' }}>
                                {isGu ? 'સારવાર શેડ્યૂલ પગલાં (સ્કેન પરિણામમાંથી)' : 'Prescribed Treatment Schedule (From Scan)'}
                              </h5>
                              <span style={{ fontSize: '11px', color: 'var(--ui-accent)', fontWeight: 600 }}>
                                {completedCount} / {scheduleSteps.length} {isGu ? 'પૂર્ણ' : 'completed'}
                              </span>
                            </div>

                            <div className="roadmap-steps-list">
                              {scheduleSteps.map((step, idx) => {
                                const stepId = `${plant.id}_treatment_${idx}`
                                const remedyId = `${plant.id}_remedy_${idx}`
                                const isDone = completedSteps.includes(stepId) || completedSteps.includes(remedyId)
                                const stepAction = step.action || (Array.isArray(step.actions) ? step.actions.join('; ') : 'Treatment step')
                                const stepTiming = step.day || step.week || (isGu ? `પગલું ${idx + 1}` : `Phase ${idx + 1}`)

                                return (
                                  <div key={idx} className={`roadmap-step-item ${isDone ? 'step-completed' : ''}`}>
                                    <button
                                      type="button"
                                      className={`step-checkbox-btn ${isDone ? 'checked' : ''}`}
                                      onClick={() => isDone
                                        ? handleUndoComplete({ id: stepId, plantId: plant.id, type: 'treatment' })
                                        : handleCompleteTask({ id: stepId, plantId: plant.id, type: 'treatment' })}
                                      aria-label="Toggle step completion"
                                    >
                                      {isDone && <CheckIcon size={12} color="#fff" />}
                                    </button>

                                    <div className="step-content-body">
                                      <div className="step-timeframe-tag">{stepTiming}</div>
                                      <div className="step-action-text">{stepAction}</div>
                                      {step.notes && <div className="step-notes-text">{step.notes}</div>}
                                    </div>

                                    <div className="step-status-tag">
                                      {isDone ? (
                                        <span className="tag-done">{isGu ? 'પૂર્ણ થયું' : 'Done'}</span>
                                      ) : (
                                        <span className="tag-pending">{isGu ? 'બાકી' : 'Pending'}</span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* 5. Health Timeline & Observation Logs */}
                          <div className="health-timeline-section">
                            <button
                              type="button"
                              className="timeline-toggle-btn"
                              onClick={() => toggleTimeline(plant.id)}
                            >
                              <ActivityIcon size={14} />
                              <span>
                                {isTimelineOpen
                                  ? (isGu ? 'સ્વાસ્થ્ય સમયરેખા છુપાવો ▲' : 'Hide Health Timeline ▲')
                                  : (isGu ? `સ્વાસ્થ્ય સુધારા સમયરેખા જુઓ (${healthLogs.length} નોંધો) ▼` : `View Health Recovery Timeline (${healthLogs.length} updates) ▼`)}
                              </span>
                            </button>

                            {isTimelineOpen && (
                              <div className="health-timeline-tree">
                                {healthLogs.map((log, lIdx) => (
                                  <div
                                    key={log.id || lIdx}
                                    className={`timeline-node ${log.status === 'recovered' ? 'node-recovered' : log.scanBased ? 'node-scan' : 'node-treatment'}`}
                                  >
                                    <div className="timeline-node-header">
                                      <span className="timeline-date">{log.date || 'Today'}</span>
                                      <span className="timeline-badge">
                                        {log.conditionLabel || log.status}
                                      </span>
                                      {log.vigor && (
                                        <span style={{ color: 'var(--ui-text-muted)' }}>
                                          Vigor: {log.vigor}/5
                                        </span>
                                      )}
                                    </div>
                                    <p className="timeline-desc">{log.notes}</p>
                                  </div>
                                ))}

                                {healthLogs.length === 0 && (
                                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--ui-text-muted)' }}>
                                    {isGu ? 'હજી સુધી કોઈ નોંધ નથી. ઉપરના "સ્વાસ્થ્ય નોંધ ઉમેરો" બટન પર ક્લિક કરો.' : 'No observations logged yet. Click "+ Log Health Check-in" above.'}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: UPCOMING 7 DAYS */}
            {activeTab === 'upcoming' && (
              <div className="upcoming-view-container">
                <div className="group-title-row" style={{ marginBottom: 'var(--space-3)' }}>
                  <h3 className="group-title">
                    <CalendarIcon size={18} />
                    <span>{isGu ? 'આગામી ૭ દિવસનું સંભાળ આયોજન' : 'Projected 7-Day Schedule'}</span>
                  </h3>
                </div>

                {upcomingTasks.length === 0 ? (
                  <div className="empty-tasks-panel panel-card">
                    <CheckCircleIcon size={24} color="var(--color-success)" />
                    <h4>{isGu ? 'આગામી કોઈ કાર્ય નથી' : 'No upcoming routines for the next 7 days'}</h4>
                  </div>
                ) : (
                  <div className="upcoming-tasks-table-wrap panel-card">
                    <table className="upcoming-table">
                      <thead>
                        <tr>
                          <th>{isGu ? 'તારીખ' : 'Scheduled Date'}</th>
                          <th>{isGu ? 'છોડ' : 'Plant'}</th>
                          <th>{isGu ? 'પ્રકાર' : 'Type'}</th>
                          <th>{isGu ? 'સૂચના' : 'Directive'}</th>
                          <th>{isGu ? 'ક્રિયા' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcomingTasks.map((task) => (
                          <tr key={task.id}>
                            <td>
                              <strong>{task.dueDateFormatted}</strong>
                              <span className="sub-day">
                                {task.dueInDays === 1
                                  ? (isGu ? 'આવતીકાલે' : 'Tomorrow')
                                  : (isGu ? `${task.dueInDays} દિવસમાં` : `in ${task.dueInDays}d`)}
                              </span>
                            </td>
                            <td>
                              <span className="plant-cell-name">{task.plantName}</span>
                            </td>
                            <td>
                              <span className="type-cell-pill">
                                {task.typeLabel}
                              </span>
                            </td>
                            <td className="directive-cell">{task.reminder}</td>
                            <td>
                              <button
                                type="button"
                                className="btn-complete-subtle"
                                onClick={() => handleCompleteTask(task)}
                                title={isGu ? 'હમણાં પૂર્ણ કરો' : 'Complete now'}
                              >
                                <CheckIcon size={12} />
                                <span>{isGu ? 'પૂર્ણ' : 'Done'}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: MY PLANTS DIRECTORY */}
            {activeTab === 'plants' && (
              <div className="plants-collection-container">
                <div className="group-title-row" style={{ marginBottom: 'var(--space-3)' }}>
                  <h3 className="group-title">
                    <PlantIcon size={18} />
                    <span>{isGu ? 'તમારા નોંધાયેલા છોડ' : 'Tracked Plant Directory'}</span>
                  </h3>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setEditingPlant(null)
                      setIsModalOpen(true)
                    }}
                  >
                    <PlusIcon size={14} />
                    <span>{isGu ? 'નવો છોડ' : 'Add Plant'}</span>
                  </button>
                </div>

                <div className="plants-cards-grid">
                  {plants.map((plant) => {
                    const ageStage = calculatePlantAgeAndStage(plant.plantingDate, plant.speciesId, language)
                    const preset = PLANT_SPECIES_PRESETS.find(p => p.id === plant.speciesId) || PLANT_SPECIES_PRESETS[PLANT_SPECIES_PRESETS.length - 1]
                    const healthBadge = getHealthBadge(plant.healthStatus)

                    return (
                      <div key={plant.id} className="plant-profile-card panel-card">
                        <div className="plant-profile-head">
                          <div className="plant-avatar">
                            {plant.image ? (
                              <img
                                src={plant.image}
                                alt={plant.name}
                                className="plant-avatar-img"
                              />
                            ) : (
                              <PlantIcon size={20} color="var(--ui-accent)" />
                            )}
                          </div>
                          <div className="plant-info-col">
                            <div className="plant-name-row">
                              <h4 className="plant-nickname">{plant.name}</h4>
                              <span className={`health-status-badge ${healthBadge.cls}`}>
                                {healthBadge.label}
                              </span>
                            </div>
                            <span className="species-subtitle">
                              {isGu ? preset.gujaratiName : preset.name} • {plant.location || 'Outdoor'}
                            </span>
                          </div>
                        </div>

                        {/* Stage progress */}
                        <div className="stage-progress-box">
                          <div className="stage-header-row">
                            <span className="stage-label">{ageStage.stageName}</span>
                            <span className="stage-days">{ageStage.ageDays} {isGu ? 'દિવસ' : 'days'}</span>
                          </div>
                          <div className="stage-progress-bar">
                            <div
                              className="stage-progress-fill"
                              style={{ width: `${ageStage.progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Active disease tag */}
                        {plant.activeDisease && (
                          <div className="plant-disease-tag">
                            <span>{isGu ? 'રોગ:' : 'Disease:'} <strong>{plant.activeDisease}</strong></span>
                          </div>
                        )}

                        {/* Dates Matrix */}
                        <div className="plant-dates-matrix">
                          <div className="date-matrix-item">
                            <span className="matrix-lbl">{isGu ? 'વાવણી' : 'Planted'}</span>
                            <strong className="matrix-val">{plant.plantingDate || '--'}</strong>
                          </div>
                          <div className="date-matrix-item">
                            <span className="matrix-lbl">{isGu ? 'છેલ્લું પાણી' : 'Last Watered'}</span>
                            <strong className="matrix-val">{plant.lastWatered || '--'}</strong>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="plant-card-actions">
                          <button
                            type="button"
                            className="btn-quick-water"
                            onClick={() => handleQuickWater(plant.id)}
                            title={isGu ? 'આજે પાણી આપ્યું' : 'Water today'}
                          >
                            <DropletIcon size={13} color="currentColor" />
                            <span>{isGu ? 'પાણી આપ્યું' : 'Water Now'}</span>
                          </button>
                          <button
                            type="button"
                            className="btn-icon-subtle"
                            onClick={() => {
                              setEditingPlant(plant)
                              setIsModalOpen(true)
                            }}
                            title={isGu ? 'સુધારો' : 'Edit details'}
                          >
                            <EditIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon-subtle btn-danger-hover"
                            onClick={() => handleDeletePlant(plant.id, plant.name)}
                            title={isGu ? 'કાઢી નાખો' : 'Remove plant'}
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Column: Real-time Weather Sync & Field Condition */}
          <div className="dashboard-side-col">
            {/* Environmental Conditions Card */}
            <div className="panel-card side-env-card">
              <div className="side-card-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <WeatherIcon size={16} color="var(--ui-accent)" />
                  <h3 className="side-card-title">{isGu ? 'હવામાન અને માટી સ્થિતિ' : 'Field Environment'}</h3>
                </div>
                {typeof onNavigateToEnv === 'function' && (
                  <button type="button" className="side-card-link-btn" onClick={onNavigateToEnv}>
                    {isGu ? 'વિગતવાર →' : 'Details →'}
                  </button>
                )}
              </div>

              <div className="side-env-metrics-grid">
                <div className="side-env-metric">
                  <span className="metric-label">{isGu ? 'તાપમાન' : 'Temperature'}</span>
                  <strong className="metric-value">{weatherData?.temperature ? `${weatherData.temperature}°C` : '--'}</strong>
                </div>
                <div className="side-env-metric">
                  <span className="metric-label">{isGu ? 'ભેજ' : 'Humidity'}</span>
                  <strong className="metric-value">{weatherData?.humidity ? `${weatherData.humidity}%` : '--'}</strong>
                </div>
                <div className="side-env-metric">
                  <span className="metric-label">{isGu ? 'માટી ભેજ (SoilHive)' : 'Soil Moisture'}</span>
                  <strong className="metric-value">{soilData?.moisture || `${weatherAdj.soilMoisturePercent}%`}</strong>
                </div>
                <div className="side-env-metric">
                  <span className="metric-label">{isGu ? 'માટી રચના' : 'Texture'}</span>
                  <strong className="metric-value">{soilData?.texture || 'Clay Loam'}</strong>
                </div>
              </div>

              {/* Weather Advisories in Sidebar */}
              {weatherAdj.weatherAlerts.length > 0 && (
                <div className="side-advisories-stack">
                  <span className="side-advisory-heading">{isGu ? 'સક્રિય અનુકૂલન સલાહ' : 'Active Field Advisories'}</span>
                  {weatherAdj.weatherAlerts.map((alert, idx) => (
                    <div key={idx} className={`side-advisory-item item-${alert.level}`}>
                      <strong>{isGu ? alert.titleGu : alert.titleEn}</strong>
                      <p>{isGu ? alert.descGu : alert.descEn}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Summary of Tracked Plants */}
            <div className="panel-card side-plants-card">
              <div className="side-card-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PlantIcon size={16} color="var(--ui-accent)" />
                  <h3 className="side-card-title">{isGu ? 'છોડ સ્ટેટસ સારાંશ' : 'Garden Summary'}</h3>
                </div>
              </div>

              <div className="side-plants-list">
                {plants.slice(0, 5).map((plant) => (
                  <div key={plant.id} className="side-plant-item">
                    <div className="side-plant-meta">
                      <span className="side-plant-name">{plant.name}</span>
                      <span className="side-plant-disease">
                        {plant.activeDisease ? plant.activeDisease : (isGu ? 'સ્વસ્થ' : 'Healthy')}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="side-water-chip"
                      onClick={() => handleQuickWater(plant.id)}
                      title={isGu ? 'પાણી આપ્યું' : 'Quick water'}
                    >
                      <DropletIcon size={12} />
                      <span>{isGu ? 'પાણી' : 'Water'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Plant Modal */}
      <PlantModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingPlant(null)
        }}
        onSave={handleSavePlant}
        initialPlant={editingPlant}
        language={language}
      />
    </div>
  )
}
