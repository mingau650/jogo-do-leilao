let currentPlayer = null;
let isDev = false;
let isAdmin = false;
let currentRound = 0;
let hasGuessed = false;
let selectedGame = null;
let timerInterval = null;
let timerStartTime = 0;
let currentTargetTime = 0;
let currentQuantosCount = 0;
let quantosTimeout = null;
let currentCorWord = '';
let currentCorColor = '';
let usedWords = [];
let currentCategory = '';

if (!window.storage) {
    window.storage = {
        async get(key) {
            const val = localStorage.getItem(key);
            return val ? { key, value: val, shared: true } : null;
        },
        async set(key, value) {
            localStorage.setItem(key, value);
            return { key, value, shared: true };
        },
        async delete(key) {
            localStorage.removeItem(key);
            return { key, deleted: true, shared: true };
        },
        async list(prefix) {
            const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix || ''));
            return { keys, shared: true };
        }
    };
}

const palavraCategories = {
    'frutas': ['maçã', 'banana', 'laranja', 'uva', 'morango', 'abacaxi', 'manga', 'melancia', 'kiwi', 'pera'],
    'animais': ['cachorro', 'gato', 'elefante', 'leão', 'tigre', 'girafa', 'zebra', 'macaco', 'urso', 'lobo'],
    'países': ['brasil', 'argentina', 'japão', 'alemanha', 'frança', 'itália', 'espanha', 'portugal', 'china', 'índia'],
    'cores': ['vermelho', 'azul', 'verde', 'amarelo', 'roxo', 'laranja', 'rosa', 'preto', 'branco', 'cinza'],
    'esportes': ['futebol', 'basquete', 'vôlei', 'tênis', 'natação', 'corrida', 'judô', 'boxe', 'ciclismo', 'surfe']
};

const corWords = ['vermelho', 'azul', 'verde', 'amarelo', 'roxo', 'laranja', 'rosa', 'preto'];
const corColors = {
    'vermelho': '#e74c3c',
    'azul': '#3498db',
    'verde': '#27ae60',
    'amarelo': '#f4d03f',
    'roxo': '#9b59b6',
    'laranja': '#e67e22',
    'rosa': '#ff69b4',
    'preto': '#000'
};

document.addEventListener('DOMContentLoaded', () => {
    loadRankings();
    setInterval(updateGame, 2000);
});

function selectGame(game) {
    selectedGame = game;
    document.getElementById('menuScreen').classList.remove('active');
    document.getElementById('loginScreen').classList.add('active');
    
    const titles = {
        'leilao': ['🎨 leilão de objetos', 'adivinhe o valor de objetos raros'],
        'cronometro': ['⏱️ cronômetro cego', 'pare o cronômetro no tempo certo'],
        'quantos': ['👀 quantos tem?', 'conte os objetos rapidamente'],
        'cor': ['🌈 cor confusa', 'digite a cor do texto, não a palavra'],
        'palavra': ['💬 palavra proibida', 'diga palavras sem repetir']
    };
    
    document.getElementById('gameTitle').textContent = titles[game][0];
    document.getElementById('gameDesc').textContent = titles[game][1];
}

function backToMenu() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('menuScreen').classList.add('active');
    selectedGame = null;
}

function backToMenuFinal() {
    location.reload();
}

