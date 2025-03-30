const socket = new WebSocket("ws://79.23.73.102:3001");
let pc = new RTCPeerConnection();
let channel;
let peerId = "";
let sessionId = "";
let receivedHistory = [];


function Invia() {
    let inputId = document.getElementById("session-id").value;
    if (!inputId) return alert("Inserisci un ID di sessione");
    sessionId = inputId.trim(); //
    startSession(sessionId);
}

function annullaRichiesta() {
    // Manda un messaggio di annullamento (se vuoi gestirlo lato server)
    socket.send(JSON.stringify({
        type: "cancel-request",
        peerId,
        sessionId
    }));

    // Ripristina la UI
    document.getElementById("wait-ui").style.display = "none";
    document.querySelector('button[onclick="Invia()"]').disabled = false;
}


function startSession(idSessione) {
    socket.send(JSON.stringify({
        type: "try",
        peerId: peerId,
        sessionId: idSessione
    }));
}


function accettaPeer(peer, session) {
    socket.send(JSON.stringify({
        type: "join-response",
        peerId: peer,
        sessionId: session,
        accept: true
    }));

    // Rimuovi l'elemento dalla lista
    document.querySelector(`li[data-peer-id="${peer}"]`)?.remove();
}

function rifiutaPeer(peer, session) {
    socket.send(JSON.stringify({
        type: "join-response",
        peerId: peer,
        sessionId: session,
        accept: false
    }));

    document.querySelector(`li[data-peer-id="${peer}"]`)?.remove();
}



socket.onmessage = async (event) => {
  const msg = JSON.parse(event.data);
  
    if (msg.type === "offer" && msg.from !== peerId) {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.send(JSON.stringify({
            type: "answer",
            data: answer,
            to: msg.from,
            sessionId: sessionId
        }));
    } else if (msg.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
    } else if (msg.type === "candidate") {
        try {
            await pc.addIceCandidate(msg.data);
        } catch (e) {
            console.error("Errore ICE:", e);
        }
    } else if (msg.type === "peers") {
        msg.list.forEach(p => {
            if (p !== peerId && !peerConnections[p]) {
                const newPc = new RTCPeerConnection();
                const newChannel = newPc.createDataChannel("clipboard");
    
                newChannel.onopen = () => console.log("DataChannel aperto con", p);
                newChannel.onmessage = e => {
                    receivedHistory.push(e.data);
                    console.log("📥 Ricevuto da", p, ":", e.data);
                };
    
                peerConnections[p] = newPc;
                channels[p] = newChannel;
    
                newPc.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.send(JSON.stringify({
                            type: "candidate",
                            data: event.candidate,
                            to: p,
                            from: peerId,
                            sessionId
                        }));
                    }
                };
    
                newPc.createOffer().then(offer => {
                    return newPc.setLocalDescription(offer).then(() => {
                        socket.send(JSON.stringify({
                            type: "offer",
                            data: offer,
                            to: p,
                            from: peerId,
                            sessionId
                        }));
                    });
                });
            }
        });
    } else if (msg.type === 'assign-id') {
        peerId = msg.peerId;
        console.log(`ID assegnato dal server: ${peerId}`);
        // Ora puoi procedere con la registrazione alla sessione
    } else if (msg.type === 'create-session') {
        window.sessionId = msg.sessionId;
    } else if (msg.type === 'join-request') {
        const list = document.getElementById("join-requests");

        const li = document.createElement("li");
        li.dataset.peerId = msg.from;
    
        li.innerHTML = `
            <strong>${msg.from}</strong>
            <button style="margin-left: 10px;" onclick="accettaPeer('${msg.from}', '${msg.sessionId}')">✅ Accetta</button>
            <button style="margin-left: 5px;" onclick="rifiutaPeer('${msg.from}', '${msg.sessionId}')">❌ Rifiuta</button>
        `;
    
        list.appendChild(li);
    } else if (msg.type === 'join-denied') {
        alert("La richiesta di unione alla sessione è stata rifiutata.");
        document.getElementById("wait-ui").style.display = "none";
        document.querySelector('button[onclick="Invia()"]').disabled = false;


    }else if (msg.type === "accepted") {
        sessionId = msg.sessionId;
        console.log("Sei stato accettato nella sessione");
        // Avvia WebRTC come fa l’host
        channel = pc.createDataChannel("clipboard");
        
        pc.createOffer().then(offer => {
            pc.setLocalDescription(offer);
            socket.send(JSON.stringify({
                type: "offer",
                data: offer,
                from: peerId,
                sessionId: sessionId
            }));
        });

    } else if (msg.type === "wait") {
        const btnEntra = document.querySelector('button[onclick="Invia()"]');
        const waitUI = document.getElementById("wait-ui");
    
        btnEntra.disabled = true;
        waitUI.style.display = "block";

    } else if (msg.type === "created-session"){
        showView("session-view")
        document.getElementById("view-session-id").textContent = msg.sessionId + " Sei l'Host";

    }  else if (msg.type === "cancel-request") {
        const list = document.getElementById("join-requests");
        const li = list.querySelector(`li[data-peer-id="${msg.from}"]`);
        if (li) li.remove();
        console.log(`❌ Il peer ${msg.from} ha annullato la richiesta.`);
    }
};

pc.onicecandidate = (event) => {
    if (event.candidate) {
        socket.send(JSON.stringify({
          type: "candidate",
          data: event.candidate,
          sessionId: sessionId
        }));
    }
};

pc.ondatachannel = (event) => {
    const ch = event.channel;
    ch.onmessage = (e) => {
        receivedHistory.push(e.data);
        console.log("📥 Ricevuto:", e.data);
    };
    ch.onopen = () => console.log("✅ Canale ricevuto aperto");

    // Se sai da chi arriva, puoi usare:
    // channels[msg.from] = ch;
};


function sendClipboard() {
    navigator.clipboard.readText().then(text => {
        Object.entries(channels).forEach(([peer, ch]) => {
            if (ch.readyState === "open") {
                ch.send(text);
                console.log(`📤 Inviato a ${peer}:`, text);
            }
        });
    });
}


window.electronAPI.onShortcutCopy(() => {
console.log("short-cut copia")
   sendClipboard();
});

window.electronAPI.onShortcutPaste(() => {
    if (receivedHistory.length > 0) {
        const last = receivedHistory[receivedHistory.length - 1]; // ultimo arrivato
        navigator.clipboard.writeText(last).then(() => {
            console.log("📋 Incollato l'ultimo elemento:", last);
        });
    } else {
        console.log("⚠️ Nessun contenuto ricevuto");
    }
});
  

function showView(id) {
    document.querySelectorAll('div[id$="-view"]').forEach(el => el.style.display = 'none');
    document.getElementById(id).style.display = 'block';
}
  