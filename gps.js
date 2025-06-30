// ---------- Gestion GPS et détection de vitesse ---------- //

// Variables pour la simulation et le suivi GPS
let simulationInterval;
let gpsWatchId;

// Initialisation de la simulation GPS
function initSimulation() {
    // Initialiser les valeurs de simulation
    DOM.simSpeedValue.textContent = `${DOM.simSpeedSlider.value} km/h`;
    DOM.simAccelValue.textContent = `${DOM.simAccelSlider.value} km/h/s`;
}

// Démarrer la simulation de vitesse manuelle
function startSimulation() {
    if (simulationInterval) clearInterval(simulationInterval);
    
    simulationInterval = setInterval(() => {
        // Utiliser les valeurs des sliders
        const simulatedSpeed = parseFloat(DOM.simSpeedSlider.value);
        const simulatedAcceleration = parseFloat(DOM.simAccelSlider.value);
        
        // Mettre à jour l'état de l'application
        updateSpeedData(simulatedSpeed, simulatedAcceleration);
    }, CONFIG.gps.updateInterval);
    
    APP_STATE.usingRealGPS = false;
    CONFIG.gps.simulationMode = true;
    updateStatusMessage("Mode simulation manuelle activé");
}

// Fonction pour démarrer la simulation automatique basée sur le temps
function startAutoSimulation() {
    if (autoSimulationInterval) clearInterval(autoSimulationInterval);
    if (simulationInterval) clearInterval(simulationInterval);
    
    // Variables locales pour stocker l'état de l'auto-simulation
    let currentSpeed = 0;
    let targetSpeed = 0;
    let currentAccel = 0;
    let phase = 'acceleration'; // phases: acceleration, stable, deceleration
    let phaseDuration = 0;
    let phaseElapsed = 0;
    
    // Configurer le comportement de conduite
    const drivingProfile = {
        city: {
            maxSpeed: 50,
            acceleration: 10,
            deceleration: -8,
            stableDuration: 5000,  // ms
            stopDuration: 2000,    // ms
        },
        highway: {
            maxSpeed: 90,
            acceleration: 4,
            deceleration: -5,
            stableDuration: 15000,  // ms
            stopDuration: 0,        // ms
        }
    };
    
    // Sélectionner un profil aléatoirement ou en fonction du temps
    let currentProfile = Math.random() > 0.7 ? drivingProfile.highway : drivingProfile.city;
    
    autoSimulationInterval = setInterval(() => {
        // Gérer les phases de conduite
        phaseElapsed += CONFIG.gps.updateInterval;
        
        // Transitions entre phases
        if (phaseElapsed >= phaseDuration) {
            phaseElapsed = 0;
            
            // Sélection de la prochaine phase
            switch (phase) {
                case 'acceleration':
                    phase = 'stable';
                    phaseDuration = currentProfile.stableDuration;
                    break;
                case 'stable':
                    phase = 'deceleration';
                    phaseDuration = (currentSpeed / Math.abs(currentProfile.deceleration)) * 1000;
                    break;
                case 'deceleration':
                    if (currentSpeed <= 1) {
                        // Si on s'arrête complètement
                        if (currentProfile.stopDuration > 0) {
                            phase = 'stopped';
                            phaseDuration = currentProfile.stopDuration;
                            currentSpeed = 0;
                        } else {
                            // Sinon, nouvelle accélération
                            phase = 'acceleration';
                            phaseDuration = (currentProfile.maxSpeed / currentProfile.acceleration) * 1000;
                            // Changer de profil aléatoirement
                            currentProfile = Math.random() > 0.7 ? drivingProfile.highway : drivingProfile.city;
                        }
                    }
                    break;
                case 'stopped':
                    phase = 'acceleration';
                    phaseDuration = (currentProfile.maxSpeed / currentProfile.acceleration) * 1000;
                    break;
            }
            
            console.log(`Auto-sim: Nouvelle phase '${phase}', durée: ${phaseDuration/1000}s`);
        }
        
        // Calcul de la nouvelle vitesse en fonction de la phase
        switch (phase) {
            case 'acceleration':
                currentAccel = currentProfile.acceleration;
                currentSpeed = Math.min(
                    currentProfile.maxSpeed, 
                    currentSpeed + (currentProfile.acceleration * (CONFIG.gps.updateInterval / 1000))
                );
                break;
            case 'stable':
                currentAccel = 0;
                // Petites variations aléatoires
                currentSpeed += (Math.random() - 0.5) * 2;
                currentSpeed = Math.min(currentProfile.maxSpeed, Math.max(currentSpeed, currentProfile.maxSpeed * 0.9));
                break;
            case 'deceleration':
                currentAccel = currentProfile.deceleration;
                currentSpeed = Math.max(
                    0, 
                    currentSpeed + (currentProfile.deceleration * (CONFIG.gps.updateInterval / 1000))
                );
                break;
            case 'stopped':
                currentAccel = 0;
                currentSpeed = 0;
                break;
        }
        
        // Mettre à jour l'interface
        updateSpeedData(currentSpeed, currentAccel);
    }, CONFIG.gps.updateInterval);
    
    APP_STATE.usingRealGPS = false;
    CONFIG.gps.simulationMode = true;
    updateStatusMessage("🚗 Auto-simulation activée 🚗");
}

