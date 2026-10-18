PROJECT: MAXIMUS
DOCUMENT: MASTER DEVELOPMENT SPECIFICATION
VERSION: 1.0
ROLE: Senior Full-Stack Engineer, AI Systems Architect, UI/UX Designer,
Database Engineer, Security Engineer, and QA Engineer

========================================================
1. PRODUCT DEFINITION — WHAT IS MAXIMUS?
========================================================

Build MAXIMUS, a premium, AI-powered personal growth and life-management
web application.

MAXIMUS is designed to help a user transform personal ambitions into
structured roadmaps, realistic daily plans, measurable actions, and
continuous improvement.

The core philosophy is:

DEFINE GOALS
    ↓
UNDERSTAND THE USER
    ↓
GENERATE PERSONALIZED ROADMAPS
    ↓
CREATE WEEKLY OBJECTIVES
    ↓
GENERATE DAILY PLANS
    ↓
COMPLETE TASKS
    ↓
EARN XP
    ↓
ANALYZE REAL PROGRESS
    ↓
ADAPT FUTURE PLANS
    ↓
REPEAT

MAXIMUS must combine the functionality of:

- A personal goal-management system
- An AI roadmap generator
- A daily planning application
- A habit and discipline tracker
- An affordable nutrition planner
- A fitness and workout tracker
- An academic study planner
- A cybersecurity learning roadmap
- A sleep and routine tracker
- An AI personal coach
- A progress analytics system
- A gamified personal growth system

This must be a functional application with persistent data,
real business logic, working interactions, validated APIs, and
proper error handling.

Do not build merely a static dashboard or UI prototype.

The initial deployment target is a locally running application
for personal use. The architecture should support future expansion
without requiring a complete rewrite.

Use MAXIMUS as the working product name.

========================================================
2. CORE PRODUCT PRINCIPLES
========================================================

Follow these principles throughout development.

1. FUNCTIONALITY BEFORE DECORATION

Every implemented feature must perform its stated purpose.

2. DATABASE AS THE SOURCE OF TRUTH

User profiles, goals, roadmaps, tasks, completions, XP transactions,
and progress records must be stored persistently.

Do not rely on hardcoded arrays or frontend-only state for
persistent application data.

3. AI FOR PERSONALIZATION

Use AI to interpret goals, generate structured roadmaps,
personalize recommendations, explain progress, and propose
appropriate adjustments.

Use deterministic application logic for calculations,
permissions, XP transactions, scheduling constraints,
and other operations that require predictable behavior.

4. USER CONTROL

The user must be able to review, edit, approve, pause,
resume, and regenerate plans when appropriate.

Do not silently replace approved roadmaps.

5. REALISTIC PLANNING

Do not generate impossible schedules.

Respect available time, priorities, rest periods, existing
commitments, and user preferences.

6. CONTINUITY

Remember previously completed roadmap milestones and learning
topics. Daily plans must continue from the existing roadmap.

7. PRIVACY

Treat personal goals, health information, schedules, and
conversations as private user data.

8. TRANSPARENCY

Clearly distinguish actual tracked data, calculated metrics,
AI recommendations, and estimates.

9. NO PUNISHMENT FOR FAILURE

Missed tasks should trigger useful recovery recommendations,
not destructive streak resets or shame-based messages.

10. NO FAKE FEATURES

Never claim functionality works unless it has been implemented
and verified.

========================================================
3. INITIAL USER GOALS
========================================================

Support these configurable goal categories.

A. HEALTHY WEIGHT AND NUTRITION
B. STRENGTH AND FITNESS
C. ACADEMICS
D. CYBERSECURITY LEARNING
E. DISCIPLINE AND HABITS
F. SLEEP CONSISTENCY
G. PERSONAL DEVELOPMENT
H. CUSTOM GOALS

Users must be able to create multiple goals.

Each goal should support:

- Name
- Description
- Category
- Motivation
- Current situation
- Desired outcome
- Priority
- Optional target date
- Available time
- Constraints
- Preferences
- Status
- Milestones
- Roadmap
- Weekly objectives
- Related daily tasks
- Progress history

Supported statuses:

- Draft
- Active
- Paused
- Completed
- Archived

Users must be able to create, view, edit, pause, resume,
complete, archive, and delete their goals.

Deleting a goal must follow a clear and safe data-handling policy.

