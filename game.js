class WhisperingEntranceGame {
    constructor() {
        this.currentArea = 0;
        this.gameMode = null;
        this.isListening = false;
        this.recognition = null;
        this.currentSequence = [];
        this.playerSequence = [];
        this.goblinHealth = 3;
        this.playerHealth = 3;
        this.battleTurn = 0;
        this.autoListenTimeout = null;
        this.isSpeaking = false;
        this.audioContext = null;
        this.audioElements = {};
        this.speechSynth = window.speechSynthesis;
        this.selectedVoice = null;
        this.hasStarted = false;
        this.welcomeTriggered = false; // NEW: Prevent multiple welcome triggers
        this.gameKeyListener = null; // NEW: Store game key listener reference
        this.voiceSettings = {
            rate: 0.9,
            pitch: 1.1,
            volume: 0.9
        };
        this.gameAreas = [{
            name: "introduction",
            text: "You are Aria, a young, blind adventurer standing before the ancient stone archway of the Whispering Abyss. Tonight, a faint, otherworldly echo calls you in—a riddle softly vibrating through the ground beneath your feet. As your loyal companion Echo, a sonic bat creature, gently clicks in your palm, you steel your courage and step into the inky dark.",
            choices: [{ text: "Continue", action: "nextArea" }],
            audio: "intro"
        }, {
            name: "echoes_of_entry",
            text: "Soft dripping water and distant, low rumbles immerse you in the subterranean environment. Echo occasionally emits chirps, bouncing off unseen walls. These are auditory cues to suggest the size and shape of the tunnel. A faint melody to the east, rhythmic taps to the north. Which pathway do you choose?",
            choices: [
                { text: "East", action: "chooseEast" },
                { text: "North", action: "chooseNorth" }
            ],
            voiceCommands: ["east", "north"],
            audio: "cave_ambient"
        }, {
            name: "puzzle_door",
            text: "After some exploration, Aria and Echo approach a sealed stone door. A riddle is etched here, words faint but clear: 'Mimic my echo, three notes in the dark, to show you listen and leave your mark.' Listen carefully to the sequence of tones.",
            choices: [{ text: "Listen to Sequence", action: "playSequence" }],
            voiceCommands: ["high", "low", "medium"],
            audio: "door_ambient"
        }, {
            name: "battle",
            text: "Stepping inside, the soundscape changes—furtive shuffles and low growls encircle you. Suddenly, a shadow goblin leaps from the gloom! Prepare to battle.",
            choices: [
                { text: "Attack", action: "attack" },
                { text: "Defend", action: "defend" }
            ],
            voiceCommands: ["attack", "defend"],
            audio: "battle_ambient"
        }, {
            name: "conclusion",
            text: "You have prevailed! Echo circles overhead victoriously. Echo carries a crystal shard dropped by the goblin to your hand. You feel the warmth of the crystal in your palm—a token of your courage. The path deeper into the Abyss now lies open. Your adventure has only just begun. Thank you for playing the Whispering Entrance, an audio journey for the senses.",
            choices: [
                { text: "Play Again", action: "restart" },
                { text: "Exit Game", action: "exit" }
            ],
            audio: "victory"
        }, {
            name: "exit_screen",
            text: "Thank you for playing The Whispering Entrance! Your journey with Aria and Echo has come to an end. You may now close this browser tab.",
            choices: [],
            audio: "farewell"
        }];

        this.init();
    }

    init() {
        this.initializeAudio();
        this.selectRandomVoice();
        this.setupEventListeners();
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            this.setupSpeechRecognition();
        }
        setTimeout(() => {
            this.announceKeyPrompt();
        }, 1000);
    }

    selectRandomVoice() {
        const voices = this.speechSynth.getVoices();
        
        const voiceOptions = [
            { keywords: ['Google UK English Female', 'Microsoft Hazel', 'Karen'], accent: 'British' },
            { keywords: ['Google US English Female', 'Microsoft Zira', 'Samantha'], accent: 'American' },
            { keywords: ['Microsoft Susan', 'Victoria', 'Alex'], accent: 'American Alt' },
            { keywords: ['Google Australian Female', 'Catherine'], accent: 'Australian' },
            { keywords: ['Microsoft Linda', 'Moira', 'Fiona'], accent: 'Scottish/Irish' },
            { keywords: ['Tessa', 'Veena'], accent: 'Indian English' },
            { keywords: ['Microsoft Heami', 'Yuna'], accent: 'Asian English' }
        ];

        const shuffledOptions = voiceOptions.sort(() => Math.random() - 0.5);
        
        for (let option of shuffledOptions) {
            for (let keyword of option.keywords) {
                const voice = voices.find(v => v.name.includes(keyword));
                if (voice) {
                    this.selectedVoice = voice;
                    console.log(`Selected random voice: ${voice.name} (${option.accent})`);
                    return;
                }
            }
        }

        const femaleVoices = voices.filter(v =>
            v.name.toLowerCase().includes('female') ||
            v.name.toLowerCase().includes('woman') ||
            ['Samantha', 'Karen', 'Victoria', 'Moira', 'Tessa', 'Veena', 'Fiona', 'Susan', 'Linda', 'Heami', 'Catherine'].some(name => v.name.includes(name))
        );
        
        if (femaleVoices.length > 0) {
            this.selectedVoice = femaleVoices[Math.floor(Math.random() * femaleVoices.length)];
            console.log('Selected random female voice:', this.selectedVoice.name);
        } else {
            const englishVoice = voices.find(v => v.lang.startsWith('en'));
            this.selectedVoice = englishVoice || voices[0];
            console.log('Selected fallback voice:', this.selectedVoice?.name || 'Default');
        }
    }

    announceKeyPrompt() {
        const keyPromptText = "Press any key to start.";
        this.speakAndThen(keyPromptText, () => {
            setTimeout(() => {
                if (!this.hasStarted) {
                    this.announceGameStart();
                }
            }, 5000);
        });
    }

    announceGameStart() {
        if (this.welcomeTriggered) return; // FIXED: Prevent multiple welcome messages
        this.welcomeTriggered = true;
        
        const welcomeText = "Welcome to The Whispering Entrance, an audio adventure game. Say voice mode for voice gameplay, or normal mode for button controls.";
        this.speakAndThen(welcomeText, () => {
            this.playListenCue(() => {
                this.startAutoListen(0);
            });
        });
    }

    playListenCue(callback) {
        setTimeout(() => {
            this.playChime([330, 440], callback);
        }, 100);
    }

    speak(text, priority = false) {
        if (priority) {
            this.speechSynth.cancel();
        }
        this.isSpeaking = true;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = this.voiceSettings.rate;
        utterance.pitch = this.voiceSettings.pitch;
        utterance.volume = this.voiceSettings.volume;
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }
        utterance.onend = () => {
            this.isSpeaking = false;
        };
        this.speechSynth.speak(utterance);
    }

    speakAndThen(text, callback, delay = 0) {
        this.isSpeaking = true;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = this.voiceSettings.rate;
        utterance.pitch = this.voiceSettings.pitch;
        utterance.volume = this.voiceSettings.volume;
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }
        utterance.onend = () => {
            this.isSpeaking = false;
            if (callback) {
                setTimeout(callback, delay);
            }
        };
        this.speechSynth.speak(utterance);
    }

    startAutoListen(delay = 0) {
        if (!this.recognition) return;
        clearTimeout(this.autoListenTimeout);
        this.autoListenTimeout = setTimeout(() => {
            if (!this.isListening && !this.isSpeaking) {
                console.log('Starting auto-listen');
                try {
                    this.recognition.start();
                } catch (error) {
                    console.error('Speech recognition start error:', error);
                }
            }
        }, delay);
    }

    displayUserSpeech(text) {
        const debugDiv = document.getElementById('debug-output') || this.createDebugOutput();
        debugDiv.innerHTML = `You said: "${text}"<br>${debugDiv.innerHTML}`;
        const entries = debugDiv.getElementsByTagName('br');
        if (entries.length > 10) {
            debugDiv.innerHTML = debugDiv.innerHTML.split('<br>').slice(0, 10).join('<br>');
        }
    }

    createDebugOutput() {
        const debugDiv = document.createElement('div');
        debugDiv.id = 'debug-output';
        debugDiv.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; max-width: 300px; max-height: 200px;
            background: rgba(0,0,0,0.8); color: #00ff00; padding: 10px; font-family: monospace;
            font-size: 12px; border: 1px solid #00ff00; border-radius: 5px; overflow-y: auto; z-index: 1000;
        `;
        document.body.appendChild(debugDiv);
        return debugDiv;
    }

    // FIXED: Separate initial key listener from game key listener
    setupEventListeners() {
        const handleInitialKeyPress = (event) => {
            if (!this.hasStarted && !this.welcomeTriggered) {
                this.hasStarted = true;
                document.removeEventListener('keydown', handleInitialKeyPress);
                
                this.initializeAudioContext().then(() => {
                    this.announceGameStart();
                    // Setup game key listener after welcome
                    this.setupGameKeyListener();
                });
            }
        };
        
        document.addEventListener('keydown', handleInitialKeyPress);

        // Button event listeners with null checks
        const voiceModeBtn = document.getElementById('voice-mode');
        const normalModeBtn = document.getElementById('normal-mode');
        const restartBtn = document.getElementById('restart-btn');
        
        if (voiceModeBtn) {
            voiceModeBtn.addEventListener('click', () => {
                this.speak("Voice mode selected. Starting adventure.", true);
                setTimeout(() => this.startGame('voice'), 2000);
            });
        }
        
        if (normalModeBtn) {
            normalModeBtn.addEventListener('click', () => {
                this.speak("Normal mode selected. Starting adventure.", true);
                setTimeout(() => this.startGame('normal'), 2000);
            });
        }
        
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.restartGame();
            });
        }
    }

    // NEW: Separate game key listener
    setupGameKeyListener() {
        this.gameKeyListener = (event) => {
            if (this.gameMode === 'normal' && this.hasStarted) {
                this.handleKeyboardInput(event);
            }
        };
        document.addEventListener('keydown', this.gameKeyListener);
    }

    // ENHANCED: Better keyboard input handling with debounce
    handleKeyboardInput(event) {
        const key = event.key.toLowerCase();
        const area = this.gameAreas[this.currentArea];
        
        // Prevent default for game keys
        const gameKeys = ['1', '2', '3', '4', '5', 'c', 'e', 'n', 'a', 'd', 'h', 'l', 'm', 'r', 'x', ' '];
        if (gameKeys.includes(key)) {
            event.preventDefault();
        }

        // FIXED: Add debounce to prevent multiple rapid key presses
        if (this.keyDebounce) return;
        this.keyDebounce = true;
        setTimeout(() => { this.keyDebounce = false; }, 300);

        switch (area.name) {
            case 'introduction':
                if (key === 'c' || key === '1') {
                    this.handleChoice('nextArea');
                }
                break;
            case 'echoes_of_entry':
                if (key === 'e' || key === '1') {
                    this.handleChoice('chooseEast');
                } else if (key === 'n' || key === '2') {
                    this.handleChoice('chooseNorth');
                }
                break;
            case 'puzzle_door':
                if (key === 'h' || key === '1') {
                    this.handlePuzzleKeyboard('high');
                } else if (key === 'l' || key === '2') {
                    this.handlePuzzleKeyboard('low');
                } else if (key === 'm' || key === '3') {
                    this.handlePuzzleKeyboard('medium');
                } else if (key === ' ') {
                    this.handleChoice('playSequence');
                }
                break;
            case 'battle':
                if (key === 'a' || key === '1') {
                    this.handleChoice('attack');
                } else if (key === 'd' || key === '2') {
                    this.handleChoice('defend');
                }
                break;
            case 'conclusion':
                if (key === 'r' || key === '1') {
                    this.handleChoice('restart');
                } else if (key === 'x' || key === '2') {
                    this.handleChoice('exit');
                }
                break;
        }
    }

    // FIXED: Enhanced puzzle keyboard with better timing and audio validation
    handlePuzzleKeyboard(tone) {
        // Validate tone input
        const validTones = ['high', 'low', 'medium'];
        if (!validTones.includes(tone)) {
            this.speak('Invalid tone. Please use high, low, or medium.');
            return;
        }

        setTimeout(() => {
            this.playerSequence.push(tone);
            
            // FIXED: Better audio context validation
            if (this.audioContext && this.audioContext.state === 'running') {
                this.playTone(tone);
            } else {
                this.speak(`${tone} tone`, false);
            }

            if (this.playerSequence.length < 3) {
                const nextPrompt = this.playerSequence.length === 1 ? "Second tone?" : "Final tone?";
                setTimeout(() => {
                    this.speak(`Got it. ${nextPrompt}`);
                }, 800); // Wait for tone to finish
            } else {
                setTimeout(() => {
                    this.speakAndThen(`You entered: ${this.playerSequence.join(', ')}. Checking...`, () => {
                        this.checkSequence();
                    }, 500);
                }, 800);
            }
        }, 150); // Small delay to ensure proper sequencing
    }

    initializeAudio() {
        try {
            this.audioContext = new(window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    // ENHANCED: Better speech recognition error handling
    setupSpeechRecognition() {
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            
            this.recognition.onstart = () => {
                this.isListening = true;
                const statusEl = document.getElementById('voice-status');
                if (statusEl) statusEl.textContent = 'Listening...';
            };
            
            this.recognition.onend = () => {
                this.isListening = false;
                const statusEl = document.getElementById('voice-status');
                if (statusEl) statusEl.textContent = 'Ready...';
                
                if (this.gameMode === 'voice' && !this.isSpeaking && this.hasStarted) {
                    this.playListenCue(() => {
                        this.startAutoListen(3500);
                    });
                }
            };
            
            this.recognition.onresult = (event) => {
                if (event.results && event.results[0] && event.results[0][0]) {
                    const command = event.results[0][0].transcript.toLowerCase().trim();
                    this.displayUserSpeech(command);
                    this.processVoiceCommand(command);
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.displayUserSpeech(`[ERROR: ${event.error}]`);
                
                // Don't restart on certain errors
                const nonRecoverableErrors = ['not-allowed', 'service-not-allowed'];
                if (nonRecoverableErrors.includes(event.error)) {
                    this.speak("Speech recognition is not available. Please use normal mode.");
                    return;
                }
                
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    this.speak("Sorry, I didn't catch that. Please try again.");
                }
                
                if (this.gameMode === 'voice' && this.hasStarted) {
                    this.playListenCue(() => {
                        this.startAutoListen(3500);
                    });
                }
            };
        } catch (error) {
            console.error('Speech recognition setup failed:', error);
        }
    }

    async initializeAudioContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new(window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.error('Web Audio API not supported:', e);
                return;
            }
        }
        
        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('Audio context resumed');
            } catch (e) {
                console.error('Failed to resume AudioContext:', e);
            }
        }
    }

    startGame(mode) {
        this.gameMode = mode;
        this.currentArea = 0;
        this.goblinHealth = 3;
        this.playerHealth = 3;
        this.battleTurn = 0;
        this.initializeAudioContext();
        
        const gameMenu = document.getElementById('game-menu');
        const gameArea = document.getElementById('game-area');
        const voiceControls = document.getElementById('voice-controls');
        const buttonControls = document.getElementById('button-controls');
        const listenBtn = document.getElementById('listen-btn');
        
        if (gameMenu) gameMenu.classList.remove('active');
        if (gameArea) gameArea.classList.add('active');
        
        if (mode === 'voice') {
            if (voiceControls) voiceControls.classList.remove('hidden');
            if (buttonControls) buttonControls.classList.add('hidden');
            if (listenBtn) listenBtn.style.display = 'none';
        } else {
            if (voiceControls) voiceControls.classList.add('hidden');
            if (buttonControls) buttonControls.classList.remove('hidden');
        }
        this.loadArea();
    }

    playTone(type) {
        if (!this.audioContext) {
            this.initializeAudioContext();
            return;
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                this.playToneInternal(type);
            });
        } else {
            this.playToneInternal(type);
        }
    }

    // FIXED: Enhanced tone playing with better error handling and validation
    playToneInternal(type) {
        try {
            if (!this.audioContext || this.audioContext.state !== 'running') {
                console.warn('Audio context not running, using speech fallback');
                this.speak(`${type} tone`, false);
                return;
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const frequencies = { 'high': 880, 'medium': 440, 'low': 220 };
            
            if (!frequencies[type]) {
                throw new Error(`Invalid tone type: ${type}`);
            }
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            oscillator.frequency.setValueAtTime(frequencies[type], this.audioContext.currentTime);
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.8);
            
            console.log(`Successfully played ${type} tone at ${frequencies[type]}Hz`);
        } catch (error) {
            console.error('Error playing tone:', error);
            this.speak(`${type} tone`, false);
        }
    }

    loadArea() {
        const area = this.gameAreas[this.currentArea];
        const narratorText = document.getElementById('narrator-text');
        if (narratorText) narratorText.textContent = area.text;
        this.playAmbientSound(area.audio);
        
        if (this.gameMode === 'voice') {
            let fullNarration = area.text;
            switch (area.name) {
                case 'introduction':
                    fullNarration += " Say continue to proceed.";
                    break;
                case 'echoes_of_entry':
                    fullNarration += " Say east or north to choose your path.";
                    break;
                case 'puzzle_door':
                    fullNarration += " I will now generate and play the tone sequence. Listen carefully.";
                    break;
                case 'battle':
                    fullNarration += ` Your health: ${this.playerHealth} hearts. Goblin health: ${this.goblinHealth} hearts. Say attack to strike or defend to block.`;
                    break;
                case 'conclusion':
                    fullNarration += " Say play again to restart the adventure, or say exit to end the game.";
                    break;
                case 'exit_screen':
                    break;
            }
            this.speakAndThen(fullNarration, () => {
                if (area.name === 'puzzle_door') {
                    setTimeout(() => {
                        this.generateToneSequence();
                        this.playSequence();
                    }, 1000);
                } else if (area.name === 'exit_screen') {
                    this.stopListening();
                } else {
                    this.playListenCue(() => {
                        this.startAutoListen(0);
                    });
                }
            });
        } else {
            this.speak(area.text);
            setTimeout(() => {
                this.createChoiceButtons();
                this.announceKeyboardOptions();
            }, this.calculateSpeechDuration(area.text) + 1000);
        }
        
        if (area.name === 'battle') {
            this.updateBattleStatus();
        }
        if (area.name === 'conclusion') {
            const restartBtn = document.getElementById('restart-btn');
            if (restartBtn) restartBtn.classList.remove('hidden');
            this.clearHealthDisplay();
        }
        if (area.name === 'exit_screen') {
            this.clearHealthDisplay();
        }
    }

    announceKeyboardOptions() {
        const area = this.gameAreas[this.currentArea];
        let keyboardText = "";
        
        switch (area.name) {
            case 'introduction':
                keyboardText = "Press C or 1 to continue.";
                break;
            case 'echoes_of_entry':
                keyboardText = "Press E or 1 for East, N or 2 for North.";
                break;
            case 'puzzle_door':
                keyboardText = "Press Space to listen to sequence. Then use H or 1 for High, L or 2 for Low, M or 3 for Medium.";
                break;
            case 'battle':
                keyboardText = "Press A or 1 to Attack, D or 2 to Defend.";
                break;
            case 'conclusion':
                keyboardText = "Press R or 1 to restart, X or 2 to exit.";
                break;
        }
        
        if (keyboardText) {
            setTimeout(() => {
                this.speak(keyboardText);
            }, 500);
        }
    }

    clearHealthDisplay() {
        const gameStatus = document.getElementById('game-status');
        if (gameStatus) gameStatus.textContent = '';
    }

    stopListening() {
        clearTimeout(this.autoListenTimeout);
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('Error stopping speech recognition:', error);
            }
        }
        this.isListening = false;
        const voiceStatus = document.getElementById('voice-status');
        if (voiceStatus) voiceStatus.textContent = 'Game ended';
    }

    // FIXED: Enhanced sequence playing with better timing
    playSequence() {
        if (!this.currentSequence.length) {
            this.generateToneSequence();
        }
        this.playerSequence = [];
        clearTimeout(this.autoListenTimeout);
        
        // FIXED: More reliable sequence timing
        let delay = 500; // Initial delay
        this.currentSequence.forEach((tone, index) => {
            setTimeout(() => {
                console.log(`Playing tone ${index + 1}/${this.currentSequence.length}: ${tone}`);
                this.playTone(tone);
            }, delay);
            delay += 1500;
        });
        
        setTimeout(() => {
            if (this.gameMode === 'voice') {
                this.speakAndThen('Sequence complete. What was the first tone?', () => {
                    this.playListenCue(() => {
                        this.startAutoListen(0);
                    });
                });
            } else {
                this.speak('Sequence complete. Enter the tones using H, L, M or numbers 1, 2, 3.');
            }
        }, delay + 500);
    }

    calculateSpeechDuration(text) {
        const wordsPerMinute = 160;
        const words = text.length / 5;
        return (words / wordsPerMinute) * 60 * 1000;
    }

    announceButtonOptions() {
        const area = this.gameAreas[this.currentArea];
        if (area.choices && area.choices.length > 0) {
            let optionsText = "Available options: ";
            optionsText += area.choices.map(choice => choice.text).join(", ");
            this.speak(optionsText);
        }
    }

    createChoiceButtons() {
        const area = this.gameAreas[this.currentArea];
        const buttonsContainer = document.getElementById('choice-buttons');
        if (!buttonsContainer) return;
        
        buttonsContainer.innerHTML = '';
        area.choices.forEach((choice) => {
            const button = document.createElement('button');
            button.textContent = choice.text;
            button.addEventListener('click', () => {
                this.speak(`You selected ${choice.text}`);
                setTimeout(() => this.handleChoice(choice.action), 1000);
            });
            buttonsContainer.appendChild(button);
        });
    }

    processVoiceCommand(command) {
        if (!command || command.trim() === '') return;
        
        const area = this.gameAreas[this.currentArea];

        if (!this.gameMode) {
            if (command.includes('voice')) {
                this.speak("Voice mode selected. Starting adventure.", true);
                setTimeout(() => this.startGame('voice'), 2000);
            } else if (command.includes('normal')) {
                this.speak("Normal mode selected. Starting adventure.", true);
                setTimeout(() => this.startGame('normal'), 2000);
            } else {
                this.speak('Say "voice mode" or "normal mode" to begin.');
                this.playListenCue(() => {
                    this.startAutoListen(3500);
                });
            }
            return;
        }

        switch (area.name) {
            case 'introduction':
                if (command.includes('continue') || command.includes('next') || command.includes('proceed')) {
                    this.handleChoice('nextArea');
                } else {
                    this.speak('Say "continue" to proceed.');
                    this.playListenCue(() => {
                        this.startAutoListen(3500);
                    });
                }
                break;
            case 'echoes_of_entry':
                if (command.includes('east')) {
                    this.handleChoice('chooseEast');
                } else if (command.includes('north')) {
                    this.handleChoice('chooseNorth');
                } else {
                    this.speak('Say "east" or "north" to choose your path.');
                    this.playListenCue(() => {
                        this.startAutoListen(3500);
                    });
                }
                break;
            case 'puzzle_door':
                this.handlePuzzleCommand(command);
                break;
            case 'battle':
                if (command.includes('attack')) {
                    this.handleChoice('attack');
                } else if (command.includes('defend') || command.includes('block')) {
                    this.handleChoice('defend');
                } else {
                    this.speak('Say "attack" to strike or "defend" to block.');
                    this.playListenCue(() => {
                        this.startAutoListen(3500);
                    });
                }
                break;
            case 'conclusion':
                if ((command.includes('play') && command.includes('again')) || command.includes('restart')) {
                    this.handleChoice('restart');
                } else if (command.includes('exit') || command.includes('quit') || command.includes('end')) {
                    this.handleChoice('exit');
                } else {
                    this.speak('Say "play again" to restart or "exit" to end the game.');
                    this.playListenCue(() => {
                        this.startAutoListen(3500);
                    });
                }
                break;
            case 'exit_screen':
                break;
            default:
                this.speak('Command not recognized in this context.');
                this.playListenCue(() => {
                    this.startAutoListen(3500);
                });
        }
    }

    handlePuzzleCommand(command) {
        let recognizedTone = null;
        if (command.includes('high') || command.includes('hi')) {
            recognizedTone = 'high';
        } else if (command.includes('low')) {
            recognizedTone = 'low';
        } else if (command.includes('medium')) {
            recognizedTone = 'medium';
        }

        if (recognizedTone) {
            this.playerSequence.push(recognizedTone);
            this.playTone(recognizedTone);

            if (this.playerSequence.length < 3) {
                const nextPrompt = this.playerSequence.length === 1 ? "What was the second tone?" : "And the final tone?";
                this.speakAndThen(`Got it. ${nextPrompt}`, () => {
                    this.playListenCue(() => {
                        this.startAutoListen(0);
                    });
                });
            } else {
                this.speakAndThen(`Okay, I heard: ${this.playerSequence.join(', ')}. Let's see if that's correct.`, () => {
                    this.checkSequence();
                }, 0);
            }
        } else {
            const prompts = [
                "What was the first tone? Please say high, low, or medium.",
                "What was the second tone? Please say high, low, or medium.",
                "What was the third tone? Please say high, low, or medium."
            ];
            const currentPrompt = prompts[this.playerSequence.length];
            this.speakAndThen(`Sorry, I didn't catch that. ${currentPrompt}`, () => {
                this.playListenCue(() => {
                    this.startAutoListen(0);
                });
            });
        }
    }

    // FIXED: Better sequence checking with validation
    checkSequence() {
        console.log('Player sequence:', this.playerSequence);
        console.log('Correct sequence:', this.currentSequence);

        if (this.playerSequence.length !== 3 || this.currentSequence.length !== 3) {
            this.speak('Invalid sequence length. Let\'s try again.');
            this.playSequence();
            return;
        }

        let isCorrect = true;
        for (let i = 0; i < 3; i++) {
            if (this.playerSequence[i] !== this.currentSequence[i]) {
                isCorrect = false;
                break;
            }
        }

        if (isCorrect) {
            this.playSuccessSound();
            const successText = "Perfect! The stone door rumbles open with a warm chime. The passage beyond awaits.";
            this.speak(successText);
            const narratorText = document.getElementById('narrator-text');
            if (narratorText) narratorText.textContent = successText;
            setTimeout(() => {
                this.currentArea++;
                this.loadArea();
            }, this.calculateSpeechDuration(successText) + 1000);
        } else {
            this.playErrorSound();
            this.speak(`Not quite right. The correct sequence was: ${this.currentSequence.join(', ')}. Let's try again. Listen carefully.`);
            setTimeout(() => {
                this.playSequence();
            }, 5000);
        }
    }

    handleChoice(action) {
        clearTimeout(this.autoListenTimeout);
        this.speechSynth.cancel();
        switch (action) {
            case 'nextArea':
                this.currentArea++;
                this.loadArea();
                break;
            case 'chooseEast':
                this.playSuccessSound();
                const eastText = "The musical chimes grow brighter. This is the correct route. You proceed deeper.";
                this.speakAndThen(eastText, () => {
                    this.currentArea++;
                    this.loadArea();
                });
                const narratorText = document.getElementById('narrator-text');
                if (narratorText) narratorText.textContent += "\n\n" + eastText;
                break;
            case 'chooseNorth':
                this.playErrorSound();
                const northText = "Heavy echoes suggest a dead end. Echo chirps nervously, guiding you back. Try a different path.";
                this.speakAndThen(northText, () => {
                    if (this.gameMode === 'voice') {
                        this.playListenCue(() => {
                            this.startAutoListen(0);
                        });
                    }
                });
                const narratorText2 = document.getElementById('narrator-text');
                if (narratorText2) narratorText2.textContent += "\n\n" + northText;
                break;
            case 'attack':
                this.handleBattleAction('attack');
                break;
            case 'defend':
                this.handleBattleAction('defend');
                break;
            case 'restart':
                this.speak("Restarting adventure.");
                setTimeout(() => this.restartGame(), 2000);
                break;
            case 'playSequence':
                this.generateToneSequence();
                this.playSequence();
                break;
            case 'exit':
                this.speak("Thank you for playing!");
                setTimeout(() => {
                    this.currentArea = this.gameAreas.length - 1;
                    this.loadArea();
                }, 2000);
                break;
        }
    }

    generateToneSequence() {
        const tones = ['high', 'low', 'medium'];
        this.currentSequence = [];
        for (let i = 0; i < 3; i++) {
            this.currentSequence.push(tones[Math.floor(Math.random() * tones.length)]);
        }
        this.playerSequence = [];
        console.log('Generated new sequence:', this.currentSequence);
    }

    // ENHANCED: Better battle logic with mutual death retry
    handleBattleAction(action) {
        this.battleTurn++;
        const goblinActions = ['attack', 'defend'];
        const goblinAction = goblinActions[Math.floor(Math.random() * goblinActions.length)];
        let resultText = '';

        if (action === 'attack') {
            if (goblinAction === 'defend') {
                resultText = "Your strike finds its mark! The goblin stumbles back with a yelp!";
                this.goblinHealth--;
                this.playAttackSound();
            } else {
                resultText = "Both strike! Your sword clashes against goblin claws. Both take damage!";
                this.goblinHealth--;
                this.playerHealth--;
                this.playClashSound();
            }
        } else if (action === 'defend') {
            if (goblinAction === 'attack') {
                resultText = "Perfect timing! The goblin's claws glance off your shield.";
                this.playDefendSound();
            } else {
                resultText = "Both take defensive stances. The tension builds.";
                this.playStandoffSound();
            }
        }

        const narratorText = document.getElementById('narrator-text');
        if (narratorText) narratorText.textContent = resultText;
        this.updateBattleStatus();

        // FIXED: Mutual death retry logic
        if (this.goblinHealth <= 0 && this.playerHealth <= 0) {
            this.playErrorSound();
            const drawText = resultText + " In a final clash, both you and the goblin fall! The ancient magic of the abyss revives you both for another chance. The fight begins anew!";
            this.speakAndThen(drawText, () => {
                this.goblinHealth = 3;
                this.playerHealth = 3;
                this.battleTurn = 0;
                this.updateBattleStatus();
                
                const retryText = "Both fighters stand again, ready for battle! What's your move?";
                this.speakAndThen(retryText, () => {
                    if (this.gameMode === 'voice') {
                        this.playListenCue(() => {
                            this.startAutoListen(0);
                        });
                    }
                });
            });
        } else if (this.goblinHealth <= 0) {
            this.playVictorySound();
            const victoryText = resultText + " Victory! The goblin is defeated!";
            this.speakAndThen(victoryText, () => {
                this.currentArea++;
                this.loadArea();
            });
        } else if (this.playerHealth <= 0) {
            const defeatText = resultText + " The goblin's claws find their mark. You collapse defeated. Say restart to try again.";
            this.speakAndThen(defeatText, () => {
                const restartBtn = document.getElementById('restart-btn');
                if (restartBtn) restartBtn.classList.remove('hidden');
                if (this.gameMode === 'voice') {
                    this.playListenCue(() => {
                        this.startAutoListen(3500);
                    });
                }
            });
        } else {
            const continueText = resultText + ` The battle continues! Your health: ${this.playerHealth}. Goblin health: ${this.goblinHealth}. What's your next move?`;
            this.speakAndThen(continueText, () => {
                if (this.gameMode === 'voice') {
                    this.playListenCue(() => {
                        this.startAutoListen(0);
                    });
                }
            });
        }
    }

    updateBattleStatus() {
        const statusText = `Your Health: ${'❤️'.repeat(Math.max(0, this.playerHealth))} | Goblin Health: ${'👹'.repeat(Math.max(0, this.goblinHealth))}`;
        const gameStatus = document.getElementById('game-status');
        if (gameStatus) gameStatus.textContent = statusText;
    }

    playSuccessSound() { 
        setTimeout(() => this.playChime([523.25, 659.25, 783.99]), 100);
    }
    playErrorSound() { 
        setTimeout(() => this.playChime([200, 150, 100]), 100);
    }
    playAttackSound() { 
        setTimeout(() => this.playChime([400, 300, 500]), 100);
    }
    playDefendSound() { 
        setTimeout(() => this.playChime([300, 400]), 100);
    }
    playClashSound() { 
        setTimeout(() => this.playChime([600, 400, 200, 800]), 100);
    }
    playStandoffSound() { 
        setTimeout(() => this.playChime([250, 260, 255]), 100);
    }
    playVictorySound() { 
        setTimeout(() => this.playChime([523.25, 587.33, 659.25, 698.46, 783.99]), 100);
    }

    // ENHANCED: Improved chime playing with better error handling
    playChime(frequencies, callback) {
        if (!this.audioContext) {
            if (callback) callback();
            return;
        }
        
        try {
            let completedTones = 0;
            const totalTones = frequencies.length;
            
            frequencies.forEach((freq, index) => {
                setTimeout(() => {
                    try {
                        const oscillator = this.audioContext.createOscillator();
                        const gainNode = this.audioContext.createGain();
                        oscillator.connect(gainNode);
                        gainNode.connect(this.audioContext.destination);
                        oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                        oscillator.start(this.audioContext.currentTime);
                        oscillator.stop(this.audioContext.currentTime + 0.3);
                        
                        oscillator.onended = () => {
                            completedTones++;
                            if (completedTones === totalTones && callback) {
                                setTimeout(callback, 100);
                            }
                        };
                    } catch (error) {
                        console.error('Error playing chime tone:', error);
                        completedTones++;
                        if (completedTones === totalTones && callback) {
                            setTimeout(callback, 100);
                        }
                    }
                }, index * 100);
            });
        } catch (error) {
            console.error('Error in playChime:', error);
            if (callback) callback();
        }
    }

    playAmbientSound(soundType) {
        console.log(`Playing ambient sound: ${soundType}`);
    }

    // ENHANCED: Better cleanup on restart
    restartGame() {
        clearTimeout(this.autoListenTimeout);
        this.speechSynth.cancel();
        
        // Clean up event listeners
        if (this.gameKeyListener) {
            document.removeEventListener('keydown', this.gameKeyListener);
            this.gameKeyListener = null;
        }
        
        // Reset UI elements
        const gameArea = document.getElementById('game-area');
        const gameMenu = document.getElementById('game-menu');
        const restartBtn = document.getElementById('restart-btn');
        
        if (gameArea) gameArea.classList.remove('active');
        if (gameMenu) gameMenu.classList.add('active');
        if (restartBtn) restartBtn.classList.add('hidden');
        
        this.clearHealthDisplay();
        
        // Reset game state
        this.currentArea = 0;
        this.playerSequence = [];
        this.currentSequence = [];
        this.gameMode = null;
        this.hasStarted = false;
        this.welcomeTriggered = false;
        this.keyDebounce = false;
        
        this.selectRandomVoice();
        
        const debugDiv = document.getElementById('debug-output');
        if (debugDiv) {
            debugDiv.innerHTML = '';
        }
        
        this.setupEventListeners();
        setTimeout(() => {
            this.announceKeyPrompt();
        }, 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if ('speechSynthesis' in window) {
        let voicesLoaded = false;
        const loadVoices = () => {
            if (!voicesLoaded) {
                voicesLoaded = true;
                new WhisperingEntranceGame();
            }
        };
        const checkVoices = () => {
            if (speechSynthesis.getVoices().length > 0) {
                loadVoices();
            } else {
                setTimeout(checkVoices, 100);
            }
        };
        speechSynthesis.addEventListener('voiceschanged', loadVoices);
        checkVoices();
    } else {
        new WhisperingEntranceGame();
    }
});