async function login() {
    const nameInput = document.getElementById('playerName').value.trim();
    
    if (!nameInput) {
        alert('digite um nome');
        return;
    }

    if (nameInput === '2011#mingau_de_chocolate_dev') {
        currentPlayer = 'MINGAU';
        isDev = true;
    } else {
        currentPlayer = nameInput;
    }

    try {
        const adminResult = await window.storage.get('admin:' + currentPlayer, true);
        if (adminResult && adminResult.value === 'true') {
            isAdmin = true;
        }
    } catch (e) {}

    try {
        const playerData = {
            name: currentPlayer,
            score: 0,
            isDev: isDev,
            isAdmin: isAdmin,
            lastSeen: Date.now(),
            game: selectedGame
        };
        
        const existingPlayer = await window.storage.get('player:' + selectedGame + ':' + currentPlayer, true);
        if (existingPlayer) {
            const oldData = JSON.parse(existingPlayer.value);
            playerData.score = oldData.score;
        }
        
        await window.storage.set('player:' + selectedGame + ':' + currentPlayer, JSON.stringify(playerData), true);
        
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');
        
        if (isDev) {
            document.getElementById('devFinishButton').classList.remove('hidden');
        }
        
        document.getElementById('leilaoGame').classList.add('hidden');
        document.getElementById('cronometroGame').classList.add('hidden');
        document.getElementById('quantosGame').classList.add('hidden');
        document.getElementById('corGame').classList.add('hidden');
        document.getElementById('palavraGame').classList.add('hidden');
        
        if (selectedGame === 'leilao') {
            document.getElementById('gameHeaderTitle').textContent = 'quanto vale isso?';
            document.getElementById('leilaoGame').classList.remove('hidden');
            loadCurrentRound();
        } else if (selectedGame === 'cronometro') {
            document.getElementById('gameHeaderTitle').textContent = 'cronômetro cego';
            document.getElementById('cronometroGame').classList.remove('hidden');
            loadTimerRound();
        } else if (selectedGame === 'quantos') {
            document.getElementById('gameHeaderTitle').textContent = 'quantos tem?';
            document.getElementById('quantosGame').classList.remove('hidden');
            loadQuantosRound();
        } else if (selectedGame === 'cor') {
            document.getElementById('gameHeaderTitle').textContent = 'cor confusa';
            document.getElementById('corGame').classList.remove('hidden');
            loadCorRound();
        } else if (selectedGame === 'palavra') {
            document.getElementById('gameHeaderTitle').textContent = 'palavra proibida';
            document.getElementById('palavraGame').classList.remove('hidden');
            loadPalavraRound();
        }
        
        updatePlayerInfo();
    } catch (error) {
        alert('erro ao fazer login');
    }
}

async function updatePlayerInfo() {
    try {
        const result = await window.storage.get('player:' + selectedGame + ':' + currentPlayer, true);
        if (result) {
            const data = JSON.parse(result.value);
            document.getElementById('currentPlayer').textContent = currentPlayer;
            document.getElementById('currentScore').textContent = 'pontos: ' + data.score;
        }
    } catch (e) {
        document.getElementById('currentPlayer').textContent = currentPlayer;
        document.getElementById('currentScore').textContent = 'pontos: 0';
    }
}

async function loadCurrentRound() {
    try {
        const roundResult = await window.storage.get('round:' + selectedGame, true);
        
        if (!roundResult) {
            currentRound = 0;
            await startNewRound();
        } else {
            const roundData = JSON.parse(roundResult.value);
            currentRound = roundData.round;
            
            const item = gameData[currentRound];
            document.getElementById('currentImage').src = item.image;
            document.getElementById('imageDescription').textContent = item.description;
            
            try {
                const guessResult = await window.storage.get('guess:' + selectedGame + ':' + currentRound + ':' + currentPlayer, true);
                if (guessResult) {
                    hasGuessed = true;
                    document.getElementById('guessButton').disabled = true;
                    document.getElementById('waitingMessage').classList.remove('hidden');
                }
            } catch (e) {
                hasGuessed = false;
            }
            
            if (roundData.revealed) {
                showResults(roundData);
            }
        }
    } catch (error) {
        await startNewRound();
    }
}

async function startNewRound() {
    if (currentRound >= gameData.length) {
        return;
    }
    
    const item = gameData[currentRound];
    const roundData = {
        round: currentRound,
        item: item,
        revealed: false,
        startTime: Date.now()
    };
    
    try {
        await window.storage.set('round:' + selectedGame, JSON.stringify(roundData), true);
        
        document.getElementById('currentImage').src = item.image;
        document.getElementById('imageDescription').textContent = item.description;
        document.getElementById('guessButton').disabled = false;
        document.getElementById('waitingMessage').classList.add('hidden');
        document.getElementById('resultMessage').classList.add('hidden');
        
        hasGuessed = false;
    } catch (error) {}
}

