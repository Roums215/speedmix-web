// ---------- Effets Audio et Visualisation ---------- //

// Variables pour le visualiseur
let visualizerFrameId;
let bufferLength;
let dataArray;

// Effets audio disponibles
const AUDIO_EFFECTS = {
    // Effet de tempo (vitesse de lecture)
    tempo: {
        min: 0.8,    // Ralentir jusqu'à 80%
        max: 1.3,    // Accélérer jusqu'à 130%
        default: 1.0  // Tempo normal
    },
    // Filtres (pour des transitions douces)
    filter: {
        lowpass: {
            frequency: { min: 500, max: 20000, default: 20000 }
        }
    }
};

// Adapter la musique au comportement de vitesse
function adaptMusicToSpeed(behavior) {
    if (!APP_STATE.isPlaying || APP_STATE.audioSources.length === 0) return;
    
    const currentSource = APP_STATE.audioSources[APP_STATE.audioSources.length - 1];
    const { speedCategory, isAccelerating, isStabilized, energyScore } = behavior;
    
    // 1. Ajuster le tempo selon la vitesse
    adjustTempo(currentSource, behavior);
    
    // 2. Décider de changer de morceau si nécessaire
    if (shouldChangeTrack(behavior)) {
        selectNextTrackBasedOnBehavior(behavior);
    }
}

// Ajuster le tempo de la musique selon la vitesse
function adjustTempo(audioSource, behavior) {
    if (!audioSource || !audioSource.source) return;
    
    // Calcul du facteur de tempo (vitesse de lecture)
    let tempoFactor = 1.0; // Par défaut
    
    // Mapper l'énergie (0-100) à un facteur de tempo (0.8-1.3)
    const energyRange = AUDIO_EFFECTS.tempo.max - AUDIO_EFFECTS.tempo.min;
    tempoFactor = AUDIO_EFFECTS.tempo.min + (behavior.energyScore / 100) * energyRange;
    
    // Limiter entre les min et max
    tempoFactor = Math.max(AUDIO_EFFECTS.tempo.min, 
                  Math.min(AUDIO_EFFECTS.tempo.max, tempoFactor));
    
    // Appliquer le tempo si c'est une AudioBufferSourceNode
    try {
        audioSource.source.playbackRate.value = tempoFactor;
    } catch (e) {
        console.error("Erreur lors de l'ajustement du tempo:", e);
    }
}

// Déterminer si un changement de piste est nécessaire
function shouldChangeTrack(behavior) {
    // Changer de morceau lors d'un changement significatif de comportement
    
    // Éviter les changements trop fréquents
    if (!APP_STATE.lastTrackChange) {
        APP_STATE.lastTrackChange = Date.now();
        return false;
    }
    
    const timeSinceLastChange = Date.now() - APP_STATE.lastTrackChange;
    if (timeSinceLastChange < 10000) { // Min 10 secondes entre les changements
        return false;
    }
    
    // Changer si forte accélération
    if (behavior.acceleration > CONFIG.acceleration.threshold * 1.5) {
        APP_STATE.lastTrackChange = Date.now();
        return true;
    }
    
    // Changer si changement important de catégorie de vitesse
    if (APP_STATE.lastSpeedCategory && 
        APP_STATE.lastSpeedCategory !== behavior.speedCategory &&
        (behavior.speedCategory === 'high' || APP_STATE.lastSpeedCategory === 'high')) {
        APP_STATE.lastTrackChange = Date.now();
        return true;
    }
    
    // Mémoriser la catégorie de vitesse actuelle
    APP_STATE.lastSpeedCategory = behavior.speedCategory;
    
    return false;
}

// Sélectionner le prochain morceau en fonction du comportement
function selectNextTrackBasedOnBehavior(behavior) {
    if (APP_STATE.tracks.length <= 1) return; // Un seul morceau, rien à changer
    
    let targetEnergy;
    
    // Sélectionner l'énergie cible selon le comportement
    if (behavior.isAccelerating) {
        targetEnergy = 'high';
    } else if (behavior.isStabilized && behavior.speedCategory === 'high') {
        targetEnergy = 'medium';
    } else if (behavior.speedCategory === 'low' || behavior.speedCategory === 'very_low') {
        targetEnergy = 'low';
    } else {
        targetEnergy = 'medium';
    }
    
    // Filtrer les pistes par énergie cible (hors piste actuelle)
    const currentTrack = APP_STATE.tracks[APP_STATE.currentTrackIndex];
    const eligibleTracks = APP_STATE.tracks.filter(track => 
        track.id !== currentTrack.id && track.energy === targetEnergy
    );
    
    // S'il existe des pistes correspondantes, en choisir une aléatoirement
    if (eligibleTracks.length > 0) {
        const nextTrack = eligibleTracks[Math.floor(Math.random() * eligibleTracks.length)];
        crossfadeToTrack(nextTrack);
    } else {
        // Sinon, choisir une piste aléatoire différente de la piste actuelle
        const otherTracks = APP_STATE.tracks.filter(track => track.id !== currentTrack.id);
        if (otherTracks.length > 0) {
            const nextTrack = otherTracks[Math.floor(Math.random() * otherTracks.length)];
            crossfadeToTrack(nextTrack);
        }
    }
}