// Arrêter l'auto-simulation
function stopAutoSimulation() {
    if (autoSimulationInterval) {
        clearInterval(autoSimulationInterval);
        autoSimulationInterval = null;
    }
}

// Arrêter la simulation GPS
function stopSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
}

// Mettre à jour la vitesse simulée
function updateSimulatedSpeed() {
    const value = DOM.simSpeedSlider.value;
    DOM.simSpeedValue.textContent = `${value} km/h`;
    
    if (CONFIG.gps.simulationMode) {
        updateSpeedData(parseFloat(value), parseFloat(DOM.simAccelSlider.value));
    }
}

// Mettre à jour l'accélération simulée
function updateSimulatedAcceleration() {
    const value = DOM.simAccelSlider.value;
    DOM.simAccelValue.textContent = `${value} km/h/s`;
    
    if (CONFIG.gps.simulationMode) {
        updateSpeedData(parseFloat(DOM.simSpeedSlider.value), parseFloat(value));
    }
}

// Variable globale pour stocker l'intervalle d'auto-simulation
let autoSimulationInterval = null;

// Basculer entre GPS réel, simulation manuelle et auto-simulation
function toggleGPSMode() {
    // Si on était en mode GPS réel
    if (APP_STATE.usingRealGPS) {
        // Passer au mode simulation manuelle
        stopGPSTracking();
        stopMotionTracking();
        stopAutoSimulation();
        startSimulation();
        DOM.btnSimGps.textContent = "Auto-Simulation";
        updateStatusMessage("Mode simulation manuelle activé");
    }
    // Si on était en mode simulation manuelle
    else if (autoSimulationInterval === null) {
        // Passer au mode auto-simulation
        stopSimulation();
        startAutoSimulation();
        DOM.btnSimGps.textContent = "Utiliser GPS réel";
    }
    // Si on était en mode auto-simulation
    else {
        // Passer au GPS réel
        stopSimulation();
        stopAutoSimulation();
        
        // Détection de plateforme pour message adapté
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        if (isIOS) {
            // Sur iOS, vérifiez si le navigateur est Safari
            updateStatusMessage("Demande d'accès au GPS de l'iPhone...");
            
            // Sur iOS, on essaie d'abord de tester si la géolocalisation est déjà accordée
            if (typeof navigator.permissions !== 'undefined') {
                navigator.permissions.query({name:'geolocation'}).then(function(result) {
                    if (result.state === 'prompt') {
                        alert("Safari va vous demander l'accès à votre position. Veuillez sélectionner 'Autoriser'.");
                    }
                });
            }
        } else {
            updateStatusMessage("Activation des capteurs de mouvement...");
        }
        
        // Démarrer le suivi GPS/mouvement
        startMotionAndGPSTracking();
        DOM.btnSimGps.textContent = "Utiliser simulation";
    }
}

