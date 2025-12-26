// --- 1. CLÉS ET DONNÉES DE BASE ---
const LS_STATS_KEY = 'jdrStatsAdvanced';
const LS_EQUIPMENT_KEY = 'jdrEquipment'; 
const LS_INVENTORY_KEY = 'jdrInventorySimple'; 
const LS_NPCS_KEY = 'jdrNpcsAdvanced';
const LS_CHAR_INFO_KEY = 'jdrCharInfo';
const LS_DICE_HISTORY_KEY = 'jdrDiceHistory';

const STATS_LIST = ['HAB', 'END', 'ARM', 'ADR', 'CHA', 'CRI'];

// Descriptions des stats (CORRIGÉES avec les entités HTML pour plus de fiabilité)
const STAT_DESCRIPTIONS = {
    'HAB': { name: 'Habileté (HAB)', desc: 'Avantage ou non au combat. Calcul: (Score H. du Héros) - (Score H. de l\'ennemi). Si le résultat est +8 ou -8, domination totale de l\'un ou de l\'autre.' },
    'END': { name: 'Endurance (END)', desc: 'Résistance Physique / Résilience. PV Max calculés: 1 Endurance = 3 Points de Vie Max.' },
    'ARM': { name: 'Armure (ARM)', desc: 'Réduction FLAT (plate) des dégâts finaux reçus.' },
    'ADR': { name: 'Adresse (ADR)', desc: 'Agilité / Esquive. Si un jet de dé D6 est &le; au score d\'Adresse, l\'esquive réussit. Esquive possible uniquement si ADR &ge; 2. Si jet d\'esquive = 1, alors l\'esquive réussit + contre-attaque critique (ignorante l\'armure ennemie).' },
    'CHA': { name: 'Chance (CHA)', desc: 'Si un jet de dé de chance est &le; au score de Chance actuel, alors le jet réussit. Chaque utilisation du jet de Chance consomme 1 point de la Chance actuelle.' },
    'CRI': { name: 'Critique (CRI)', desc: 'Bonus de dégâts pour les coups critiques. Dégâts de Contre-Attaque Critique = (Dégâts Max de l\'attaque) + (Score de Critique).' }
};

// --- 2. FONCTIONS UTILITAIRES DE STOCKAGE ---

function loadData(key, defaultValue) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Données initiales
let stats = loadData(LS_STATS_KEY, {
    base: { HAB: 5, END: 5, ARM: 0, ADR: 5, CHA: 5, CRI: 0 },
    current: { ...loadData(LS_STATS_KEY, {}).current, 'PV Actuels': 15 },
    maxCha: 5,
});

let equipment = loadData(LS_EQUIPMENT_KEY, []);
let inventorySimple = loadData(LS_INVENTORY_KEY, []);
let npcs = loadData(LS_NPCS_KEY, []);
let charInfo = loadData(LS_CHAR_INFO_KEY, { name: '', class: '' });
let diceHistory = loadData(LS_DICE_HISTORY_KEY, []); 

// --- 3. GESTION DES STATISTIQUES ET CALCULS ---

function calculateStatBonus() {
    const bonuses = { HAB: 0, END: 0, ARM: 0, ADR: 0, CHA: 0, CRI: 0 };

    equipment.forEach(item => { 
        if (item.bonus) {
            const bonusParts = item.bonus.toUpperCase().split(',');
            bonusParts.forEach(part => {
                const match = part.trim().match(/([+-]\d+)\s*([A-Z]+)/);
                if (match) {
                    const value = parseInt(match[1], 10) * item.quantity;
                    const statKey = match[2];
                    if (STATS_LIST.includes(statKey)) {
                        bonuses[statKey] += value;
                    }
                }
            });
        }
    });
    return bonuses;
}

