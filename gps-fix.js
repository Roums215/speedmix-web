// ---------- Gestion GPS et détection de vitesse - Version simplifiée ---------- //
console.log("Chargement de gps-fix.js");

// Vérifier que APP est disponible
if (!window.APP) {
    window.APP = {
        GPS: {},
        STATE: {
            usingRealGPS: false,
            autoSimulation: false
        },
        CONFIG: {
            gps: { updateInterval: 1000, simulationMode: true }
        },
        UTILS: {
            updateStatusMessage: function(msg) { console.log(msg); }
        }
    };
}

// Variables locales pour la simulation et le suivi GPS
let simulationInterval = null;
let gpsWatchId = null;
let autoSimulationInterval = null;

// Alias pour faciliter l'accès
const GPS = window.APP.GPS;
// Utiliser directement window.DOM sans créer de variable locale DOM

// Fonction de log sécurisée
function updateStatus(message) {
    console.log(message);
    if (window.APP && window.APP.UTILS) {
        window.APP.UTILS.updateStatusMessage(message);
    }
}

// Basculer entre GPS réel et simulation
window.APP.GPS.toggleGPSMode = function() {
    console.log("toggleGPSMode appelé");
    
    try {
        // Vérifier si DOM est accessible
        if (!window.DOM) {
            console.error("DOM n'est pas défini!");
            window.DOM = {};
            
            // Trouver les éléments manuellement
            window.DOM.btnSimGps = document.getElementById('btn-sim-gps');
        }
        
        if (!window.APP.STATE) {
            window.APP.STATE = { usingRealGPS: false, autoSimulation: false };
        }
        
        // Maintenant, exécuter la logique de bascule
        if (window.APP.STATE.usingRealGPS) {
            // Désactiver le GPS réel et activer la simulation
            console.log("Désactivation du GPS réel, activation de la simulation");
            window.APP.STATE.usingRealGPS = false;
            
            if (window.DOM.btnSimGps) {
                window.DOM.btnSimGps.textContent = "Auto-Simulation";
            }
            
            updateStatus("Mode simulation manuelle activé");
        } 
        else if (!window.APP.STATE.autoSimulation) {
            // Activer l'auto-simulation
            console.log("Activation de l'auto-simulation");
            window.APP.STATE.autoSimulation = true;
            
            if (window.DOM.btnSimGps) {
                window.DOM.btnSimGps.textContent = "Utiliser GPS réel";
            }
            
            updateStatus("Mode auto-simulation activé");
        }
        else {
            // Activer le GPS réel
            console.log("Activation du GPS réel");
            window.APP.STATE.usingRealGPS = true;
            window.APP.STATE.autoSimulation = false;
            
            if (window.DOM.btnSimGps) {
                window.DOM.btnSimGps.textContent = "Utiliser simulation";
            }
            
            // Activer le GPS réel
            startRealGPSTracking();
            
            updateStatus("Mode GPS réel activé");
        }
    } catch (error) {
        console.error("Erreur dans toggleGPSMode:", error);
        alert("Erreur lors du changement de mode GPS: " + error.message);
    }
};

// Activer le GPS réel
function startRealGPSTracking() {
    console.log("Tentative d'activation du GPS réel");
    
    try {
        if (navigator.geolocation) {
            updateStatus("Activation du GPS réel...");
            
            // Demander la permission de géolocalisation
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    // Succès
                    updateStatus("GPS activé avec succès!");
                    
                    // Démarrer le suivi continu
                    gpsWatchId = navigator.geolocation.watchPosition(
                        handlePositionUpdate,
                        handlePositionError,
                        { 
                            enableHighAccuracy: true,
                            maximumAge: 0,
                            timeout: 5000
                        }
                    );
                    
                    // Activer les capteurs de mouvement si disponibles
                    startDeviceMotion();
                },
                function(error) {
                    // Erreur
                    console.error("Erreur d'accès au GPS:", error.message);
                    updateStatus("Erreur d'accès au GPS: " + getPositionErrorMessage(error));
                    
                    // Retour au mode simulation
                    window.APP.STATE.usingRealGPS = false;
                    if (window.DOM.btnSimGps) {
                        window.DOM.btnSimGps.textContent = "Auto-Simulation";
                    }
                },
                { 
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 10000
                }
            );
        } else {
            updateStatus("La géolocalisation n'est pas prise en charge par ce navigateur");
            
            // Retour au mode simulation
            window.APP.STATE.usingRealGPS = false;
            if (window.DOM.btnSimGps) {
                window.DOM.btnSimGps.textContent = "Auto-Simulation";
            }
        }
    } catch (error) {
        console.error("Erreur lors de l'activation du GPS:", error);
        updateStatus("Erreur GPS: " + error.message);
    }
}