async function submitGuess() {
    const guessValue = parseInt(document.getElementById('guessInput').value);
    
    if (!guessValue || guessValue <= 0) {
        alert('digite um valor valido');
        return;
    }
    
    try {
        const guessData = {
            player: currentPlayer,
            value: guessValue,
            timestamp: Date.now()
        };
        
        await window.storage.set('guess:' + selectedGame + ':' + currentRound + ':' + currentPlayer, JSON.stringify(guessData), true);
        
        hasGuessed = true;
        document.getElementById('guessButton').disabled = true;
        document.getElementById('waitingMessage').classList.remove('hidden');
        document.getElementById('guessInput').value = '';
        
        checkAllGuessed();
    } catch (error) {
        alert('erro ao enviar');
    }
}

async function checkAllGuessed() {
    try {
        const playersResult = await window.storage.list('player:' + selectedGame + ':', true);
        if (!playersResult || !playersResult.keys || playersResult.keys.length === 0) return;
        
        const activePlayers = [];
        const now = Date.now();
        
        for (const key of playersResult.keys) {
            try {
                const result = await window.storage.get(key, true);
                if (result && result.value) {
                    const data = JSON.parse(result.value);
                    if (now - data.lastSeen < 10000) {
                        activePlayers.push(data);
                    }
                }
            } catch (e) {}
        }
        
        if (activePlayers.length <= 1) {
            await resetGame();
            return;
        }
        
        const guessesResult = await window.storage.list('guess:' + selectedGame + ':' + currentRound + ':', true);
        const guessCount = guessesResult && guessesResult.keys ? guessesResult.keys.length : 0;
        
        if (guessCount >= activePlayers.length && guessCount > 0) {
            setTimeout(() => revealResults(), 1500);
        }
    } catch (error) {}
}

async function revealResults() {
    try {
        const roundResult = await window.storage.get('round:' + selectedGame, true);
        if (!roundResult) return;
        
        const roundData = JSON.parse(roundResult.value);
        if (roundData.revealed) return;
        
        const item = gameData[currentRound];
        const realValue = item.value;
        
        const guessesResult = await window.storage.list('guess:' + selectedGame + ':' + currentRound + ':', true);
        if (!guessesResult || !guessesResult.keys) return;
        
        let bestPlayer = null;
        let bestDiff = Infinity;
        
        for (const key of guessesResult.keys) {
            try {
                const guessResult = await window.storage.get(key, true);
                if (guessResult && guessResult.value) {
                    const guess = JSON.parse(guessResult.value);
                    const diff = Math.abs(guess.value - realValue);
                    
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        bestPlayer = guess.player;
                    }
                }
            } catch (e) {}
        }
        
        if (bestPlayer) {
            try {
                const playerResult = await window.storage.get('player:' + selectedGame + ':' + bestPlayer, true);
                if (playerResult && playerResult.value) {
                    const playerData = JSON.parse(playerResult.value);
                    playerData.score += 1;
                    await window.storage.set('player:' + selectedGame + ':' + bestPlayer, JSON.stringify(playerData), true);
                }
            } catch (e) {}
        }
        
        roundData.revealed = true;
        roundData.winner = bestPlayer;
        roundData.realValue = realValue;
        await window.storage.set('round:' + selectedGame, JSON.stringify(roundData), true);
        
        showResults(roundData);
        loadRankings();
        
        setTimeout(async () => {
            currentRound++;
            await startNewRound();
            loadCurrentRound();
        }, 5000);
        
    } catch (error) {}
}

function showResults(roundData) {
    document.getElementById('resultTitle').textContent = 'valor real: R$ ' + roundData.realValue.toLocaleString('pt-BR');
    document.getElementById('resultText').textContent = 'vencedor:';
    document.getElementById('winnerText').textContent = roundData.winner || 'ninguem';
    document.getElementById('resultMessage').classList.remove('hidden');
    document.getElementById('waitingMessage').classList.add('hidden');
    
    if (roundData.winner === currentPlayer) {
        updatePlayerInfo();
    }
}

