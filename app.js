const CREDENTIALS = { user: "admin", pass: "admin123" };
let allVideos = [];
let currentPlaylist = [];
let currentIndex = -1;

document.addEventListener("DOMContentLoaded", () => {
    // Menu Retrátil
    const sidebar = document.getElementById("sidebar");
    document.getElementById("toggle-menu").addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
    });

    // Login
    document.getElementById("login-form").addEventListener("submit", (e) => {
        e.preventDefault();
        if(document.getElementById("username").value === CREDENTIALS.user && 
           document.getElementById("password").value === CREDENTIALS.pass) {
            localStorage.setItem("session", "true");
            initApp();
        }
    });

    if(localStorage.getItem("session") === "true") initApp();
    
    document.getElementById("btn-logout").addEventListener("click", () => {
        localStorage.clear();
        location.reload();
    });
});

async function initApp() {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("main-content").classList.remove("hidden");
    
    const res = await fetch('videos.json');
    allVideos = await res.json();
    
    buildSidebar(allVideos);
    renderGrid(allVideos);
    setupModal();
}

function buildSidebar(videos) {
    const menu = document.getElementById("sidebar-menu");
    const cats = [...new Set(videos.map(v => v.categoria))];
    
    menu.innerHTML = `<div class="category-title-link" onclick="renderGrid(allVideos, 'Início')"><i class="fa-solid fa-house"></i> <span>Início</span></div>`;
    
    cats.forEach(cat => {
        const subCats = [...new Set(videos.filter(v => v.categoria === cat).map(v => v.subcategoria))];
        let html = `<div class="category-title-link" onclick="filterCat('${cat}')"><i class="fa-solid fa-folder"></i> <span>${cat}</span></div>`;
        html += `<ul class="subcategory-list">`;
        subCats.forEach(sub => {
            html += `<li onclick="filterSub('${cat}', '${sub}')">${sub}</li>`;
        });
        html += `</ul>`;
        menu.innerHTML += html;
    });
}

function renderGrid(videos, title = "Vídeos") {
    document.getElementById("current-view-title").innerText = title;
    const grid = document.getElementById("categories-grid");
    grid.innerHTML = "";

    const groups = {};
    videos.forEach(v => {
        const k = `${v.categoria} - ${v.subcategoria}`;
        if(!groups[k]) groups[k] = [];
        groups[k].push(v);
    });

    for(let key in groups) {
        const vids = groups[key];
        const row = document.createElement("div");
        row.className = "playlist-row";
        row.innerHTML = `
            <div class="playlist-header">
                <img src="${vids[0].capa}" class="playlist-cover-preview">
                <div><h2>${key}</h2><p>${vids.length} vídeos</p></div>
            </div>
            <div class="playlist-videos-expand"></div>
        `;
        
        const container = row.querySelector(".playlist-videos-expand");
        vids.forEach(vid => {
            const card = document.createElement("div");
            card.className = "video-card";
            card.innerHTML = `<img src="${vid.capa}" class="video-thumb"><div class="video-info">${vid.título}</div>`;
            card.onclick = () => openPlayer(vid, vids);
            container.appendChild(card);
        });
        grid.appendChild(row);
    }
}

function filterCat(c) { renderGrid(allVideos.filter(v => v.categoria === c), c); }
function filterSub(c, s) { renderGrid(allVideos.filter(v => v.categoria === c && v.subcategoria === s), s); }

function openPlayer(video, playlist) {
    currentPlaylist = playlist;
    currentIndex = playlist.findIndex(v => v.link === video.link);
    const modal = document.getElementById("video-modal");
    const wrapper = document.getElementById("player-wrapper");
    
    modal.classList.remove("hidden");
    document.getElementById("modal-video-title").innerText = video.título;

    // Lógica para diferentes fontes
    if (video.link.includes("youtube.com") || video.link.includes("youtu.be")) {
        wrapper.innerHTML = `<iframe id="main-player" src="${video.link}?autoplay=1" allowfullscreen allow="autoplay"></iframe>`;
    } else {
        // Para Archive.org ou links diretos de MP4/WebM
        wrapper.innerHTML = `
            <video id="main-player" controls autoplay>
                <source src="${video.link}" type="video/mp4">
                Seu navegador não suporta este vídeo.
            </video>`;
        
        // Autoplay para vídeos diretos (Archive.org etc)
        const v = wrapper.querySelector('video');
        v.onended = () => changeVideo(1);
    }
}

function changeVideo(step) {
    currentIndex += step;
    if(currentIndex >= 0 && currentIndex < currentPlaylist.length) {
        openPlayer(currentPlaylist[currentIndex], currentPlaylist);
    }
}

function setupModal() {
    document.getElementById("close-modal").onclick = () => {
        document.getElementById("video-modal").classList.add("hidden");
        document.getElementById("player-wrapper").innerHTML = "";
    };
    document.getElementById("next-video-btn").onclick = () => changeVideo(1);
    document.getElementById("prev-video-btn").onclick = () => changeVideo(-1);
}
