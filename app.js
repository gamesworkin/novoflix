// CONFIGURAÇÃO DE LOGIN (Modifique aqui se quiser mudar o acesso)
const CREDENTIALS = {
    username: "admin",
    password: "admin123"
};

let allVideos = [];
let currentPlaylist = [];
let currentVideoIndex = -1;
let youtubePlayer = null;

// Carrega a API do YouTube para rastrear o fim do vídeo de maneira nativa
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

document.addEventListener("DOMContentLoaded", () => {
    initLogin();
    checkSession();
});

// Lógica de Autenticação
function initLogin() {
    const loginForm = document.getElementById("login-form");
    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const userIn = document.getElementById("username").value;
        const passIn = document.getElementById("password").value;

        if(userIn === CREDENTIALS.username && passIn === CREDENTIALS.password) {
            localStorage.setItem("logged_stream_session", "true");
            checkSession();
        } else {
            document.getElementById("login-error").style.display = "block";
        }
    });

    document.getElementById("btn-logout").addEventListener("click", () => {
        localStorage.removeItem("logged_stream_session");
        location.reload();
    });
}

function checkSession() {
    const isLogged = localStorage.getItem("logged_stream_session");
    if(isLogged === "true") {
        document.getElementById("login-screen").classList.add("hidden");
        document.getElementById("main-content").classList.remove("hidden");
        loadDatabase();
    }
}

// Busca o JSON e monta a árvore de categorias
async function loadDatabase() {
    try {
        const response = await fetch('videos.json');
        allVideos = await response.json();
        
        buildMenu(allVideos);
        renderPlaylists(allVideos);
        initPlayerEvents();
    } catch (error) {
        console.error("Erro ao carregar os dados JSON:", error);
    }
}

// Agrupa e renderiza o Menu Lateral (Categorias > Subcategorias)
function buildMenu(videos) {
    const menuNav = document.getElementById("sidebar-menu");
    menuNav.innerHTML = "";

    // Mapeamento hierárquico
    const structure = {};
    videos.forEach(v => {
        if(!structure[v.categoria]) structure[v.categoria] = new Set();
        if(v.subcategoria) structure[v.categoria].add(v.subcategoria);
    });

    // Item para resetar filtro / Ver tudo
    const allItem = document.createElement("div");
    allItem.className = "menu-category";
    allItem.innerHTML = `<span class="category-title-link"><i class="fa-solid fa-house"></i> Ver Tudo</span>`;
    allItem.addEventListener("click", () => renderPlaylists(videos, "Todos os Vídeos"));
    menuNav.appendChild(allItem);

    // Renderiza categorias e subcategorias no menu
    for(let cat in structure) {
        const catBox = document.createElement("div");
        catBox.className = "menu-category";
        
        const catTitle = document.createElement("span");
        catTitle.className = "category-title-link";
        catTitle.innerHTML = `<i class="fa-solid fa-folder"></i> ${cat}`;
        catTitle.addEventListener("click", () => {
            const filtered = videos.filter(v => v.categoria === cat);
            renderPlaylists(filtered, cat);
        });
        catBox.appendChild(catTitle);

        if(structure[cat].size > 0) {
            const subList = document.createElement("ul");
            subList.className = "subcategory-list";
            
            structure[cat].forEach(sub => {
                const subItem = document.createElement("li");
                subItem.innerText = sub;
                subItem.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const filtered = videos.filter(v => v.categoria === cat && v.subcategoria === sub);
                    renderPlaylists(filtered, `${cat} > ${sub}`);
                });
                subList.appendChild(subItem);
            });
            catBox.appendChild(subList);
        }
        menuNav.appendChild(catBox);
    }
}