// Démarrer le suivi de mouvement réel (priorité au GPS pour iOS)
function startMotionAndGPSTracking() {
    // Réinitialiser l'historique des vitesses et positions
    APP_STATE.speedHistory = [];
    APP_STATE.previousSpeed = 0;
    APP_STATE.previousPosition = null;
    APP_STATE.lastUpdate = Date.now();
    APP_STATE.motionTotal = 0;
    APP_STATE.motionEvents = 0;
    APP_STATE.usingRealGPS = true;
    CONFIG.gps.simulationMode = false;
    
    // Détection de la plateforme pour adapter la stratégie
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Sur iOS, priorité au GPS car l'accéléromètre nécessite HTTPS
    if (isIOS) {
        startEnhancedGPSTracking();
    } else {
        // Sur d'autres plateformes, essayer d'utiliser l'accéléromètre et le GPS
        startMotionTracking();
        startGPSBackup();
    }
}

// Démarrer un suivi GPS amélioré spécifiquement pour iOS
function startEnhancedGPSTracking() {
    if (!navigator.geolocation) {
        updateStatusMessage("GPS non disponible sur cet appareil");
        startSimulation();
        return;
    }
    
    // Méthode plus directe pour iOS
    // Ajouter un indicateur visuel que nous essayons d'obtenir la position
    updateStatusMessage("Demande de position GPS en cours...");
    document.body.classList.add('requesting-gps');
    
    // Options optimisées pour GPS en voiture
    const options = {
        enableHighAccuracy: true,   // Force l'utilisation du GPS haute précision
        timeout: 30000,            // Temps d'attente plus long (30s)
        maximumAge: 0,             // Toujours obtenir une nouvelle position
        distanceFilter: 1          // Mettre à jour tous les 1 mètre de déplacement
    };
    
    // Tenter d'obtenir une position une seule fois d'abord
    navigator.geolocation.getCurrentPosition(
        // Succès - la permission est accordée
        function gpsPermissionSuccess(position) {
            document.body.classList.remove('requesting-gps');
            updateStatusMessage("✅ GPS disponible!");
            console.log("GPS activé avec succès!", position);
            
            // Utiliser les premières données
            handlePositionSuccess(position);
            
            // Démarrer le suivi continu
            gpsWatchId = navigator.geolocation.watchPosition(
                handlePositionSuccess,
                function(error) {
                    // Erreur pendant le suivi (moins grave)
                    console.warn("Erreur pendant le suivi GPS:", error);
                    updateStatusMessage("Attente du prochain signal GPS...");
                },
                options
            );
        },
        // Échec - problème de permission ou autre
        function gpsPermissionError(error) {
            document.body.classList.remove('requesting-gps');
            
            // Message d'erreur spécifique pour iOS
            let message = "Problème d'accès au GPS";
            
            if (error.code === 1) { // PERMISSION_DENIED
                message = "❌ Permission GPS refusée. Vérifiez les points suivants:";
                
                // Afficher des instructions spécifiques pour iOS
                alert("Pour utiliser votre position sur Safari iPhone:\n\n" +
                      "1. Fermez cette boîte de dialogue\n" + 
                      "2. Allez dans Réglages iPhone > Confidentialité > Service de localisation > Safari\n" +
                      "3. Sélectionnez 'Lorsque l'app est active'\n" +
                      "4. Revenez à Safari et rechargez complètement la page\n" +
                      "5. Appuyez à nouveau sur 'Réessayer GPS réel'\n\n" +
                      "Vous devez également vérifier:\n" +
                      "- Réglages > Safari > Tous les sites web > Accès > Position");
            } else {
                alert("Erreur GPS (code " + error.code + "): " + error.message);
            }
            
            updateStatusMessage(message);
            startSimulation();
            DOM.btnSimGps.textContent = "Réessayer GPS réel";
        },
        // Options adaptées à iOS
        options
    );
}

