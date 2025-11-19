let currentPlayer = null;
let isDev = false;
let isAdmin = false;
let currentRound = 0;
let hasGuessed = false;
let selectedGame = null;
let timerInterval = null;
let timerStartTime = 0;
let currentTargetTime = 0;

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

document.addEventListener('DOMContentLoaded', () => {
    loadRankings();
    setInterval(updateGame, 2000);
});

function selectGame(game) {
    selectedGame = game;
    document.getElementById('menuScreen').classList.remove('active');
    document.getElementById('loginScreen').classList.add('active');
    
    if (game === 'leilao') {
        document.getElementById('gameTitle').textContent = '🎨 leilão de objetos';
        document.getElementById('gameDesc').textContent = 'adivinhe o valor de objetos raros';
    } else if (game === 'cronometro') {
        document.getElementById('gameTitle').textContent = '⏱️ cronômetro cego';
        document.getElementById('gameDesc').textContent = 'pare o cronômetro no tempo certo';
    }
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
        
        if (selectedGame === 'leilao') {
            document.getElementById('gameHeaderTitle').textContent = 'quanto vale isso?';
            document.getElementById('leilaoGame').classList.remove('hidden');
            document.getElementById('cronometroGame').classList.add('hidden');
            loadCurrentRound();
        } else if (selectedGame === 'cronometro') {
            document.getElementById('gameHeaderTitle').textContent = 'cronômetro cego';
            document.getElementById('leilaoGame').classList.add('hidden');
            document.getElementById('cronometroGame').classList.remove('hidden');
            loadTimerRound();
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

async function loadRankings() {
    if (!selectedGame) return;
    
    try {
        const playersResult = await window.storage.list('player:' + selectedGame + ':', true);
        if (!playersResult || !playersResult.keys) return;
        
        const players = [];
        const now = Date.now();
        
        for (const key of playersResult.keys) {
            try {
                const result = await window.storage.get(key, true);
                if (result && result.value) {
                    const data = JSON.parse(result.value);
                    if (now - data.lastSeen < 10000) {
                        players.push(data);
                    }
                }
            } catch (e) {}
        }
        
        const devAdmPlayers = players.filter(p => p.isDev || p.isAdmin).sort((a, b) => b.score - a.score);
        const normalPlayers = players.filter(p => !p.isDev && !p.isAdmin).sort((a, b) => b.score - a.score).slice(0, 3);
        
        const rankingDevAdm = document.getElementById('rankingDevAdm');
        rankingDevAdm.innerHTML = '';
        
        devAdmPlayers.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item ' + (player.isDev ? 'dev' : 'admin');
            item.innerHTML = `
                <span><span class="ranking-number">${index + 1}.</span> ${player.name}</span>
                <span>${player.score}</span>
            `;
            rankingDevAdm.appendChild(item);
        });
        
        const rankingTop3 = document.getElementById('rankingTop3');
        rankingTop3.innerHTML = '';
        
        normalPlayers.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            item.innerHTML = `
                <span><span class="ranking-number">${index + 1}.</span> ${player.name}</span>
                <span>${player.score}</span>
            `;
            rankingTop3.appendChild(item);
        });
        
    } catch (error) {}
}

async function updateGame() {
    if (!currentPlayer || !selectedGame) return;
    
    try {
        const playerResult = await window.storage.get('player:' + selectedGame + ':' + currentPlayer, true);
        if (playerResult && playerResult.value) {
            const data = JSON.parse(playerResult.value);
            data.lastSeen = Date.now();
            await window.storage.set('player:' + selectedGame + ':' + currentPlayer, JSON.stringify(data), true);
        }
        
        const roundResult = await window.storage.get('round:' + selectedGame, true);
        if (!roundResult) return;
        
        const roundData = JSON.parse(roundResult.value);
        
        if (roundData.round !== currentRound) {
            currentRound = roundData.round;
            if (selectedGame === 'leilao') {
                loadCurrentRound();
            } else if (selectedGame === 'cronometro') {
                loadTimerRound();
            }
        }
        
        if (roundData.revealed) {
            if (selectedGame === 'leilao' && document.getElementById('resultMessage').classList.contains('hidden')) {
                showResults(roundData);
            } else if (selectedGame === 'cronometro' && document.getElementById('timerResult').classList.contains('hidden')) {
                showTimerResults(roundData);
            }
        }
        
        const gameStatusResult = await window.storage.get('game_status:' + selectedGame, true);
        if (gameStatusResult && gameStatusResult.value) {
            const status = JSON.parse(gameStatusResult.value);
            if (status.finished) {
                showFinalScreen();
            }
        }
        
        loadRankings();
        updatePlayerInfo();
    } catch (error) {}
}