========================================================
4. USER ONBOARDING
========================================================

Create a polished onboarding flow.

SCREEN 1: WELCOME

Introduce MAXIMUS and explain its core purpose.

SCREEN 2: BASIC PROFILE

Collect only necessary information:

- Display name
- Age or age range when appropriate
- Time zone
- Preferred language
- Typical wake-up time
- Preferred bedtime
- Daily availability

SCREEN 3: LIFESTYLE

Ask relevant questions about:

- College or work schedule
- Available study hours
- Food budget and preferences
- Exercise experience
- Available exercise equipment
- Existing routines
- Preferred planning style

SCREEN 4: GOAL SELECTION

Allow selection of one or more goals.

SCREEN 5: GOAL-SPECIFIC QUESTIONS

Dynamically ask questions relevant to selected goals.

For academics:
- Subjects
- Upcoming exams
- Strong and weak topics
- Available study time

For cybersecurity:
- Current skill level
- Previously learned topics
- Career interests
- Available weekly learning time
- Existing projects

For fitness:
- Exercise experience
- Available equipment
- Time available
- Relevant limitations

For nutrition:
- Food preferences
- Dietary restrictions
- Affordable ingredients
- Approximate budget
- Cooking availability

Collect health-related information only when necessary.

Do not require sensitive information without a clear reason.

SCREEN 6: REVIEW

Show the profile and selected goals.

Allow editing before submission.

SCREEN 7: PLAN GENERATION

Generate roadmaps and present a clear review screen.

The user must approve generated roadmaps before they become
the active plan.

Save onboarding progress so an interrupted onboarding session
can be resumed.

========================================================
5. APPLICATION PAGES
========================================================

Implement the following pages.

1. Authentication
2. Onboarding
3. Dashboard / Today
4. Goals
5. Goal Details
6. Roadmaps
7. Roadmap Details
8. Weekly Planning
9. Daily Plan
10. AI Coach
11. Health Overview
12. Nutrition
13. Fitness and Workouts
14. Sleep
15. Academics
16. Cybersecurity Learning
17. Habits and Discipline
18. Progress Analytics
19. XP and Achievements
20. Settings

Organize navigation so the application remains easy to use.

Use a responsive sidebar on desktop and an appropriate
mobile navigation pattern.

Do not implement every page as an isolated mockup.

Pages must use shared application state, backend APIs,
database records, and consistent navigation.

========================================================
6. DASHBOARD — TODAY
========================================================

The dashboard is the primary daily interface.

It must display:

- Greeting
- Current date
- Daily progress
- Active goals
- Today's tasks
- Task priorities
- Estimated remaining time
- XP earned today
- Current level
- Current consistency streak
- Upcoming commitments
- Relevant reminders
- Brief AI insight when available

Organize tasks into understandable categories:

HEALTH
FITNESS
ACADEMICS
CYBERSECURITY
DISCIPLINE
SLEEP
PERSONAL DEVELOPMENT

Example:

TODAY'S MISSION

HEALTH
[ ] Follow today's meal plan

FITNESS
[ ] Complete scheduled workout

ACADEMICS
[ ] Study Operating Systems
[ ] Revise Java

CYBERSECURITY
[ ] Learn a networking concept
[ ] Complete a practical lab

DISCIPLINE
[ ] Complete two focus sessions

SLEEP
[ ] Start the bedtime routine

Each task must support:

- Completion
- Skip with optional reason
- Rescheduling
- Viewing instructions
- Viewing estimated duration
- Viewing associated goal
- Viewing XP reward

Display progress calculated from actual persisted task records.

Do not hardcode completion percentages.

The dashboard must handle empty states, loading states,
API errors, and days without scheduled tasks.

========================================================
7. AI ROADMAP ENGINE
========================================================

This is one of MAXIMUS's most important components.

INPUTS:

- User profile
- Selected goal
- Current skill or development level
- Desired outcome
- Available time
- User preferences
- Constraints
- Relevant existing progress

OUTPUT:

A validated, structured roadmap containing:

- Goal summary
- Starting assessment
- Suggested milestones
- Milestone descriptions
- Ordered phases
- Learning or action steps
- Estimated durations
- Dependencies
- Completion criteria
- Weekly objectives
- Suggested next actions

Example cybersecurity roadmap:

