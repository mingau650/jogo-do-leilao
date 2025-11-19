let currentPlayer = null;
let isDev = false;
let isAdmin = false;
let currentRound = 0;
let hasGuessed = false;

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

async function login() {
    const nameInput = document.getElementById('playerName').value.trim();
    
    if (!nameInput) {
        alert('Digite um nome!');
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
            lastSeen: Date.now()
        };
        
        const existingPlayer = await window.storage.get('player:' + currentPlayer, true);
        if (existingPlayer) {
            const oldData = JSON.parse(existingPlayer.value);
            playerData.score = oldData.score;
        }
        
        await window.storage.set('player:' + currentPlayer, JSON.stringify(playerData), true);
        
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');
        
        if (isDev) {
            document.getElementById('devFinishButton').classList.remove('hidden');
        }
        
        updatePlayerInfo();
        loadCurrentRound();
    } catch (error) {
        alert('erro ao fazer login');
    }
}

async function updatePlayerInfo() {
    try {
        const result = await window.storage.get('player:' + currentPlayer, true);
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
        const roundResult = await window.storage.get('current_round', true);
        
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
                const guessResult = await window.storage.get('guess:' + currentRound + ':' + currentPlayer, true);
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
        await window.storage.set('current_round', JSON.stringify(roundData), true);
        
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
        
        await window.storage.set('guess:' + currentRound + ':' + currentPlayer, JSON.stringify(guessData), true);
        
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
        const playersResult = await window.storage.list('player:', true);
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
        
        const guessesResult = await window.storage.list('guess:' + currentRound + ':', true);
        const guessCount = guessesResult && guessesResult.keys ? guessesResult.keys.length : 0;
        
        if (guessCount >= activePlayers.length && guessCount > 0) {
            setTimeout(() => revealResults(), 1500);
        }
    } catch (error) {}
}

async function revealResults() {
    try {
        const roundResult = await window.storage.get('current_round', true);
        if (!roundResult) return;
        
        const roundData = JSON.parse(roundResult.value);
        if (roundData.revealed) return;
        
        const item = gameData[currentRound];
        const realValue = item.value;
        
        const guessesResult = await window.storage.list('guess:' + currentRound + ':', true);
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
                const playerResult = await window.storage.get('player:' + bestPlayer, true);
                if (playerResult && playerResult.value) {
                    const playerData = JSON.parse(playerResult.value);
                    playerData.score += 1;
                    await window.storage.set('player:' + bestPlayer, JSON.stringify(playerData), true);
                }
            } catch (e) {}
        }
        
        roundData.revealed = true;
        roundData.winner = bestPlayer;
        roundData.realValue = realValue;
        await window.storage.set('current_round', JSON.stringify(roundData), true);
        
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

async function loadRankings() {
    try {
        const playersResult = await window.storage.list('player:', true);
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
    if (!currentPlayer) return;
    
    try {
        const playerResult = await window.storage.get('player:' + currentPlayer, true);
        if (playerResult && playerResult.value) {
            const data = JSON.parse(playerResult.value);
            data.lastSeen = Date.now();
            await window.storage.set('player:' + currentPlayer, JSON.stringify(data), true);
        }
        
        const roundResult = await window.storage.get('current_round', true);
        if (!roundResult) return;
        
        const roundData = JSON.parse(roundResult.value);
        
        if (roundData.round !== currentRound) {
            currentRound = roundData.round;
            loadCurrentRound();
        }
        
        if (roundData.revealed && document.getElementById('resultMessage').classList.contains('hidden')) {
            showResults(roundData);
        }
        
        const gameStatusResult = await window.storage.get('game_status', true);
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
    if (!currentPlayer) return;
    
    try {
        await window.storage.delete('player:' + currentPlayer, true);
        
        const guessesResult = await window.storage.list('guess:', true);
        if (guessesResult && guessesResult.keys) {
            for (const key of guessesResult.keys) {
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
    try {
        await window.storage.delete('current_round', true);
        await window.storage.delete('game_status', true);
        
        const guessesResult = await window.storage.list('guess:', true);
        if (guessesResult && guessesResult.keys) {
            for (const key of guessesResult.keys) {
                await window.storage.delete(key, true);
            }
        }
        
        const playersResult = await window.storage.list('player:', true);
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
        await startNewRound();
        loadCurrentRound();
    } catch (error) {}
}

async function finishGame() {
    if (!isDev) return;
    
    try {
        await window.storage.set('game_status', JSON.stringify({ finished: true }), true);
        showFinalScreen();
    } catch (error) {
        alert('erro ao finalizar');
    }
}

async function showFinalScreen() {
    document.getElementById('gameScreen').classList.remove('active');
    document.getElementById('finalScreen').classList.add('active');
    
    try {
        const playersResult = await window.storage.list('player:', true);
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
    try {
        await window.storage.delete('current_round', true);
        await window.storage.delete('game_status', true);
        
        const guessesResult = await window.storage.list('guess:', true);
        if (guessesResult && guessesResult.keys) {
            for (const key of guessesResult.keys) {
                await window.storage.delete(key, true);
            }
        }
        
        const playersResult = await window.storage.list('player:', true);
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