export interface ScheduleItem {
  id: number
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  memo: string | null
  source: string | null
}

export interface GoalItem {
  id: number
  parent_id: number | null
  title: string
  issue_type: 'epic' | 'story' | 'task' | 'subtask'
  status: 'todo' | 'in_progress' | 'done'
  priority: 'high' | 'medium' | 'low'
  category: string
  start_date: string
  end_date: string
  progress: number
  color: string
  memo: string | null
  sort_order: number
  scheduled_time: string | null
  scheduled_duration: number | null
}

export interface GoalTreeNode {
  goal: GoalItem
  children: GoalTreeNode[]
  depth: number
}

export interface RoutineItem {
  id: number
  name: string
  start_time: string
  end_time: string
  day_of_week: string
  sort_order: number
}

export type CalendarView = 'month' | 'week' | 'day'

export interface CalendarEvent {
  type: 'schedule' | 'goal'
  id: number
  title: string
  date: string
  endDate?: string
  startTime?: string
  endTime?: string
  color: string
  status?: string
  issueType?: string
  original: ScheduleItem | GoalItem
}

// Positioned band segment for rendering leaf-only goal bars
export interface BandSegment {
  id: number
  left: number   // percentage 0-100
  width: number  // percentage 0-100
  top: number    // px from top of overlay area
  height: number // px
  depth: number
  issueType: string
  title: string
  hasChildren: boolean
  epicTitle: string | null   // 祖先Epicのタイトル
  storyTitle: string | null  // 祖先Storyのタイトル
  goal: GoalItem
}
