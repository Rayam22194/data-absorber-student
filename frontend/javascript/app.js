const DEMO_MODE = false;
const defaultApiBase = "/api";
const fallbackApiBase = "http://127.0.0.1:8000/api";
const localFallbackApiBase = "http://localhost:8000/api";
let apiBase = defaultApiBase;
const onboardingKey = "dataAbsorberOnboardingComplete";
const state = {
  authToken: null,
  currentUser: null,
  subjects: [],
  notes: [],
  documents: [],
  assignments: [],
  events: []
};

function query(selector) {
  return document.querySelector(selector);
}

function queryAll(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function setAuthToken(token) {
  state.authToken = token;
  if (token) {
    localStorage.setItem("dataAbsorberToken", token);
  } else {
    localStorage.removeItem("dataAbsorberToken");
  }
}

function showAuthMessage(message, isError = false) {
  const el = query("#auth-message");
  el.textContent = message;
  el.style.color = isError ? "#c2410c" : "#0f766e";
}

function getApiBaseCandidates() {
  const candidates = [];
  if (window.location.protocol.startsWith("http") && window.location.host) {
    candidates.push(`${window.location.protocol}//${window.location.host}/api`);
  }
  candidates.push(defaultApiBase);
  if (!candidates.includes(fallbackApiBase)) {
    candidates.push(fallbackApiBase);
  }
  if (!candidates.includes(localFallbackApiBase)) {
    candidates.push(localFallbackApiBase);
  }
  return candidates.filter(Boolean);
}

async function apiFetch(path, options = {}) {
  const headers = {};
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (state.authToken) {
    headers.Authorization = `Bearer ${state.authToken}`;
  }

  const candidates = getApiBaseCandidates();
  let lastError = null;

  const currentOrigin = window.location.protocol.startsWith("http") && window.location.host
    ? `${window.location.protocol}//${window.location.host}`
    : null;

  for (const candidateBase of candidates) {
    try {
      const response = await fetch(`${candidateBase}${path}`, {
        headers,
        ...options
      });

      if (!response.ok) {
        const fallbackFromOrigin = currentOrigin && (candidateBase === `${currentOrigin}/api` || candidateBase === defaultApiBase);
        if (fallbackFromOrigin && [404, 405].includes(response.status)) {
          continue;
        }

        if (response.status === 401) {
          clearSession();
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || response.statusText);
      }

      apiBase = candidateBase;
      return response.json();
    } catch (error) {
      lastError = error;
      const fallbackable = error instanceof TypeError || /failed to fetch|network error|method not allowed/i.test(error.message);
      if (!fallbackable) {
        throw error;
      }
    }
  }

  throw new Error(`Unable to reach backend server. Tried: ${candidates.join(", ")}`);
}

function attachPasswordToggleHandlers() {
  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.closest(".password-field").querySelector("input");
      if (!input) return;
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      button.textContent = isPassword ? "🙈" : "👁";
      button.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    });
  });
}

function showSection(sectionId) {
  queryAll(".page-section").forEach((section) => {
    section.classList.toggle("hidden", section.id !== sectionId);
  });

  queryAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionId);
  });
}

function resetAuthForms() {
  queryAll(".auth-form").forEach((form) => form.classList.add("hidden"));
  showAuthMessage("");
}

function showAuthScreen() {
  resetAuthForms();
  query("#auth-screen").classList.remove("hidden");
  query("#app-content").classList.add("hidden");
}

function showAppScreen() {
  query("#auth-screen").classList.add("hidden");
  query("#app-content").classList.remove("hidden");
}

function updateUserGreeting() {
  query("#user-welcome").textContent = state.currentUser ? `Hi, ${state.currentUser.first_name}` : "";
}

function getGreetingPrefix() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function getExamCount() {
  return state.assignments.filter((assignment) => {
    if (assignment.status === "done") return false;
    const title = String(assignment.title || "").toLowerCase();
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    const soon = dueDate ? dueDate.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000 : false;
    return /exam|test|quiz/.test(title) || soon;
  }).length;
}