// Effectuer un crossfade vers une nouvelle piste
function crossfadeToTrack(nextTrack) {
    if (!APP_STATE.isPlaying) return;
    
    // Trouver l'index de la piste cible
    const nextIndex = APP_STATE.tracks.findIndex(track => track.id === nextTrack.id);
    if (nextIndex === -1) return;
    
    // Récupérer la source audio actuelle
    if (APP_STATE.audioSources.length === 0) {
        // Aucune source active, démarrer directement la nouvelle piste
        APP_STATE.currentTrackIndex = nextIndex;
        playCurrentTrack();
        return;
    }
    
    const currentSource = APP_STATE.audioSources[APP_STATE.audioSources.length - 1];
    
    // Créer une nouvelle source pour la piste suivante
    const newSource = APP_STATE.audioContext.createBufferSource();
    newSource.buffer = nextTrack.buffer;
    
    // Créer un nœud de gain pour le crossfade
    const newGain = APP_STATE.audioContext.createGain();
    newGain.gain.value = 0;  // Commencer à volume zéro
    
    // Connecter la nouvelle source
    newSource.connect(newGain);
    newGain.connect(APP_STATE.analyzer);
    APP_STATE.analyzer.connect(APP_STATE.audioContext.destination);
    
    // Ajouter la nouvelle source à la liste
    const newSourceInfo = {
        source: newSource,
        gain: newGain,
        track: nextTrack,
        startTime: APP_STATE.audioContext.currentTime
    };
    APP_STATE.audioSources.push(newSourceInfo);
    
    // Démarrer la lecture
    newSource.start();
    
    // Effectuer le crossfade
    const fadeTime = CONFIG.audio.crossfadeDuration / 1000;
    const now = APP_STATE.audioContext.currentTime;
    
    // Baisser le volume de la piste actuelle
    currentSource.gain.gain.linearRampToValueAtTime(0, now + fadeTime);
    
    // Augmenter le volume de la nouvelle piste
    newGain.gain.linearRampToValueAtTime(CONFIG.audio.defaultVolume, now + fadeTime);
    
    // Mettre à jour l'index de la piste courante
    APP_STATE.currentTrackIndex = nextIndex;
    
    // Mettre à jour l'affichage
    updateTrackInfo(nextTrack);
    highlightCurrentTrack();
    
    // Arrêter l'ancienne source après le crossfade
    setTimeout(() => {
        try {
            currentSource.source.stop();
            // Retirer l'ancienne source de la liste
            APP_STATE.audioSources = APP_STATE.audioSources.filter(src => src !== currentSource);
        } catch (e) {
            // Ignorer si déjà arrêtée
        }
    }, CONFIG.audio.crossfadeDuration);
    
    // Gérer la fin de la nouvelle piste
    newSource.onended = () => {
        if (APP_STATE.isPlaying) {
            // Passer à la piste suivante si celle-ci se termine naturellement
            APP_STATE.currentTrackIndex = (APP_STATE.currentTrackIndex + 1) % APP_STATE.tracks.length;
            playCurrentTrack();
        }
    };
}

// ---------- Visualiseur audio ---------- //

// Initialiser et démarrer le visualiseur
function startVisualizer() {
    if (!APP_STATE.audioContext || !APP_STATE.analyzer) return;
    
    APP_STATE.visualizerActive = true;
    
    // Configurer l'analyseur pour la visualisation
    APP_STATE.analyzer.fftSize = 256;
    bufferLength = APP_STATE.analyzer.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    // Obtenir le contexte de dessin
    const canvas = DOM.visualizer;
    const ctx = canvas.getContext('2d');
    
    // Fonction de dessin du visualiseur
    function drawVisualizer() {
        if (!APP_STATE.visualizerActive) return;
        
        // Demander l'animation suivante
        visualizerFrameId = requestAnimationFrame(drawVisualizer);
        
        // Obtenir les données de fréquence
        APP_STATE.analyzer.getByteFrequencyData(dataArray);
        
        // Effacer le canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Paramètres de dessin
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;
        
        // Dessiner chaque barre
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = dataArray[i] / 255 * canvas.height;
            
            // Couleur dégradée selon la hauteur
            const r = 76 + (255 - 76) * (barHeight / canvas.height);
            const g = 175 + (87 - 175) * (barHeight / canvas.height);
            const b = 80 + (34 - 80) * (barHeight / canvas.height);
            
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }
    
    // Démarrer le dessin
    drawVisualizer();
}

// Arrêter le visualiseur
function stopVisualizer() {
    APP_STATE.visualizerActive = false;
    if (visualizerFrameId) {
        cancelAnimationFrame(visualizerFrameId);
        visualizerFrameId = null;
    }
    
    // Nettoyer le canvas
    const canvas = DOM.visualizer;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ---------- Utilitaires ---------- //

// Formater le temps en minutes:secondes
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
