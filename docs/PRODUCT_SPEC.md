# MAXIMUS — Product Specification

This is a working summary of the product. The authoritative, detailed
specification is [`MASTER_SPEC.md`](./MASTER_SPEC.md); where the two differ,
the master specification wins.

## 1. Product

MAXIMUS is a premium, AI-powered personal growth and life-management web
application. It turns ambitions into structured roadmaps, realistic daily
plans, measurable actions, and continuous improvement.

Core loop:

```
Define goals → Understand the user → Generate roadmaps → Weekly objectives
→ Daily plans → Complete tasks → Earn XP → Analyse progress → Adapt → Repeat
```

## 2. Target goal categories

Healthy weight & nutrition · Strength & fitness · Academics · Cybersecurity
learning · Discipline & habits · Sleep consistency · Personal development ·
Custom goals.

## 3. Core principles

1. Functionality before decoration.
2. The database is the source of truth — no persistent data in frontend state
   or hardcoded arrays.
3. AI for personalisation; deterministic logic for XP, scheduling constraints,
   permissions, and metrics.
4. User control — approve, edit, pause, resume, regenerate; approved plans are
   never silently replaced.
5. Realistic planning — respect available time, rest, and commitments.
6. Continuity — remember completed milestones and learned topics.
7. Privacy — personal data is treated as private.
8. Transparency — distinguish tracked data, calculated metrics,
   recommendations, and estimates.
9. No punishment for failure — offer recovery, not shame or streak resets.
10. No fake features — never present unimplemented functionality as working.

## 4. Planned application areas

Authentication · Onboarding · Dashboard/Today · Goals · Goal details ·
Roadmaps · Weekly planning · Daily plan · AI coach · Health overview ·
Nutrition · Fitness · Sleep · Academics · Cybersecurity learning · Habits &
discipline · Progress analytics · XP & achievements · Settings.

Each area is implemented in the phase defined by the master specification and
is labelled honestly in the UI until then.
