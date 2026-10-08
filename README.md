# Wollo University Exam Prep

A beginner-friendly React version of the Wollo University exam preparation demo.
It includes a landing page, sample sign-in and registration forms, course
selection, practice questions, a timed mock exam, results, and progress.

## Run locally

1. Install Node.js.
2. Open a terminal in this project folder.
3. Run `npm install`.
4. Run `npm run dev` and open the local address shown in the terminal.

The sign-in screen is a front-end demo, so any student ID and password work.
Choose Administrator on the login form to open the sample administration dashboard.
The questions and progress figures are sample content, not an official exam
database.

## Project structure

- `src/App.jsx` coordinates navigation and app-wide state.
- `src/components/layout/` contains the shared site header and footer.
- `src/components/pages/` contains the home, sign-in, department/course selection, quiz, results, remedial, analytics, admin dashboard, and question management screens.
- `src/components/dashboard/` contains the student overview and progress view, plus reusable course-selection components.
- `src/data/` contains the course catalog and practice questions.
- `src/utils/` contains helpers for aggregating completed-session analytics.
- `src/i18n/` contains the English, Amharic, Afaan Oromo, and Tigrinya translations and language selector.
- Each UI component has a neighboring CSS file; `src/styles.css` contains shared styles and design tokens.