PHASE 1: COMPUTER AND NETWORKING FUNDAMENTALS

PHASE 2: LINUX FUNDAMENTALS

PHASE 3: PROGRAMMING AND SCRIPTING

PHASE 4: WEB FUNDAMENTALS

PHASE 5: SECURITY FUNDAMENTALS

PHASE 6: PRACTICAL SECURITY LABS

PHASE 7: SPECIALIZATION

PHASE 8: PROJECTS AND PORTFOLIO

The roadmap must adapt to the user's existing knowledge.

Do not force users to repeat completed topics unnecessarily.

Persist approved roadmaps in the database.

Users must be able to edit milestones and regenerate selected
parts without losing unrelated progress.

If the AI service is unavailable, preserve existing roadmaps
and display an honest error message.

Do not pretend that a generated roadmap came from AI if it
was produced by a fallback rule-based template.

========================================================
8. WEEKLY PLANNING ENGINE
========================================================

Convert approved roadmap milestones into weekly objectives.

Consider:

- Goal priorities
- Milestone dependencies
- Available weekly time
- Existing commitments
- Previous task completion
- Upcoming deadlines
- User-reported difficulty
- Required rest and recovery

The weekly plan must contain realistic objectives.

Allow the user to:

- Review the plan
- Edit objectives
- Change priorities
- Reschedule tasks
- Approve the plan

Avoid scheduling every available minute.

Preserve reasonable buffer time for unexpected work.

Do not automatically increase workload simply because the
user completed one unusually productive day.

========================================================
9. DAILY PLANNING ENGINE
========================================================

Convert weekly objectives into daily actions.

Each daily task must include:

- Title
- Description
- Category
- Related goal
- Related milestone, if applicable
- Estimated duration
- Priority
- Scheduled time, when appropriate
- XP reward
- Completion criteria
- Status

Daily planning must consider:

- User availability
- College or work schedule
- Task dependencies
- Goal priorities
- Existing tasks
- Workout/rest schedule
- Study deadlines
- Sleep schedule
- Previously completed work
- User feedback

Prevent duplicate task generation.

Generating a plan twice must not silently duplicate tasks
or overwrite completed tasks.

When plans change, preserve completion history.

Users must be able to regenerate a day or modify selected
tasks without destroying their existing roadmap.

========================================================
10. ADAPTIVE PLANNING
========================================================

Analyze actual application data to identify patterns.

Possible inputs:

- Completion rates
- Missed tasks
- Skip reasons
- Available time
- Reported task difficulty
- Learning performance
- Workout history
- Sleep trends
- User feedback

Examples:

If study tasks are repeatedly too long:
Recommend shorter sessions.

If beginner cybersecurity tasks are consistently completed:
Suggest an appropriate next milestone.

If the user reports insufficient time:
Reduce or reschedule lower-priority work.

If the user misses workouts:
Preserve recovery time and adjust the schedule.

If sleep is inconsistent:
Recommend a more realistic bedtime routine.

IMPORTANT:

AI may propose changes.

The backend must validate the proposal.

The user must be able to review significant changes.

Do not automatically alter medical recommendations,
aggressive weight targets, or other health-sensitive settings.

Do not interpret a few missed tasks as a permanent personality
trait or diagnosis.

Maintain an understandable history of significant plan changes.

========================================================
11. NUTRITION SYSTEM
========================================================

Build a practical, budget-aware nutrition module.

Features:

- Food library
- Food preferences
- Dietary restrictions
- Meal planning
- Meal alternatives
- Meal checklist
- Meal logging
- Grocery suggestions
- Estimated costs when reliable price data is available
- Weekly meal plan
- Nutrition progress

Support affordable foods commonly available in India, such as:

- Rice
- Idli and dosa
- Dal
- Eggs
- Milk
- Curd
- Chickpeas
- Peanuts
- Bananas
- Seasonal vegetables
- Potatoes
- Other locally available foods

Food recommendations must respect the user's preferences
and dietary restrictions.

Do not invent exact current food prices.

If reliable price data is unavailable, label cost estimates
as estimates and let users enter local prices.

The AI must not prescribe extreme diets, unsafe weight-gain
methods, dangerous supplements, or unsupported medical
nutrition advice.

Do not treat meal completion as proof that nutritional
requirements were met.

Support sensible substitutions and affordable alternatives.

