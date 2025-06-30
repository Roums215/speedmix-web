// ---------- Génération de sons synthétiques ---------- //

// Fonction pour créer un buffer audio synthétique
function createSynthBuffer(audioContext, type, duration, options = {}) {
    // Type: 'sine', 'square', 'sawtooth', 'triangle', 'noise', 'drum', 'bass'
    const sampleRate = audioContext.sampleRate;
    const bufferSize = duration * sampleRate;
    const buffer = audioContext.createBuffer(2, bufferSize, sampleRate); // Stéréo
    
    // Options par défaut
    const defaults = {
        frequency: 440, // Hz
        attack: 0.01,  // secondes
        decay: 0.1,    // secondes
        sustain: 0.7,  // niveau (0-1)
        release: 0.5,  // secondes
        bpm: 120,      // battements par minute
        notes: [60, 64, 67, 72] // MIDI notes (C, E, G, C)
    };
    
    // Fusionner avec les options par défaut
    const params = { ...defaults, ...options };
    
    // Obtenir les canaux de données
    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);
    
    // Fonction pour générer une enveloppe ADSR
    const generateADSR = (time, totalDuration) => {
        const attackEnd = params.attack;
        const decayEnd = attackEnd + params.decay;
        const releaseStart = totalDuration - params.release;
        
        if (time < attackEnd) {
            // Phase d'attaque
            return time / params.attack;
        } else if (time < decayEnd) {
            // Phase de decay
            return 1 - (1 - params.sustain) * ((time - attackEnd) / params.decay);
        } else if (time < releaseStart) {
            // Phase de sustain
            return params.sustain;
        } else {
            // Phase de release
            return params.sustain * (1 - (time - releaseStart) / params.release);
        }
    };
    
    // Génération selon le type
    switch(type) {
        case 'sine':
        case 'square':
        case 'sawtooth':
        case 'triangle':
            // Oscillateur simple
            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate; // Temps en secondes
                const envelope = generateADSR(t, duration);
                
                // Génération de forme d'onde
                let value = 0;
                if (type === 'sine') {
                    value = Math.sin(2 * Math.PI * params.frequency * t);
                } else if (type === 'square') {
                    value = Math.sin(2 * Math.PI * params.frequency * t) > 0 ? 1 : -1;
                } else if (type === 'sawtooth') {
                    value = 2 * ((t * params.frequency) % 1) - 1;
                } else if (type === 'triangle') {
                    const phase = (t * params.frequency) % 1;
                    value = phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
                }
                
                // Appliquer l'enveloppe
                value *= envelope * 0.5; // Réduire l'amplitude
                
                leftChannel[i] = value;
                rightChannel[i] = value;
            }
            break;
            
        case 'noise':
            // Bruit blanc
            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate;
                const envelope = generateADSR(t, duration);
                const noise = Math.random() * 2 - 1;
                
                leftChannel[i] = noise * envelope * 0.25; // Réduire volume
                rightChannel[i] = noise * envelope * 0.25;
            }
            break;
            
        case 'drum':
            // Son de batterie synthétique (kick drum)
            const kickFreq = 150;
            const kickDecay = 0.2;
            
            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate;
                let amp = Math.exp(-t / kickDecay);
                let freq = kickFreq * Math.exp(-t * 5);
                
                // Oscillateur principal (sinus)
                let value = amp * Math.sin(2 * Math.PI * t * freq);
                
                // Ajouter un peu de bruit pour la texture
                if (t < 0.05) {
                    value += (Math.random() * 2 - 1) * amp * 0.5;
                }
                
                leftChannel[i] = value * 0.7;
                rightChannel[i] = value * 0.7;
            }
            break;
            
        case 'bass':
            // Son de basse synthétique
            const baseFreq = params.frequency;
            
            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate;
                const envelope = generateADSR(t, duration);
                
                // Oscillateur principal (onde carrée)
                let value = Math.sin(2 * Math.PI * baseFreq * t) > 0 ? 1 : -1;
                
                // Ajouter un sub-oscillateur (une octave plus bas)
                const subOsc = Math.sin(2 * Math.PI * (baseFreq / 2) * t) > 0 ? 0.5 : -0.5;
                value = value * 0.7 + subOsc * 0.3;
                
                // Ajouter un filtre passe-bas simulé
                const filterEnv = Math.exp(-t * 2);
                value = value * (0.7 + 0.3 * filterEnv);
                
                // Appliquer l'enveloppe ADSR
                value *= envelope * 0.5;
                
                leftChannel[i] = value;
                rightChannel[i] = value;
            }
            break;
            
        case 'melody':
            // Mélodie simple basée sur les notes MIDI
            const noteDuration = 60 / params.bpm; // Durée d'une noire en secondes
            const notes = params.notes;
            
            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate;
                
                // Déterminer quelle note jouer
                const noteIndex = Math.floor(t / noteDuration) % notes.length;
                const noteStartTime = noteIndex * noteDuration;
                const timeInNote = t - noteStartTime;
                
                // Convertir MIDI en fréquence: f = 440 * 2^((n-69)/12)
                const midiNote = notes[noteIndex];
                const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
                
                // Créer une enveloppe par note
                const noteEnvelope = generateADSR(timeInNote, noteDuration);
                
                // Générer le son (sinus)
                let value = Math.sin(2 * Math.PI * freq * t) * noteEnvelope * 0.4;
                
                leftChannel[i] = value;
                rightChannel[i] = value;
            }
            break;
    }
    
    return buffer;
}

