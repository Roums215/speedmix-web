// Application DJ Speed Mix
// Mixage dynamique en fonction de la vitesse et des accélérations

// ---------- Configuration ---------- //
const CONFIG = {
    // Seuils de détection
    acceleration: {
        threshold: 10,      // km/h/s - Seuil d'accélération rapide
        duration: 2         // secondes - Durée minimale pour considérer comme une accélération
    },
    stabilization: {
        threshold: 5,       // km/h - Variation max pour une vitesse stable  
        duration: 5         // secondes - Durée minimale pour considérer stable
    },
    // Mise à jour GPS
    gps: {
        updateInterval: 1000, // ms - Intervalle de mise à jour du GPS
        simulationMode: true  // Par défaut en mode simulation
    },
    // Audio
    audio: {
        crossfadeDuration: 3000,  // ms - Durée des crossfades
        defaultVolume: 0.8        // Volume par défaut (0-1)
    }
};

// ---------- Éléments DOM ---------- //
const DOM = {
    // Vitesse et données
    speed: document.querySelector('.speed-value'),
    speedStatus: document.querySelector('.speed-status'),
    acceleration: document.querySelector('.acceleration-value'),
    status: document.querySelector('.status-value'),
    
    // Lecteur
    vinyl: document.getElementById('vinyl'),
    trackTitle: document.getElementById('track-title'),
    trackArtist: document.getElementById('track-artist'),
    progressBar: document.querySelector('.progress'),
    currentTime: document.querySelector('.current-time'),
    totalTime: document.querySelector('.total-time'),
    visualizer: document.getElementById('visualizer'),
    
    // Contrôles
    fileInput: document.getElementById('file-input'),
    btnImport: document.getElementById('btn-import'),
    btnStart: document.getElementById('btn-start'),
    btnStop: document.getElementById('btn-stop'),
    playlist: document.getElementById('playlist'),
    
    // Simulation
    simSpeedSlider: document.getElementById('sim-speed'),
    simSpeedValue: document.getElementById('sim-speed-value'),
    simAccelSlider: document.getElementById('sim-accel'),
    simAccelValue: document.getElementById('sim-accel-value'),
    btnSimGps: document.getElementById('btn-sim-gps')
};

// ---------- État de l'application ---------- //
const APP_STATE = {
    isPlaying: false,
    currentSpeed: 0,
    currentAcceleration: 0,
    previousSpeed: 0,
    speedHistory: [],
    isStabilized: false,
    tracks: [],
    currentTrackIndex: -1,
    audioContext: null,
    audioSources: [],
    visualizerActive: false,
    analyzer: null,
    usingRealGPS: false
};

// ---------- Initialisation ---------- //
document.addEventListener('DOMContentLoaded', () => {
    initAudio();
    initEventListeners();
    initSimulation();
    
    // Par défaut, commencer en mode simulation
    if (CONFIG.gps.simulationMode) {
        startSimulation();
    }
    
    // Charger automatiquement des sons synthétisés
    loadSynthSounds();
});

// Initialiser le contexte audio
function initAudio() {
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        APP_STATE.audioContext = new AudioContext();
        APP_STATE.analyzer = APP_STATE.audioContext.createAnalyser();
        APP_STATE.analyzer.fftSize = 256;
        console.log("Contexte audio initialisé avec succès");
        
        // Message de démarrage
        updateStatusMessage("Contexte audio initialisé. Utilisation de sons synthétiques.");
    } catch(e) {
        console.error("Erreur lors de l'initialisation du contexte audio:", e);
        alert("Votre navigateur ne prend pas en charge l'API Web Audio nécessaire pour cette application.");
    }
}

// Initialiser les écouteurs d'événements
function initEventListeners() {
    // Importation de fichiers
    DOM.btnImport.addEventListener('click', () => {
        DOM.fileInput.click();
    });
    
    DOM.fileInput.addEventListener('change', handleFileSelect);
    
    // Contrôles de lecture
    DOM.btnStart.addEventListener('click', startPlayback);
    DOM.btnStop.addEventListener('click', stopPlayback);
    
    // Simulation
    DOM.simSpeedSlider.addEventListener('input', updateSimulatedSpeed);
    DOM.simAccelSlider.addEventListener('input', updateSimulatedAcceleration);
    DOM.btnSimGps.addEventListener('click', toggleGPSMode);
}

