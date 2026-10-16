/** A completed weekend is only a season review if no later round is known. */
export function showSeasonReview(round: number, calendarRounds: number[], weekendFinished: boolean): boolean {
  return calendarRounds.length > 0 && weekendFinished && !calendarRounds.some(next => next > round);
}
