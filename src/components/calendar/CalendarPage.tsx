import { useState, useMemo, useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import type { ScheduleItem, GoalItem, CalendarView, CalendarEvent, RoutineItem } from './calendarTypes'
import { formatDate, getMonthRange, getWeekRange, getDayRange, mergeEvents } from './calendarUtils'
import CalendarHeader from './CalendarHeader'
import CalendarMonthView from './CalendarMonthView'
import CalendarWeekView from './CalendarWeekView'
import CalendarDayView from './CalendarDayView'
import CalendarFormModal from './CalendarFormModal'

export default function CalendarPage() {
  const [view, setView] = useState<CalendarView>('month')
  const [anchorDate, setAnchorDate] = useState(formatDate(new Date()))

  // Compute date range based on current view
  const range = useMemo(() => {
    const d = new Date(anchorDate + 'T00:00:00')
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    switch (view) {
      case 'month': return getMonthRange(year, month)
      case 'week': return getWeekRange(anchorDate)
      case 'day': return getDayRange(anchorDate)
    }
  }, [view, anchorDate])

  // Fetch data with range parameters
  const { data: schedules, refetch: refetchSchedules } = useApi<ScheduleItem[]>(
    `/api/schedules?from=${range.from}&to=${range.to}`
  )
  const { data: goals, refetch: refetchGoals } = useApi<GoalItem[]>(
    `/api/goals?from=${range.from}&to=${range.to}`
  )
  const { data: routines } = useApi<RoutineItem[]>('/api/routines')

  // Merge into unified events — exclude habit-derived schedules
  const nonHabitSchedules = useMemo(
    () => (schedules ?? []).filter(s => s.source !== 'habit'),
    [schedules]
  )
  const events = useMemo(() => mergeEvents(nonHabitSchedules, goals), [nonHabitSchedules, goals])

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'schedule' | 'goal'>('schedule')
  const [editItem, setEditItem] = useState<ScheduleItem | GoalItem | null>(null)
  const [prefilledDate, setPrefilledDate] = useState<string | null>(null)

  // Refetch both data sources
  const refetchAll = useCallback(() => {
    refetchSchedules()
    refetchGoals()
  }, [refetchSchedules, refetchGoals])

  // Navigation
  const handleNavigate = useCallback((direction: -1 | 0 | 1) => {
    if (direction === 0) {
      setAnchorDate(formatDate(new Date()))
      return
    }
    const d = new Date(anchorDate + 'T00:00:00')
    if (view === 'month') {
      d.setMonth(d.getMonth() + direction)
    } else if (view === 'week') {
      d.setDate(d.getDate() + direction * 7)
    } else {
      d.setDate(d.getDate() + direction)
    }
    setAnchorDate(formatDate(d))
  }, [anchorDate, view])

  // Date click → open schedule creation modal
  const handleDateClick = useCallback((dateStr: string) => {
    setPrefilledDate(dateStr)
    setModalMode('schedule')
    setEditItem(null)
    setShowModal(true)
  }, [])

  // Time slot click → open schedule creation modal with time
  const handleSlotClick = useCallback((dateStr: string, _time: string) => {
    setPrefilledDate(dateStr)
    setModalMode('schedule')
    setEditItem(null)
    setShowModal(true)
  }, [])

  // Event click → open edit modal
  const handleEventClick = useCallback((event: CalendarEvent) => {
    setEditItem(event.original)
    setModalMode(event.type)
    setPrefilledDate(null)
    setShowModal(true)
  }, [])

  // Navigate to day view
  const handleNavigateToDay = useCallback((dateStr: string) => {
    setAnchorDate(dateStr)
    setView('day')
  }, [])

  // Modal saved → close and refetch
  const handleSaved = useCallback(() => {
    setShowModal(false)
    setEditItem(null)
    refetchAll()
  }, [refetchAll])

  const goalsArray = goals ?? []

  return (
    <div>
      <CalendarHeader
        view={view}
        onViewChange={setView}
        anchorDate={anchorDate}
        onNavigate={handleNavigate}
      />

      {view === 'month' && (
        <CalendarMonthView
          anchorDate={anchorDate}
          events={events}
          goals={goalsArray}
          onDateClick={handleDateClick}
          onEventClick={handleEventClick}
          onNavigateToDay={handleNavigateToDay}
        />
      )}

      {view === 'week' && (
        <CalendarWeekView
          anchorDate={anchorDate}
          events={events}
          goals={goalsArray}
          routines={routines ?? []}
          onSlotClick={handleSlotClick}
          onEventClick={handleEventClick}
        />
      )}

      {view === 'day' && (
        <CalendarDayView
          date={anchorDate}
          events={events}
          goals={goalsArray}
          routines={routines ?? []}
          onSlotClick={handleSlotClick}
          onEventClick={handleEventClick}
        />
      )}

      {showModal && (
        <CalendarFormModal
          mode={modalMode}
          editItem={editItem}
          prefilledDate={prefilledDate}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
