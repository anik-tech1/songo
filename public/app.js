const API = "";
let token = localStorage.getItem("songo_token");
let allTracks = [];
let currentQueue = [];
let queueIndex = -1;
let isShuffled = false;
let repeatMode = 0; // 0=off, 1=all, 2=one

const audio = document.getElementById("audio-player");
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// -- Auth --
async function login(username, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const data = await res.json();
  token = data.token;
  localStorage.setItem("songo_token", token);
  return data;
}

async function checkAuth() {
  if (!token) return false;
  try {
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// -- Tracks --
async function fetchTracks() {
  const res = await fetch(`${API}/api/songs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  allTracks = data.songs || [];
  renderTracks();
}

function renderTracks() {
  const tbody = $("#track-list");
  tbody.innerHTML = allTracks
    .map(
      (t, i) => `<tr>
      <td>${i + 1}</td>
      <td>${esc(t.title)}</td>
      <td>${esc(t.artist)}</td>
      <td>${esc(t.album)}</td>
      <td class="track-actions">
        <button onclick="playTrack(${t.id})" title="Play">&#x25B6;</button>
        <button onclick="downloadTrack(${t.id}, '${esc(t.title)}')" title="Download">&#x2B07;</button>
        <button onclick="promptAddToPlaylist(${t.id})" title="Add to playlist">+</button>
      </td>
    </tr>`
    )
    .join("");
}

// -- Player --
function playTrack(id) {
  const track = allTracks.find((t) => t.id === id);
  if (!track) return;

  currentQueue = [...allTracks];
  if (isShuffled) shuffleArray(currentQueue);
  queueIndex = currentQueue.findIndex((t) => t.id === id);

  loadAndPlay(track);
}

function loadAndPlay(track) {
  audio.src = `${API}/api/stream/${track.id}?token=${token}`;
  audio.play();
  $("#player-title").textContent = track.title;
  $("#player-artist").textContent = track.artist;
  $("#play-btn").innerHTML = "&#x23F8;";
  $("#download-btn").onclick = () => downloadTrack(track.id, track.title);
}

function togglePlay() {
  if (audio.paused) {
    audio.play();
    $("#play-btn").innerHTML = "&#x23F8;";
  } else {
    audio.pause();
    $("#play-btn").innerHTML = "&#x25B6;";
  }
}

function playNext() {
  if (currentQueue.length === 0) return;
  queueIndex = (queueIndex + 1) % currentQueue.length;
  loadAndPlay(currentQueue[queueIndex]);
}

function playPrev() {
  if (currentQueue.length === 0) return;
  queueIndex = (queueIndex - 1 + currentQueue.length) % currentQueue.length;
  loadAndPlay(currentQueue[queueIndex]);
}

function toggleShuffle() {
  isShuffled = !isShuffled;
  $("#shuffle-btn").style.color = isShuffled ? "var(--accent)" : "";
  if (isShuffled) {
    const current = currentQueue[queueIndex];
    shuffleArray(currentQueue);
    queueIndex = currentQueue.findIndex((t) => t.id === current?.id);
  }
}

function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  const btn = $("#repeat-btn");
  btn.style.color = repeatMode > 0 ? "var(--accent)" : "";
  btn.innerHTML = repeatMode === 2 ? "&#x1F502;" : "&#x1F501;";
}

// Fisher-Yates shuffle
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function formatTime(s) {
  if (isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function downloadTrack(id, title) {
  const a = document.createElement("a");
  a.href = `${API}/api/download/${id}`;
  a.setAttribute("download", "");
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// -- Playlists --
async function fetchPlaylists() {
  const res = await fetch(`${API}/api/playlists`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  renderPlaylistNav(data.playlists || []);
}

function renderPlaylistNav(playlists) {
  const nav = $("#playlist-nav");
  nav.innerHTML = playlists
    .map(
      (p) =>
        `<li onclick="loadPlaylist(${p.id}, '${esc(p.name)}')">${esc(p.name)}</li>`
    )
    .join("");
}

async function createPlaylist(name) {
  await fetch(`${API}/api/playlists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  fetchPlaylists();
}

let currentPlaylistId = null;

async function loadPlaylist(id, name) {
  currentPlaylistId = id;
  $("#playlist-title").textContent = name;
  $("#track-view").classList.add("hidden");
  $("#playlist-view").classList.remove("hidden");

  $$("#nav li").forEach((li) => li.classList.remove("active"));

  const res = await fetch(`${API}/api/playlists/${id}/tracks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  const tbody = $("#playlist-tracks");
  tbody.innerHTML = (data.tracks || [])
    .map(
      (t, i) => `<tr>
      <td>${i + 1}</td>
      <td>${esc(t.title)}</td>
      <td>${esc(t.artist)}</td>
      <td class="track-actions">
        <button onclick="playTrack(${t.id})" title="Play">&#x25B6;</button>
        <button onclick="removeFromPlaylist(${currentPlaylistId}, ${t.id})" title="Remove">&#x2715;</button>
      </td>
    </tr>`
    )
    .join("");
}

async function addToPlaylist(playlistId, songId) {
  await fetch(`${API}/api/playlists/${playlistId}/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ songId }),
  });
}