function renderStats() {
    const table = document.getElementById('stats-table');
    table.innerHTML = `
        <tr>
            <th>Statistique</th>
            <th>Base</th>
            <th>Bonus (Équipement)</th>
            <th>Total</th>
        </tr>
    `;
    const statBonuses = calculateStatBonus();
    let totalPVMax = 0;
    
    STATS_LIST.forEach(statKey => {
        const baseValue = stats.base[statKey] || 0;
        const bonus = statBonuses[statKey] || 0;
        const totalValue = baseValue + bonus;
        
        let totalStatCell = totalValue;

        // Cas spécial pour l'Endurance (END)
        if (statKey === 'END') {
            totalPVMax = totalValue * 3;
        }

        // Cas spécial pour la Chance (CHA)
        if (statKey === 'CHA') {
            const newMaxCha = totalValue;
            stats.maxCha = newMaxCha;
            
            // Assure que la Chance actuelle ne dépasse pas la Chance Max
            if (typeof stats.current.CHA === 'undefined' || stats.current.CHA > stats.maxCha) {
                 stats.current.CHA = stats.maxCha;
            }
            totalStatCell = stats.current.CHA;
        }

        const row = table.insertRow();
        row.innerHTML = `
            <th>${statKey}</th>
            <td class="stat-value-base">
                <input type="number" value="${baseValue}" 
                       onchange="updateStatBase('${statKey}', this.value)" 
                       min="${statKey === 'ARM' || statKey === 'CRI' ? 0 : 1}" style="width: 50px;">
            </td>
            <td>${bonus >= 0 ? '+' : ''}${bonus}</td>
            <td class="stat-value-total">${totalStatCell}</td>
        `;
    });
    
    // Ajout d'une ligne pour les PV Actuels / Max
    const pvRow = table.insertRow();
    pvRow.innerHTML = `
        <th>PV Actuels</th>
        <td colspan="3" class="stat-value-total pv-row">
            <input type="number" value="${stats.current['PV Actuels'] > totalPVMax ? totalPVMax : stats.current['PV Actuels'] || totalPVMax}" 
                   onchange="updatePV(this.value, ${totalPVMax})" min="0" 
                   style="width: 50px; background: none; color: inherit; border: none; text-align: center;"> / ${totalPVMax} (PV Max)
        </td>
    `;
    
    saveData(LS_STATS_KEY, stats);
}

window.updateStatBase = function(statKey, value) {
    const newValue = parseInt(value, 10) || 0;
    stats.base[statKey] = newValue;
    
    if (statKey === 'CHA') {
        const statBonuses = calculateStatBonus();
        const totalValue = newValue + (statBonuses.CHA || 0);
        
        if (totalValue > stats.maxCha || totalValue > stats.current.CHA) {
             stats.current.CHA = totalValue;
        }
    }
    
    saveData(LS_STATS_KEY, stats);
    renderStats();
}

window.updatePV = function(value, maxPV) {
    let newValue = parseInt(value, 10);
    stats.current['PV Actuels'] = Math.min(newValue, maxPV); 
    saveData(LS_STATS_KEY, stats);
    renderStats();
}

// --- 4. GESTION DES INFORMATIONS DU PERSONNAGE (Inchangé) ---

function renderCharInfo() {
    document.getElementById('charName').value = charInfo.name;
    document.getElementById('charClass').value = charInfo.class;
}

window.updateCharInfo = function(key, value) {
    charInfo[key] = value;
    saveData(LS_CHAR_INFO_KEY, charInfo);
}

// --- 5. LANCEUR DE DÉ ET CHANCE ---

function renderDiceHistory() {
    const list = document.getElementById('diceHistoryList');
    list.innerHTML = '';
    
    diceHistory.slice(-10).reverse().forEach(entry => {
        const item = document.createElement('li');
        
        if (entry.resultatChance === 'Réussi') {
            item.className = 'dice-history-success';
        } else if (entry.resultatChance === 'Échoué') {
            item.className = 'dice-history-fail';
        }

        item.textContent = `${entry.heure} | ${entry.type}: ${entry.resultat} ${entry.resultatChance ? `(${entry.resultatChance})` : ''}`;
        list.appendChild(item);
    });
}