// Créer une playlist de sons synthétiques prédéfinis
function createSynthPlaylist(audioContext) {
    const playlist = [];
    
    // Track 1: Drum pattern (high energy)
    const drumTrack = {
        id: 'synth-drum-1',
        name: 'Beat Energique',
        artist: 'Synth DJ',
        energy: 'high',
        duration: 16 // 16 secondes
    };
    
    drumTrack.buffer = createSynthBuffer(audioContext, 'drum', drumTrack.duration, {
        bpm: 128
    });
    
    // Track 2: Bass line (medium energy)
    const bassTrack = {
        id: 'synth-bass-1',
        name: 'Groove Bass',
        artist: 'Synth DJ',
        energy: 'medium',
        duration: 12 // 12 secondes
    };
    
    bassTrack.buffer = createSynthBuffer(audioContext, 'bass', bassTrack.duration, {
        frequency: 110, // La grave
        bpm: 110
    });
    
    // Track 3: Ambient melody (low energy)
    const ambientTrack = {
        id: 'synth-ambient-1',
        name: 'Ambiance Calme',
        artist: 'Synth DJ',
        energy: 'low',
        duration: 20 // 20 secondes
    };
    
    ambientTrack.buffer = createSynthBuffer(audioContext, 'melody', ambientTrack.duration, {
        notes: [60, 64, 67, 71, 67, 64], // Do, Mi, Sol, Si, Sol, Mi
        bpm: 60
    });
    
    // Track 4: Energetic melody (high energy)
    const energeticTrack = {
        id: 'synth-energetic-1',
        name: 'Montée Dynamique',
        artist: 'Synth DJ',
        energy: 'high',
        duration: 10 // 10 secondes
    };
    
    energeticTrack.buffer = createSynthBuffer(audioContext, 'melody', energeticTrack.duration, {
        notes: [60, 62, 64, 65, 67, 69, 71, 72], // Do, Ré, Mi, Fa, Sol, La, Si, Do
        bpm: 140
    });
    
    // Track 5: Calm ambient (very low energy)
    const calmTrack = {
        id: 'synth-calm-1',
        name: 'Détente',
        artist: 'Synth DJ',
        energy: 'low',
        duration: 15 // 15 secondes
    };
    
    calmTrack.buffer = createSynthBuffer(audioContext, 'sine', calmTrack.duration, {
        frequency: 220, // La
        attack: 1.0,
        decay: 1.0,
        sustain: 0.8,
        release: 2.0
    });
    
    // Ajouter toutes les pistes à la playlist
    playlist.push(drumTrack, bassTrack, ambientTrack, energeticTrack, calmTrack);
    
    return playlist;
}