// Traitement des mises à jour de position GPS
function handlePositionUpdate(position) {
    try {
        const speed = position.coords.speed ? position.coords.speed * 3.6 : 0; // m/s à km/h
        updateStatus("Vitesse GPS: " + speed.toFixed(1) + " km/h");
        
        // Mettre à jour l'affichage de la vitesse
        if (window.DOM.speed) {
            window.DOM.speed.textContent = speed.toFixed(1) + " ";
        }
        
        if (window.DOM.speedStatus) {
            window.DOM.speedStatus.textContent = speed > 5 ? '🚗 En mouvement' : '⏸️ À l\'arrêt';
        }
    } catch (error) {
        console.error("Erreur de traitement GPS:", error);
    }
}

// Gestion des erreurs de position
function handlePositionError(error) {
    console.error("Erreur GPS:", error.code, error.message);
    updateStatus("Erreur GPS: " + getPositionErrorMessage(error));
}

// Obtenir un message d'erreur lisible
function getPositionErrorMessage(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            return "Permission refusée. Veuillez autoriser l'accès à votre position.";
        case error.POSITION_UNAVAILABLE:
            return "Information de position indisponible.";
        case error.TIMEOUT:
            return "Délai d'attente dépassé.";
        default:
            return "Erreur inconnue.";
    }
}

// Activer les capteurs de mouvement
function startDeviceMotion() {
    try {
        if (window.DeviceMotionEvent) {
            // Pour iOS 13+, il faut demander la permission explicitement
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                DeviceMotionEvent.requestPermission()
                    .then(response => {
                        if (response === 'granted') {
                            window.addEventListener('devicemotion', handleDeviceMotion);
                            updateStatus("Capteurs de mouvement activés (iOS)");
                        } else {
                            updateStatus("Permission d'accès aux capteurs refusée");
                        }
                    })
                    .catch(error => {
                        console.error("Erreur de permission DeviceMotion:", error);
                        updateStatus("Erreur d'accès aux capteurs de mouvement");
                    });
            } else {
                // Pour les autres navigateurs
                window.addEventListener('devicemotion', handleDeviceMotion);
                updateStatus("Capteurs de mouvement activés");
            }
        } else {
            updateStatus("Les capteurs de mouvement ne sont pas disponibles");
        }
    } catch (error) {
        console.error("Erreur d'activation des capteurs:", error);
    }
}

// Traiter les données des capteurs de mouvement
let lastAccelUpdate = 0;
let accelValues = [];
const ACCEL_UPDATE_THROTTLE = 200; // ms

function handleDeviceMotion(event) {
    try {
        // Limiter la fréquence de mise à jour (toutes les 200ms)
        const now = Date.now();
        if (now - lastAccelUpdate < ACCEL_UPDATE_THROTTLE) return;
        lastAccelUpdate = now;
        
        // Vérifier si nous avons access.acceleration ou accelerationIncludingGravity
        let accelData = { x: 0, y: 0, z: 0 };
        
        if (event.acceleration && event.acceleration.x !== null) {
            // Données d'accélération sans gravité
            accelData.x = event.acceleration.x;
            accelData.y = event.acceleration.y;
            accelData.z = event.acceleration.z;
            console.log("Accélération sans gravité:", accelData);
        } else if (event.accelerationIncludingGravity) {
            // Données d'accélération avec gravité
            accelData.x = event.accelerationIncludingGravity.x;
            accelData.y = event.accelerationIncludingGravity.y;
            accelData.z = event.accelerationIncludingGravity.z - 9.81; // Soustraction approximative de la gravité
            console.log("Accélération avec gravité (corrigée):", accelData);
        } else {
            console.log("Aucune donnée d'accélération disponible dans l'événement", event);
            return;
        }
        
        // Magnitude de l'accélération (en m/s²)
        const accelMagnitude = Math.sqrt(accelData.x*accelData.x + accelData.y*accelData.y + accelData.z*accelData.z);
        
        // Moyenner les valeurs pour réduire le bruit
        accelValues.push(accelMagnitude);
        if (accelValues.length > 5) accelValues.shift();
        
        const avgAccel = accelValues.reduce((sum, val) => sum + val, 0) / accelValues.length;
        
        // Convertir en km/h/s (approximatif)
        const accelKmh = avgAccel * 3.6;
        
        // Mise à jour de l'affichage
        console.log("Accélération calculée: " + accelKmh.toFixed(1) + " km/h/s");
        
        if (window.DOM && window.DOM.acceleration) {
            window.DOM.acceleration.textContent = accelKmh.toFixed(1) + " km/h/s";
        } else {
            console.warn("Élément DOM.acceleration non disponible pour l'affichage de l'accélération");
        }
        
        // Adaptation du son en fonction de l'accélération
        if (window.APP && window.APP.AUDIO && typeof window.APP.AUDIO.adaptAudioToAcceleration === 'function') {
            window.APP.AUDIO.adaptAudioToAcceleration(accelKmh);
        }
    } catch (error) {
        console.error("Erreur de traitement des données d'accélération:", error);
    }
}

// Créer des exports globaux pour compatibilité
window.toggleGPSMode = window.APP.GPS.toggleGPSMode;

console.log("gps-fix.js chargé avec succès");
