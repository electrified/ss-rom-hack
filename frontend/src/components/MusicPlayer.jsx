import React, { useEffect, useRef, useState } from 'react';
import { ChiptuneJsPlayer } from 'chiptune3';
import { createPlayback } from './playback';

const BASE = import.meta.env.BASE_URL;

const TRACKS = [
  // Sensible Soccer Amiga — MOD (chiptune3)
  { file: 'sensible_soccer.mod',        type: 'mod', label: 'Menu Theme (Sensible Soccer Amiga)' },
  { file: 'ss_ingame.mod',              type: 'mod', label: 'In-Game (Sensible Soccer Amiga)' },
  { file: 'ss_menu.mod',                type: 'mod', label: 'Menu (Sensible Soccer Amiga)' },

  // Sensible Soccer International CD — OGG (native CD audio)
  { file: 'cdda_02_opening_credits.ogg', type: 'ogg', label: 'Opening Credits (Amiga CD32)' },
  { file: 'cdda_03_menu.ogg',            type: 'ogg', label: 'Menu (Amiga CD32)' },

  // Mega Drive — MP3
  { file: 'md_title.mp3',               type: 'mp3', label: 'Title Theme (Mega Drive)' },
  { file: 'md_menu.mp3',                type: 'mp3', label: 'Menu Theme (Mega Drive)' },
  { file: 'md_ingame.mp3',              type: 'mp3', label: 'In-Game Music (Mega Drive)' },

  // SWOS Amiga — MP3 (rjp custom format, no MOD available)
  { file: 'swos_goalscoring.mp3',       type: 'mp3', label: 'Goalscoring Superstar Hero (SWOS Amiga)' },
  { file: 'swos_main_menu.mp3',         type: 'mp3', label: 'Main Menu (SWOS Amiga)' },
  { file: 'swos_main_menu_95.mp3',      type: 'mp3', label: "Main Menu '95 (SWOS Amiga)" },

  // Game Boy — MP3
  { file: 'gb_bgm.mp3',                 type: 'mp3', label: 'BGM (Game Boy)' },
];

function pickRandom(exclude) {
  const pool = exclude ? TRACKS.filter(t => t !== exclude) : TRACKS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function MusicPlayer() {
  const controller = useRef(null);
  const trackRef = useRef(null);
  const [state, setState] = useState({playing: false, label: null, error: null});
  useEffect(() => {
    const playback = createPlayback({
      createContext: () => {
        if (!window.AudioContext) throw new Error('Music is unavailable in this browser.');
        return new AudioContext();
      },
      createPlayer: context => new ChiptuneJsPlayer({context, repeatCount: 0}),
      createAudio: url => new Audio(url),
      fetchTrack: (...args) => fetch(...args),
      onState: setState,
      onEnded: previous => {
        const next = pickRandom(previous); trackRef.current = next;
        playback.play(next, BASE + next.file);
      },
    });
    controller.current = playback;
    return () => { playback.stop(false); controller.current = null; };
  }, []);
  function playNext() {
    const next = pickRandom(trackRef.current); trackRef.current = next;
    controller.current?.play(next, BASE + next.file);
  }
  return <div className="music-player">
    <button className={`music-btn ${state.playing ? 'playing' : ''}`}
      onClick={() => state.playing ? controller.current?.stop() : playNext()}>
      {state.playing ? '⏹ Stop Music' : '▶ Play Music'}
    </button>
    {state.playing && <button className="music-btn" onClick={playNext}>⏭ Skip</button>}
    {state.label && <span className="music-track">{state.label}</span>}
    {state.error && <span role="status">{state.error} <button onClick={playNext}>Try another track</button></span>}
  </div>;
}
