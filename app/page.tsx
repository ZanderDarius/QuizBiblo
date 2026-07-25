"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Player = { session: string; name: string };
type RoomState = {
  room: string;
  hostSession: string;
  started: boolean;
  startedAt: number | null;
  winnerSession: string | null;
  winnerName: string | null;
  players: Player[];
};

const QUESTION = "Which river did Naaman wash in seven times to be healed of leprosy?";
const words = QUESTION.split(" ");

function getSession() {
  if (typeof window === "undefined") return "";
  const saved = localStorage.getItem("quizbiblo-session");
  if (saved) return saved;
  const fresh = crypto.randomUUID();
  localStorage.setItem("quizbiblo-session", fresh);
  return fresh;
}

export default function Home() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);
  const [session, setSession] = useState("");
  const [state, setState] = useState<RoomState | null>(null);
  const [status, setStatus] = useState("Ready to join");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const request = useCallback(async (action: string, body: Record<string, string> = {}) => {
    const response = await fetch(`/api/${action}`, {
      method: action === "state" ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      body: action === "state" ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data as RoomState;
  }, []);

  const refresh = useCallback(async () => {
    if (!joined || !room || !session) return;
    try {
      const response = await fetch(`/api/state?room=${encodeURIComponent(room)}&session=${encodeURIComponent(session)}`);
      const data = await response.json();
      if (response.ok) {
        setState(data);
        setStatus("Connected to room");
      }
    } catch { setStatus("Reconnecting…"); }
  }, [joined, room, session]);

  useEffect(() => { if (joined) { refresh(); const id = window.setInterval(refresh, 350); return () => clearInterval(id); } }, [joined, refresh]);
  useEffect(() => { if (state?.started && !state.winnerSession) { const id = window.setInterval(() => setNow(Date.now()), 80); return () => clearInterval(id); } }, [state?.started, state?.winnerSession]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.code === "Space" && joined) { event.preventDefault(); buzz(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const join = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    const cleanName = name.trim().slice(0, 24); const cleanRoom = room.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
    if (!cleanName || cleanRoom.length < 3) { setError("Enter a display name and a room code of at least 3 characters."); return; }
    const id = getSession(); setSession(id); setRoom(cleanRoom); setStatus("Joining room…");
    try { const next = await request("join", { room: cleanRoom, name: cleanName, session: id }); setState(next); setJoined(true); setStatus("Connected to room"); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to join."); setStatus("Not connected"); }
  };
  const start = async () => { try { setState(await request("start", { room, session })); } catch (e) { setError(e instanceof Error ? e.message : "Unable to start."); } };
  const buzz = async () => { if (!state?.started || state.winnerSession) return; try { setState(await request("buzz", { room, session })); } catch (e) { setError(e instanceof Error ? e.message : "Buzz did not reach the room."); } };

  const isHost = state?.hostSession === session;
  const elapsed = state?.startedAt ? Math.max(0, now - state.startedAt - 700) : 0;
  const visibleWords = state?.started ? Math.min(words.length, Math.floor(elapsed / 330) + 1) : 0;
  const winnerIsMe = state?.winnerSession === session;

  if (!joined) return <main className="landing"><section className="intro"><p className="eyebrow">QUIZBIBLO · TWO-PLAYER BUZZ TEST</p><h1>Study together.<br/><em>Buzz fairly.</em></h1><p className="lead">A shared Bible-question buzzer for two people, wherever you are.</p><div className="verse">“Your word is a lamp to my feet and a light to my path.” <span>Psalm 119:105</span></div></section><section className="join-card"><div className="cross">✦</div><h2>Enter the study room</h2><p>Use the same room code on both devices.</p><form onSubmit={join}><label>Display name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ruth" maxLength={24} autoFocus /></label><label>Room code<input value={room} onChange={e => setRoom(e.target.value.toUpperCase())} placeholder="e.g. BETHANY" maxLength={12} /></label>{error && <p className="error">{error}</p>}<button className="primary" type="submit">Join room <span>→</span></button></form><small>First person in a room is the host.</small></section></main>;

  return <main className="game"><header><div className="brand">QUIZ<span>BIBLO</span></div><div className="room-chip"><b>ROOM</b> {room}</div><div className="connection"><i /> {status}</div></header><section className="game-top"><div><p className="eyebrow">SAMPLE BIBLE QUESTION</p><h1>The Buzz Test</h1></div><div className="players">{state?.players.map(player => <div className={player.session === session ? "player me" : "player"} key={player.session}><span>{player.name.slice(0,1).toUpperCase()}</span><b>{player.name}</b><small>{player.session === state.hostSession ? "HOST" : "PLAYER"}</small></div>)}{(state?.players.length ?? 0) < 2 && <div className="waiting">Waiting for player 2…</div>}</div></section><section className="question-card"><div className="question-label">QUESTION IN PROGRESS</div><p className="question">{words.map((word, index) => <span className={index < visibleWords ? "shown" : "hidden"} key={`${word}-${index}`}>{word} </span>)}</p>{!state?.started && <p className="hint">The host can begin when both players are ready.</p>}</section>{state?.winnerName ? <section className={winnerIsMe ? "winner winner-me" : "winner"}><p>FIRST TO BUZZ</p><h2>{state.winnerName} <span>{winnerIsMe ? "— that’s you!" : "got there first!"}</span></h2><button className="secondary" onClick={start} disabled={!isHost}>{isHost ? "Ask again" : "Waiting for host"}</button></section> : <section className="controls">{isHost && !state?.started ? <button className="start" onClick={start} disabled={(state?.players.length ?? 0) < 2}>Start question <span>→</span></button> : <button className="buzz" onClick={buzz} disabled={!state?.started}><strong>SPACE</strong><span>Buzz in</span></button>}<p>{isHost && !state?.started ? "You’re the host — begin when ready." : state?.started ? "Press Space or tap to buzz." : "Waiting for the host to start."}</p></section>}<p className="fairness">✦ The room server records the first buzz and locks the other button.</p></main>;
}
