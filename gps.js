// ---------- Gestion GPS et détection de vitesse ---------- //

// Variables globales pour la simulation et le suivi GPS
let simulationInterval = null;
let gpsWatchId = null;
let autoSimulationInterval = null;

// Initialisation de la simulation GPS
window.initSimulation = function() {
    // Initialiser les valeurs de simulation
    DOM.simSpeedValue.textContent = `${DOM.simSpeedSlider.value} km/h`;
    DOM.simAccelValue.textContent = `${DOM.simAccelSlider.value} km/h/s`;
}

// Démarrer la simulation de vitesse manuelle
window.startSimulation = function() {
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
window.startAutoSimulation = function() {
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
window.stopAutoSimulation = function() {
    if (autoSimulationInterval) {
        clearInterval(autoSimulationInterval);
        autoSimulationInterval = null;
    }
}

// Arrêter la simulation GPS
window.stopSimulation = function() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
}

// Mettre à jour la vitesse simulée
window.updateSimulatedSpeed = function() {
    const value = DOM.simSpeedSlider.value;
    DOM.simSpeedValue.textContent = `${value} km/h`;
    
    if (CONFIG.gps.simulationMode) {
        updateSpeedData(parseFloat(value), parseFloat(DOM.simAccelSlider.value));
    }
}

// Mettre à jour l'accélération simulée
window.updateSimulatedAcceleration = function() {
    const value = DOM.simAccelSlider.value;
    DOM.simAccelValue.textContent = `${value} km/h/s`;
    
    if (CONFIG.gps.simulationMode) {
        updateSpeedData(parseFloat(DOM.simSpeedSlider.value), parseFloat(value));
    }
}

// Auto-simulation déjà déclarée en haut du fichier

// Basculer entre GPS réel, simulation manuelle et auto-simulation
// Déclaration globale pour accessibilité depuis app.js
window.toggleGPSMode = function() {
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
window.startMotionAndGPSTracking = function() {
    // Stopper les éventuelles instances précédentes
    stopGPSTracking();
    stopMotionTracking();
    stopSimulation();
    stopAutoSimulation();
    
    // Indiquer qu'on utilise les capteurs réels
    APP_STATE.usingRealGPS = true;
    CONFIG.gps.simulationMode = false;
    
    // Détection de la plateforme
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isHTTPS = location.protocol === 'https:';
    
    console.log("Démarrage du suivi de mouvement");
    console.log("Appareil mobile:", isMobile ? "Oui" : "Non");
    console.log("iOS:", isIOS ? "Oui" : "Non");
    console.log("HTTPS:", isHTTPS ? "Oui" : "Non");
    console.log("User Agent:", navigator.userAgent);
    
    updateStatusMessage("📱 Activation des capteurs...");
    
    // Sur les appareils mobiles avec HTTPS, demander l'accès à l'accéléromètre
    if (isMobile && isHTTPS) {
        if (window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission === 'function') {
            // iOS 13+ nécessite une demande explicite
            window.DeviceMotionEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        console.log("Permission accéléromètre accordée");
                        startMotionTracking();
                    } else {
                        console.warn("Permission accéléromètre refusée:", response);
                        updateStatusMessage("Accès accéléromètre refusé");
                    }
                })
                .catch(error => {
                    console.error("Erreur accéléromètre:", error);
                    // On lance quand même le tracking accéléromètre standard
                    startMotionTracking();
                });
        } else if (window.DeviceMotionEvent) {
            // Android et autres appareils sans besoin de permission explicite
            console.log("Démarrage accéléromètre standard");
            startMotionTracking();
        }
    } else if (window.DeviceMotionEvent) {
        // Si ce n'est pas un mobile ou pas HTTPS, on essaie quand même l'accéléromètre
        startMotionTracking();
    }
    
    // Toujours essayer de démarrer le suivi GPS (avec nouvelles options optimisées)
    startGPSTracking();
}

