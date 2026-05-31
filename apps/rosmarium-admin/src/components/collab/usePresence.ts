import { useEffect, useState, useRef } from "react";

export interface PresenceUser {
    userId: string;
    name: string;
    avatarUrl?: string;
    fieldId?: string;
    lastActive: number;
}

export function usePresence(entryId: string, currentUser: { id: string; name: string }) {
    const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!entryId || !currentUser.id) return;

        // Fetch initial active users
        fetch(`/api/collab/${entryId}/active`)
            .then(res => res.json())
            .then(data => setActiveUsers(data))
            .catch(console.error);

        // Connect WebSocket
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/collab/${entryId}/presence`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({
                type: "join",
                userId: currentUser.id,
                name: currentUser.name,
            }));

            // Heartbeat every 15s
            const interval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "heartbeat" }));
                }
            }, 15000);
            return () => clearInterval(interval);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.action === "heartbeat") {
                    setActiveUsers(prev => {
                        const existing = prev.find(u => u.userId === message.user.userId);
                        if (existing) {
                            return prev.map(u => u.userId === message.user.userId ? message.user : u);
                        }
                        return [...prev, message.user];
                    });
                } else if (message.action === "leave") {
                    setActiveUsers(prev => prev.filter(u => u.userId !== message.userId));
                }
            } catch (err) {
                console.error("WS parse error", err);
            }
        };

        return () => {
            ws.close();
        };
    }, [entryId, currentUser.id, currentUser.name]);

    const lockField = (fieldId: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "lock", fieldId }));
        }
    };

    const unlockField = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "unlock" }));
        }
    };

    return { activeUsers, lockField, unlockField };
}
