import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import ws from "ws";

const doc = new Y.Doc();
const wsProvider = new WebsocketProvider(
    "ws://localhost:1234",
    "demo-room",
    doc,
    { WebSocketPolyfill: ws },
);

wsProvider.on("status", (event) => {
    console.log(`[provider] websocket ${event.status}`);
});

const awareness = wsProvider.awareness;

awareness.on("change", ({ added, updated, removed }) => {
    if (added.length) {
        for (const id of added) {
            const state = awareness.getStates().get(id);
            console.log(`[+] user ${id} joined`, state ?? "");
        }
    }
    if (removed.length) {
        for (const id of removed) {
            console.log(`[-] user ${id} left`);
        }
    }
    if (updated.length) {
        for (const id of updated) {
            const state = awareness.getStates().get(id);
            if (state?.cursor) {
                console.log(`[~] user ${id} cursor: (${state.cursor.x}, ${state.cursor.y})`);
            }
        }
    }

    const users = [...awareness.getStates().entries()]
        .filter(([id]) => id !== doc.clientID)
        .map(([id, state]) => ({ id, ...state }));
    console.log(`[i] ${users.length} remote user(s) connected`);
});

console.log("[provider] listening for awareness updates...");