async function loadTimerRound() {
    try {
        const roundResult = await window.storage.get('round:' + selectedGame, true);
        
        if (!roundResult) {
            currentRound = 0;
            await startTimerRound();
        } else {
            const roundData = JSON.parse(roundResult.value);
            currentRound = roundData.round;
            currentTargetTime = roundData.targetTime;
            
            document.getElementById('timerChallenge').textContent = 'aperte STOP em exatamente ' + currentTargetTime + ' segundos';
            
            try {
                const attemptResult = await window.storage.get('attempt:' + selectedGame + ':' + currentRound + ':' + currentPlayer, true);
                if (attemptResult) {
                    hasGuessed = true;
                    document.getElementById('startTimerBtn').classList.add('hidden');
                    document.getElementById('stopTimerBtn').classList.add('hidden');
                    document.getElementById('timerDisplay').classList.add('hidden');
                    document.getElementById('timerWaiting').classList.remove('hidden');
                }
            } catch (e) {
                hasGuessed = false;
            }
            
            if (roundData.revealed) {
                showTimerResults(roundData);
            }
        }
    } catch (error) {
        await startTimerRound();
    }
}

async function startTimerRound() {
    const possibleTimes = [3, 5, 7, 10, 15];
    currentTargetTime = possibleTimes[Math.floor(Math.random() * possibleTimes.length)];
    
    const roundData = {
        round: currentRound,
        targetTime: currentTargetTime,
        revealed: false,
        startTime: Date.now()
    };
    
    try {
        await window.storage.set('round:' + selectedGame, JSON.stringify(roundData), true);
        
        document.getElementById('timerChallenge').textContent = 'aperte STOP em exatamente ' + currentTargetTime + ' segundos';
        document.getElementById('startTimerBtn').classList.remove('hidden');
        document.getElementById('stopTimerBtn').classList.add('hidden');
        document.getElementById('timerDisplay').classList.add('hidden');
        document.getElementById('timerWaiting').classList.add('hidden');
        document.getElementById('timerResult').classList.add('hidden');
        
        hasGuessed = false;
    } catch (error) {}
}

function startTimer() {
    document.getElementById('startTimerBtn').classList.add('hidden');
    document.getElementById('stopTimerBtn').classList.remove('hidden');
    document.getElementById('timerDisplay').classList.remove('hidden');
    
    timerStartTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = (Date.now() - timerStartTime) / 1000;
        document.getElementById('timerDisplay').textContent = elapsed.toFixed(2) + 's';
    }, 10);
}

async function stopTimer() {
    clearInterval(timerInterval);
    const elapsed = (Date.now() - timerStartTime) / 1000;
    
    document.getElementById('stopTimerBtn').classList.add('hidden');
    document.getElementById('timerDisplay').classList.add('hidden');
    document.getElementById('timerWaiting').classList.remove('hidden');
    
    try {
        const attemptData = {
            player: currentPlayer,
            time: elapsed,
            timestamp: Date.now()
        };
        
        await window.storage.set('attempt:' + selectedGame + ':' + currentRound + ':' + currentPlayer, JSON.stringify(attemptData), true);
        
        hasGuessed = true;
        checkAllTimerAttempts();
    } catch (error) {
        alert('erro ao enviar');
    }
}

async function checkAllTimerAttempts() {
    try {
        const playersResult = await window.storage.list('player:' + selectedGame + ':', true);
        if (!playersResult || !playersResult.keys || playersResult.keys.length === 0) return;
        
        const activePlayers = [];
        const now = Date.now();
        
        for (const key of playersResult.keys) {
            try {
                const result = await window.storage.get(key, true);
                if (result && result.value) {
                    const data = JSON.parse(result.value);
                    if (now - data.lastSeen < 10000) {
                        activePlayers.push(data);
                    }
                }
            } catch (e) {}
        }
        
        if (activePlayers.length <= 1) {
            await resetGame();
            return;
        }
        
        const attemptsResult = await window.storage.list('attempt:' + selectedGame + ':' + currentRound + ':', true);
        const attemptCount = attemptsResult && attemptsResult.keys ? attemptsResult.keys.length : 0;
        
        if (attemptCount >= activePlayers.length && attemptCount > 0) {
            setTimeout(() => revealTimerResults(), 1500);
        }
    } catch (error) {}
}

