const CREDENTIALS = { user: "admin", pass: "admin123" };
let allVideos = [];
let currentPlaylist = [];
let currentIndex = -1;

document.addEventListener("DOMContentLoaded", () => {
    // Inicialização do Menu Retrátil
    const sidebar = document.getElementById("sidebar");
    document.getElementById("toggle-menu").addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
    });

    // Evento de Login
    document.getElementById("login-form").addEventListener("submit", (e) => {
        e.preventDefault();
        if(document.getElementById("username").value === CREDENTIALS.user && 
           document.getElementById("password").value === CREDENTIALS.pass) {
            localStorage.setItem("session", "true");
            initApp();
        } else {
            document.getElementById("login-error").style.display = "block";
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
    
    try {
        const res = await fetch('videos.json');
        allVideos = await res.json();
        
        buildSidebar(allVideos);
        // Inicializa a grade com todos os blocos fechados (apenas as capas iniciais das playlists)
        renderGrid(allVideos, 'Início');
        setupModal();
    } catch (error) {
        console.error("Erro ao carregar banco de dados JSON", error);
    }
}

// Monta a estrutura de pastas do menu lateral esquerdo
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

// Renderiza as Playlists baseadas nos filtros. Por padrão, nenhuma começa expandida.
function renderGrid(videos, title = "Vídeos") {
    document.getElementById("current-view-title").innerText = title;
    const grid = document.getElementById("categories-grid");
    grid.innerHTML = "";

    // Agrupa os itens por Categoria e Subcategoria
    const groups = {};
    videos.forEach(v => {
        const k = `${v.categoria}${v.subcategoria ? ' > ' + v.subcategoria : ''}`;
        if(!groups[k]) groups[k] = [];
        groups[k].push(v);
    });

    // Cria as seções das Playlists. Apenas a capa do primeiro vídeo fica visível inicialmente.
    for(let key in groups) {
        const vids = groups[key];
        const row = document.createElement("div");
        row.className = "playlist-row";
        
        row.innerHTML = `
            <div class="playlist-header" data-expanded="false">
                <img src="${vids[0].capa}" class="playlist-cover-preview">
                <div class="playlist-info">
                    <h2>${key}</h2>
                    <p><span>${vids.length} vídeos</span> — <span class="status-icon">Clique para abrir <i class="fa-solid fa-chevron-down"></i></span></p>
                </div>
            </div>
            <div class="playlist-videos-expand hidden"></div>
        `;
        
        const header = row.querySelector(".playlist-header");
        const container = row.querySelector(".playlist-videos-expand");
        
        // Controla a expansão manual ao clicar na capa/cabeçalho
        header.addEventListener("click", () => {
            const isExpanded = header.getAttribute("data-expanded") === "true";
            
            if(isExpanded) {
                container.classList.add("hidden");
                container.innerHTML = "";
                header.setAttribute("data-expanded", "false");
                header.querySelector(".status-icon").innerHTML = 'Clique para abrir <i class="fa-solid fa-chevron-down"></i>';
            } else {
                // Injeta os vídeos somente ao expandir, mantendo a tela limpa
                container.innerHTML = "";
                vids.forEach(vid => {
                    const card = document.createElement("div");
                    card.className = "video-card";
                    card.innerHTML = `
                        <img src="${vid.capa}" class="video-thumb">
                        <div class="video-info">${vid.título}</div>
                    `;
                    card.onclick = (e) => {
                        e.stopPropagation(); // Evita fechar a lista ao clicar no vídeo
                        openPlayer(vid, vids);
                    };
                    container.appendChild(card);
                });
                container.classList.remove("hidden");
                header.setAttribute("data-expanded", "true");
                header.querySelector(".status-icon").innerHTML = 'Clique para fechar <i class="fa-solid fa-chevron-up"></i>';
            }
        });

        grid.appendChild(row);
    }
}

// Filtros do menu lateral
function filterCat(c) { renderGrid(allVideos.filter(v => v.categoria === c), c); }
function filterSub(c, s) { renderGrid(allVideos.filter(v => v.categoria === c && v.subcategoria === s), s); }

// Gerenciamento e execução do player de vídeo (YouTube Embed ou Link Direto/Archive)
function openPlayer(video, playlist) {
    currentPlaylist = playlist;
    currentIndex = playlist.findIndex(v => v.link === video.link);
    const modal = document.getElementById("video-modal");
    const wrapper = document.getElementById("player-wrapper");
    
    modal.classList.remove("hidden");
    document.getElementById("modal-video-title").innerText = video.título;

    if (video.link.includes("youtube.com") || video.link.includes("youtu.be")) {
        // Modo YouTube Iframe
        wrapper.innerHTML = `<iframe id="main-player" src="${video.link}?autoplay=1" allowfullscreen allow="autoplay"></iframe>`;
    } else {
        // Modo Vídeo Nativo HTML5 (Archive.org, MP4, etc.)
        wrapper.innerHTML = `
            <video id="main-player" controls autoplay>
                <source src="${video.link}" type="video/mp4">
                Seu navegador não suporta este vídeo.
            </video>`;
        
        // Evento de reprodução contínua automática para vídeos nativos
        const nativeVideo = wrapper.querySelector('video');
        nativeVideo.onended = () => changeVideo(1);
    }
}

function changeVideo(step) {
    currentIndex += step;
    if(currentIndex >= 0 && currentIndex < currentPlaylist.length) {
        openPlayer(currentPlaylist[currentIndex], currentPlaylist);
    } else if (currentIndex >= currentPlaylist.length) {
        alert("Fim da playlist atingido!");
        closeModal();
    }
}

function closeModal() {
    document.getElementById("video-modal").classList.add("hidden");
    document.getElementById("player-wrapper").innerHTML = "";
}

function setupModal() {
    document.getElementById("close-modal").onclick = closeModal;
    document.getElementById("next-video-btn").onclick = () => changeVideo(1);
    document.getElementById("prev-video-btn").onclick = () => changeVideo(-1);
    document.querySelector(".modal-backdrop").onclick = closeModal;
}