========================================================
12. FITNESS SYSTEM
========================================================

Create a structured exercise database.

Each exercise may contain:

- Name
- Instructions
- Muscle group
- Difficulty
- Required equipment
- Sets
- Repetitions
- Duration
- Rest intervals
- Safety notes
- Progression guidance

Support:

- Workout scheduling
- Workout sessions
- Exercise completion
- Sets and repetitions
- Performance history
- Rest days
- Workout modifications
- Exercise alternatives

Use deterministic workout templates and validated rules
for basic workout construction.

AI can personalize approved templates but must not invent
unsafe training progressions.

Do not automatically increase intensity when performance
or recovery suggests that doing so may be inappropriate.

Allow the user to report discomfort and stop a workout.

Health-related limitations should trigger appropriate caution
and professional guidance when necessary.

========================================================
13. ACADEMIC PLANNING
========================================================

Support:

- Subjects
- Topics
- Exams
- Deadlines
- Study sessions
- Revision sessions
- Focus timers
- Study notes or references
- Completion tracking
- Performance history

AI should help prioritize topics using:

- Exam deadlines
- Topic importance
- Difficulty
- User-reported understanding
- Previous performance
- Available study time

Do not claim to know examination syllabuses or dates unless
they have been provided by the user or verified from a source.

Preserve the user's learning progress.

========================================================
14. CYBERSECURITY LEARNING
========================================================

Build a structured cybersecurity learning module.

Support:

- Learning paths
- Topics
- Lessons
- Practical labs
- Learning notes
- Progress
- Study time
- Projects
- Milestones

Example foundations:

Networking
Linux
Programming
Web technologies
Security fundamentals
Security tools
Practical labs
Specialization
Projects
Portfolio

Allow users to choose a learning path, such as:

- SOC analyst
- Defensive security
- Penetration testing
- Security engineering

Adapt recommendations to current skill level.

Use legal, authorized training environments for practical
security exercises.

Track completed topics and avoid repeatedly assigning
already-mastered beginner material.

Do not fabricate certifications, lab completions, skills,
or learning achievements.

========================================================
15. HABITS AND DISCIPLINE
========================================================

Implement:

- Habit creation
- Daily and weekly frequencies
- Habit completion
- Habit history
- Streaks
- Focus sessions
- Morning routines
- Evening routines
- Optional screen-time goals

Users must be able to pause or modify habits.

Missing a day must not erase historical achievements.

Distinguish a missed habit from a habit the user deliberately
scheduled as a rest day.

Provide supportive recovery suggestions.

Avoid shame-based messages.

========================================================
16. SLEEP TRACKING
========================================================

Support:

- Sleep and wake times
- Sleep duration
- Personal sleep goals
- Sleep history
- Consistency charts
- Bedtime routines
- Optional reminders

Calculate duration accurately, including sleep that crosses
midnight.

Use the user's configured time zone.

Do not diagnose medical sleep disorders.

Do not claim that a particular sleep duration guarantees
a specific health outcome.

========================================================
17. XP, LEVELS, AND ACHIEVEMENTS
========================================================

Implement a deterministic points system.

Possible starting rewards:

Small habit: 5 XP
30-minute study session: 15 XP
60-minute study session: 25 XP
Completed workout: 30 XP
Practical learning task: 30 XP
Sleep routine completion: 10 XP

These are configurable starting values, not mandatory
medical or productivity measurements.

Requirements:

- XP transaction history
- Current total XP
- Level calculation
- Achievements
- Daily XP
- Weekly XP
- Streak calculation

CRITICAL:

XP must be awarded by the backend only.

Prevent repeated completion requests from awarding XP multiple
times for the same task completion.

Use database transactions and idempotency protections where
appropriate.

Users must not be able to manipulate XP by modifying
frontend state or sending arbitrary XP values.

Do not award points simply because the user opens a page.

Do not use fake progress or random achievements.

Make XP rewards transparent and consistent.

========================================================
18. PROGRESS ANALYTICS
========================================================

Display analytics calculated from actual persisted data.

Examples:

- Task completion rate
- Weekly consistency
- Monthly consistency
- Study time
- Workout frequency
- Roadmap milestone completion
- Habit completion
- Sleep consistency
- Goal progress

Every metric must have a clear definition.

Do not present arbitrary weighted averages as scientifically
validated measures of personal growth.