async function revealTimerResults() {
    try {
        const roundResult = await window.storage.get('round:' + selectedGame, true);
        if (!roundResult) return;
        
        const roundData = JSON.parse(roundResult.value);
        if (roundData.revealed) return;
        
        const targetTime = roundData.targetTime;
        
        const attemptsResult = await window.storage.list('attempt:' + selectedGame + ':' + currentRound + ':', true);
        if (!attemptsResult || !attemptsResult.keys) return;
        
        let bestPlayer = null;
        let bestDiff = Infinity;
        
        for (const key of attemptsResult.keys) {
            try {
                const attemptResult = await window.storage.get(key, true);
                if (attemptResult && attemptResult.value) {
                    const attempt = JSON.parse(attemptResult.value);
                    const diff = Math.abs(attempt.time - targetTime);
                    
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        bestPlayer = attempt.player;
                    }
                }
            } catch (e) {}
        }
        
        if (bestPlayer) {
            try {
                const playerResult = await window.storage.get('player:' + selectedGame + ':' + bestPlayer, true);
                if (playerResult && playerResult.value) {
                    const playerData = JSON.parse(playerResult.value);
                    playerData.score += 1;
                    await window.storage.set('player:' + selectedGame + ':' + bestPlayer, JSON.stringify(playerData), true);
                }
            } catch (e) {}
        }
        
        roundData.revealed = true;
        roundData.winner = bestPlayer;
        await window.storage.set('round:' + selectedGame, JSON.stringify(roundData), true);
        
        showTimerResults(roundData);
        loadRankings();
        
        setTimeout(async () => {
            currentRound++;
            await startTimerRound();
            loadTimerRound();
        }, 5000);
        
    } catch (error) {}
}

function showTimerResults(roundData) {
    document.getElementById('timerResultTitle').textContent = 'tempo alvo: ' + roundData.targetTime + 's';
    document.getElementById('timerResultText').textContent = 'vencedor:';
    document.getElementById('timerWinnerText').textContent = roundData.winner || 'ninguem';
    document.getElementById('timerResult').classList.remove('hidden');
    document.getElementById('timerWaiting').classList.add('hidden');
    
    if (roundData.winner === currentPlayer) {
        updatePlayerInfo();
    }
}

async function loadQuantosRound() {
    try {
        const roundResult = await window.storage.get('round:' + selectedGame, true);
        
        if (!roundResult) {
            currentRound = 0;
            await startQuantosRound();
        } else {
            const roundData = JSON.parse(roundResult.value);
            currentRound = roundData.round;
            currentQuantosCount = roundData.count;
            
            try {
                const attemptResult = await window.storage.get('attempt:' + selectedGame + ':' + currentRound + ':' + currentPlayer, true);
                if (attemptResult) {
                    hasGuessed = true;
                    document.getElementById('quantosImageContainer').innerHTML = '';
                    document.getElementById('quantosInputArea').classList.add('hidden');
                    document.getElementById('quantosWaiting').classList.remove('hidden');
                }
            } catch (e) {
                hasGuessed = false;
                displayQuantosObjects(roundData.count, roundData.emoji);
            }
            
            if (roundData.revealed) {
                showQuantosResults(roundData);
            }
        }
    } catch (error) {
        await startQuantosRound();
    }
}

async function startQuantosRound() {
    const emojis = ['⭐', '🎈', '🍎', '🌸', '🔷', '🎯', '💎', '🌟', '🎨', '🔥'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const count = Math.floor(Math.random() * 31) + 20;
    
    currentQuantosCount = count;
    
    const roundData = {
        round: currentRound,
        count: count,
        emoji: emoji,
        revealed: false,
        startTime: Date.now()
    };
    
    try {
        await window.storage.set('round:' + selectedGame, JSON.stringify(roundData), true);
        
        document.getElementById('quantosWaiting').classList.add('hidden');
        document.getElementById('quantosResult').classList.add('hidden');
        document.getElementById('quantosInputArea').classList.add('hidden');
        
        displayQuantosObjects(count, emoji);
        
        hasGuessed = false;
        
        quantosTimeout = setTimeout(() => {
            document.getElementById('quantosImageContainer').innerHTML = '<p style="padding: 20px; color: #666;">tempo acabou! digite sua resposta</p>';
            document.getElementById('quantosInputArea').classList.remove('hidden');
        }, 5000);
        
    } catch (error) {}
}

function displayQuantosObjects(count, emoji) {
    const container = document.getElementById('quantosImageContainer');
    container.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const obj = document.createElement('div');
        obj.className = 'quantos-object';
        obj.textContent = emoji;
        obj.style.left = Math.random() * 90 + '%';
        obj.style.top = Math.random() * 90 + '%';
        container.appendChild(obj);
    }
}

