# Supabase Database Setup

## 1. Create a Supabase project

1. Go to https://app.supabase.com and create a new project.
2. Choose a strong database password and save it somewhere safe.
3. Wait for the project to finish provisioning (~1 minute).

---

## 2. Apply the schema

Open the **SQL Editor** in your Supabase dashboard and run the file:

```
server/config/wollo-exam-prep-supabase (1).sql
```

Paste the entire file contents and click **Run**.

The script will create:
- All enums, tables, indexes and foreign keys
- The signup trigger (`on_auth_user_created` → `profiles`)
- All Row Level Security (RLS) policies
- The server-side RPCs (`start_attempt`, `save_answer`, `log_tab_switch`, `submit_attempt`, `attempt_review`)
- The notification trigger (`notify_on_report`)
- Platform settings seed data (`mock_minutes = 10`, `retake_limit = 2`)

---

## 3. Configure environment variables

Copy `.env.example` to `.env` in the project root:

```
cp .env.example .env
```

Fill in the two values from **Project Settings → API**:

| Variable                | Where to find it                          |
|-------------------------|-------------------------------------------|
| `VITE_SUPABASE_URL`     | Project Settings → API → Project URL      |
| `VITE_SUPABASE_ANON_KEY`| Project Settings → API → anon public key  |

> **Never** commit `.env`. It is already in `.gitignore`.

---

## 4. Enable Email Auth

In **Authentication → Providers → Email** make sure Email provider is enabled.

For the demo you can disable "Confirm email" so students can sign in immediately.

---

## 5. (Optional) Regenerate TypeScript types

If you change the schema, regenerate `src/lib/database.types.ts`:

```bash
npx supabase login
npx supabase gen types typescript --project-id YOUR_PROJECT_REF \
  > src/lib/database.types.ts
```

---

## 6. Schema overview

```
auth.users  ← managed by Supabase Auth
    │
    └─▶ profiles (role, status, language)
            │
            ├─▶ student_profiles (exam kind, department, plan)
            ├─▶ coordinator_scopes (which tree nodes they manage)
            └─▶ course_assignments (instructor ↔ course)

tree_nodes (stream → field → subgroup → department)
    └─▶ node_courses ←─▶ courses ←─▶ topics
                                        └─▶ questions
                                               ├─▶ question_options
                                               └─▶ question_answer_keys (staff-only)

exam_attempts
    ├─▶ attempt_questions
    ├─▶ attempt_answers
    └─▶ tab_switch_events

question_reports ──triggers──▶ notifications

department_pages + department_blueprint
settings, offline_downloads, payments, audit_log, announcements
```

---

## 7. Key security rules

- **Passwords**: Supabase Auth handles all passwords. The app never sees them.
- **Answer keys**: The `question_answer_keys` table has no RLS policy for students — they literally cannot read correct answers.
- **Exam RPCs**: Students can only create/answer/submit via `start_attempt`, `save_answer`, `submit_attempt` — all `SECURITY DEFINER` functions that enforce retake limits and deadlines server-side.
- **Role changes**: Only an admin (or the service role) can change `profiles.role` or `profiles.status` — enforced by the `guard_profile` trigger.
- **Plan changes**: `student_profiles.plan` is locked by the `guard_student_profile` trigger — only the service role can upgrade a student.