If an overall MAXIMUS score is implemented, label it as an
application-defined progress indicator and explain its
calculation.

Do not fabricate historical records to populate charts.

For a new user, display helpful empty states.

========================================================
19. AI COACH
========================================================

Implement a conversational AI coach.

Possible requests:

- Analyze my weekly progress.
- Help me recover after missing tasks.
- Explain today's plan.
- Reschedule tasks because I have exams.
- Suggest affordable food alternatives.
- Explain a cybersecurity topic.
- Help me identify why my routine is failing.
- Suggest realistic priorities for next week.

The AI must use relevant, actual user data.

It must not invent past conversations, completed tasks,
measurements, achievements, or personal information.

Keep unrelated sensitive data out of AI requests.

Use structured context retrieval instead of sending the
entire database or full personal history every time.

Validate AI-generated structured output before using it.

Handle:

- API timeouts
- Rate limits
- Invalid responses
- Provider errors
- Missing API keys
- Malformed JSON

Never display a fabricated AI response as if a real
provider call succeeded.

If AI is unavailable, clearly distinguish any rule-based
fallback from actual AI-generated advice.

========================================================
20. DATABASE REQUIREMENTS
========================================================

Use PostgreSQL for persistent application data.

Use SQLAlchemy for ORM and migrations with Alembic.

Create normalized, well-related database tables.

At minimum, consider:

users
profiles
goals
goal_assessments
roadmaps
roadmap_milestones
weekly_objectives
daily_plans
daily_tasks
task_completions
habits
habit_logs
food_items
meals
meal_logs
exercises
workouts
workout_sessions
subjects
academic_topics
study_sessions
learning_paths
learning_topics
learning_sessions
sleep_logs
xp_transactions
achievements
user_achievements
ai_conversations
ai_messages
weekly_reviews
notifications
plan_change_history

Add tables only when justified by the actual implementation.

Requirements:

- Primary keys
- Foreign keys
- Appropriate indexes
- Unique constraints
- Created/updated timestamps
- User ownership
- Correct deletion behavior
- Transactional updates
- Data validation

Use migrations for schema changes.

Do not rely on automatic table recreation in production.

Do not silently discard existing data when the schema changes.

Do not store sensitive information unnecessarily.

========================================================
21. BACKEND ARCHITECTURE
========================================================

Use Python and FastAPI.

Organize backend code into maintainable modules.

Suggested structure:

backend/
    app/
        main.py
        core/
            config.py
            security.py
            logging.py
        api/
            routes/
        models/
        schemas/
        repositories/
        services/
        ai/
        planning/
        tests/
    alembic/
    requirements.txt

Separate:

- API routing
- Request/response schemas
- Database models
- Database access
- Business logic
- AI orchestration
- Authentication
- Planning logic
- Validation

Use dependency injection where appropriate.

Use Pydantic schemas for request and response validation.

Use consistent HTTP status codes and error responses.

Never put all business logic into one giant route file.

========================================================
22. FRONTEND ARCHITECTURE
========================================================

Use:

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Recharts

Use a modular structure such as:

frontend/
    src/
        app/
        components/
        features/
            auth/
            onboarding/
            goals/
            roadmaps/
            daily-plan/
            ai-coach/
            nutrition/
            fitness/
            academics/
            cybersecurity/
            sleep/
            analytics/
        hooks/
        lib/
        services/
        types/
        styles/

Use reusable components and strongly typed API responses.

Keep API communication in a dedicated service layer.

Do not mix database logic or secret keys into frontend code.

Avoid oversized components.

Use appropriate state management based on actual complexity.

Provide loading, success, empty, error, and disabled states.

Use accessible semantic HTML and keyboard navigation.

========================================================
23. UI AND VISUAL DESIGN
========================================================

Create a premium, futuristic, disciplined visual identity.

Design direction:

- Dark-first theme
- Charcoal/near-black backgrounds
- Carefully selected accent colors
- Strong typography
- Clean spacing
- Subtle borders
- Controlled gradients
- Restrained glass effects
- Smooth micro-interactions
- Professional data visualizations
- Responsive layouts

Avoid:

- Excessive neon
- Excessive glow
- Overloaded dashboards
- Too many cards
- Unnecessary animations
- Generic AI-generated landing-page aesthetics
- Fake terminal effects
- Decorative elements that reduce readability

