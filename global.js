// ---------- Configuration globale et variables partagées ---------- //
console.log("Initialisation de global.js");

// Objet global pour toute l'application
window.APP = {
    // Configuration de l'application
    CONFIG: {
        gps: { updateInterval: 1000, simulationMode: true },
        acceleration: { threshold: 10, duration: 2 },
        stabilization: { threshold: 5, duration: 5 }
    },
    
    // État de l'application
    STATE: {
        currentSpeed: 0,
        currentAcceleration: 0,
        previousSpeed: 0,
        speedHistory: [],
        isStabilized: false,
        isPlaying: false,
        tracks: [],
        usingRealGPS: false,
        autoSimulation: false
    },
    
    // Fonctions GPS et accéléromètre
    GPS: {
        // Variables de suivi
        simulationInterval: null,
        gpsWatchId: null,
        autoSimulationInterval: null,
        
        // Fonctions principales
        initSimulation: function() {
            console.log("GPS.initSimulation appelé");
            if (window.DOM && window.DOM.simSpeedSlider && window.DOM.simSpeedValue) {
                window.DOM.simSpeedValue.textContent = `${window.DOM.simSpeedSlider.value} km/h`;
                window.DOM.simAccelValue.textContent = `${window.DOM.simAccelSlider.value} km/h/s`;
            }
        },
        
        startSimulation: function() {
            console.log("GPS.startSimulation appelé");
            if (APP.GPS.simulationInterval) clearInterval(APP.GPS.simulationInterval);
            
            APP.STATE.usingRealGPS = false;
            APP.STATE.autoSimulation = false;
            
            APP.UTILS.updateStatusMessage("Mode simulation manuelle activé");
            
            if (window.DOM && window.DOM.simSpeedSlider) {
                APP.GPS.updateSpeed(parseFloat(window.DOM.simSpeedSlider.value));
                
                APP.GPS.simulationInterval = setInterval(() => {
                    if (window.DOM && window.DOM.simAccelSlider) {
                        APP.GPS.updateAcceleration(parseFloat(window.DOM.simAccelSlider.value));
                    }
                }, 100);
            }
        },
        
        stopSimulation: function() {
            console.log("GPS.stopSimulation appelé");
            if (APP.GPS.simulationInterval) {
                clearInterval(APP.GPS.simulationInterval);
                APP.GPS.simulationInterval = null;
            }
        },
        
        toggleGPSMode: function() {
            console.log("GPS.toggleGPSMode appelé");
            if (window.DOM && window.DOM.btnSimGps) {
                if (APP.STATE.usingRealGPS) {
                    // Si on utilise le GPS réel, passer à la simulation
                    APP.GPS.stopGPSTracking();
                    APP.GPS.stopMotionTracking();
                    APP.GPS.stopAutoSimulation();
                    APP.GPS.startSimulation();
                    window.DOM.btnSimGps.textContent = "Auto-Simulation";
                    APP.UTILS.updateStatusMessage("Mode simulation manuelle activé");
                } else if (APP.GPS.autoSimulationInterval === null) {
                    // Si on est en simulation manuelle, passer à l'auto-simulation
                    APP.GPS.stopSimulation();
                    APP.GPS.startAutoSimulation();
                    window.DOM.btnSimGps.textContent = "Utiliser GPS réel";
                } else {
                    // Si on est en auto-simulation, passer au GPS réel
                    APP.GPS.stopSimulation();
                    APP.GPS.stopAutoSimulation();
                    APP.GPS.startMotionAndGPSTracking();
                    window.DOM.btnSimGps.textContent = "Utiliser simulation";
                }
            } else {
                console.error("DOM non disponible pour toggleGPSMode");
            }
        },
        
        updateSimulatedSpeed: function() {
            console.log("GPS.updateSimulatedSpeed appelé");
            if (window.DOM && window.DOM.simSpeedSlider && window.DOM.simSpeedValue) {
                const speed = parseFloat(window.DOM.simSpeedSlider.value);
                window.DOM.simSpeedValue.textContent = `${speed} km/h`;
                APP.GPS.updateSpeed(speed);
            }
        },
        
        updateSimulatedAcceleration: function() {
            console.log("GPS.updateSimulatedAcceleration appelé");
            if (window.DOM && window.DOM.simAccelSlider && window.DOM.simAccelValue) {
                const accel = parseFloat(window.DOM.simAccelSlider.value);
                window.DOM.simAccelValue.textContent = `${accel} km/h/s`;
                APP.GPS.updateAcceleration(accel);
            }
        },
        
        startMotionAndGPSTracking: function() {
            console.log("Démarrage du suivi GPS et des capteurs de mouvement");
            APP.STATE.usingRealGPS = true;
            APP.GPS.startEnhancedGPSTracking();
            APP.GPS.startMotionTracking();
        },
        
        updateSpeed: function(speed) {
            APP.STATE.currentSpeed = speed;
            APP.UTILS.updateSpeedDisplay();
            APP.AUDIO.adaptMusicToSpeed();
        },
        
        updateAcceleration: function(acceleration) {
            APP.STATE.currentAcceleration = acceleration;
            APP.UTILS.updateSpeedDisplay();
        },
        
        // Fonctions stub à implémenter plus tard
        startEnhancedGPSTracking: function() { console.log("GPS réel activé"); },
        stopGPSTracking: function() { console.log("GPS réel désactivé"); },
        startMotionTracking: function() { console.log("Capteurs de mouvement activés"); },
        stopMotionTracking: function() { console.log("Capteurs de mouvement désactivés"); },
        startAutoSimulation: function() { console.log("Auto-simulation activée"); },
        stopAutoSimulation: function() { console.log("Auto-simulation désactivée"); }
    },
    
    // Fonctions utilitaires
    UTILS: {
        updateStatusMessage: function(message) {
            console.log("Message d'état: " + message);
            if (window.DOM && window.DOM.status) {
                window.DOM.status.textContent = message;
            }
        },
        
        updateSpeedDisplay: function() {
            if (!window.DOM) return;
            
            // Vitesse
            if (DOM.speed) {
                DOM.speed.textContent = `${APP.STATE.currentSpeed.toFixed(1)} `;
            }
            
            // Accélération
            if (DOM.acceleration) {
                DOM.acceleration.textContent = `${APP.STATE.currentAcceleration.toFixed(1)} km/h/s`;
            }
            
            // État et style selon la vitesse
            if (DOM.speed && DOM.speedStatus && DOM.status) {
                DOM.status.textContent = APP.STATE.isStabilized ? "Stable" : "Variable";
                
                // Reset de la classe
                DOM.speed.className = 'speed-value';
                
                if (APP.STATE.currentAcceleration > APP.CONFIG.acceleration.threshold) {
                    DOM.speedStatus.textContent = '🚀 Accélération!';
                    DOM.speed.classList.add('accelerating');
                } else if (APP.STATE.isStabilized) {
                    DOM.speedStatus.textContent = '🎵 Vitesse stabilisée';
                    DOM.speed.classList.add('stabilized');
                } else {
                    DOM.speedStatus.textContent = '🚗 En mouvement';
                }
            }
        },
        
        formatTime: function(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    },
    
    // Fonctions audio
    AUDIO: {
        adaptMusicToSpeed: function(speed) {
            try {
                // Si pas de paramètre, utiliser la vitesse stockée
                if (speed === undefined) {
                    speed = APP.STATE.currentSpeed;
                }
                
                console.log("Adaptation musicale selon vitesse:", speed);
                
                // Vérifier que le lecteur audio est disponible
                if (!window.audioContext || !window.currentSource) {
                    console.warn("Lecteur audio non disponible pour l'adaptation à la vitesse");
                    return;
                }
                
                // Paramètres d'adaptation
                let playbackRate = 1.0;
                let filterFrequency = 22050; // valeur par défaut (pas de filtrage)
                let reverbAmount = 0;
                
                // Modifier le tempo en fonction de la vitesse
                if (speed < 5) {
                    // Vitesse faible - tempo lent
                    playbackRate = 0.85 + (speed / 20); // de 0.85 à 1.0
                    filterFrequency = 1000 + (speed * 200); // de 1000Hz à 2000Hz
                    reverbAmount = 0.3 - (speed / 50); // plus de reverb à basse vitesse
                } else if (speed < 30) {
                    // Vitesse moyenne - tempo normal
                    playbackRate = 1.0 + ((speed - 5) / 100); // de 1.0 à 1.25
                    filterFrequency = 2000 + ((speed - 5) * 400); // de 2000Hz à 12000Hz
                } else {
                    // Vitesse élevée - tempo rapide
                    playbackRate = 1.25 + ((speed - 30) / 200); // de 1.25 à 1.5 max
                    filterFrequency = 12000 + ((speed - 30) * 300); // ouvrir davantage le filtre
                }
                
                // Limiter les valeurs
                playbackRate = Math.max(0.7, Math.min(playbackRate, 1.5));
                filterFrequency = Math.min(filterFrequency, 22050);
                
                // Appliquer les effets si disponibles
                if (window.currentSource) {
                    window.currentSource.playbackRate.value = playbackRate;
                    console.log("Playback rate ajusté à: " + playbackRate.toFixed(2));
                }
                
                // Appliquer le filtre passe-bas si disponible
                if (window.lowpassFilter) {
                    window.lowpassFilter.frequency.value = filterFrequency;
                    console.log("Filtre passe-bas ajusté à: " + filterFrequency.toFixed(0) + "Hz");
                }
                
                // Activer/désactiver la réverbération
                if (window.convolver && window.dryGain && window.wetGain) {
                    window.dryGain.gain.value = 1 - reverbAmount;
                    window.wetGain.gain.value = reverbAmount;
                    console.log("Réverbération ajustée à: " + (reverbAmount * 100).toFixed(0) + "%");
                }
            } catch (error) {
                console.error("Erreur lors de l'adaptation de la musique à la vitesse:", error);
            }
        },
        
        adaptAudioToAcceleration: function(acceleration) {
            try {
                // Si pas de paramètre, utiliser l'accélération stockée
                if (acceleration === undefined) {
                    acceleration = APP.STATE.currentAcceleration;
                }
                
                console.log("Adaptation audio à l'accélération:", acceleration);
                
                // Vérifier que le lecteur audio est disponible
                if (!window.audioContext || !window.currentSource) {
                    console.warn("Lecteur audio non disponible pour l'adaptation à l'accélération");
                    return;
                }
                
                // Détecter les fortes accélérations (positives ou négatives)
                const accelMagnitude = Math.abs(acceleration);
                
                // Adapter les effets en fonction de l'accélération
                if (accelMagnitude > 10) { // Forte accélération
                    // Activer un filtre dynamique ou effet spécial
                    if (window.dynamicCompressor) {
                        const threshold = -24 - (accelMagnitude - 10); // De -24dB à -34dB
                        window.dynamicCompressor.threshold.value = Math.max(-50, threshold);
                        
                        // Augmenter le ratio pour les accélérations très fortes
                        const ratio = 4 + (accelMagnitude / 5);
                        window.dynamicCompressor.ratio.value = Math.min(20, ratio);
                        
                        console.log(`Compresseur ajusté: threshold=${window.dynamicCompressor.threshold.value}dB, ratio=${window.dynamicCompressor.ratio.value}:1`);
                    }
                    
                    // Ajouter un effet de distorsion léger si disponible
                    if (window.distortion && typeof window.updateDistortion === 'function') {
                        const distortionAmount = Math.min(50, accelMagnitude) / 100;
                        window.updateDistortion(distortionAmount);
                        console.log("Distorsion ajustée à: " + (distortionAmount * 100).toFixed(0) + "%");
                    }
                    
                } else { // Accélération normale ou faible
                    // Rétablir les valeurs par défaut
                    if (window.dynamicCompressor) {
                        window.dynamicCompressor.threshold.value = -24;
                        window.dynamicCompressor.ratio.value = 4;
                    }
                    
                    if (window.distortion && typeof window.updateDistortion === 'function') {
                        window.updateDistortion(0); // Désactiver la distorsion
                    }
                }
            } catch (error) {
                console.error("Erreur lors de l'adaptation audio à l'accélération:", error);
            }
        }
    }
};

// Export global pour compatibilité avec le code existant
window.updateStatusMessage = APP.UTILS.updateStatusMessage;
window.formatTime = APP.UTILS.formatTime;
window.initSimulation = APP.GPS.initSimulation;
window.startSimulation = APP.GPS.startSimulation;
window.stopSimulation = APP.GPS.stopSimulation;
window.toggleGPSMode = APP.GPS.toggleGPSMode;
window.updateSimulatedSpeed = APP.GPS.updateSimulatedSpeed;
window.updateSimulatedAcceleration = APP.GPS.updateSimulatedAcceleration;
window.adaptMusicToSpeed = APP.AUDIO.adaptMusicToSpeed;

console.log("global.js chargé avec succès");