window.lancerDe = function(faces, type = 'normal') {
    const diceCube = document.getElementById('diceCube');
    const diceFace = document.getElementById('diceFace');
    const messageElement = document.getElementById('chanceMessage');
    const resultatElement = document.getElementById('resultatDe');
    
    // Réinitialisation de l'affichage
    diceFace.textContent = '?';
    resultatElement.textContent = '?';
    messageElement.textContent = '';
    
    // 1. Démarrer l'animation
    diceCube.classList.add('rolling');
    
    document.querySelectorAll('.dice-roller button').forEach(btn => btn.disabled = true);


    // 2. Calculer le résultat
    const resultat = Math.floor(Math.random() * faces) + 1;
    let resultatChance = null;
    let chanceConsumed = false;
    const ANIMATION_DURATION = 800; 

    // Délai pour simuler le lancer
    setTimeout(() => {
        
        // 3. Stoppe l'animation et affiche le résultat
        diceCube.classList.remove('rolling');
        diceFace.textContent = resultat; 
        resultatElement.textContent = resultat;

        // 4. Logique de Chance
        if (type === 'chance') {
            const currentChance = stats.current.CHA;
            if (currentChance > 0) {
                chanceConsumed = true;
                
                // Consomme le point de Chance
                stats.current.CHA = Math.max(0, currentChance - 1);
                saveData(LS_STATS_KEY, stats);
                renderStats(); 
                
                if (resultat <= currentChance) {
                    messageElement.textContent = `Jet de Chance réussi ! (${resultat} ≤ ${currentChance})`;
                    messageElement.style.color = '#3c763d'; 
                    resultatChance = 'Réussi';
                } else {
                    messageElement.textContent = `Jet de Chance échoué. (${resultat} > ${currentChance})`;
                    messageElement.style.color = '#a00'; 
                    resultatChance = 'Échoué';
                }
            } else {
                messageElement.textContent = 'Chance épuisée ! Impossible de faire un jet de Chance.';
                messageElement.style.color = '#a00'; 
                type = 'normal';
            }
        }

        // 5. Ajout à l'historique
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        if (type === 'normal' || chanceConsumed) {
            diceHistory.push({
                heure: timeString,
                type: (type === 'chance' ? 'D6 (CHA)' : 'D6'),
                resultat: resultat,
                resultatChance: resultatChance
            });
            
            if (diceHistory.length > 50) {
                diceHistory = diceHistory.slice(-50);
            }
            
            saveData(LS_DICE_HISTORY_KEY, diceHistory);
            renderDiceHistory();
        }

        // Réactiver les boutons
        document.querySelectorAll('.dice-roller button').forEach(btn => btn.disabled = false);

    }, ANIMATION_DURATION);
}

// Effacer l'historique des dés SANS confirmation ET nettoyer l'affichage
window.clearDiceHistory = function() {
    // 1. Nettoyage de l'historique des données
    diceHistory = [];
    saveData(LS_DICE_HISTORY_KEY, diceHistory);
    
    // 2. Nettoyage de l'affichage de l'historique
    renderDiceHistory();

    // 3. Nettoyage des résultats et messages récents (la zone sous le dé)
    const diceFace = document.getElementById('diceFace');
    const resultatElement = document.getElementById('resultatDe');
    const messageElement = document.getElementById('chanceMessage');
    
    // Réinitialisation de la zone de résultat
    if (diceFace) {
        diceFace.textContent = '?';
        diceFace.classList.remove('rolling'); // Assure que l'animation est stoppée
    }
    if (resultatElement) {
        resultatElement.textContent = '?';
    }
    if (messageElement) {
        messageElement.textContent = '';
    }
}


// --- 6. GESTION DE L'ÉQUIPEMENT (Inchangé) ---

function renderEquipment() {
    const list = document.getElementById('equipment-list');
    list.innerHTML = '';

    equipment.forEach((item, index) => {
        const row = list.insertRow();
        row.insertCell().textContent = item.name;
        row.insertCell().textContent = item.quantity;
        row.insertCell().textContent = item.bonus;
        
        const actionCell = row.insertCell();
        actionCell.innerHTML = `<button onclick="removeEquipmentItem(${index})" class="delete-btn">Retirer</button>`;
    });
    
    renderStats(); 
}

document.getElementById('equipment-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const newItem = {
        name: document.getElementById('equipmentName').value,
        quantity: parseInt(document.getElementById('equipmentQuantity').value, 10),
        bonus: document.getElementById('equipmentBonus').value,
    };
    equipment.push(newItem);
    saveData(LS_EQUIPMENT_KEY, equipment);
    renderEquipment();
    this.reset();
});

window.removeEquipmentItem = function(index) {
    equipment.splice(index, 1);
    saveData(LS_EQUIPMENT_KEY, equipment);
    renderEquipment(); 
}