// ---------- Gestion des fichiers audio ---------- //
function handleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) {
        // Si l'utilisateur ne sélectionne aucun fichier ou annule, charger des sons synthétiques
        loadSynthSounds();
        return;
    }
    
    // Réinitialiser la playlist si on importe de nouveaux fichiers
    APP_STATE.tracks = [];
    DOM.playlist.innerHTML = '';
    
    let importedCount = 0;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Accepter les fichiers audio et mp4
        if (!file.type.startsWith('audio/') && file.type !== 'video/mp4') continue;
        
        const track = {
            id: `track-${Date.now()}-${i}`,
            file: file,
            name: file.name.replace(/\.[^/.]+$/, ""), // Nom sans extension
            artist: file.type === 'video/mp4' ? "Vidéo importée" : "Audio importé",
            duration: 0,
            buffer: null,
            fileType: file.type,
            energy: getRandomEnergy() // Dans une version réelle, analyser l'audio
        };
        
        APP_STATE.tracks.push(track);
        loadAudioBuffer(track);
        addTrackToPlaylist(track);
        importedCount++;
    }
    
    if (importedCount > 0) {
        updateStatusMessage(`${importedCount} fichier(s) importé(s)! Cliquez sur Démarrer Mix pour commencer.`);
    } else {
        updateStatusMessage('Aucun fichier audio ou vidéo valide sélectionné.');
        loadSynthSounds(); // Charger des sons synthétiques par défaut
    }
}

function loadAudioBuffer(track) {
    // Afficher un indicateur de chargement
    updatePlaylistTrackLoading(track, 'Chargement...');
    
    if (track.fileType === 'video/mp4') {
        // Traitement spécial pour les fichiers MP4
        loadMP4AudioTrack(track);
    } else {
        // Traitement standard pour les fichiers audio
        const reader = new FileReader();
        
        reader.onload = (e) => {
            APP_STATE.audioContext.decodeAudioData(e.target.result)
                .then(buffer => {
                    track.buffer = buffer;
                    track.duration = buffer.duration;
                    
                    // Mettre à jour l'affichage
                    updatePlaylistTrackDuration(track);
                    
                    console.log(`Track loaded: ${track.name}, duration: ${track.duration}s`);
                })
                .catch(err => {
                    console.error(`Erreur de décodage audio pour ${track.name}:`, err);
                    updatePlaylistTrackLoading(track, 'Erreur!');
                });
        };
        
        reader.onerror = (err) => {
            console.error(`Erreur de lecture du fichier ${track.name}:`, err);
            updatePlaylistTrackLoading(track, 'Erreur!');
        };
        
        reader.readAsArrayBuffer(track.file);
    }
}

// Fonction spéciale pour extraire l'audio des fichiers MP4
function loadMP4AudioTrack(track) {
    // Méthode simplifiée utilisant MediaSource et FileReader
    const reader = new FileReader();
    
    reader.onload = (e) => {
        // Utiliser l'API standard de décodage audio
        // Cela fonctionne pour l'audio MP4 car la piste audio est généralement au format AAC
        APP_STATE.audioContext.decodeAudioData(e.target.result)
            .then(buffer => {
                track.buffer = buffer;
                track.duration = buffer.duration;
                
                // Mettre à jour l'affichage
                updatePlaylistTrackDuration(track);
                
                console.log(`MP4 audio extracted: ${track.name}, duration: ${track.duration}s`);
            })
            .catch(err => {
                console.error(`Erreur de décodage audio pour MP4 ${track.name}:`, err);
                // Méthode de secours - utiliser un oscillateur synthétisé pour remplacer
                createSynthTrackFallback(track);
            });
    };
    
    reader.onerror = (err) => {
        console.error(`Erreur de lecture du fichier ${track.name}:`, err);
        updatePlaylistTrackLoading(track, 'Erreur!');
        // Méthode de secours
        createSynthTrackFallback(track);
    };
    
    // Lire le fichier 
    reader.readAsArrayBuffer(track.file);
}

// Créer une piste synthétique de secours en cas d'échec
function createSynthTrackFallback(track) {
    console.log(`Création d'une piste synthétique de secours pour ${track.name}`);
    
    // Créer un buffer synthétisé de 10 secondes
    track.buffer = createSynthBuffer(APP_STATE.audioContext, 'melody', 10, {
        notes: [60, 64, 67, 72, 67, 64], // Do, Mi, Sol, Do, Sol, Mi
        bpm: 120
    });
    
    track.duration = 10;
    track.name = track.name + ' (Audio synthétisé)';
    
    // Mettre à jour l'affichage
    updatePlaylistTrackDuration(track);
    updatePlaylistTrackName(track);
}

