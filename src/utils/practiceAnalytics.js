export function getPracticeAnalytics(history) {
  let totalCorrect = 0;
  let totalQuestions = 0;
  let totalAnswered = 0;
  const courses = new Map();

  for (const session of history) {
    totalCorrect += session.correct;
    totalQuestions += session.total;
    totalAnswered += session.answered ?? session.total;
    const course = courses.get(session.course) ?? {
      course: session.course,
      correct: 0,
      total: 0,
      sessions: 0,
    };
    course.correct += session.correct;
    course.total += session.total;
    course.sessions += 1;
    courses.set(session.course, course);
  }

  return {
    sessions: history.length,
    totalQuestions,
    totalAnswered,
    averageScore: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    recentScores: history.slice(0, 6).map((session) => ({
      ...session,
      percentage: session.total ? Math.round((session.correct / session.total) * 100) : 0,
    })),
    coursePerformance: [...courses.values()].map((course) => ({
      ...course,
      percentage: course.total ? Math.round((course.correct / course.total) * 100) : 0,
    })),
  };
}
