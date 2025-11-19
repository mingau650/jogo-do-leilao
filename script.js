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
            isAdmin: isAdmin
        };
        
        await window.storage.set('player:' + currentPlayer, JSON.stringify(playerData), true);
        
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');
        
        if (isDev) {
            document.getElementById('devFinishButton').classList.remove('hidden');
        }
        
        updatePlayerInfo();
        loadCurrentRound();
    } catch (error) {
        alert('Erro ao fazer login: ' + error.message);
    }
}

async function updatePlayerInfo() {
    try {
        const result = await window.storage.get('player:' + currentPlayer, true);
        if (result) {
            const data = JSON.parse(result.value);
            document.getElementById('currentPlayer').textContent = '👤 ' + currentPlayer;
            document.getElementById('currentScore').textContent = 'Pontos: ' + data.score;
        }
    } catch (e) {
        document.getElementById('currentPlayer').textContent = '👤 ' + currentPlayer;
        document.getElementById('currentScore').textContent = 'Pontos: 0';
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
        console.error('Erro ao carregar rodada:', error);
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
    } catch (error) {
        console.error('Erro ao iniciar rodada:', error);
    }
}

async function submitGuess() {
    const guessValue = parseInt(document.getElementById('guessInput').value);
    
    if (!guessValue || guessValue <= 0) {
        alert('Digite um valor válido!');
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
        alert('Erro ao enviar palpite: ' + error.message);
    }
}

async function checkAllGuessed() {
    try {
        const playersResult = await window.storage.list('player:', true);
        if (!playersResult || !playersResult.keys) return;
        
        const playerKeys = playersResult.keys;
        
        const guessesResult = await window.storage.list('guess:' + currentRound + ':', true);
        const guessCount = guessesResult && guessesResult.keys ? guessesResult.keys.length : 0;
        
        if (guessCount >= playerKeys.length && guessCount > 0) {
            setTimeout(() => revealResults(), 3000);
        }
    } catch (error) {
        console.error('Erro ao verificar palpites:', error);
    }
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
            const guessResult = await window.storage.get(key, true);
            const guess = JSON.parse(guessResult.value);
            const diff = Math.abs(guess.value - realValue);
            
            if (diff < bestDiff) {
                bestDiff = diff;
                bestPlayer = guess.player;
            }
        }
        
        if (bestPlayer) {
            const playerResult = await window.storage.get('player:' + bestPlayer, true);
            const playerData = JSON.parse(playerResult.value);
            playerData.score += 1;
            await window.storage.set('player:' + bestPlayer, JSON.stringify(playerData), true);
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
        
    } catch (error) {
        console.error('Erro ao revelar resultados:', error);
    }
}

function showResults(roundData) {
    document.getElementById('resultTitle').textContent = '💰 Valor Real: R$ ' + roundData.realValue.toLocaleString('pt-BR');
    document.getElementById('resultText').textContent = 'Vencedor desta rodada:';
    document.getElementById('winnerText').textContent = '🏆 ' + (roundData.winner || 'Ninguém');
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
        
        for (const key of playersResult.keys) {
            const result = await window.storage.get(key, true);
            const data = JSON.parse(result.value);
            players.push(data);
        }
        
        const devAdmPlayers = players.filter(p => p.isDev || p.isAdmin).sort((a, b) => b.score - a.score);
        const normalPlayers = players.filter(p => !p.isDev && !p.isAdmin).sort((a, b) => b.score - a.score).slice(0, 3);
        
        const rankingDevAdm = document.getElementById('rankingDevAdm');
        rankingDevAdm.innerHTML = '';
        
        devAdmPlayers.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item ' + (player.isDev ? 'dev' : 'admin');
            item.innerHTML = `
                <span><span class="ranking-number">${index + 1}º</span> ${player.name}</span>
                <span>${player.score} pts</span>
            `;
            rankingDevAdm.appendChild(item);
        });
        
        const rankingTop3 = document.getElementById('rankingTop3');
        rankingTop3.innerHTML = '';
        
        normalPlayers.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            item.innerHTML = `
                <span><span class="ranking-number">${index + 1}º</span> ${player.name}</span>
                <span>${player.score} pts</span>
            `;
            rankingTop3.appendChild(item);
        });
        
    } catch (error) {
        console.error('Erro ao carregar rankings:', error);
    }
}

async function updateGame() {
    if (!currentPlayer) return;
    
    try {
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
        if (gameStatusResult) {
            const status = JSON.parse(gameStatusResult.value);
            if (status.finished) {
                showFinalScreen();
            }
        }
        
        loadRankings();
        updatePlayerInfo();
    } catch (error) {}
}

async function finishGame() {
    if (!isDev) return;
    
    try {
        await window.storage.set('game_status', JSON.stringify({ finished: true }), true);
        showFinalScreen();
    } catch (error) {
        alert('Erro ao finalizar jogo: ' + error.message);
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
            const result = await window.storage.get(key, true);
            const data = JSON.parse(result.value);
            players.push(data);
        }
        
        players.sort((a, b) => b.score - a.score);
        
        const finalRanking = document.getElementById('finalRanking');
        finalRanking.innerHTML = '';
        
        players.slice(0, 5).forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'final-ranking-item';
            item.innerHTML = `
                <span>${index + 1}º lugar - ${player.name}</span>
                <span>${player.score} pontos</span>
            `;
            finalRanking.appendChild(item);
        });
        
    } catch (error) {
        console.error('Erro ao mostrar ranking final:', error);
    }
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
                const result = await window.storage.get(key, true);
                const data = JSON.parse(result.value);
                data.score = 0;
                await window.storage.set(key, JSON.stringify(data), true);
            }
        }
        
        location.reload();
    } catch (error) {
        alert('Erro ao reiniciar: ' + error.message);
    }
}