The dashboard should emphasize today's priorities.

Use consistent design tokens for:

- Colors
- Typography
- Spacing
- Borders
- Radius
- Shadows
- Animation duration

Support desktop, tablet, and mobile layouts.

Follow reduced-motion preferences.

Use meaningful icons and labels.

Do not use emoji as the only visual label for important
navigation or actions.

All forms must have validation and understandable feedback.

Every interactive element must have a real action.

========================================================
24. AUTHENTICATION AND SECURITY
========================================================

Implement secure authentication.

Requirements:

- Password hashing with a suitable password-hashing library
- Secure session management
- Login and logout
- Protected routes
- Authorization checks
- Input validation
- Rate limiting
- Secure cookies when cookie-based sessions are used
- CSRF protection where applicable
- Strict CORS configuration
- Protection against SQL injection
- XSS prevention
- Safe error handling
- Secret management
- User data isolation

Choose one authentication architecture and implement it
consistently.

Do not invent authentication success.

Do not trust user IDs supplied by the frontend as proof
of ownership.

Derive the authenticated identity from the validated session
or token.

Every user-owned database query must enforce ownership.

Never expose:

- Password hashes
- Secret keys
- Database credentials
- Internal stack traces
- Private data belonging to other users

Use environment variables for secrets.

Create a .env.example containing placeholders only.

Ensure real .env files are excluded from Git.

Never hardcode AI API keys into source code.

Never commit credentials.

========================================================
25. AI SERVICE CONFIGURATION
========================================================

Create a backend AI service abstraction.

The model provider and model name should be configurable.

Do not assume that a provider or model is available without
checking its current configuration.

Requirements:

- Backend-only provider credentials
- Request timeouts
- Error handling
- Structured output validation
- Sensible token limits
- Rate limiting
- Controlled retries
- Logging without sensitive prompt contents
- Separation of AI logic from API routes

If no AI API key is configured:

- The application must still start when possible.
- Core non-AI functionality must remain usable.
- Show a clear AI configuration message.
- Do not pretend real AI generation occurred.
- Allow the user to continue with available non-AI features.

Use a small, testable provider interface so another model
provider can be integrated later.

========================================================
26. DOCKER AND LOCAL DEVELOPMENT
========================================================

Use Docker Compose for local development.

Provide a configuration for:

- Frontend
- Backend
- PostgreSQL

Use appropriate environment variables.

Add health checks and dependency handling.

Persist PostgreSQL data using a named volume.

Do not place real credentials in Docker configuration.

Provide clear instructions for Windows 11 and VS Code.

The intended workflow should be simple:

1. Open the project in VS Code.
2. Configure environment variables.
3. Start the application with the documented command.
4. Open the local frontend.
5. Stop the application using the documented command.

If helper scripts are provided, make them safe and predictable.

Do not require unnecessary manual terminal steps every time.

Provide:

README.md
.env.example
.dockerignore
.gitignore

Document required software and exact commands.

========================================================
27. CODING STANDARDS
========================================================

Follow these standards.

1. Use TypeScript strict mode.
2. Avoid unnecessary use of any.
3. Use meaningful variable and function names.
4. Keep components small and focused.
5. Separate presentation from business logic.
6. Use typed API contracts.
7. Use Pydantic validation.
8. Handle errors explicitly.
9. Avoid duplicated business logic.
10. Keep secrets out of source code.
11. Use migrations for database changes.
12. Add tests for important business rules.
13. Document non-obvious logic.
14. Remove dead code.
15. Avoid unnecessary dependencies.
16. Avoid giant source files.
17. Avoid circular imports.
18. Use consistent formatting and linting.
19. Use deterministic logic for financial-like calculations
    such as XP and progress metrics.
20. Never suppress errors merely to make the application
    appear successful.

Do not rewrite unrelated working modules without a clear reason.

Do not delete user data or project files without explicit
authorization.

========================================================
28. TESTING REQUIREMENTS
========================================================

Use appropriate testing tools.

Frontend:
- Vitest
- React Testing Library

Backend:
- Pytest
- FastAPI test client

Test at least:

AUTHENTICATION
- Successful login
- Invalid credentials
- Logout
- Unauthorized access

AUTHORIZATION
- User cannot read another user's records
- User cannot modify another user's records

GOALS
- Create
- Update
- Pause
- Resume
- Delete