// Démarrer le GPS comme source secondaire (quand l'accéléromètre est la source principale)
function startGPSBackup() {
    if (!navigator.geolocation) return;
    
    // Options de géolocalisation
    const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 500
    };
    
    try {
        gpsWatchId = navigator.geolocation.watchPosition(
            handlePositionSuccess,
            (error) => {
                // On ne revient pas à la simulation si on a déjà les capteurs de mouvement
                console.warn("Erreur GPS, utilisation uniquement des capteurs de mouvement:", error);
            },
            options
        );
        
        updateStatusMessage("GPS + Accéléromètre actifs");
    } catch (e) {
        console.warn("GPS non disponible en source secondaire");
    }
}

// Démarrage manuel de la fonction GPS originale (pour référence)
function startGPSTracking() {
    if (!navigator.geolocation) {
        alert("La géolocalisation n'est pas prise en charge par votre navigateur.");
        updateStatusMessage("GPS non disponible!");
        return;
    }
    
    // Vérifier et demander les permissions
    requestGPSPermission();
    
    updateStatusMessage("Démarrage du GPS...");
    
    // Réinitialiser l'historique des vitesses et positions
    APP_STATE.speedHistory = [];
    APP_STATE.previousSpeed = 0;
    APP_STATE.previousPosition = null;
    APP_STATE.lastUpdate = Date.now();
    
    // Options de géolocalisation
    const options = {
        enableHighAccuracy: true,  // Utiliser GPS haute précision (si disponible)
        timeout: 5000,             // Délai d'attente maximal
        maximumAge: 500            // Utiliser des données récentes (max 0.5s)
    };
    
    // Démarrer le suivi de position
    try {
        gpsWatchId = navigator.geolocation.watchPosition(
            handlePositionSuccess,
            handlePositionError,
            options
        );
        
        APP_STATE.usingRealGPS = true;
        CONFIG.gps.simulationMode = false;
        
        // Message de confirmation
        updateStatusMessage("GPS actif - en attente de signal...");        
    } catch (e) {
        console.error("Erreur lors du démarrage du GPS:", e);
        updateStatusMessage("Erreur d'activation GPS");
        // Revenir en mode simulation
        startSimulation();
    }
}

// Détecter le mouvement à l'aide de l'accéléromètre et du gyroscope
let motionSensorId = null;
function startMotionTracking() {
    // Support des capteurs de mouvement
    if (window.DeviceMotionEvent) {
        // Demander l'autorisation sur iOS 13+
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        startDeviceMotionListening();
                    } else {
                        updateStatusMessage("Permission accéléromètre refusée");
                    }
                })
                .catch(console.error);
        } else {
            // Autres navigateurs
            startDeviceMotionListening();
        }
    } else {
        updateStatusMessage("Capteurs de mouvement non disponibles");
    }
}

// Démarrer l'écoute des événements de mouvement
function startDeviceMotionListening() {
    // Ajout un écouteur d'événements pour l'accéléromètre
    window.addEventListener('devicemotion', handleDeviceMotion);
    updateStatusMessage("Capteurs de mouvement actifs");
    console.log("Démarrage du suivi de mouvement");
    
    // Si le navigateur s'arrête au bout d'un moment, réactiver périodiquement
    motionSensorId = setInterval(() => {
        const now = Date.now();
        if (now - APP_STATE.lastUpdate > 2000) { // Pas de mise à jour depuis 2 secondes
            updateStatusMessage("Réactivation capteurs de mouvement...");
            // Tenter de redémarrer le suivi
            window.removeEventListener('devicemotion', handleDeviceMotion);
            window.addEventListener('devicemotion', handleDeviceMotion);
        }
    }, 2000);
}