// Démarrer un suivi GPS amélioré spécifiquement pour tous appareils
window.startEnhancedGPSTracking = function() {
    if (!navigator.geolocation) {
        updateStatusMessage("GPS non disponible sur cet appareil");
        startSimulation();
        return;
    }
    
    // Méthode optimisée pour tous appareils, spécialement mobiles
    // Ajouter un indicateur visuel que nous essayons d'obtenir la position
    updateStatusMessage("📍 Initialisation du GPS...");
    document.body.classList.add('requesting-gps');
    
    // Découvrir l'agent utilisateur pour le débogage
    console.log("Agent utilisateur:", navigator.userAgent);
    console.log("Plateforme:", navigator.platform);
    console.log("Protocole:", window.location.protocol);
    
    // Détecter si on est sur un appareil mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Options optimisées pour GPS en voiture (plus agressives sur mobile)
    const options = {
        enableHighAccuracy: true,       // Force l'utilisation du GPS haute précision
        timeout: isMobile ? 15000 : 30000,  // Temps d'attente adapté
        maximumAge: 0,                 // Toujours obtenir une nouvelle position
        distanceFilter: isMobile ? 0 : 1  // Plus sensible sur mobile
    };
    
    // Ajouter un message pour mobile
    if (isMobile && window.location.protocol === 'https:') {
        updateStatusMessage("📱 GPS mobile détecté! Initialisation...");
    }
    
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
        // Options adaptées à tous appareils
        options
    );
}

// Arrêter le suivi GPS
window.stopGPSTracking = function() {
    if (gpsWatchId !== undefined) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = undefined;
    }
    APP_STATE.usingRealGPS = false;
}

// Démarrage du suivi GPS standard
window.startGPSTracking = function() {
    if (!navigator.geolocation) {
        alert("La géolocalisation n'est pas prise en charge par votre navigateur.");
        updateStatusMessage("GPS non disponible!");
        return;
    }
    
    // Vérifier et demander les permissions
    if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' })
            .then(permissionStatus => {
                console.log('État permission GPS:', permissionStatus.state);
            });
    }
    
    updateStatusMessage("Démarrage du GPS...");
    
    // Réinitialiser l'historique des vitesses et positions
    APP_STATE.speedHistory = [];
    APP_STATE.previousSpeed = 0;
    APP_STATE.previousPosition = null;
    APP_STATE.lastUpdate = Date.now();
    
    // Détecter si on est sur un appareil mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Options de géolocalisation optimisées pour mobile
    const options = {
        enableHighAccuracy: true,       // Utiliser GPS haute précision (si disponible)
        timeout: isMobile ? 10000 : 15000, // Délai d'attente maximal
        maximumAge: 0,                 // Toujours utiliser des données récentes
        distanceFilter: isMobile ? 0 : 1  // Intervalle minimal de mise à jour
    };
    
    // Démarrer le suivi de position
    try {
        gpsWatchId = navigator.geolocation.watchPosition(
            handlePositionSuccess,
            (error) => {
                console.warn("Erreur GPS:", error.code, error.message);
                if (error.code === 1) { // PERMISSION_DENIED
                    updateStatusMessage("\u26a0️ Accès GPS refusé. Vérifiez vos paramètres.");
                } else {
                    updateStatusMessage("Erreur GPS: " + error.message);
                }
            },
            options
        );
        
        APP_STATE.usingRealGPS = true;
        CONFIG.gps.simulationMode = false;
        
        // Message de confirmation
        updateStatusMessage("GPS activé - en attente de signal...");        
    } catch (e) {
        console.error("Erreur lors du démarrage du GPS:", e);
        updateStatusMessage("Erreur d'activation GPS");
    }
}

// Détecter le mouvement à l'aide de l'accéléromètre
let motionSensorId = null;
window.startMotionTracking = function() {
    // Support des capteurs de mouvement
    if (window.DeviceMotionEvent) {
        console.log("Démarrage suivi accéléromètre");
        // Ajout un écouteur d'événements pour l'accéléromètre
        window.addEventListener('devicemotion', handleDeviceMotion);
        updateStatusMessage("Capteurs de mouvement actifs");
    } else {
        console.warn("Accéléromètre non disponible");
        updateStatusMessage("Capteurs de mouvement non disponibles");
    }
}

