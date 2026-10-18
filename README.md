# Wollo University Exam Prep

A React version of the Wollo University exam preparation platform. It includes
a landing page, Supabase email/password sign-in and registration, course
selection, practice questions, a timed mock exam, results, and progress.

## Run locally

1. Install Node.js and run `npm install`.
2. In the Supabase Dashboard, open **SQL Editor**, paste the supplied Wollo
   schema SQL file, and run it once on your project.
3. Copy `.env.example` to `.env` and fill in the Supabase **Project URL** and
   **anon/public key** from **Project Settings → API**:

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   ```

   Never put the `service_role` key in this frontend project.
4. In the Supabase Dashboard, configure **Authentication → URL Configuration**
   with your local URL (for example, `http://localhost:5173`) as a redirect URL.
   If email confirmation is enabled, new users must confirm their email before
   logging in.
5. Run `npm run dev` and open the local address shown in the terminal.

New sign-ups create student accounts through Supabase Auth. The SQL trigger
creates each user's `profiles` row; staff roles must be granted by an
administrator and cannot be selected on the sign-in screen. Row Level Security
from the schema controls database access.

Authentication and profile loading are connected to Supabase. The current
course catalog, questions, dashboard analytics, and other app content are still
sample/local data and have not yet been wired to the database tables.

## Project structure

- `src/App.jsx` coordinates navigation and app-wide state.
- `src/components/layout/` contains the shared site header and footer.
- `src/components/pages/` contains the home, sign-in, department/course selection, quiz, results, remedial, analytics, admin dashboard, and question management screens.
- `src/components/dashboard/` contains the student overview and progress view, plus reusable course-selection components.
- `src/data/` contains the course catalog and practice questions.
- `src/utils/` contains helpers for aggregating completed-session analytics.
- `src/i18n/` contains the English, Amharic, Afaan Oromo, and Tigrinya translations and language selector.
- Each UI component has a neighboring CSS file; `src/styles.css` contains shared styles and design tokens.