function getSubjectProgress(subject) {
  const subjectAssignments = state.assignments.filter((assignment) => assignment.subject_id === subject.id).length;
  const subjectNotes = state.notes.filter((note) => note.subject_id === subject.id).length;
  const subjectDocuments = state.documents.filter((documentItem) => documentItem.subject_id === subject.id).length;
  const count = subjectAssignments + subjectNotes + subjectDocuments;
  if (!count) return 30;
  return Math.min(100, 30 + count * 15);
}

function renderDashboardSummary() {
  const summaryEl = query("#dashboard-summary");
  const assignmentsDue = state.assignments.filter((item) => item.status !== "done").length;
  const examCount = getExamCount();
  const upcoming = state.assignments.filter((item) => item.status !== "done").slice(0, 4);

  const subjectSummary = state.subjects.length
    ? state.subjects.map((subject) => {
        const progress = getSubjectProgress(subject);
        return `<div class="subject-progress-item"><div class="subject-progress-title"><strong>${subject.name}</strong><span>${progress}%</span></div><div class="progress-track"><div class="progress-fill" style="width: ${progress}%;"></div></div></div>`;
      }).join("")
    : `<div class="card"><p class="card-body">Add subjects to see progress tracking for each course.</p></div>`;

  const upcomingTasks = upcoming.length
    ? upcoming.map((assignment) => `<div class="summary-task-item"><strong>${assignment.title}</strong><span class="task-meta">Due ${formatDate(assignment.due_date)}</span></div>`).join("")
    : `<div class="card"><p class="card-body">Add assignments to see upcoming tasks.</p></div>`;

  summaryEl.innerHTML = `
    <div class="summary-banner">
      <h3>${getGreetingPrefix()}, ${state.currentUser?.first_name || "Student"}</h3>
      <div class="summary-metrics">
        <div class="summary-metric"><strong>${assignmentsDue}</strong><span>Assignments Due</span></div>
        <div class="summary-metric"><strong>${examCount}</strong><span>Exams Coming Up</span></div>
      </div>
    </div>
    <div class="subject-progress-list">
      <h3>Subject Progress</h3>
      ${subjectSummary}
    </div>
    <div class="summary-tasks">
      <h3>Upcoming Tasks</h3>
      ${upcomingTasks}
    </div>
  `;
}

function parseSubjectId(value) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

async function loginUser(data) {
  const result = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: data.email, password: data.password })
  });

  setAuthToken(result.token);
  state.currentUser = result.user;
  updateUserGreeting();
  showAppScreen();
  showSection("dashboard");
  await refreshData();
}

async function registerUser(data) {
  const result = await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      password: data.password
    })
  });

  setAuthToken(result.token);
  state.currentUser = result.user;
  updateUserGreeting();
  showAppScreen();
  showSection("dashboard");
  await refreshData();
}

function clearSession() {
  setAuthToken(null);
  state.currentUser = null;
  state.subjects = [];
  state.notes = [];
  state.documents = [];
  state.assignments = [];
  updateUserGreeting();
  showAuthScreen();
}