async function submitQuantos() {
    const guess = parseInt(document.getElementById('quantosInput').value);
    
    if (!guess || guess <= 0) {
        alert('digite um numero valido');
        return;
    }
    
    try {
        const attemptData = {
            player: currentPlayer,
            guess: guess,
            timestamp: Date.now()
        };
        
        await window.storage.set('attempt:' + selectedGame + ':' + currentRound + ':' + currentPlayer, JSON.stringify(attemptData), true);
        
        hasGuessed = true;
        document.getElementById('quantosInputArea').classList.add('hidden');
        document.getElementById('quantosWaiting').classList.remove('hidden');
        document.getElementById('quantosInput').value = '';
        
        checkAllTimerAttempts();
    } catch (error) {
        alert('erro ao enviar');
    }
}

async function showQuantosResults(roundData) {
    document.getElementById('quantosResultTitle').textContent = 'quantidade real: ' + roundData.count;
    document.getElementById('quantosResultText').textContent = 'vencedor:';
    document.getElementById('quantosWinnerText').textContent = roundData.winner || 'ninguem';
    document.getElementById('quantosResult').classList.remove('hidden');
    document.getElementById('quantosWaiting').classList.add('hidden');
    
    if (roundData.winner === currentPlayer) {
        updatePlayerInfo();
    }
}

async function loadCorRound() {
    try {
        const roundResult = await window.storage.get('round:' + selectedGame, true);
        
        if (!roundResult) {
            currentRound = 0;
            await startCorRound();
        } else {
            const roundData = JSON.parse(roundResult.value);
            currentRound = roundData.round;
            currentCorWord = roundData.word;
            currentCorColor = roundData.color;
            
            document.getElementById('corDisplay').textContent = currentCorWord;
            document.getElementById('corDisplay').style.color = corColors[currentCorColor];
            
            try {
                const attemptResult = await window.storage.get('attempt:' + selectedGame + ':' + currentRound + ':' + currentPlayer, true);
                if (attemptResult) {
                    hasGuessed = true;
                    document.getElementById('corButton').disabled = true;
                    document.getElementById('corWaiting').classList.remove('hidden');
                }
            } catch (e) {
                hasGuessed = false;
            }
            
            if (roundData.revealed) {
                showCorResults(roundData);
            }
        }
    } catch (error) {
        await startCorRound();
    }
}

async function startCorRound() {
    const word = corWords[Math.floor(Math.random() * corWords.length)];
    let color = corWords[Math.floor(Math.random() * corWords.length)];
    
    while (color === word) {
        color = corWords[Math.floor(Math.random() * corWords.length)];
    }
    
    currentCorWord = word;
    currentCorColor = color;
    
    const roundData = {
        round: currentRound,
        word: word,
        color: color,
        revealed: false,
        startTime: Date.now()
    };
    
    try {
        await window.storage.set('round:' + selectedGame, JSON.stringify(roundData), true);
        
        document.getElementById('corDisplay').textContent = word;
        document.getElementById('corDisplay').style.color = corColors[color];
        document.getElementById('corButton').disabled = false;
        document.getElementById('corWaiting').classList.add('hidden');
        document.getElementById('corResult').classList.add('hidden');
        
        hasGuessed = false;
    } catch (error) {}
}

async function submitCor() {
    const answer = document.getElementById('corInput').value.trim().toLowerCase();
    
    if (!answer) {
        alert('digite uma cor');
        return;
    }
    
    try {
        const attemptData = {
            player: currentPlayer,
            answer: answer,
            correct: answer === currentCorColor,
            timestamp: Date.now()
        };
        
        await window.storage.set('attempt:' + selectedGame + ':' + currentRound + ':' + currentPlayer, JSON.stringify(attemptData), true);
        
        hasGuessed = true;
        document.getElementById('corButton').disabled = true;
        document.getElementById('corWaiting').classList.remove('hidden');
        document.getElementById('corInput').value = '';
        
        checkAllTimerAttempts();
    } catch (error) {
        alert('erro ao enviar');
    }
}