ROADMAPS
- Generate
- Validate
- Approve
- Persist
- Update without losing progress

DAILY PLANS
- Generate without duplicates
- Preserve completed tasks
- Reschedule correctly

XP
- Award correct XP
- Prevent duplicate rewards
- Reject unauthorized XP manipulation

AI
- Handle malformed output
- Handle unavailable provider
- Handle timeout
- Validate generated tasks

HEALTH
- Respect configured limitations
- Avoid unsupported medical claims
- Validate workout and meal-plan structures

DATABASE
- Migrations
- Foreign keys
- Transactions
- Data persistence

UI
- Loading states
- Empty states
- Error states
- Responsive layouts
- Working forms

Run available tests and report the actual results.

Do not claim that tests passed if they were not executed.

========================================================
29. STRICT NO-FAKE-FUNCTIONALITY POLICY
========================================================

THIS SECTION IS MANDATORY.

Never use fake functionality to make MAXIMUS appear complete.

PROHIBITED:

- Buttons that do nothing
- Forms that do not submit real data
- Fake login or registration
- Hardcoded dashboard statistics presented as real
- Fake AI responses presented as live AI
- Randomly generated progress
- Fake task completion
- XP awarded only in frontend state
- Charts populated with invented historical data
- Success messages when backend operations fail
- Mock API responses in production flows
- Simulated database persistence
- Placeholder links presented as functional pages
- Pretending an integration is configured when it is not

Development fixtures and test mocks are permitted only when
explicitly isolated from real application functionality.

When a feature is not implemented, label it honestly as
unavailable or not yet implemented.

For every feature, determine:

1. What action the user performs.
2. What validation occurs.
3. What backend operation runs.
4. What database change occurs.
5. What result is returned.
6. What the interface displays.
7. How failures are handled.
8. How the behavior is tested.

A feature is not complete merely because its UI exists.

It is complete when its end-to-end behavior works and has
been verified to the appropriate level.

If something cannot be implemented in the current phase,
document the limitation rather than silently substituting
a mock.

========================================================
30. DEVELOPMENT PHASES
========================================================

Implement the project incrementally.

Do not attempt to build every feature in one enormous change.

PHASE 0 — PROJECT INSPECTION AND PLAN

- Inspect the working directory.
- Identify existing files and tools.
- Preserve useful existing work.
- Check the available environment.
- Create an implementation plan.
- Identify missing dependencies.
- Confirm the intended architecture.

Do not overwrite an existing project blindly.

PHASE 1 — FOUNDATION

- Initialize frontend.
- Initialize backend.
- Configure PostgreSQL.
- Configure Docker Compose.
- Configure environment variables.
- Add health endpoints.
- Add database migrations.
- Create the initial UI shell.
- Document startup instructions.

PHASE 2 — AUTHENTICATION AND PROFILE

- Registration
- Login
- Logout
- Secure sessions
- Protected routes
- Profile management
- Validation
- Tests

PHASE 3 — GOALS AND ONBOARDING

- Onboarding flow
- Goal selection
- Custom goals
- Goal assessment
- Goal CRUD
- Persistent storage

PHASE 4 — ROADMAP ENGINE

- AI provider abstraction
- Structured roadmap schema
- Roadmap generation
- Validation
- Approval
- Milestones
- Persistent roadmap history

PHASE 5 — WEEKLY AND DAILY PLANNING

- Weekly objectives
- Daily plans
- Task scheduling
- Duplicate prevention
- Rescheduling
- Completion tracking

PHASE 6 — XP AND PROGRESS

- Backend XP transactions
- Levels
- Streaks
- Achievements
- Progress calculations
- Analytics

PHASE 7 — NUTRITION AND FITNESS

- Affordable food library
- Meal planning
- Meal logging
- Exercise library
- Workout generation
- Workout tracking
- Weight tracking where appropriate

PHASE 8 — ACADEMICS AND CYBERSECURITY

- Academic subjects
- Topics
- Study sessions
- Cybersecurity learning paths
- Labs
- Projects
- Learning progress

PHASE 9 — SLEEP AND DISCIPLINE

- Sleep tracking
- Habit tracking
- Focus sessions
- Routine management
- Recovery system

PHASE 10 — AI COACH

- Conversation persistence
- Relevant user-context retrieval
- Daily analysis
- Weekly review
- Goal-specific recommendations