async function leaveGame() {
    if (!currentPlayer || !selectedGame) return;
    
    try {
        await window.storage.delete('player:' + selectedGame + ':' + currentPlayer, true);
        
        const guessesResult = await window.storage.list('guess:' + selectedGame + ':', true);
        if (guessesResult && guessesResult.keys) {
            for (const key of guessesResult.keys) {
                if (key.includes(':' + currentPlayer)) {
                    await window.storage.delete(key, true);
                }
            }
        }
        
        const attemptsResult = await window.storage.list('attempt:' + selectedGame + ':', true);
        if (attemptsResult && attemptsResult.keys) {
            for (const key of attemptsResult.keys) {
                if (key.includes(':' + currentPlayer)) {
                    await window.storage.delete(key, true);
                }
            }
        }
        
        location.reload();
    } catch (error) {
        alert('erro ao sair');
    }
}

async function resetGame() {
    if (!selectedGame) return;
    
    try {
        await window.storage.delete('round:' + selectedGame, true);
        await window.storage.delete('game_status:' + selectedGame, true);
        
        const guessesResult = await window.storage.list('guess:' + selectedGame + ':', true);
        if (guessesResult && guessesResult.keys) {
            for (const key of guessesResult.keys) {
                await window.storage.delete(key, true);
            }
        }
        
        const attemptsResult = await window.storage.list('attempt:' + selectedGame + ':', true);
        if (attemptsResult && attemptsResult.keys) {
            for (const key of attemptsResult.keys) {
                await window.storage.delete(key, true);
            }
        }
        
        const playersResult = await window.storage.list('player:' + selectedGame + ':', true);
        if (playersResult && playersResult.keys) {
            for (const key of playersResult.keys) {
                try {
                    const result = await window.storage.get(key, true);
                    if (result && result.value) {
                        const data = JSON.parse(result.value);
                        data.score = 0;
                        await window.storage.set(key, JSON.stringify(data), true);
                    }
                } catch (e) {}
            }
        }
        
        currentRound = 0;
        if (selectedGame === 'leilao') {
            await startNewRound();
            loadCurrentRound();
        } else if (selectedGame === 'cronometro') {
            await startTimerRound();
            loadTimerRound();
        }
    } catch (error) {}
}

async function finishGame() {
    if (!isDev || !selectedGame) return;
    
    try {
        await window.storage.set('game_status:' + selectedGame, JSON.stringify({ finished: true }), true);
        showFinalScreen();
    } catch (error) {
        alert('erro ao finalizar');
    }
}

async function showFinalScreen() {
    if (!selectedGame) return;
    
    document.getElementById('gameScreen').classList.remove('active');
    document.getElementById('finalScreen').classList.add('active');
    
    try {
        const playersResult = await window.storage.list('player:' + selectedGame + ':', true);
        if (!playersResult || !playersResult.keys) return;
        
        const players = [];
        
        for (const key of playersResult.keys) {
            try {
                const result = await window.storage.get(key, true);
                if (result && result.value) {
                    const data = JSON.parse(result.value);
                    players.push(data);
                }
            } catch (e) {}
        }
        
        players.sort((a, b) => b.score - a.score);
        
        const finalRanking = document.getElementById('finalRanking');
        finalRanking.innerHTML = '';
        
        players.slice(0, 5).forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'final-ranking-item';
            item.innerHTML = `
                <span>${index + 1}. ${player.name}</span>
                <span>${player.score} pontos</span>
            `;
            finalRanking.appendChild(item);
        });
        
    } catch (error) {}
}

async function restartGame() {
    if (!selectedGame) return;
    
    try {
        await window.storage.delete('round:' + selectedGame, true);
        await window.storage.delete('game_status:' + selectedGame, true);
        
        const guessesResult = await window.storage.list('guess:' + selectedGame + ':', true);
        if (guessesResult && guessesResult.keys) {
            for (const key of guessesResult.keys) {
                await window.storage.delete(key, true);
            }
        }
        
        const attemptsResult = await window.storage.list('attempt:' + selectedGame + ':', true);
        if (attemptsResult && attemptsResult.keys) {
            for (const key of attemptsResult.keys) {
                await window.storage.delete(key, true);
            }
        }
        
        const playersResult = await window.storage.list('player:' + selectedGame + ':', true);
        if (playersResult && playersResult.keys) {
            for (const key of playersResult.keys) {
                try {
                    const result = await window.storage.get(key, true);
                    if (result && result.value) {
                        const data = JSON.parse(result.value);
                        data.score = 0;
                        await window.storage.set(key, JSON.stringify(data), true);
                    }
                } catch (e) {}
            }
        }
        
        location.reload();
    } catch (error) {
        alert('erro ao reiniciar');
    }
}