// Gérer les données de l'accéléromètre
function handleDeviceMotion(event) {
    const currentTime = Date.now();
    
    // Obtenir les données d'accélération (avec et sans gravité)
    let acceleration = event.acceleration || { x: 0, y: 0, z: 0 };
    let accelerationGravity = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
    
    // Calculer la force nette de mouvement (sans gravité si disponible)
    let accelX = acceleration.x || 0;
    let accelY = acceleration.y || 0;
    let accelZ = acceleration.z || 0;
    
    // Si l'accélération sans gravité n'est pas disponible, essayer de la soustraire
    if (acceleration.x === null || acceleration.x === undefined) {
        accelX = accelerationGravity.x || 0;
        accelY = accelerationGravity.y || 0;
        accelZ = accelerationGravity.z || 0;
    }
    
    // Magnitude totale du mouvement
    const motionMagnitude = Math.sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
    
    // Accumuler les mesures pour une estimation plus stable
    APP_STATE.motionTotal += motionMagnitude;
    APP_STATE.motionEvents++;
    
    // Calcul de la "vitesse" basée sur l'intensité des mouvements
    // Mise à jour tous les ~500ms pour éviter les rafraîchissements trop fréquents
    const timeDiff = currentTime - (APP_STATE.lastMotionUpdate || 0);
    if (timeDiff >= 500 && APP_STATE.motionEvents > 0) {
        const avgMotion = APP_STATE.motionTotal / APP_STATE.motionEvents;
        
        // Conversion de l'intensité du mouvement en une "vitesse" représentative
        // Calibrage empirique: un mouvement modéré donne ~5-10 m/s²
        let speedEstimate = 0;
        
        if (avgMotion < 0.5) {
            // Presque immobile
            speedEstimate = 0;
        } else if (avgMotion < 3) {
            // Mouvement léger à modéré (marche lente)
            speedEstimate = avgMotion * 1.5;
        } else if (avgMotion < 8) {
            // Mouvement modéré à énergique (marche rapide)
            speedEstimate = 4.5 + (avgMotion - 3) * 2;
        } else {
            // Mouvement énergique à intense (course)
            speedEstimate = 14.5 + (avgMotion - 8) * 2.5;
            // Limitation de la vitesse maximale à 30 km/h
            if (speedEstimate > 30) speedEstimate = 30;
        }
        
        // Calcul de l'accélération
        const oldSpeed = APP_STATE.currentSpeed || 0;
        const accel = (speedEstimate - oldSpeed) / (timeDiff / 1000);
        
        // Mise à jour des données et de l'interface
        updateSpeedData(speedEstimate, accel);
        APP_STATE.lastMotionUpdate = currentTime;
        APP_STATE.lastUpdate = currentTime;
        APP_STATE.motionTotal = 0;
        APP_STATE.motionEvents = 0;
        
        // Message de débogage
        console.log(`Motion: ${avgMotion.toFixed(2)} m/s² -> Vitesse estimée: ${speedEstimate.toFixed(2)} km/h`);
    }
}

// Arrêter le suivi des capteurs de mouvement
function stopMotionTracking() {
    if (motionSensorId) {
        clearInterval(motionSensorId);
        motionSensorId = null;
    }
    
    window.removeEventListener('devicemotion', handleDeviceMotion);
}

// Demander la permission de géolocalisation explicitement
function requestGPSPermission() {
    if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' })
            .then(permissionStatus => {
                if (permissionStatus.state === 'granted') {
                    console.log('Permission GPS déjà accordée');
                } else if (permissionStatus.state === 'prompt') {
                    console.log('Permission GPS sera demandée');
                    // Une demande explicite sera faite par watchPosition
                } else if (permissionStatus.state === 'denied') {
                    updateStatusMessage("Permission GPS refusée. Veuillez l'autoriser dans les paramètres du navigateur.");
                    console.warn('Permission GPS refusée par l\'utilisateur');
                    startSimulation(); // Revenir en mode simulation
                }
            })
            .catch(error => {
                console.error('Erreur lors de la vérification des permissions:', error);
            });
    }
}