// --- 7. GESTION DE L'INVENTAIRE (Inchangé) ---

function renderInventory() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';

    inventorySimple.forEach((item, index) => {
        const row = list.insertRow();
        row.insertCell().textContent = item.name;
        row.insertCell().textContent = item.quantity;
        row.insertCell().textContent = item.description;
        
        const actionCell = row.insertCell();
        actionCell.innerHTML = `<button onclick="removeSimpleItem(${index})" class="delete-btn">Retirer</button>`;
    });
}

document.getElementById('inventory-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const newItem = {
        name: document.getElementById('itemName').value,
        quantity: parseInt(document.getElementById('itemQuantity').value, 10),
        description: document.getElementById('itemDescription').value,
    };
    inventorySimple.push(newItem);
    saveData(LS_INVENTORY_KEY, inventorySimple);
    renderInventory();
    this.reset();
});

window.removeSimpleItem = function(index) {
    inventorySimple.splice(index, 1);
    saveData(LS_INVENTORY_KEY, inventorySimple);
    renderInventory();
}


// --- 8. GESTION DES PNJS (Inchangé) ---

function renderNpcs() {
    const list = document.getElementById('npc-list');
    list.innerHTML = '';

    npcs.forEach((npc, index) => {
        const card = document.createElement('div');
        card.className = 'npc-card';
        card.innerHTML = `
            <h4>${npc.name}</h4>
            <p>${npc.description.replace(/\n/g, '<br>')}</p>
            <button onclick="removeNpc(${index})" class="delete-btn">X</button>
        `;
        list.appendChild(card);
    });
}

document.getElementById('npc-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const newNpc = {
        name: document.getElementById('npcName').value,
        description: document.getElementById('npcDescription').value,
    };
    npcs.push(newNpc);
    saveData(LS_NPCS_KEY, npcs);
    renderNpcs();
    this.reset();
});

window.removeNpc = function(index) {
    npcs.splice(index, 1);
    saveData(LS_NPCS_KEY, npcs);
    renderNpcs();
}

// --- 9. AFFICHAGE DE L'AIDE SUR LES STATS (Garantit le contenu et le basculement) ---

window.toggleStatDescriptions = function() {
    const descriptionBox = document.getElementById('statDescriptions');
    
    // Remplissage du contenu (assure que le contenu, incluant les entités HTML, est bien inséré à chaque fois)
    let content = '<h3>Explication des Statistiques</h3>';
    STATS_LIST.forEach(key => {
        const stat = STAT_DESCRIPTIONS[key];
        content += `
            <h4>${stat.name} (${key})</h4>
            <p>${stat.desc}</p>
        `;
    });
    descriptionBox.innerHTML = content;

    // Bascule la classe hidden pour afficher/masquer
    descriptionBox.classList.toggle('hidden'); 
}


// --- 10. INITIALISATION ---

document.addEventListener('DOMContentLoaded', () => {
    renderCharInfo();
    renderEquipment(); 
    renderInventory(); 
    renderNpcs();
    renderDiceHistory();
});

// --- 11. GESTION DU BLOC-NOTES (SAUVEGARDE ET DÉPLACEMENT) ---
const LS_NOTE_KEY = 'jdrNotebook';

window.saveNote = function() {
    const noteContent = document.getElementById('noteArea').value;
    localStorage.setItem(LS_NOTE_KEY, noteContent);
};

function loadNote() {
    const savedNote = localStorage.getItem(LS_NOTE_KEY);
    const noteArea = document.getElementById('noteArea');
    if (savedNote && noteArea) {
        noteArea.value = savedNote;
    }
}

// LOGIQUE DE DÉPLACEMENT
function makeElementDraggable(el, header) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        // On ne déclenche le drag que si on clique sur le header, 
        // pas sur le coin de redimensionnement (resize)
        if (e.target !== header && e.target.parentElement !== header) return;

        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
    // ... vos autres fonctions (renderCharInfo, etc.)
    renderCharInfo();
    renderEquipment(); 
    renderInventory(); 
    renderNpcs();
    renderDiceHistory();
    
    loadNote();
    
    const notebook = document.getElementById('notebook');
    const header = document.getElementById('notebookHeader');
    if (notebook && header) makeElementDraggable(notebook, header);
});