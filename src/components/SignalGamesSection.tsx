import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../hooks/useContent";
import { trackGameLifecycle } from "../lib/analytics";
import { GameCatalogItem, LiveEventsFeed, TopFeed } from "../types/content";

type SignalGameMode = "headline-match" | "timeline-sort" | "world-quiz" | "rapid-reaction";

interface SignalGamesSectionProps {
  items?: GameCatalogItem[];
  loading: boolean;
  error: string | null;
}

interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function SignalGamesSection({ items, loading, error }: SignalGamesSectionProps) {
  const featuredItems = (items ?? []).filter((item) =>
    ["headline-match", "timeline-sort", "world-quiz", "rapid-reaction"].includes(item.mode),
  ) as GameCatalogItem[];
  const initialMode = (featuredItems[0]?.mode as SignalGameMode | undefined) ?? "headline-match";
  const [activeMode, setActiveMode] = useState<SignalGameMode>(initialMode);

  const news = useContent<TopFeed>("/content/news/top.json", { refreshMs: 60000 });
  const sports = useContent<TopFeed>("/content/sports/top.json", { refreshMs: 60000 });
  const tech = useContent<TopFeed>("/content/tech/top.json", { refreshMs: 60000 });
  const liveEvents = useContent<LiveEventsFeed>("/content/live/events.json", { refreshMs: 60000 });

  const startTrackerRef = useRef<string | null>(null);

  useEffect(() => {
    if (startTrackerRef.current === activeMode) {
      return;
    }

    startTrackerRef.current = activeMode;
    trackGameLifecycle("game_start", activeMode);
  }, [activeMode]);

  const headlineDeck = useMemo(
    () =>
      shuffle([
        ...(news.data?.items.slice(0, 2).map((item) => ({ id: item.id, title: item.title, answer: "News" })) ?? []),
        ...(sports.data?.items.slice(0, 2).map((item) => ({ id: item.id, title: item.title, answer: "Sports" })) ?? []),
        ...(tech.data?.items.slice(0, 2).map((item) => ({ id: item.id, title: item.title, answer: "Tech" })) ?? []),
      ]),
    [news.data?.items, sports.data?.items, tech.data?.items],
  );
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [headlineScore, setHeadlineScore] = useState(0);

  const timelineBase = useMemo(
    () =>
      (liveEvents.data?.items ?? [])
        .filter((item) => item.status !== "ended")
        .slice(0, 4),
    [liveEvents.data?.items],
  );
  const [timelineDeck, setTimelineDeck] = useState(() => shuffle(timelineBase));
  const [timelineSolved, setTimelineSolved] = useState(false);

  const quizQuestions = useMemo(() => buildQuizQuestions(liveEvents.data?.items ?? []), [liveEvents.data?.items]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);

  const [reactionStarted, setReactionStarted] = useState(false);
  const [reactionTarget, setReactionTarget] = useState(0);
  const [reactionHits, setReactionHits] = useState(0);
  const [reactionStartTime, setReactionStartTime] = useState<number | null>(null);
  const [reactionEndTime, setReactionEndTime] = useState<number | null>(null);

  useEffect(() => {
    if (!timelineBase.length) {
      return;
    }

    setTimelineDeck(shuffle(timelineBase));
    setTimelineSolved(false);
  }, [timelineBase]);

  useEffect(() => {
    if (headlineDeck.length > 0 && headlineIndex >= headlineDeck.length) {
      trackGameLifecycle("game_complete", "headline-match", headlineScore);
    }
  }, [headlineDeck.length, headlineIndex, headlineScore]);

  useEffect(() => {
    if (timelineSolved) {
      trackGameLifecycle("game_complete", "timeline-sort", timelineDeck.length);
    }
  }, [timelineDeck.length, timelineSolved]);

  useEffect(() => {
    if (quizQuestions.length > 0 && quizIndex >= quizQuestions.length) {
      trackGameLifecycle("game_complete", "world-quiz", quizScore);
    }
  }, [quizIndex, quizQuestions.length, quizScore]);

  useEffect(() => {
    if (reactionEndTime && reactionStartTime) {
      const elapsedSeconds = Number(((reactionEndTime - reactionStartTime) / 1000).toFixed(2));
      trackGameLifecycle("game_complete", "rapid-reaction", elapsedSeconds);
    }
  }, [reactionEndTime, reactionStartTime]);

  const activeCatalogItem = featuredItems.find((item) => item.mode === activeMode) ?? featuredItems[0];
  const currentHeadline = headlineDeck[headlineIndex];
  const currentQuestion = quizQuestions[quizIndex];
  const reactionAverage =
    reactionStartTime && reactionEndTime && reactionHits > 0
      ? ((reactionEndTime - reactionStartTime) / reactionHits / 1000).toFixed(2)
      : null;

  function answerHeadline(choice: string) {
    if (!currentHeadline) {
      return;
    }

    if (choice === currentHeadline.answer) {
      setHeadlineScore((score) => score + 1);
    }
    setHeadlineIndex((index) => index + 1);
  }

  function moveTimeline(index: number, direction: -1 | 1) {
    setTimelineDeck((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function checkTimeline() {
    const isSorted = timelineDeck.every((item, index, array) => {
      if (index === 0) {
        return true;
      }
      return Date.parse(array[index - 1].startsAt) <= Date.parse(item.startsAt);
    });

    setTimelineSolved(isSorted);
  }

  function answerQuiz(choice: string) {
    if (!currentQuestion) {
      return;
    }

    if (choice === currentQuestion.answer) {
      setQuizScore((score) => score + 1);
    }
    setQuizIndex((index) => index + 1);
  }

  function startReaction() {
    setReactionStarted(true);
    setReactionHits(0);
    setReactionStartTime(Date.now());
    setReactionEndTime(null);
    setReactionTarget(Math.floor(Math.random() * 4));
  }

  function hitReaction(index: number) {
    if (!reactionStarted || reactionEndTime || index !== reactionTarget) {
      return;
    }

    if (reactionHits + 1 >= 8) {
      setReactionHits((current) => current + 1);
      setReactionEndTime(Date.now());
      return;
    }

    setReactionHits((current) => current + 1);
    setReactionTarget(Math.floor(Math.random() * 4));
  }

  return (
    <section className="section-block" id="signal-games">
      <div className="section-header">
        <div>
          <p className="section-eyebrow">Signal Games</p>
          <h2>Current-event retention modes</h2>
        </div>
        <div className="section-meta">
          <p>{activeCatalogItem?.prompt ?? "Use live sections and current feeds as the input layer for these games."}</p>
        </div>
      </div>
      <div className="signal-games-layout">
        <article className="card signal-games-card">
          <div className="games-header">
            <p className="section-eyebrow">Modes</p>
            <div className="top-list-tags" aria-label="Signal game choices">
              {featuredItems.map((item) => (
                <button
                  className={`games-mode-button ${activeMode === item.mode ? "is-active" : ""}`}
                  key={item.id}
                  onClick={() => setActiveMode(item.mode as SignalGameMode)}
                  type="button"
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>

          {activeMode === "headline-match" ? (
            <div className="signal-game-shell">
              <div className="signal-game-meta">
                <span>Score {headlineScore}</span>
                <span>
                  {Math.min(headlineIndex + 1, headlineDeck.length)} / {headlineDeck.length || 0}
                </span>
              </div>
              {currentHeadline ? (
                <>
                  <h3>{currentHeadline.title}</h3>
                  <p className="top-card-summary">Pick the section where this item belongs.</p>
                  <div className="signal-answer-grid">
                    {["News", "Sports", "Tech"].map((choice) => (
                      <button className="ghost-button" key={choice} onClick={() => answerHeadline(choice)} type="button">
                        {choice}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="signal-game-summary">
                  <h3>Round complete</h3>
                  <p>You matched {headlineScore} of {headlineDeck.length} headlines correctly.</p>
                </div>
              )}
            </div>
          ) : null}

          {activeMode === "timeline-sort" ? (
            <div className="signal-game-shell">
              <div className="signal-game-meta">
                <span>{timelineDeck.length} active events</span>
                <span>{timelineSolved ? "Sorted" : "Reorder by start time"}</span>
              </div>
              <div className="signal-timeline-list">
                {timelineDeck.map((item, index) => (
                  <div className="sticky-row signal-timeline-row" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{formatShortDate(item.startsAt)}</p>
                    </div>
                    <div className="signal-timeline-actions">
                      <button className="ghost-button" onClick={() => moveTimeline(index, -1)} type="button">
                        Up
                      </button>
                      <button className="ghost-button" onClick={() => moveTimeline(index, 1)} type="button">
                        Down
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="event-related-list">
                <button className="ghost-button" onClick={checkTimeline} type="button">
                  Check order
                </button>
                {timelineSolved ? <span className="chip chip-earth">Correct</span> : null}
              </div>
            </div>
          ) : null}

          {activeMode === "world-quiz" ? (
            <div className="signal-game-shell">
              <div className="signal-game-meta">
                <span>Score {quizScore}</span>
                <span>
                  {Math.min(quizIndex + 1, quizQuestions.length)} / {quizQuestions.length || 0}
                </span>
              </div>
              {currentQuestion ? (
                <>
                  <h3>{currentQuestion.prompt}</h3>
                  <div className="signal-answer-grid">
                    {currentQuestion.options.map((choice) => (
                      <button className="ghost-button" key={choice} onClick={() => answerQuiz(choice)} type="button">
                        {choice}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="signal-game-summary">
                  <h3>Quiz complete</h3>
                  <p>You answered {quizScore} of {quizQuestions.length} questions correctly.</p>
                </div>
              )}
            </div>
          ) : null}

          {activeMode === "rapid-reaction" ? (
            <div className="signal-game-shell">
              <div className="signal-game-meta">
                <span>{reactionHits} / 8 hits</span>
                <span>{reactionAverage ? `${reactionAverage}s avg` : "Hit the active tile only"}</span>
              </div>
              {!reactionStarted ? (
                <button className="ghost-button" onClick={startReaction} type="button">
                  Start round
                </button>
              ) : (
                <div className="signal-reaction-grid">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <button
                      className={`signal-reaction-tile ${reactionTarget === index && !reactionEndTime ? "is-active" : ""}`}
                      key={`target-${index}`}
                      onClick={() => hitReaction(index)}
                      type="button"
                    >
                      {reactionTarget === index && !reactionEndTime ? "Tap" : "Wait"}
                    </button>
                  ))}
                </div>
              )}
              {reactionAverage ? (
                <div className="signal-game-summary">
                  <h3>Round complete</h3>
                  <p>Average reaction time: {reactionAverage}s.</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </article>

        <aside className="signal-games-sidebar">
          {loading ? <article className="card game-loading">Loading game catalog...</article> : null}
          {error ? (
            <article className="card card-error">
              <p>Could not load the game catalog.</p>
              <span>{error}</span>
            </article>
          ) : null}
          {featuredItems.map((item) => (
            <article className="card signal-game-note" key={item.id}>
              <div className="card-chip-row">
                <span className="chip chip-space">{item.metricLabel}</span>
                <span className="muted">{item.metricValue}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <Link className="event-related-link" to={item.relatedPath}>
                {item.relatedLabel}
              </Link>
            </article>
          ))}
        </aside>
      </div>
    </section>
  );
}

function buildQuizQuestions(items: LiveEventsFeed["items"]) {
  const pool = (items ?? []).slice(0, 4);
  const categories = [...new Set(pool.map((item) => item.category))];
  const sources = [...new Set(pool.map((item) => item.sourceName))];

  return pool.flatMap((item, index) => {
    const sourceOptions = shuffle([item.sourceName, ...sources.filter((source) => source !== item.sourceName)]).slice(0, 3);
    const categoryOptions = shuffle([item.category, ...categories.filter((category) => category !== item.category)]).slice(0, 2);

    return [
      {
        id: `${item.id}-category`,
        prompt: `Which category does "${item.title}" belong to?`,
        options: categoryOptions,
        answer: item.category,
      },
      {
        id: `${item.id}-source`,
        prompt: `Which source is attached to "${item.title}"?`,
        options: sourceOptions,
        answer: item.sourceName,
      },
    ].slice(0, index === 0 ? 2 : 1);
  }) as QuizQuestion[];
}