// Arrêter le suivi GPS
function stopGPSTracking() {
    if (gpsWatchId !== undefined) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = undefined;
    }
    APP_STATE.usingRealGPS = false;
}

// Gérer une mise à jour de position GPS réussie
function handlePositionSuccess(position) {
    const currentTime = Date.now();
    const coords = position.coords;
    let speedKmh = 0;
    let acceleration = 0;
    
    // Détecter si on est sur iOS pour afficher plus d'infos
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
    // Détection de précision
    const accuracy = coords.accuracy || 0; // en mètres
    const isHighAccuracy = accuracy < 20; // moins de 20m = bonne précision
        
    console.log('Position GPS reçue:', position);
        
    // Méthode 1: Utiliser la vitesse fournie par l'API Geolocation (si disponible)
    if (coords.speed !== null && coords.speed !== undefined && coords.speed >= 0) {
        // La vitesse est fournie en m/s, convertir en km/h
        // REMARQUE: Certain navigateurs retournent 0 même lorsqu'on se déplace
        speedKmh = coords.speed * 3.6;
        console.log(`Vitesse GPS directe: ${speedKmh.toFixed(2)} km/h (${coords.speed} m/s) (précision: ${accuracy}m)`);
    } 
        
    // Méthode 2: Calculer la vitesse à partir des positions (si on a un historique)
    // On utilise toujours cette méthode comme complément/vérification
    if (APP_STATE.previousPosition) {
        const prevTime = APP_STATE.previousPosition.timestamp;
        const prevCoords = APP_STATE.previousPosition.coords;
            
        // Calculer la distance et la vitesse
        if (prevCoords && prevCoords.latitude && prevCoords.longitude) {
            // Calcul de la distance parcourue
            const distance = calculateDistance(
                prevCoords.latitude, prevCoords.longitude,
                coords.latitude, coords.longitude
            );
                
            // Calcul du temps écoulé en secondes
            const timeDiff = (currentTime - prevTime) / 1000;
                
            if (timeDiff > 0 && timeDiff < 10) { // Ignorer les mesures trop espacées
                // Vitesse en mètres par seconde, convertie en km/h
                const calculatedSpeed = distance / timeDiff; // m/s
                const calculatedSpeedKmh = calculatedSpeed * 3.6; // km/h
                    
                // Affichage en console pour débogage
                console.log(`Vitesse calculée: ${calculatedSpeedKmh.toFixed(2)} km/h, distance: ${distance.toFixed(2)}m, temps: ${timeDiff.toFixed(2)}s`);
                    
                // Si coords.speed est 0 ou faible mais qu'on détecte un mouvement significatif
                // ou si coords.speed n'est pas disponible, utiliser notre calcul
                if ((speedKmh < 3 && calculatedSpeedKmh > 5) || coords.speed === null || coords.speed === undefined) {
                    console.log('Correction: utilisation de la vitesse calculée au lieu de la valeur GPS');
                    speedKmh = calculatedSpeedKmh;
                        
                    // Limiter les pics extrêmes (filtrer les erreurs GPS)
                    if (speedKmh > 150) {
                        speedKmh = Math.min(speedKmh, APP_STATE.previousSpeed * 1.5);
                        console.log(`Limitation d'un pic de vitesse à ${speedKmh.toFixed(1)} km/h`);
                    }
                }
                    
                // Moyenne glissante pour lisser les valeurs
                if (APP_STATE.previousSpeed > 0) {
                    speedKmh = (speedKmh + APP_STATE.previousSpeed) / 2;
                }
            }
        }
    }
        
    // Calculer l'accélération
    if (APP_STATE.lastUpdate) {
        const timeDiff = (currentTime - APP_STATE.lastUpdate) / 1000;
        if (timeDiff > 0) {
            acceleration = (speedKmh - APP_STATE.previousSpeed) / timeDiff;
                
            // Lisser l'accélération pour éviter les pics trop brutaux
            if (Math.abs(acceleration) > 20) {
                acceleration = Math.sign(acceleration) * 20;
            }
        }
    }
    const timeDiffSecs = (currentTime - (APP_STATE.lastUpdate || currentTime)) / 1000;
    if (timeDiffSecs > 0 && APP_STATE.previousSpeed !== undefined) {
        // Accélération instantanée
        acceleration = (speedKmh - APP_STATE.previousSpeed) / timeDiffSecs;
        
        // Limite plus strict pour iOS car l'accéléromètre n'est pas disponible
        const accelerationLimit = isIOS ? 20 : 30;
        if (Math.abs(acceleration) > accelerationLimit) {
            acceleration = Math.sign(acceleration) * accelerationLimit;
        }
    }
    
    // Mettre à jour l'état et les données
    APP_STATE.previousPosition = {
        coords: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy
        },
        timestamp: currentTime
    };
    APP_STATE.lastUpdate = currentTime;
    
    // Mettre à jour l'interface
    updateSpeedData(speedKmh, acceleration);
    
    // Message d'état plus complet
    if (isIOS) {
        updateStatusMessage(`GPS actif ▶ ${speedKmh.toFixed(1)} km/h [${acceleration.toFixed(1)} km/h/s] (précision: ${accuracy.toFixed(0)}m)`);
    } else {
        updateStatusMessage(`GPS actif ▶ ${speedKmh.toFixed(1)} km/h [${acceleration.toFixed(1)} km/h/s]`);
    }
    
    // Mettre à jour directement l'affichage de la vitesse aussi
    DOM.speed.textContent = `${speedKmh.toFixed(1)} `;
}