// Mettre à jour l'affichage de la playlist avec un message de chargement
function updatePlaylistTrackLoading(track, message) {
    const trackItem = document.querySelector(`li[data-track-id="${track.id}"] .track-duration`);
    if (trackItem) {
        trackItem.textContent = message;
    }
}

// Mettre à jour le nom d'une piste dans l'affichage
function updatePlaylistTrackName(track) {
    const trackNameItem = document.querySelector(`li[data-track-id="${track.id}"] .track-name`);
    if (trackNameItem) {
        trackNameItem.textContent = track.name;
    }
}

function addTrackToPlaylist(track) {
    const li = document.createElement('li');
    li.dataset.trackId = track.id;
    li.innerHTML = `
        <span class="track-name">${track.name}</span>
        <span class="track-duration">Chargement...</span>
    `;
    
    li.addEventListener('click', () => {
        if (APP_STATE.isPlaying) {
            playSpecificTrack(track);
        } else {
            selectTrack(track);
        }
    });
    
    DOM.playlist.appendChild(li);
}

function updatePlaylistTrackDuration(track) {
    const trackItem = document.querySelector(`li[data-track-id="${track.id}"] .track-duration`);
    if (trackItem) {
        trackItem.textContent = formatTime(track.duration);
    }
}

function getRandomEnergy() {
    // Catégorie d'énergie (BPM) aléatoire pour la démo
    const categories = ['low', 'medium', 'high'];
    return categories[Math.floor(Math.random() * categories.length)];
}

// ---------- Lecture Audio ---------- //
function startPlayback() {
    if (APP_STATE.tracks.length === 0) {
        alert("Veuillez d'abord importer des fichiers audio!");
        return;
    }
    
    // Démarrer le contexte audio si nécessaire
    if (APP_STATE.audioContext.state === 'suspended') {
        APP_STATE.audioContext.resume();
    }
    
    if (!APP_STATE.isPlaying) {
        APP_STATE.isPlaying = true;
        
        // Sélectionner une piste si aucune n'est sélectionnée
        if (APP_STATE.currentTrackIndex === -1) {
            APP_STATE.currentTrackIndex = 0;
        }
        
        // Démarrer la lecture
        playCurrentTrack();
        
        // Mettre à jour l'UI
        DOM.btnStart.style.display = 'none';
        DOM.btnStop.style.display = 'block';
        DOM.vinyl.classList.add('rotating');
        startVisualizer();
        
        // Démarrer le suivi GPS s'il n'est pas déjà actif
        if (!APP_STATE.usingRealGPS && !CONFIG.gps.simulationMode) {
            startGPSTracking();
        }
    }
}

function stopPlayback() {
    if (APP_STATE.isPlaying) {
        APP_STATE.isPlaying = false;
        
        // Arrêter toutes les sources audio
        APP_STATE.audioSources.forEach(sourceObj => {
            try {
                if (sourceObj && sourceObj.source) {
                    sourceObj.source.stop();
                    console.log('Source audio arrêtée avec succès');
                }
            } catch (e) {
                console.error('Erreur lors de l\'arrêt de la source:', e);
                // Ignorer si déjà arrêté
            }
        });
        APP_STATE.audioSources = [];
        
        // Mettre à jour l'UI
        DOM.btnStart.style.display = 'block';
        DOM.btnStop.style.display = 'none';
        DOM.vinyl.classList.remove('rotating');
        stopVisualizer();
        updateTrackInfo(null);
        
        // Réinitialiser le temps et la progression
        DOM.currentTime.textContent = '0:00';
        DOM.progressBar.style.width = '0%';
        
        // Afficher un message de confirmation
        updateStatusMessage('Lecture arrêtée');
    }
}

