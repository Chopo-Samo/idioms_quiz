(() => {
  "use strict";

  const STORAGE_KEY = "idiomsQuizState_v2";
  const PREFS_KEY = "idiomsQuizPrefs_v2";

  const ITEMS = Array.isArray(window.IDIOMS_DATA) ? window.IDIOMS_DATA : [];
  const ITEMS_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

  const PARTS = [
    { key: "part-1", index: 1, start: 1, end: 26 },
    { key: "part-2", index: 2, start: 27, end: 52 },
    { key: "part-3", index: 3, start: 53, end: 77 },
    { key: "part-4", index: 4, start: 78, end: 102 }
  ].map((p) => {
    const ids = [];
    for (let id = p.start; id <= p.end; id++) ids.push(id);
    return { ...p, ids };
  });

  let prefs = loadJSON(PREFS_KEY, {
    theme: "auto",
    shuffle: false
  });

  let progress = loadJSON(STORAGE_KEY, {
    masteredIds: [],
    mistakeIds: [],
    partBest: {}
  });

  let session = null;
  let resetConfirmTimer = null;
  let resetPending = false;

  // DOM References
  const viewHome = document.getElementById("view-home");
  const viewQuiz = document.getElementById("view-quiz");
  const viewResults = document.getElementById("view-results");
  const mainEl = document.getElementById("main-content");
  const announcer = document.getElementById("live-announcer");

  const brandHomeBtn = document.getElementById("brand-home-btn");
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const themeLabel = document.getElementById("theme-label");

  const statMastered = document.getElementById("stat-mastered");
  const statPartsDone = document.getElementById("stat-parts-done");
  const statMistakesCount = document.getElementById("stat-mistakes-count");

  const startAllBtn = document.getElementById("start-all-btn");
  const startMistakesBtn = document.getElementById("start-mistakes-btn");
  const mistakesBadge = document.getElementById("mistakes-badge");
  const shuffleToggle = document.getElementById("shuffle-toggle");
  const partsGrid = document.getElementById("parts-grid");
  const resetProgressBtn = document.getElementById("reset-progress-btn");

  // Quiz DOM
  const quitQuizBtn = document.getElementById("quit-quiz-btn");
  const quizModeTitle = document.getElementById("quiz-mode-title");
  const progressCounter = document.getElementById("progress-counter");
  const quizScoreText = document.getElementById("quiz-score-text");
  const quizStreakPill = document.getElementById("quiz-streak-pill");
  const quizStreakNum = document.getElementById("quiz-streak-num");
  const quizProgress = document.getElementById("quiz-progress");
  const questionCard = document.getElementById("question-card");
  const qNumber = document.getElementById("q-number");
  const qIdiom = document.getElementById("q-idiom");
  const qImage = document.getElementById("q-image");
  const optionsGrid = document.getElementById("options-grid");

  const feedbackPanel = document.getElementById("feedback-panel");
  const feedbackIcon = document.getElementById("feedback-icon");
  const feedbackHeadline = document.getElementById("feedback-headline");
  const fbHyEquivalent = document.getElementById("fb-hy-equivalent");
  const fbHyTag = document.getElementById("fb-hy-tag");
  const fbHyExplanation = document.getElementById("fb-hy-explanation");
  const fbEnMeaning = document.getElementById("fb-en-meaning");
  const fbEnExample = document.getElementById("fb-en-example");
  const nextQuestionBtn = document.getElementById("next-question-btn");
  const nextBtnLabel = document.getElementById("next-btn-label");

  // Results DOM
  const resultsModeLabel = document.getElementById("results-mode-label");
  const resultsHeadline = document.getElementById("results-headline");
  const resultsFraction = document.getElementById("results-fraction");
  const resultsPct = document.getElementById("results-pct");
  const resultsSummaryText = document.getElementById("results-summary-text");
  const resCorrectCount = document.getElementById("res-correct-count");
  const resWrongCount = document.getElementById("res-wrong-count");
  const resTotalCount = document.getElementById("res-total-count");
  const resNextPartBtn = document.getElementById("res-next-part-btn");
  const resRetryMistakesBtn = document.getElementById("res-retry-mistakes-btn");
  const resRetryBtn = document.getElementById("res-retry-btn");
  const resHomeBtn = document.getElementById("res-home-btn");
  const mistakesReviewSection = document.getElementById("mistakes-review-section");
  const mistakesList = document.getElementById("mistakes-list");

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return { ...fallback, ...JSON.parse(raw) };
    } catch {
      return fallback;
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage errors
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore storage errors
    }
  }

  function announce(message) {
    announcer.textContent = "";
    requestAnimationFrame(() => {
      announcer.textContent = message;
    });
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function applyTheme() {
    if (prefs.theme === "auto") {
      document.documentElement.removeAttribute("data-theme");
      themeLabel.textContent = "Auto";
      themeToggleBtn.setAttribute("aria-pressed", "false");
    } else if (prefs.theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      themeLabel.textContent = "Dark";
      themeToggleBtn.setAttribute("aria-pressed", "true");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      themeLabel.textContent = "Light";
      themeToggleBtn.setAttribute("aria-pressed", "false");
    }
  }

  function renderHome() {
    shuffleToggle.checked = Boolean(prefs.shuffle);

    const completedParts = PARTS.filter((p) => Boolean(progress.partBest[p.key])).length;
    statMastered.textContent = `${progress.masteredIds.length} / ${ITEMS.length}`;
    statPartsDone.textContent = `${completedParts} / ${PARTS.length}`;
    statMistakesCount.textContent = String(progress.mistakeIds.length);

    if (progress.mistakeIds.length > 0) {
      startMistakesBtn.hidden = false;
      mistakesBadge.textContent = String(progress.mistakeIds.length);
    } else {
      startMistakesBtn.hidden = true;
    }

    partsGrid.innerHTML = "";
    PARTS.forEach((part) => {
      const best = progress.partBest[part.key];
      const completed = Boolean(best);

      const card = document.createElement("button");
      card.type = "button";
      card.className = "part-card";
      card.dataset.completed = String(completed);

      const top = document.createElement("div");
      top.className = "part-card-top";

      const titleSpan = document.createElement("span");
      titleSpan.className = "part-title";
      titleSpan.textContent = `Part ${part.index}`;

      const badge = document.createElement("span");
      badge.className = "part-status";
      badge.textContent = completed ? "✓ Done" : `${part.ids.length} Qs`;

      top.append(titleSpan, badge);

      const rangeEl = document.createElement("div");
      rangeEl.className = "part-range";
      rangeEl.textContent = `Idioms #${part.start}–${part.end}`;

      card.append(top, rangeEl);

      if (best) {
        const bestEl = document.createElement("div");
        bestEl.className = "part-best";
        bestEl.textContent = `Best: ${best.score} / ${best.total}`;
        card.append(bestEl);
      }

      card.addEventListener("click", () => {
        startSession({
          modeType: "part",
          partKey: part.key,
          partIndex: part.index,
          ids: part.ids
        });
      });

      partsGrid.append(card);
    });
  }

  function showView(name) {
    viewHome.hidden = name !== "home";
    viewQuiz.hidden = name !== "quiz";
    viewResults.hidden = name !== "results";
  }

  function getSessionTitle(sess) {
    if (sess.modeType === "all") return "All 102 Idioms";
    if (sess.modeType === "mistakes") return "Review Mistakes";
    if (sess.modeType === "part") return `Part ${sess.partIndex} / 4`;
    return "";
  }

  function startSession(config) {
    const orderedIds = prefs.shuffle ? shuffleArray(config.ids) : config.ids.slice();
    const questions = orderedIds
      .map((id) => ITEMS_BY_ID.get(id))
      .filter(Boolean);

    if (questions.length === 0) return;

    session = {
      ...config,
      questions,
      index: 0,
      score: 0,
      streak: 0,
      answered: false,
      currentOptions: [],
      mistakes: []
    };

    showView("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const item = session.questions[session.index];
    const total = session.questions.length;
    const step = session.index + 1;
    const titleStr = getSessionTitle(session);

    document.title = `${titleStr} — 102 Idioms Quiz`;
    quizModeTitle.textContent = titleStr;
    quizScoreText.textContent = String(session.score);

    if (session.streak >= 2) {
      quizStreakPill.hidden = false;
      quizStreakNum.textContent = String(session.streak);
    } else {
      quizStreakPill.hidden = true;
    }

    progressCounter.textContent = `${step} / ${total}`;
    quizProgress.max = total;
    quizProgress.value = step;

    qNumber.textContent = `#${item.id}`;
    qIdiom.textContent = item.idiom;

    qImage.src = item.image;
    qImage.alt = item.alt;

    const nextItem = session.questions[session.index + 1];
    if (nextItem) {
      const pre = new Image();
      pre.src = nextItem.image;
    }

    const rawOptions = [
      { text: item.armenianCorrect, isCorrect: true },
      ...item.distractors.map((d) => ({ text: d, isCorrect: false }))
    ];
    session.currentOptions = shuffleArray(rawOptions);
    session.answered = false;

    optionsGrid.innerHTML = "";
    session.currentOptions.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      btn.dataset.optionIndex = String(idx);

      const keyBadge = document.createElement("span");
      keyBadge.className = "option-key";
      keyBadge.setAttribute("aria-hidden", "true");
      keyBadge.textContent = String(idx + 1);

      const textSpan = document.createElement("span");
      textSpan.className = "option-text";
      textSpan.lang = "hy";
      textSpan.textContent = opt.text;

      const markSpan = document.createElement("span");
      markSpan.className = "option-mark";
      markSpan.setAttribute("aria-hidden", "true");

      btn.append(keyBadge, textSpan, markSpan);
      btn.addEventListener("click", () => handleAnswer(idx));
      optionsGrid.append(btn);
    });

    feedbackPanel.dataset.visible = "false";
    feedbackPanel.setAttribute("inert", "");
    feedbackPanel.removeAttribute("data-correct");

    questionCard.classList.remove("is-entering");
    void questionCard.offsetWidth;
    questionCard.classList.add("is-entering");
  }

  function handleAnswer(selectedIndex) {
    if (!session || session.answered) return;
    session.answered = true;

    const item = session.questions[session.index];
    const chosen = session.currentOptions[selectedIndex];
    const isCorrect = Boolean(chosen && chosen.isCorrect);

    if (isCorrect) {
      session.score += 1;
      session.streak += 1;
      if (!progress.masteredIds.includes(item.id)) {
        progress.masteredIds.push(item.id);
      }
      progress.mistakeIds = progress.mistakeIds.filter((id) => id !== item.id);
    } else {
      session.streak = 0;
      session.mistakes.push({
        item,
        chosenText: chosen ? chosen.text : ""
      });
      if (!progress.mistakeIds.includes(item.id)) {
        progress.mistakeIds.push(item.id);
      }
    }
    saveProgress();

    quizScoreText.textContent = String(session.score);
    if (session.streak >= 2) {
      quizStreakPill.hidden = false;
      quizStreakNum.textContent = String(session.streak);
    } else {
      quizStreakPill.hidden = true;
    }

    const buttons = optionsGrid.querySelectorAll(".option-btn");
    buttons.forEach((btn, idx) => {
      btn.setAttribute("aria-disabled", "true");
      const opt = session.currentOptions[idx];
      const mark = btn.querySelector(".option-mark");
      if (opt.isCorrect) {
        btn.dataset.state = "correct";
        mark.textContent = "✓";
      } else if (idx === selectedIndex && !isCorrect) {
        btn.dataset.state = "wrong";
        mark.textContent = "✕";
      } else {
        btn.dataset.state = "muted";
      }
    });

    feedbackPanel.dataset.visible = "true";
    feedbackPanel.removeAttribute("inert");
    feedbackPanel.dataset.correct = String(isCorrect);
    feedbackIcon.textContent = isCorrect ? "✓" : "✕";
    feedbackHeadline.textContent = isCorrect
      ? "Correct!"
      : `Incorrect — «${item.armenianCorrect}»`;

    fbHyEquivalent.textContent = item.armenianCorrect;
    fbHyTag.textContent = item.tag;
    fbHyExplanation.textContent = item.armenianExplanation;
    fbEnMeaning.textContent = item.meaning;
    fbEnExample.textContent = item.example;

    const isLast = session.index >= session.questions.length - 1;
    nextBtnLabel.textContent = isLast ? "See results" : "Next question";

    announce(
      isCorrect
        ? `Correct! ${item.armenianCorrect}`
        : `Incorrect. Correct answer: ${item.armenianCorrect}`
    );
  }

  function advanceQuiz() {
    if (!session || !session.answered) return;
    if (session.index < session.questions.length - 1) {
      session.index += 1;
      renderQuestion();
    } else {
      finishSession();
    }
  }

  function finishSession() {
    if (session.modeType === "part") {
      const prev = progress.partBest[session.partKey];
      const total = session.questions.length;
      if (!prev || session.score >= prev.score) {
        progress.partBest[session.partKey] = { score: session.score, total };
      }
      saveProgress();
    }

    showView("results");
    renderResults();
  }

  function renderResults() {
    const total = session.questions.length;
    const pct = Math.round((session.score / total) * 100);
    const titleStr = getSessionTitle(session);

    document.title = `Results: ${titleStr} — 102 Idioms Quiz`;
    resultsModeLabel.textContent = titleStr;
    resultsFraction.textContent = `${session.score} / ${total}`;
    resultsPct.textContent = `${pct}%`;

    const wrongCount = total - session.score;
    resultsSummaryText.textContent = `You got ${session.score} correct answer${session.score === 1 ? "" : "s"} out of ${total} (${pct}%).`;
    resCorrectCount.textContent = String(session.score);
    resWrongCount.textContent = String(wrongCount);
    resTotalCount.textContent = String(total);

    if (pct === 100) resultsHeadline.textContent = "Flawless! 100% score!";
    else if (pct >= 80) resultsHeadline.textContent = "Great job!";
    else if (pct >= 50) resultsHeadline.textContent = "Nice effort!";
    else resultsHeadline.textContent = "Good start — review your mistakes!";

    let nextPart = null;
    if (session.modeType === "part") {
      const idx = PARTS.findIndex((p) => p.key === session.partKey);
      if (idx >= 0 && idx < PARTS.length - 1) {
        nextPart = PARTS[idx + 1];
      }
    }

    if (nextPart) {
      resNextPartBtn.hidden = false;
      resNextPartBtn.onclick = () => {
        startSession({
          modeType: "part",
          partKey: nextPart.key,
          partIndex: nextPart.index,
          ids: nextPart.ids
        });
      };
    } else {
      resNextPartBtn.hidden = true;
    }

    if (session.mistakes.length > 0) {
      resRetryMistakesBtn.hidden = false;
      resRetryMistakesBtn.textContent = `Practice mistakes (${session.mistakes.length})`;
      mistakesReviewSection.hidden = false;
      mistakesList.innerHTML = "";

      session.mistakes.forEach(({ item, chosenText }) => {
        const li = document.createElement("li");
        li.className = "mistake-item";

        const img = document.createElement("img");
        img.className = "mistake-thumb";
        img.src = item.image;
        img.alt = item.alt;
        img.loading = "lazy";
        img.width = 240;
        img.height = 135;

        const info = document.createElement("div");
        info.className = "mistake-info";

        const h3 = document.createElement("h3");
        h3.lang = "en";
        h3.textContent = `#${item.id} ${item.idiom}`;

        const pChosen = document.createElement("p");
        pChosen.className = "mistake-chosen";
        pChosen.innerHTML = `<span>Your choice: </span><span lang="hy"></span>`;
        pChosen.querySelector('[lang="hy"]').textContent = chosenText;

        const pCorrect = document.createElement("p");
        pCorrect.className = "mistake-correct";
        pCorrect.innerHTML = `<span>Correct: </span><span lang="hy"></span>`;
        pCorrect.querySelector('[lang="hy"]').textContent = item.armenianCorrect;

        const pExp = document.createElement("p");
        pExp.className = "mistake-exp";
        pExp.lang = "hy";
        pExp.textContent = item.armenianExplanation;

        info.append(h3, pChosen, pCorrect, pExp);
        li.append(img, info);
        mistakesList.append(li);
      });
    } else {
      resRetryMistakesBtn.hidden = true;
      mistakesReviewSection.hidden = true;
    }
  }

  function goHome() {
    session = null;
    document.title = "102 Idioms Quiz — English to Armenian";
    renderHome();
    showView("home");
  }

  // Event Listeners
  brandHomeBtn.addEventListener("click", goHome);
  quitQuizBtn.addEventListener("click", goHome);
  resHomeBtn.addEventListener("click", goHome);

  themeToggleBtn.addEventListener("click", () => {
    const order = ["auto", "dark", "light"];
    prefs.theme = order[(order.indexOf(prefs.theme) + 1) % order.length];
    savePrefs();
    applyTheme();
  });

  shuffleToggle.addEventListener("change", () => {
    prefs.shuffle = shuffleToggle.checked;
    savePrefs();
  });

  startAllBtn.addEventListener("click", () => {
    startSession({ modeType: "all", ids: ITEMS.map((it) => it.id) });
  });

  startMistakesBtn.addEventListener("click", () => {
    if (progress.mistakeIds.length === 0) return;
    startSession({ modeType: "mistakes", ids: progress.mistakeIds.slice() });
  });

  nextQuestionBtn.addEventListener("click", advanceQuiz);

  resRetryBtn.addEventListener("click", () => {
    if (!session) return;
    startSession({
      modeType: session.modeType,
      partKey: session.partKey,
      partIndex: session.partIndex,
      ids: session.ids
    });
  });

  resRetryMistakesBtn.addEventListener("click", () => {
    if (!session || session.mistakes.length === 0) return;
    startSession({
      modeType: "mistakes",
      ids: session.mistakes.map((m) => m.item.id)
    });
  });

  resetProgressBtn.addEventListener("click", () => {
    if (!resetPending) {
      resetPending = true;
      resetProgressBtn.textContent = "Click again to confirm";
      clearTimeout(resetConfirmTimer);
      resetConfirmTimer = setTimeout(() => {
        resetPending = false;
        resetProgressBtn.textContent = "Reset progress";
      }, 4000);
      return;
    }

    clearTimeout(resetConfirmTimer);
    resetPending = false;
    progress = { masteredIds: [], mistakeIds: [], partBest: {} };
    saveProgress();
    resetProgressBtn.textContent = "Reset progress";
    renderHome();
    announce("Progress has been reset.");
  });

  document.addEventListener("keydown", (e) => {
    if (!session || viewQuiz.hidden) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (!session.answered && ["1", "2", "3", "4"].includes(e.key)) {
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < session.currentOptions.length) {
        e.preventDefault();
        handleAnswer(idx);
      }
      return;
    }

    if (session.answered && (e.key === "Enter" || e.key === "ArrowRight")) {
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        active !== mainEl &&
        !active.classList.contains("option-btn") &&
        active !== nextQuestionBtn
      ) {
        return;
      }
      e.preventDefault();
      advanceQuiz();
    }
  });

  // Boot
  applyTheme();
  renderHome();
  showView("home");
})();