async function removeFromPlaylist(playlistId, songId) {
  await fetch(`${API}/api/playlists/${playlistId}/remove/${songId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  loadPlaylist(playlistId, $("#playlist-title").textContent);
}

let pendingSongId = null;

function promptAddToPlaylist(songId) {
  pendingSongId = songId;
  // Simple prompt for now
  const name = prompt("Enter playlist name to add to (or create new):");
  if (name) {
    createPlaylist(name).then(() => {
      fetchPlaylists().then(() => {
        // Add to the first playlist
        const nav = $("#playlist-nav");
        if (nav.firstChild) {
          nav.firstChild.click();
        }
      });
    });
  }
}

// -- Helpers --
function esc(s) {
  const div = document.createElement("div");
  div.textContent = s || "";
  return div.innerHTML;
}

// -- Events --
document.addEventListener("DOMContentLoaded", async () => {
  if (await checkAuth()) {
    showMain();
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await login($("#username").value, $("#password").value);
      showMain();
    } catch (err) {
      $("#auth-error").textContent = err.message;
    }
  });

  $("#logout-btn").addEventListener("click", () => {
    token = null;
    localStorage.removeItem("songo_token");
    $("#main-screen").classList.add("hidden");
    $("#auth-screen").style.display = "";
  });

  $("#play-btn").addEventListener("click", togglePlay);
  $("#next-btn").addEventListener("click", playNext);
  $("#prev-btn").addEventListener("click", playPrev);
  $("#shuffle-btn").addEventListener("click", toggleShuffle);
  $("#repeat-btn").addEventListener("click", toggleRepeat);

  audio.addEventListener("timeupdate", () => {
    if (audio.duration) {
      $("#progress-bar").value = (audio.currentTime / audio.duration) * 100;
      $("#current-time").textContent = formatTime(audio.currentTime);
      $("#duration").textContent = formatTime(audio.duration);
    }
  });

  audio.addEventListener("ended", () => {
    if (repeatMode === 2) {
      audio.currentTime = 0;
      audio.play();
    } else if (repeatMode === 1 || queueIndex < currentQueue.length - 1) {
      playNext();
    } else {
      $("#play-btn").innerHTML = "&#x25B6;";
    }
  });

  $("#progress-bar").addEventListener("input", (e) => {
    if (audio.duration) {
      audio.currentTime = (e.target.value / 100) * audio.duration;
    }
  });

  $("#volume-bar").addEventListener("input", (e) => {
    audio.volume = e.target.value;
  });

  $("#create-playlist-btn").addEventListener("click", () => {
    $("#create-playlist-modal").classList.remove("hidden");
  });

  $("#modal-cancel").addEventListener("click", () => {
    $("#create-playlist-modal").classList.add("hidden");
  });

  $("#modal-create").addEventListener("click", async () => {
    const name = $("#playlist-name-input").value.trim();
    if (name) {
      await createPlaylist(name);
      $("#playlist-name-input").value = "";
      $("#create-playlist-modal").classList.add("hidden");
    }
  });

  $$("#nav li").forEach((li) => {
    li.addEventListener("click", () => {
      $$("#nav li").forEach((l) => l.classList.remove("active"));
      li.classList.add("active");
      $("#track-view").classList.remove("hidden");
      $("#playlist-view").classList.add("hidden");
    });
  });
});

function showMain() {
  $("#auth-screen").style.display = "none";
  $("#main-screen").classList.remove("hidden");
  fetchTracks();
  fetchPlaylists();
}