// Calcul de la distance entre deux points GPS (formule de Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    // Conversion des latitudes/longitudes de degrés en radians
    const R = 6371000; // Rayon de la Terre en mètres
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // en mètres

    return distance;
}

// Gérer une erreur de position GPS
function handlePositionError(error) {
    let errorMessage;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    switch(error.code) {
        case 1: // PERMISSION_DENIED
            errorMessage = "Permission GPS refusée";
            break;
        case 2: // POSITION_UNAVAILABLE
            errorMessage = "Position GPS indisponible";
            break;
        case 3: // TIMEOUT
            errorMessage = "Délai d'attente GPS dépassé";
            break;
        default:
            errorMessage = "Erreur GPS inconnue";
    }
    
    updateStatusMessage(`❌ ${errorMessage}`);
    console.error('Erreur GPS:', error);
    
    if (error.code === 1) { // PERMISSION_DENIED
        if (isIOS) {
            // Message spécifique pour iOS
            alert("Safari a besoin de votre permission pour accéder à votre position. Veuillez l'activer dans Réglages > Safari > Position, puis rafraîchir la page.");
        } else {
            alert("Pour utiliser la vitesse réelle, autorisez l'accès à votre position dans les paramètres de votre navigateur, puis rafraîchissez la page.");
        }
    } else if (error.code === 2) { // POSITION_UNAVAILABLE
        if (isIOS) {
            alert("Impossible d'obtenir votre position. Assurez-vous d'être en extérieur, que les services de localisation sont activés dans Réglages, et que Safari a la permission d'accéder à votre position.");
        } else {
            alert("Signal GPS indisponible. Assurez-vous d'être en extérieur ou près d'une fenêtre.");
        }
    } else if (error.code === 3 && isIOS) { // TIMEOUT sur iOS
        alert("La récupération de votre position a pris trop de temps. Vérifiez que les services de localisation sont activés et réessayez.");
    }
    
    // Revenir au mode simulation
    stopGPSTracking();
    startSimulation();
    DOM.btnSimGps.textContent = "Réessayer GPS réel";
}

// ---------- Analyse du comportement de conduite ---------- //