// Arrêter le suivi des capteurs de mouvement
window.stopMotionTracking = function() {
    if (motionSensorId) {
        clearInterval(motionSensorId);
        motionSensorId = null;
    }
    
    window.removeEventListener('devicemotion', handleDeviceMotion);
}

// Gérer les données de l'accéléromètre
window.handleDeviceMotion = function(event) {
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
    
    // Log des données d'accélération pour débogage
    console.log(`Accéléromètre: X=${accelX.toFixed(2)}, Y=${accelY.toFixed(2)}, Z=${accelZ.toFixed(2)}`);
    
    // Magnitude totale du mouvement
    const motionMagnitude = Math.sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
    
    // Calcul direct de vitesse et accélération à partir de l'accéléromètre
    // Pour une démonstration plus réactive
    const speedEstimate = motionMagnitude * 5; // Multiplication simple pour démonstration
    const accel = motionMagnitude;
    
    // Mise à jour de l'interface
    updateSpeedData(speedEstimate, accel);
    updateStatusMessage(`📱 Accéléromètre: ${speedEstimate.toFixed(1)} km/h`);
    
    // Affichage du débogage
    console.log(`Motion: ${motionMagnitude.toFixed(2)} m/s² -> Vitesse: ${speedEstimate.toFixed(2)} km/h`);
}

// Gérer une mise à jour de position GPS réussie
window.handlePositionSuccess = function(position) {
    const currentTime = Date.now();
    const coords = position.coords;
    let speedKmh = 0;
    let acceleration = 0;
    
    // Détecter si on est sur mobile et iOS pour adapter le traitement
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Détection de précision
    const accuracy = coords.accuracy || 0; // en mètres
    const isHighAccuracy = accuracy < 20; // moins de 20m = bonne précision
    
    console.log('Position GPS reçue:', position);
    console.log('Coords:', JSON.stringify({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        speed: coords.speed,
        heading: coords.heading,
        timestamp: position.timestamp
    }));
    
    // Méthode 1: Utiliser la vitesse fournie par l'API Geolocation (si disponible)
    // Sur mobile, la valeur coords.speed est généralement fiable
    if (coords.speed !== null && coords.speed !== undefined && coords.speed >= 0) {
        // La vitesse est fournie en m/s, convertir en km/h
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
window.calculateDistance = function(lat1, lon1, lat2, lon2) {
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
window.handlePositionError = function(error) {
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
window.updateSpeedData = function(speed, acceleration) {
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
window.isSpeedStabilized = function() {
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
window.analyzeBehavior = function() {
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
window.categorizeSpeed = function(speed) {
    if (speed < 20) return 'very_low';
    if (speed < 50) return 'low';
    if (speed < 80) return 'medium';
    return 'high';
}

// Calculer le score d'énergie pour adapter l'intensité musicale
window.calculateEnergyScore = function(speed, acceleration) {
    // Score de base lié à la vitesse (0-70)
    const speedScore = Math.min(70, (speed / 120) * 70);
    
    // Bonus d'accélération (0-30)
    const accelerationBonus = Math.min(30, Math.max(0, acceleration) * 3);
    
    // Score total (0-100)
    return Math.min(100, Math.round(speedScore + accelerationBonus));
}

// Mettre à jour l'affichage de la vitesse
window.updateSpeedDisplay = function() {
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
window.updateStatusMessage = function(message) {
    if (DOM.status) {
        DOM.status.textContent = message;
    } else {
        console.log("Message d'état: " + message);
    }
}

// Fonction pour adapter la musique à la vitesse
window.adaptMusicToSpeed = function(behavior) {
    // Cette fonction est appelée par updateSpeedData
    // Elle doit être définie pour éviter les erreurs
    if (!APP_STATE.isPlaying || APP_STATE.tracks.length === 0) {
        return;
    }
    
    console.log("Adaptation musicale:", behavior);
    
    // Vous pouvez implémenter ici la logique d'adaptation musicale
    // selon la vitesse et l'accélération
}

// Formater le temps au format mm:ss
window.formatTime = function(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
