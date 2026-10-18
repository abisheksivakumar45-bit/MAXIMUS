/**
 * Single source of truth for application navigation.
 *
 * Every entry maps to a real route. Entries whose feature has not been built
 * yet render the honest "not yet implemented" page — they are never fake
 * links and never pretend to be working features.
 */

export interface NavItem {
  label: string;
  path: string;
  /** Phase (from docs/MASTER_SPEC.md) that delivers this feature. */
  phase: number;
  /** True only for features that are implemented and verified. */
  implemented: boolean;
  description: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        path: '/',
        phase: 1,
        implemented: true,
        description: 'Today’s mission, service status, and progress at a glance.',
      },
    ],
  },
  {
    title: 'Planning',
    items: [
      {
        label: 'Goals',
        path: '/goals',
        phase: 3,
        implemented: false,
        description: 'Define goals, reviews, and assessments.',
      },
      {
        label: 'Roadmaps',
        path: '/roadmaps',
        phase: 4,
        implemented: false,
        description: 'Structured, approvable milestones per goal.',
      },
      {
        label: 'Weekly Planning',
        path: '/weekly-planning',
        phase: 5,
        implemented: false,
        description: 'Weekly objectives derived from roadmap milestones.',
      },
      {
        label: 'Daily Plan',
        path: '/daily-plan',
        phase: 5,
        implemented: false,
        description: 'Daily tasks generated from weekly objectives.',
      },
    ],
  },
  {
    title: 'Growth',
    items: [
      {
        label: 'AI Coach',
        path: '/ai-coach',
        phase: 10,
        implemented: false,
        description: 'Conversational coaching grounded in your real data.',
      },
      {
        label: 'Progress Analytics',
        path: '/analytics',
        phase: 6,
        implemented: false,
        description: 'Metrics computed from persisted records.',
      },
      {
        label: 'XP & Achievements',
        path: '/achievements',
        phase: 6,
        implemented: false,
        description: 'Backend-awarded XP, levels, and achievements.',
      },
    ],
  },
  {
    title: 'Wellness',
    items: [
      {
        label: 'Health Overview',
        path: '/health',
        phase: 7,
        implemented: false,
        description: 'Nutrition, fitness, and sleep in one place.',
      },
      {
        label: 'Nutrition',
        path: '/nutrition',
        phase: 7,
        implemented: false,
        description: 'Budget-aware meal planning and logging.',
      },
      {
        label: 'Fitness & Workouts',
        path: '/fitness',
        phase: 7,
        implemented: false,
        description: 'Exercise library, workouts, and history.',
      },
      {
        label: 'Sleep',
        path: '/sleep',
        phase: 9,
        implemented: false,
        description: 'Sleep and wake logging with consistency trends.',
      },
    ],
  },
  {
    title: 'Learning',
    items: [
      {
        label: 'Academics',
        path: '/academics',
        phase: 8,
        implemented: false,
        description: 'Subjects, topics, exams, and study sessions.',
      },
      {
        label: 'Cybersecurity',
        path: '/cybersecurity',
        phase: 8,
        implemented: false,
        description: 'Learning paths, labs, and progress.',
      },
      {
        label: 'Habits & Discipline',
        path: '/habits',
        phase: 9,
        implemented: false,
        description: 'Habits, focus sessions, and routines.',
      },
    ],
  },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  label: 'Settings',
  path: '/settings',
  phase: 1,
  implemented: true,
  description: 'Application and environment information.',
};

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_SECTIONS.flatMap((section) => section.items),
  SETTINGS_NAV_ITEM,
];