function playCurrentTrack() {
    if (APP_STATE.tracks.length === 0 || APP_STATE.currentTrackIndex < 0) return;
    
    const track = APP_STATE.tracks[APP_STATE.currentTrackIndex];
    if (!track || !track.buffer) {
        console.error("Piste non disponible ou non chargée");
        return;
    }
    
    // Créer une source audio
    const source = APP_STATE.audioContext.createBufferSource();
    source.buffer = track.buffer;
    
    // Créer un nœud de gain pour contrôler le volume
    const gainNode = APP_STATE.audioContext.createGain();
    gainNode.gain.value = CONFIG.audio.defaultVolume;
    
    // Connecter source -> gain -> analyzer -> destination
    source.connect(gainNode);
    gainNode.connect(APP_STATE.analyzer);
    APP_STATE.analyzer.connect(APP_STATE.audioContext.destination);
    
    // Stocker la source et le gain pour pouvoir les modifier plus tard
    APP_STATE.audioSources.push({
        source: source,
        gain: gainNode,
        track: track,
        startTime: APP_STATE.audioContext.currentTime
    });
    
    // Démarrer la lecture
    source.start();
    updateTrackInfo(track);
    highlightCurrentTrack();
    
    // Gérer la fin de la piste
    source.onended = () => {
        if (APP_STATE.isPlaying) {
            // Passer à la piste suivante
            APP_STATE.currentTrackIndex = (APP_STATE.currentTrackIndex + 1) % APP_STATE.tracks.length;
            playCurrentTrack();
        }
    };
    
    // Démarrer la mise à jour de la progression
    updateTrackProgress();
}

function playSpecificTrack(track) {
    const index = APP_STATE.tracks.findIndex(t => t.id === track.id);
    if (index !== -1) {
        // Arrêter les sources audio actuelles
        APP_STATE.audioSources.forEach(source => {
            try {
                source.source.stop();
            } catch (e) {
                // Ignorer si déjà arrêté
            }
        });
        APP_STATE.audioSources = [];
        
        // Définir la nouvelle piste et la jouer
        APP_STATE.currentTrackIndex = index;
        playCurrentTrack();
    }
}

function selectTrack(track) {
    const index = APP_STATE.tracks.findIndex(t => t.id === track.id);
    if (index !== -1) {
        APP_STATE.currentTrackIndex = index;
        updateTrackInfo(track);
        highlightCurrentTrack();
    }
}

function updateTrackProgress() {
    if (!APP_STATE.isPlaying || APP_STATE.audioSources.length === 0) return;
    
    const activeSource = APP_STATE.audioSources[APP_STATE.audioSources.length - 1];
    const currentTime = APP_STATE.audioContext.currentTime - activeSource.startTime;
    const duration = activeSource.track.duration;
    
    if (currentTime <= duration) {
        // Mettre à jour l'affichage du temps
        DOM.currentTime.textContent = formatTime(currentTime);
        DOM.totalTime.textContent = formatTime(duration);
        
        // Mettre à jour la barre de progression
        const progressPercent = (currentTime / duration) * 100;
        DOM.progressBar.style.width = `${Math.min(100, progressPercent)}%`;
        
        // Mettre à jour à nouveau dans un moment
        requestAnimationFrame(updateTrackProgress);
    }
}

function updateTrackInfo(track) {
    if (track) {
        DOM.trackTitle.textContent = track.name;
        DOM.trackArtist.textContent = track.artist || 'Importé';
    } else {
        DOM.trackTitle.textContent = 'Aucun morceau sélectionné';
        DOM.trackArtist.textContent = 'Importez de la musique pour commencer';
    }
}

function highlightCurrentTrack() {
    // Retirer la classe active de tous les éléments
    document.querySelectorAll('#playlist li').forEach(li => {
        li.classList.remove('active');
    });
    
    // Ajouter la classe active à l'élément courant
    if (APP_STATE.currentTrackIndex !== -1) {
        const track = APP_STATE.tracks[APP_STATE.currentTrackIndex];
        const trackElement = document.querySelector(`li[data-track-id="${track.id}"]`);
        if (trackElement) {
            trackElement.classList.add('active');
        }
    }
}

// ---------- Chargement des sons synthétiques ---------- //
function loadSynthSounds() {
    // Vérifier si le contexte audio est initialisé
    if (!APP_STATE.audioContext) {
        console.error("Contexte audio non initialisé");
        return;
    }
    
    try {
        // Utiliser la fonction du fichier synth.js pour générer des pistes
        const synthTracks = createSynthPlaylist(APP_STATE.audioContext);
        
        // Réinitialiser la playlist
        APP_STATE.tracks = [];
        DOM.playlist.innerHTML = '';
        
        // Ajouter à la playlist
        synthTracks.forEach(track => {
            APP_STATE.tracks.push(track);
            addTrackToPlaylist(track);
        });
        
        updateStatusMessage('Sons synthétiques chargés! Cliquez sur Démarrer Mix pour commencer.');
    } catch (e) {
        console.error("Erreur lors du chargement des sons synthétiques:", e);
        updateStatusMessage('Erreur lors du chargement des sons synthétiques.');
    }
}

// ---------- Suite dans gps.js et audio-effects.js ---------- //