PHASE 11 — ADAPTIVE PLANNING

- Performance analysis
- Workload adjustments
- User feedback
- Recovery recommendations
- Plan-change history

PHASE 12 — SECURITY AND QUALITY ASSURANCE

- Security review
- Authorization tests
- API validation
- AI error handling
- Database integrity
- Responsive UI testing
- Regression tests

PHASE 13 — FINAL POLISH

- Accessibility
- UI refinement
- Mobile responsiveness
- Performance optimization
- Optional PWA support
- Documentation improvements

Do not start a later phase merely because the previous phase's
UI has been generated.

Verify completion criteria first.

========================================================
31. PHASE COMPLETION PROTOCOL
========================================================

At the beginning of each phase:

1. Read the project documentation.
2. Inspect the current implementation.
3. Identify the phase's requirements.
4. List files that need to change.
5. Identify dependencies and risks.

During implementation:

1. Make focused changes.
2. Reuse existing working code.
3. Keep interfaces consistent.
4. Add or update tests.
5. Preserve existing user data.
6. Avoid unrelated refactoring.

At the end of each phase:

1. Run relevant tests.
2. Run type checking.
3. Run linting if configured.
4. Verify the frontend builds.
5. Verify the backend starts.
6. Check database migrations.
7. Test implemented workflows.
8. Review error handling.
9. Update README documentation.
10. Summarize actual results.

Report:

- Features implemented
- Files changed
- Tests executed
- Tests passed
- Tests failed
- Known limitations
- Environment variables required
- Exact startup commands
- Recommended next phase

Never invent successful test results.

If a check cannot run, explain why.

========================================================
32. PROJECT DOCUMENTATION
========================================================

Maintain these files:

README.md
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/AI_DESIGN.md
docs/SECURITY.md
docs/DEVELOPMENT_PLAN.md
docs/IMPLEMENTATION_STATUS.md

Use the current master specification as the source of truth.

Update implementation status as features are completed.

Record architectural decisions when they materially affect
future development.

Do not mark planned features as implemented.

========================================================
33. MVP ACCEPTANCE CRITERIA
========================================================

The initial MVP is considered functional only when:

1. A user can register and log in.
2. Profile data persists after restart.
3. A user can create and manage goals.
4. Goal assessments can be saved.
5. The configured AI service can generate a structured roadmap.
6. Roadmaps can be reviewed and approved.
7. Approved roadmaps persist in the database.
8. Weekly objectives can be created.
9. Daily plans can be generated from approved objectives.
10. Daily tasks can be completed and rescheduled.
11. Completed tasks remain completed after refresh and restart.
12. XP is awarded correctly by the backend.
13. Duplicate requests do not duplicate rewards.
14. Progress reflects actual stored records.
15. User data is properly isolated.
16. AI failures are handled honestly.
17. Core functionality has automated tests.
18. The application starts using documented instructions.
19. The application has no knowingly fake functional elements.
20. Known limitations are documented.

If AI configuration is unavailable, the application may still
provide working non-AI features, but AI-dependent acceptance
criteria must remain explicitly unverified.

========================================================
34. IMMEDIATE INSTRUCTIONS
========================================================

BEGIN WITH PHASE 0 AND PHASE 1 ONLY.

Do not attempt to implement all phases in the initial response.

First inspect the current working directory and available
environment.

Then:

1. Summarize the current project state.
2. Identify any existing files that must be preserved.
3. Present the proposed directory structure.
4. Implement the foundation.
5. Configure the local development environment.
6. Add initial documentation.
7. Run available checks.
8. Fix errors caused by your changes.
9. Verify the application can start.
10. Report actual results.

Do not begin authentication, roadmap generation, nutrition,
fitness, academic planning, or AI coaching until the foundation
is working.

Do not delete files or overwrite existing work without
understanding their purpose.

Do not ask unnecessary questions if a sensible, safe default
can be used.

If a genuinely blocking decision requires user input, explain
the issue and ask one concise question.

Otherwise, make reasonable engineering decisions and document
them.

FINAL DIRECTIVE:

Build MAXIMUS as a real, maintainable, secure, testable
application.

Prioritize correctness, working functionality, data integrity,
clear architecture, and honest reporting over the number
of features generated.

Never fake completion.

Start with PHASE 0.