async function loadSession() {
  const token = localStorage.getItem("dataAbsorberToken");
  if (!token) {
    showAuthScreen();
    return;
  }

  setAuthToken(token);
  try {
    const user = await apiFetch("/auth/me");
    state.currentUser = user;
    updateUserGreeting();
    showAppScreen();
    showSection("dashboard");
    await refreshData();
  } catch (error) {
    clearSession();
  }
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function renderDashboard() {
  renderDashboardSummary();
  const container = query("#dashboard-cards");
  const upcoming = state.assignments.filter((item) => item.status !== "done").slice(0, 4);
  container.innerHTML = "";

  const totalSubjects = state.subjects.length;
  const totalNotes = state.notes.length;
  const totalDocs = state.documents.length;
  const upcomingCount = upcoming.length;

  const cards = [
    { title: "Subjects", value: totalSubjects, description: "Organized topics for your studies." },
    { title: "Notes", value: totalNotes, description: "Quick access to study notes." },
    { title: "Documents", value: totalDocs, description: "PDFs and files attached by subject." },
    { title: "Upcoming items", value: upcomingCount, description: "Assignments due soon." }
  ];

  cards.forEach((card) => {
    const element = document.createElement("article");
    element.className = "card";
    element.innerHTML = `<h3 class="card-title">${card.title}</h3><p class="card-body"><strong>${card.value}</strong> ${card.description}</p>`;
    container.appendChild(element);
  });

  if (upcomingCount === 0) {
    const note = document.createElement("article");
    note.className = "card";
    note.innerHTML = `<h3 class="card-title">No upcoming assignments</h3><p class="card-body">Add a new assignment to start tracking due dates.</p>`;
    container.appendChild(note);
    return;
  }

  upcoming.forEach((assignment) => {
    const subject = state.subjects.find((subject) => subject.id === assignment.subject_id);
    const item = document.createElement("article");
    item.className = "card";
    item.innerHTML = `<h3 class="card-title">${assignment.title}</h3><p class="card-body">${subject ? subject.name : "No subject"} · Due ${formatDate(assignment.due_date)} · Status: ${assignment.status}</p>`;
    container.appendChild(item);
  });
}

function renderSubjects() {
  const list = query("#subject-list");
  list.innerHTML = "";
  if (!state.subjects.length) {
    list.innerHTML = `<div class="card"><h3 class="card-title">No subjects yet</h3><p class="card-body">Create a subject to group notes, documents, and assignments.</p></div>`;
    return;
  }

  state.subjects.forEach((subject) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<h3 class="card-title">${subject.name}</h3><p class="card-body">${subject.description || "Keep study materials and deadlines organized."}</p>`;
    list.appendChild(card);
  });
}

function renderNotes() {
  const list = query("#notes-list");
  list.innerHTML = "";

  const searchTerm = query("#notes-search")?.value.toLowerCase() || "";
  const subjectFilter = query("#notes-subject-filter")?.value;
  const filteredNotes = state.notes.filter((note) => {
    const matchesSearch = [note.title, note.content].some((value) => String(value).toLowerCase().includes(searchTerm));
    const matchesSubject = !subjectFilter || String(note.subject_id) === subjectFilter;
    return matchesSearch && matchesSubject;
  });

  if (!filteredNotes.length) {
    list.innerHTML = `<div class="card"><h3 class="card-title">No notes match your search</h3><p class="card-body">Try creating a note or adjusting the filters.</p></div>`;
    return;
  }

  const noteColors = ["#fef3c7", "#ede9fe", "#dbeafe", "#dcfce7", "#fee2e2"];

  filteredNotes.forEach((note) => {
    const subject = state.subjects.find((subject) => subject.id === note.subject_id);
    const color = noteColors[note.id % noteColors.length];
    const item = document.createElement("article");
    item.className = "note-card";
    item.style.background = color;
    item.innerHTML = `
      <div class="note-card-body">
        <div class="note-card-header">
          <h3 class="stack-title">${note.title}</h3>
          <span class="note-chip">${subject ? subject.name : "No subject"}</span>
        </div>
        <p class="stack-body note-preview">${note.content.length > 240 ? `${note.content.slice(0, 240)}...` : note.content}</p>
      </div>
      <div class="note-card-footer">
        <p class="footer-note">Tap to edit or use the buttons below</p>
        <div class="form-actions">
          <button class="action-button" data-action="edit-note" data-id="${note.id}">Edit</button>
          <button class="action-button" data-action="delete-note" data-id="${note.id}">Delete</button>
        </div>
      </div>
    `;
    item.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openEditNoteModal(note);
    });
    list.appendChild(item);
  });
}

function renderDocuments() {
  const list = query("#documents-list");
  list.innerHTML = "";

  const searchTerm = query("#documents-search")?.value.toLowerCase() || "";
  const subjectFilter = query("#documents-subject-filter")?.value;
  const filteredDocuments = state.documents.filter((documentItem) => {
    const matchesSearch = [documentItem.title, documentItem.file_name].some((value) => String(value).toLowerCase().includes(searchTerm));
    const matchesSubject = !subjectFilter || String(documentItem.subject_id) === subjectFilter;
    return matchesSearch && matchesSubject;
  });

  if (!filteredDocuments.length) {
    list.innerHTML = `<div class="card"><h3 class="card-title">No documents match your search</h3><p class="card-body">Try adding a document or adjusting the filters.</p></div>`;
    return;
  }

  filteredDocuments.forEach((documentItem) => {
    const subject = state.subjects.find((subject) => subject.id === documentItem.subject_id);
    const downloadLink = documentItem.saved_file_name
      ? `<a class="action-button" href="${apiBase}/documents/${documentItem.id}/download" target="_blank" rel="noopener">Download</a>`
      : "";
    const item = document.createElement("article");
    item.className = "stack-item";
    item.innerHTML = `<div><h3 class="stack-title">${documentItem.title}</h3><p class="stack-body">${documentItem.file_name}</p></div><div class="form-actions">${downloadLink}<button class="action-button" data-action="delete-document" data-id="${documentItem.id}">Delete</button></div><p class="footer-note">Subject: ${subject ? subject.name : "None"}</p>`;
    list.appendChild(item);
  });
}

function renderCalendar() {
  const list = query("#calendar-list");
  list.innerHTML = "";

  const searchTerm = query("#events-search")?.value.toLowerCase() || "";
  const typeFilter = query("#events-type-filter")?.value;

  const calendarItems = [
    ...state.events.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      date: event.event_date,
      type: event.type,
      notes: event.notes,
      subject_id: event.subject_id,
      source: "event"
    })),
    ...state.assignments.map((assignment) => ({
      id: `assignment-${assignment.id}`,
      title: assignment.title,
      date: assignment.due_date,
      type: "assignment",
      notes: assignment.notes,
      subject_id: assignment.subject_id,
      status: assignment.status,
      source: "assignment"
    }))
  ];

  const filteredItems = calendarItems.filter((item) => {
    const matchesSearch = [item.title, item.notes].some((value) => String(value || "").toLowerCase().includes(searchTerm));
    const matchesType = !typeFilter || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (!filteredItems.length) {
    list.innerHTML = `<div class="card"><h3 class="card-title">No calendar items match your search</h3><p class="card-body">Try another search or add a new event.</p></div>`;
    return;
  }

  const groupedByDate = filteredItems.reduce((groups, item) => {
    const dateKey = item.date;
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(item);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(a) - new Date(b));

  sortedDates.forEach((dateKey) => {
    const group = document.createElement("div");
    group.className = "calendar-group";
    group.innerHTML = `<h3 class="calendar-group-title">${formatDate(dateKey)}</h3>`;

    groupedByDate[dateKey].forEach((item) => {
      const subject = state.subjects.find((subject) => subject.id === item.subject_id);
      const card = document.createElement("article");
      card.className = "calendar-item";
      card.innerHTML = `
        <div>
          <h3 class="stack-title">${item.title}</h3>
          <p class="stack-body">${item.source === "assignment" ? `Assignment · ${item.status}` : item.type}</p>
          <p class="stack-body">${item.notes || (item.source === "assignment" ? "Assignment due date" : "No notes added.")}</p>
          <span>Subject: ${subject ? subject.name : "None"}</span>
        </div>
        ${item.source === "event" ? `<div class="form-actions"><button class="action-button" data-action="delete-event" data-id="${item.id.replace("event-", "")}">Delete</button></div>` : ""}
      `;
      group.appendChild(card);
    });

    list.appendChild(group);
  });
}

function populateSubjectFilters() {
  const notesFilter = query("#notes-subject-filter");
  const docsFilter = query("#documents-subject-filter");
  const assignmentsFilter = query("#assignments-subject-filter");

  [notesFilter, docsFilter, assignmentsFilter].forEach((select) => {
    if (!select) return;
    select.innerHTML = `<option value="">All subjects</option>` + state.subjects.map((subject) => `<option value="${subject.id}">${subject.name}</option>`).join("");
  });
}

function renderAssignments() {
  const list = query("#assignments-list");
  list.innerHTML = "";

  const searchTerm = query("#assignments-search")?.value.toLowerCase() || "";
  const subjectFilter = query("#assignments-subject-filter")?.value;
  const filteredAssignments = state.assignments.filter((assignment) => {
    const matchesSearch = [assignment.title, assignment.notes].some((value) => String(value || "").toLowerCase().includes(searchTerm));
    const matchesSubject = !subjectFilter || String(assignment.subject_id) === subjectFilter;
    return matchesSearch && matchesSubject;
  });

  if (!filteredAssignments.length) {
    list.innerHTML = `<div class="card"><h3 class="card-title">No assignments match your search</h3><p class="card-body">Try another search or create a new assignment.</p></div>`;
    return;
  }

  state.assignments.forEach((assignment) => {
    const subject = state.subjects.find((subject) => subject.id === assignment.subject_id);
    const item = document.createElement("article");
    item.className = "stack-item";
    item.innerHTML = `<div><h3 class="stack-title">${assignment.title}</h3><p class="stack-body">Due ${formatDate(assignment.due_date)} · Status: ${assignment.status}</p></div><div class="form-actions"><button class="action-button" data-action="edit-assignment" data-id="${assignment.id}">Edit</button><button class="action-button" data-action="delete-assignment" data-id="${assignment.id}">Delete</button></div><p class="footer-note">Subject: ${subject ? subject.name : "None"}</p>`;
    list.appendChild(item);
  });
}

async function refreshData() {
  const [subjects, notes, documents, assignments, events] = await Promise.all([
    apiFetch("/subjects"),
    apiFetch("/notes"),
    apiFetch("/documents"),
    apiFetch("/assignments"),
    apiFetch("/events")
  ]);

  state.subjects = subjects;
  state.notes = notes;
  state.documents = documents;
  state.assignments = assignments;
  state.events = events;

  renderDashboard();
  renderSubjects();
  renderNotes();
  renderDocuments();
  renderAssignments();
  renderCalendar();
  populateSubjectFilters();

  if (shouldShowOnboarding()) {
    showOnboardingModal();
  }
}

function createModal(title, fields, submitText, onSubmit, options = {}) {
  const modalRoot = query("#modal-root");
  modalRoot.innerHTML = "";

  const card = document.createElement("div");
  card.className = `modal-card ${options.modalClass || ""}`.trim();
  card.innerHTML = `<h3>${title}</h3><form id="modal-form" class="form-row"></form>`;

  fields.forEach((field) => {
    const row = document.createElement("div");
    if (field.type === "textarea") {
      row.innerHTML = `<label>${field.label}<textarea name="${field.name}" placeholder="${field.placeholder || ""}" ${field.required ? "required" : ""}>${field.value || ""}</textarea></label>`;
    } else if (field.type === "select") {
      const options = field.options.map((option) => `<option value="${option.value}" ${option.selected ? "selected" : ""}>${option.label}</option>`).join("");
      row.innerHTML = `<label>${field.label}<select name="${field.name}" ${field.required ? "required" : ""}>${options}</select></label>`;
    } else if (field.type === "file") {
      row.innerHTML = `<label>${field.label}<input type="file" name="${field.name}" accept="${field.accept || ""}" ${field.required ? "required" : ""} /></label>`;
    } else {
      row.innerHTML = `<label>${field.label}<input type="${field.type}" name="${field.name}" placeholder="${field.placeholder || ""}" value="${field.value || ""}" ${field.required ? "required" : ""} /></label>`;
    }
    card.querySelector("form").appendChild(row);
  });

  const actions = document.createElement("div");
  actions.className = "form-actions";
  actions.innerHTML = `<button type="button" class="secondary-button" id="close-modal">Cancel</button><button type="submit" class="primary-button">${submitText}</button>`;
  card.querySelector("form").appendChild(actions);
  modalRoot.appendChild(card);
  modalRoot.classList.remove("hidden");

  query("#close-modal").addEventListener("click", () => {
    modalRoot.classList.add("hidden");
  });

  card.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const hasFileInput = fields.some((field) => field.type === "file");
    const data = hasFileInput ? formData : Object.fromEntries(formData.entries());
    await onSubmit(data);
    modalRoot.classList.add("hidden");
  });
}

function findSubjectOptions(selectedId) {
  return state.subjects.map((subject) => ({
    label: subject.name,
    value: subject.id,
    selected: subject.id === selectedId
  }));
}

function openNewSubjectModal() {
  createModal(
    "Add Subject",
    [
      { type: "text", name: "name", label: "Subject name", placeholder: "Programming", required: true },
      { type: "text", name: "description", label: "Description", placeholder: "What will you study?" }
    ],
    "Create",
    async (data) => {
      await apiFetch("/subjects", { method: "POST", body: JSON.stringify(data) });
      await refreshData();
    }
  );
}

function openNewNoteModal() {
  createModal(
    "Create Note",
    [
      { type: "text", name: "title", label: "Title", placeholder: "Lecture summary", required: true },
      { type: "select", name: "subject_id", label: "Subject", options: findSubjectOptions() },
      { type: "textarea", name: "content", label: "Content", placeholder: "Write your note here...", required: true }
    ],
    "Save",
    async (data) => {
      data.subject_id = parseSubjectId(data.subject_id);
      await apiFetch("/notes", { method: "POST", body: JSON.stringify(data) });
      await refreshData();
    },
    { modalClass: "note-editor-modal" }
  );
}

function openEditNoteModal(note) {
  createModal(
    "Edit Note",
    [
      { type: "text", name: "title", label: "Title", value: note.title, required: true },
      { type: "select", name: "subject_id", label: "Subject", options: findSubjectOptions(note.subject_id) },
      { type: "textarea", name: "content", label: "Content", value: note.content, required: true }
    ],
    "Update",
    async (data) => {
      data.subject_id = parseSubjectId(data.subject_id);
      await apiFetch(`/notes/${note.id}`, { method: "PUT", body: JSON.stringify(data) });
      await refreshData();
    },
    { modalClass: "note-editor-modal" }
  );
}

function showOnboardingModal() {
  const modalRoot = query("#modal-root");
  modalRoot.innerHTML = `
    <div class="modal-card onboarding-card">
      <h3>Welcome to Data Absorber</h3>
      <p>Let's quickly set up your subjects so things stay organized. You can upload documents now or later.</p>
      <form id="onboarding-form" class="form-row">
        <label>Subjects (comma separated)<input type="text" name="names" placeholder="Programming, Mathematics, Physics" required /></label>
        <label>Default description (optional)<input type="text" name="description" placeholder="e.g. First year courses" /></label>
        <label style="display:flex;align-items:center;gap:10px"><input type="checkbox" name="upload_now" id="onboarding-upload-now" /> Upload a document now</label>
        <div class="form-actions">
          <button type="button" class="secondary-button" id="skip-onboarding">Skip for now</button>
          <button type="submit" class="primary-button">Create subjects</button>
        </div>
      </form>
    </div>
  `;
  modalRoot.classList.remove("hidden");

  query("#skip-onboarding").addEventListener("click", () => {
    localStorage.setItem(onboardingKey, "true");
    modalRoot.classList.add("hidden");
  });

  query("#onboarding-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const namesRaw = String(formData.get("names") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const uploadNow = !!formData.get("upload_now");

    const names = namesRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!names.length) {
      alert("Please enter at least one subject name.");
      return;
    }

    // Create subjects in parallel
    await Promise.all(names.map(async (name) => {
      const payload = { name, description: description || null };
      try {
        await apiFetch("/subjects", { method: "POST", body: JSON.stringify(payload) });
      } catch (err) {
        console.warn('Failed creating subject', name, err.message);
      }
    }));

    localStorage.setItem(onboardingKey, "true");
    modalRoot.classList.add("hidden");
    await refreshData();

    if (uploadNow) {
      // open upload dialog to encourage attaching a PDF
      openNewDocumentModal();
    } else {
      showSection("dashboard");
    }
  });
}

function shouldShowOnboarding() {
  return !localStorage.getItem(onboardingKey) && state.subjects.length === 0;
}

function openNewDocumentModal() {
  createModal(
    "Add Document",
    [
      { type: "text", name: "title", label: "Title", placeholder: "Exam sheet" },
      { type: "text", name: "file_name", label: "Displayed file name", placeholder: "exam_review.pdf" },
      { type: "file", name: "file", label: "PDF file", accept: ".pdf", required: true },
      { type: "select", name: "subject_id", label: "Subject", options: findSubjectOptions() }
    ],
    "Save",
    async (data) => {
      if (data instanceof FormData) {
        const file = data.get("file");
        if (file && file.name) {
          const title = data.get("title") || file.name;
          const fileName = data.get("file_name") || file.name;
          const subjectId = parseSubjectId(data.get("subject_id"));
          data.set("title", title);
          data.set("file_name", fileName);
          if (subjectId === null) {
            data.delete("subject_id");
          }
          await apiFetch("/documents/upload", { method: "POST", body: data });
          await refreshData();
          return;
        }
      }

      const payload = Object.fromEntries(data.entries ? data.entries() : Object.entries(data));
      payload.subject_id = parseSubjectId(payload.subject_id);
      await apiFetch("/documents", { method: "POST", body: JSON.stringify(payload) });
      await refreshData();
    }
  );
}

function promptDocumentUpload(file) {
  const modalRoot = query("#modal-root");
  const subjectOptions = findSubjectOptions();
  modalRoot.innerHTML = `
    <div class="modal-card">
      <h3>Upload PDF Document</h3>
      <p class="footer-note">File: ${file.name}</p>
      <form id="upload-document-form" class="form-row">
        <label>Title<input type="text" name="title" placeholder="${file.name.replace(/\.[^.]+$/, "")}" value="${file.name.replace(/\.[^.]+$/, "")}" required /></label>
        <label>Display name<input type="text" name="file_name" placeholder="${file.name}" value="${file.name}" required /></label>
        <label>Subject<select name="subject_id"><option value="">No subject</option>${subjectOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}</select></label>
        <div class="form-actions">
          <button type="button" class="secondary-button" id="cancel-document-upload">Cancel</button>
          <button type="submit" class="primary-button">Upload</button>
        </div>
      </form>
    </div>
  `;
  modalRoot.classList.remove("hidden");

  query("#cancel-document-upload").addEventListener("click", () => {
    modalRoot.classList.add("hidden");
  });

  query("#upload-document-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.append("file", file);
    const subjectId = parseSubjectId(formData.get("subject_id"));
    if (subjectId === null) {
      formData.delete("subject_id");
    }
    await apiFetch("/documents/upload", { method: "POST", body: formData });
    modalRoot.classList.add("hidden");
    await refreshData();
  });
}

function initDocumentDropZone() {
  const dropZone = query("#document-drop-zone");
  const fileInput = query("#document-file-input");
  if (!dropZone || !fileInput) return;

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Only PDF uploads are supported right now.");
      return;
    }
    promptDocumentUpload(file);
  });

  dropZone.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) {
      promptDocumentUpload(file);
    }
  });
}

function openEditNoteModal(note) {
  createModal(
    "Edit Note",
    [
      { type: "text", name: "title", label: "Title", value: note.title, required: true },
      { type: "select", name: "subject_id", label: "Subject", options: findSubjectOptions(note.subject_id) },
      { type: "textarea", name: "content", label: "Content", value: note.content, required: true }
    ],
    "Update",
    async (data) => {
      data.subject_id = parseSubjectId(data.subject_id);
      await apiFetch(`/notes/${note.id}`, { method: "PUT", body: JSON.stringify(data) });
      await refreshData();
    },
    { modalClass: "note-editor-modal" }
  );
}

function openNewAssignmentModal() {
  createModal(
    "Add Assignment",
    [
      { type: "text", name: "title", label: "Title", placeholder: "Math homework", required: true },
      { type: "select", name: "subject_id", label: "Subject", options: findSubjectOptions() },
      { type: "date", name: "due_date", label: "Due date", required: true },
      { type: "text", name: "status", label: "Status", placeholder: "pending", value: "pending", required: true }
    ],
    "Create",
    async (data) => {
      data.subject_id = parseSubjectId(data.subject_id);
      await apiFetch("/assignments", { method: "POST", body: JSON.stringify(data) });
      await refreshData();
    }
  );
}

function openNewEventModal() {
  createModal(
    "Add Calendar Event",
    [
      { type: "text", name: "title", label: "Title", placeholder: "Study for Chemistry exam", required: true },
      { type: "select", name: "subject_id", label: "Subject", options: findSubjectOptions() },
      { type: "date", name: "event_date", label: "Date", required: true },
      { type: "text", name: "type", label: "Type", placeholder: "study", value: "study", required: true },
      { type: "textarea", name: "notes", label: "Notes", placeholder: "Add reminders or helpful details" }
    ],
    "Add Event",
    async (data) => {
      data.subject_id = parseSubjectId(data.subject_id);
      await apiFetch("/events", { method: "POST", body: JSON.stringify(data) });
      await refreshData();
      showSection("calendar");
    }
  );
}

function attachGlobalHandlers() {
  queryAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.section));
  });

  query("#new-subject-btn").addEventListener("click", openNewSubjectModal);
  query("#new-note-btn").addEventListener("click", openNewNoteModal);
  query("#new-document-btn").addEventListener("click", openNewDocumentModal);
  query("#new-assignment-btn").addEventListener("click", openNewAssignmentModal);
  query("#new-event-btn").addEventListener("click", openNewEventModal);

  const searchInputs = [
    { selector: "#notes-search", render: renderNotes },
    { selector: "#documents-search", render: renderDocuments },
    { selector: "#assignments-search", render: renderAssignments },
    { selector: "#events-search", render: renderCalendar }
  ];

  searchInputs.forEach(({ selector, render }) => {
    const input = query(selector);
    if (input) {
      input.addEventListener("input", render);
    }
  });

  ["#notes-subject-filter", "#documents-subject-filter", "#assignments-subject-filter"].forEach((selector) => {
    const select = query(selector);
    if (select) {
      select.addEventListener("change", () => {
        if (selector === "#notes-subject-filter") renderNotes();
        if (selector === "#documents-subject-filter") renderDocuments();
        if (selector === "#assignments-subject-filter") renderAssignments();
      });
    }
  });

  const eventsTypeFilter = query("#events-type-filter");
  if (eventsTypeFilter) {
    eventsTypeFilter.addEventListener("change", renderCalendar);
  }

  document.body.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = Number(button.dataset.id);

    if (action === "edit-note" || action === "delete-note") {
      const note = state.notes.find((noteItem) => noteItem.id === id);
      if (!note) return;
      if (action === "edit-note") {
        openEditNoteModal(note);
      } else {
        await apiFetch(`/notes/${id}`, { method: "DELETE" });
        await refreshData();
      }
    }

    if (action === "delete-document") {
      await apiFetch(`/documents/${id}`, { method: "DELETE" });
      await refreshData();
    }

    if (action === "edit-assignment" || action === "delete-assignment") {
      const assignment = state.assignments.find((assignmentItem) => assignmentItem.id === id);
      if (!assignment) return;
      if (action === "edit-assignment") {
        createModal(
          "Edit Assignment",
          [
            { type: "text", name: "title", label: "Title", value: assignment.title, required: true },
            { type: "select", name: "subject_id", label: "Subject", options: findSubjectOptions(assignment.subject_id) },
            { type: "date", name: "due_date", label: "Due date", value: assignment.due_date, required: true },
            { type: "text", name: "status", label: "Status", value: assignment.status, required: true }
          ],
          "Update",
          async (data) => {
            data.subject_id = parseSubjectId(data.subject_id);
            await apiFetch(`/assignments/${id}`, { method: "PUT", body: JSON.stringify(data) });
            await refreshData();
          }
        );
      } else {
        await apiFetch(`/assignments/${id}`, { method: "DELETE" });
        await refreshData();
      }
    }

    if (action === "delete-event") {
      await apiFetch(`/events/${id}`, { method: "DELETE" });
      await refreshData();
    }
  });
}

async function init() {
  showSection("dashboard");
  attachGlobalHandlers();
  attachPasswordToggleHandlers();
  initDocumentDropZone();

  if (DEMO_MODE) {
    showAppScreen();
    await refreshData();
    return;
  }

  query("#show-login").addEventListener("click", () => {
    resetAuthForms();
    query("#login-form").classList.remove("hidden");
  });

  query("#show-signup").addEventListener("click", () => {
    resetAuthForms();
    query("#signup-form").classList.remove("hidden");
  });

  query("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await loginUser(data);
    } catch (error) {
      showAuthMessage(error.message, true);
    }
  });

  query("#signup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await registerUser(data);
    } catch (error) {
      showAuthMessage(error.message, true);
    }
  });

  query("#logout-button").addEventListener("click", clearSession);

  await loadSession();
}

init().catch((error) => {
  console.error(error);
  alert(`Unable to load app data: ${error.message}`);
});