// Renderiza as playlists organizadas em blocos expansíveis
function renderPlaylists(videosToShow, title = "Todos os Vídeos") {
    document.getElementById("current-view-title").innerText = title;
    const grid = document.getElementById("categories-grid");
    grid.innerHTML = "";

    // Agrupar itens por Categoria + Subcategoria para formar as playlists organizadas
    const grouped = {};
    videosToShow.forEach(v => {
        const key = `${v.categoria} ${v.subcategoria ? ' > ' + v.subcategoria : ''}`;
        if(!grouped[key]) grouped[key] = [];
        grouped[key].push(v);
    });

    for(let playlistName in grouped) {
        const listVideos = grouped[playlistName];
        const firstVideo = listVideos[0];

        const row = document.createElement("div");
        row.className = "playlist-row";

        // Cabeçalho da playlist (Capa é o primeiro vídeo da lista)
        row.innerHTML = `
            <div class="playlist-header" data-expanded="false">
                <img class="playlist-cover-preview" src="${firstVideo.capa}" alt="Capa">
                <div class="playlist-info">
                    <h2>${playlistName}</h2>
                    <p>${listVideos.length} vídeo(s) nesta lista — <span class="action-text" style="color:var(--accent-color);">Clique para expandir</span></p>
                </div>
            </div>
            <div class="playlist-videos-expand hidden"></div>
        `;

        const header = row.querySelector(".playlist-header");
        const bodyExpand = row.querySelector(".playlist-videos-expand");

        // Evento de Expandir/Recolher
        header.addEventListener("click", () => {
            const isExpanded = header.getAttribute("data-expanded") === "true";
            if(isExpanded) {
                bodyExpand.classList.add("hidden");
                header.setAttribute("data-expanded", "false");
                header.querySelector(".action-text").innerText = "Clique para expandir";
            } else {
                // Se expandir, renderiza os cards de vídeo internos
                bodyExpand.innerHTML = "";
                listVideos.forEach((vid) => {
                    const card = document.createElement("div");
                    card.className = "video-card";
                    card.innerHTML = `
                        <img class="video-thumb" src="${vid.capa}" alt="${vid.título}">
                        <div class="video-info">
                            <div class="video-title">${vid.título}</div>
                            <div class="video-tags">${vid.categoria} ${vid.subcategoria ? '| ' + vid.subcategoria : ''}</div>
                        </div>
                    `;
                    // Ao clicar no vídeo, define a playlist ativa temporária para navegação de próximo/anterior
                    card.addEventListener("click", () => {
                        openPlayer(vid, listVideos);
                    });
                    bodyExpand.appendChild(card);
                });

                bodyExpand.classList.remove("hidden");
                header.setAttribute("data-expanded", "true");
                header.querySelector(".action-text").innerText = "Clique para ocultar";
            }
        });

        grid.appendChild(row);
    }
}

// Controle do Player de Vídeo
function openPlayer(video, contextPlaylist) {
    currentPlaylist = contextPlaylist;
    currentVideoIndex = contextPlaylist.findIndex(v => v.link === video.link);

    document.getElementById("video-modal").classList.remove("hidden");
    loadVideoSrc(video);
}

function loadVideoSrc(video) {
    document.getElementById("modal-video-title").innerText = video.título;
    
    let embedUrl = video.link;
    
    // Configurações para garantir autoplay e habilitar API Javascript se for YouTube
    if(embedUrl.includes("youtube.com") || embedUrl.includes("youtu.be")) {
        const separator = embedUrl.includes("?") ? "&" : "?";
        embedUrl = `${embedUrl}${separator}enablejsapi=1&autoplay=1&rel=0`;
    }

    const iframe = document.getElementById("video-player");
    iframe.src = embedUrl;

    // Destrói player antigo se houver e anexa o hook de evento de fim de vídeo do YouTube
    setTimeout(() => {
        try {
            if (window.YT && YT.Player) {
                youtubePlayer = new YT.Player('video-player', {
                    events: {
                        'onStateChange': (event) => {
                            // YT.PlayerState.ENDED equivale a 0
                            if (event.data === 0) {
                                playNextVideo();
                            }
                        }
                    }
                });
            }
        } catch(e) {
            console.log("Player não-Youtube ou API ainda carregando.");
        }
    }, 1000);
}

function playNextVideo() {
    if(currentVideoIndex + 1 < currentPlaylist.length) {
        currentVideoIndex++;
        loadVideoSrc(currentPlaylist[currentVideoIndex]);
    } else {
        alert("Você chegou ao fim desta playlist!");
        closePlayer();
    }
}

function playPrevVideo() {
    if(currentVideoIndex - 1 >= 0) {
        currentVideoIndex--;
        loadVideoSrc(currentPlaylist[currentVideoIndex]);
    }
}

function closePlayer() {
    document.getElementById("video-modal").classList.add("hidden");
    document.getElementById("video-player").src = ""; // Corta o áudio imediatamente
    youtubePlayer = null;
}

function initPlayerEvents() {
    document.getElementById("close-modal").addEventListener("click", closePlayer);
    document.getElementById("next-video-btn").addEventListener("click", playNextVideo);
    document.getElementById("prev-video-btn").addEventListener("click", playPrevVideo);
    
    // Fecha clicando fora da caixa do player
    document.querySelector(".modal-backdrop").addEventListener("click", closePlayer);
}