// Mettre à jour les données de vitesse et analyser le comportement
function updateSpeedData(speed, acceleration) {
    // Enregistrer les données actuelles
    APP_STATE.currentSpeed = speed;
    APP_STATE.currentAcceleration = acceleration;
    
    // Ajouter à l'historique
    APP_STATE.speedHistory.push({
        speed,
        acceleration,
        timestamp: Date.now()
    });
    
    // Limiter la taille de l'historique
    if (APP_STATE.speedHistory.length > 20) {
        APP_STATE.speedHistory.shift();
    }
    
    // Analyser la stabilisation
    APP_STATE.isStabilized = isSpeedStabilized();
    
    // Mettre à jour l'affichage
    updateSpeedDisplay();
    
    // Analyser le comportement et adapter la musique si nécessaire
    if (APP_STATE.isPlaying) {
        const behavior = analyzeBehavior();
        adaptMusicToSpeed(behavior);
    }
    
    // Mettre à jour pour le prochain calcul
    APP_STATE.previousSpeed = speed;
}

// Vérifier si la vitesse s'est stabilisée
function isSpeedStabilized() {
    if (APP_STATE.speedHistory.length < 3) return false;
    
    const { threshold, duration } = CONFIG.stabilization;
    const currentTime = Date.now();
    
    // Récupérer l'historique pertinent pour la durée spécifiée
    const relevantHistory = APP_STATE.speedHistory.filter(
        item => (currentTime - item.timestamp) <= duration * 1000
    );
    
    if (relevantHistory.length < 3) return false;
    
    // Vérifier si la variation de vitesse est inférieure au seuil
    const speeds = relevantHistory.map(item => item.speed);
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);
    
    return (maxSpeed - minSpeed) <= threshold;
}

// Analyser le comportement de conduite
function analyzeBehavior() {
    const isAccelerating = APP_STATE.currentAcceleration > CONFIG.acceleration.threshold;
    const speedCategory = categorizeSpeed(APP_STATE.currentSpeed);
    
    // Calculer un score d'énergie (0-100) pour l'intensité musicale
    const energyScore = calculateEnergyScore(APP_STATE.currentSpeed, APP_STATE.currentAcceleration);
    
    return {
        isAccelerating,
        isStabilized: APP_STATE.isStabilized,
        speedCategory,
        energyScore,
        speed: APP_STATE.currentSpeed,
        acceleration: APP_STATE.currentAcceleration
    };
}

// Catégoriser la vitesse
function categorizeSpeed(speed) {
    if (speed < 20) return 'very_low';
    if (speed < 50) return 'low';
    if (speed < 80) return 'medium';
    return 'high';
}

// Calculer le score d'énergie pour adapter l'intensité musicale
function calculateEnergyScore(speed, acceleration) {
    // Score de base lié à la vitesse (0-70)
    const speedScore = Math.min(70, (speed / 120) * 70);
    
    // Bonus d'accélération (0-30)
    const accelerationBonus = Math.min(30, Math.max(0, acceleration) * 3);
    
    // Score total (0-100)
    return Math.min(100, Math.round(speedScore + accelerationBonus));
}

// Mettre à jour l'affichage de la vitesse
function updateSpeedDisplay() {
    // Vitesse
    DOM.speed.textContent = `${APP_STATE.currentSpeed.toFixed(1)} `;
    
    // Accélération
    DOM.acceleration.textContent = `${APP_STATE.currentAcceleration.toFixed(1)} km/h/s`;
    
    // État
    DOM.status.textContent = APP_STATE.isStabilized ? "Stable" : "Variable";
    
    // Style de vitesse selon l'état
    DOM.speed.className = 'speed-value';
    
    if (APP_STATE.currentAcceleration > CONFIG.acceleration.threshold) {
        DOM.speedStatus.textContent = '🚀 Accélération!';
        DOM.speed.classList.add('accelerating');
    } else if (APP_STATE.isStabilized) {
        DOM.speedStatus.textContent = '🎵 Vitesse stabilisée';
        DOM.speed.classList.add('stabilized');
    } else {
        DOM.speedStatus.textContent = '🚗 En mouvement';
    }
}

// Mettre à jour le message d'état
function updateStatusMessage(message) {
    DOM.status.textContent = message;
}