async function showCorResults(roundData) {
    document.getElementById('corResultTitle').textContent = 'cor correta: ' + roundData.color;
    document.getElementById('corResultText').textContent = 'vencedor:';
    document.getElementById('corWinnerText').textContent = roundData.winner || 'ninguem';
    document.getElementById('corResult').classList.remove('hidden');
    document.getElementById('corWaiting').classList.add('hidden');
    
    if (roundData.winner === currentPlayer) {
        updatePlayerInfo();
    }
}

async function loadPalavraRound() {
    try {
        const roundResult = await window.storage.get('round:' + selectedGame, true);
        
        if (!roundResult) {
            currentRound = 0;
            await startPalavraRound();
        } else {
            const roundData = JSON.parse(roundResult.value);
            currentRound = roundData.round;
            currentCategory = roundData.category;
            usedWords = roundData.usedWords || [];
            
            document.getElementById('palavraCategory').textContent = 'categoria: ' + currentCategory;
            
            const usedList = document.getElementById('palavraUsedList');
            usedList.innerHTML = '';
            usedWords.forEach(word => {
                const item = document.createElement('span');
                item.className = 'used-word';
                item.textContent = word;
                usedList.appendChild(item);
            });
            
            try {
                const attemptResult = await window.storage.get('attempt:' + selectedGame + ':' + currentRound + ':' + currentPlayer, true);
                if (attemptResult) {
                    hasGuessed = true;
                    document.getElementById('palavraButton').disabled = true;
                    document.getElementById('palavraWaiting').classList.remove('hidden');
                }
            } catch (e) {
                hasGuessed = false;
            }
            
            if (roundData.revealed) {
                showPalavraResults(roundData);
            }
        }
    } catch (error) {
        await startPalavraRound();
    }
}

async function startPalavraRound() {
    const categories = Object.keys(palavraCategories);
    currentCategory = categories[Math.floor(Math.random() * categories.length)];
    usedWords = [];
    
    const roundData = {
        round: currentRound,
        category: currentCategory,
        usedWords: [],
        revealed: false,
        startTime: Date.now()
    };
    
    try {
        await window.storage.set('round:' + selectedGame, JSON.stringify(roundData), true);
        
        document.getElementById('palavraCategory').textContent = 'categoria: ' + currentCategory;
        document.getElementById('palavraUsedList').innerHTML = '';
        document.getElementById('palavraButton').disabled = false;
        document.getElementById('palavraWaiting').classList.add('hidden');
        document.getElementById('palavraResult').classList.add('hidden');
        
        hasGuessed = false;
    } catch (error) {}
}

async function submitPalavra() {
    const word = document.getElementById('palavraInput').value.trim().toLowerCase();
    
    if (!word) {
        alert('digite uma palavra');
        return;
    }
    
    const roundResult = await window.storage.get('round:' + selectedGame, true);
    if (!roundResult) return;
    
    const roundData = JSON.parse(roundResult.value);
    const currentUsed = roundData.usedWords || [];
    
    const validWords = palavraCategories[currentCategory];
    const isValid = validWords.includes(word);
    const isRepeated = currentUsed.includes(word);
    
    try {
        const attemptData = {
            player: currentPlayer,
            word: word,
            valid: isValid && !isRepeated,
            timestamp: Date.now()
        };
        
        await window.storage.set('attempt:' + selectedGame + ':' + currentRound + ':' + currentPlayer, JSON.stringify(attemptData), true);
        
        if (isValid && !isRepeated) {
            roundData.usedWords.push(word);
            await window.storage.set('round:' + selectedGame, JSON.stringify(roundData), true);
        }
        
        hasGuessed = true;
        document.getElementById('palavraButton').disabled = true;
        document.getElementById('palavraWaiting').classList.remove('hidden');
        document.getElementById('palavraInput').value = '';
        
        checkAllTimerAttempts();
    } catch (error) {
        alert('erro ao enviar');
    }
}

async function showPalavraResults(roundData) {
    document.getElementById('palavraResultTitle').textContent = 'rodada encerrada!';
    document.getElementById('palavraResultText').textContent = 'vencedor:';
    document.getElementById('palavraWinnerText').textContent = roundData.winner || 'ninguem';
    document.getElementById('palavraResult').classList.remove('hidden');
    document.getElementById('palavraWaiting').classList.add('hidden');
    
    if (roundData.winner === currentPlayer) {
        updatePlayerInfo();
    }
}

async function updateGame() {
    if (!currentPlayer || !selectedGame) return;
    
    try {
        const playerData = {
            name: currentPlayer,
            score: 0,
            isDev: isDev,
            isAdmin: isAdmin,
            lastSeen: Date.now(),
            game: selectedGame
        };
        
        const existingPlayer = await window.storage.get('player:' + selectedGame + ':' + currentPlayer, true);
        if (existingPlayer) {
            const oldData = JSON.parse(existingPlayer.value);
            playerData.score = oldData.score;
        }
        
        await window.storage.set('player:' + selectedGame + ':' + currentPlayer, JSON.stringify(playerData), true);
        
        if (hasGuessed) {
            if (selectedGame === 'leilao') {
                checkAllGuessed();
            } else {
                checkAllTimerAttempts();
            }
        }
        
        loadRankings();
    } catch (error) {}
}

async function loadRankings() {
    try {
        const playersResult = await window.storage.list('player:', true);
        if (!playersResult || !playersResult.keys) return;
        
        const allPlayers = [];
        const now = Date.now();
        
        for (const key of playersResult.keys) {
            try {
                const result = await window.storage.get(key, true);
                if (result && result.value) {
                    const data = JSON.parse(result.value);
                    if (now - data.lastSeen < 30000) {
                        allPlayers.push(data);
                    }
                }
            } catch (e) {}
        }
        
        const devAdmPlayers = allPlayers.filter(p => p.isDev || p.isAdmin);
        const regularPlayers = allPlayers.filter(p => !p.isDev && !p.isAdmin);
        
        devAdmPlayers.sort((a, b) => b.score - a.score);
        regularPlayers.sort((a, b) => b.score - a.score);
        
        const rankingDevAdm = document.getElementById('rankingDevAdm');
        if (rankingDevAdm) {
            rankingDevAdm.innerHTML = '';
            devAdmPlayers.forEach((player, index) => {
                const item = document.createElement('div');
                item.className = 'ranking-item';
                item.innerHTML = `
                    <span class="rank">#${index + 1}</span>
                    <span class="name">${player.name}</span>
                    <span class="score">${player.score}</span>
                `;
                rankingDevAdm.appendChild(item);
            });
        }
        
        const rankingTop3 = document.getElementById('rankingTop3');
        if (rankingTop3) {
            rankingTop3.innerHTML = '';
            regularPlayers.slice(0, 3).forEach((player, index) => {
                const item = document.createElement('div');
                item.className = 'ranking-item';
                const medals = ['🥇', '🥈', '🥉'];
                item.innerHTML = `
                    <span class="rank">${medals[index]}</span>
                    <span class="name">${player.name}</span>
                    <span class="score">${player.score}</span>
                `;
                rankingTop3.appendChild(item);
            });
        }
    } catch (error) {}
}

async function finishGame() {
    try {
        const playersResult = await window.storage.list('player:' + selectedGame + ':', true);
        if (!playersResult || !playersResult.keys) return;
        
        const allPlayers = [];
        
        for (const key of playersResult.keys) {
            try {
                const result = await window.storage.get(key, true);
                if (result && result.value) {
                    allPlayers.push(JSON.parse(result.value));
                }
            } catch (e) {}
        }
        
        allPlayers.sort((a, b) => b.score - a.score);
        
        const finalRanking = document.getElementById('finalRanking');
        finalRanking.innerHTML = '';
        
        allPlayers.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            item.innerHTML = `
                <span class="rank">#${index + 1}</span>
                <span class="name">${player.name}</span>
                <span class="score">${player.score} pontos</span>
            `;
            finalRanking.appendChild(item);
        });
        
        document.getElementById('gameScreen').classList.remove('active');
        document.getElementById('finalScreen').classList.add('active');
        
    } catch (error) {}
}

async function restartGame() {
    location.reload();
}

async function resetGame() {
    try {
        const keys = await window.storage.list('', true);
        if (keys && keys.keys) {
            for (const key of keys.keys) {
                await window.storage.delete(key, true);
            }
        }
        location.reload();
    } catch (error) {
        location.reload();
    }
}

function logout() {
    location.reload();
}