import React, { useEffect, useRef, useState } from 'react';
import { ChiptuneJsPlayer } from 'chiptune3';

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
  const chiptuneRef = useRef(null);
  const audioRef = useRef(null);
  const currentTrackRef = useRef(null);
  // Each new playTrack() call gets a unique session ID.
  // Async callbacks discard themselves if the session has moved on.
  const sessionRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [trackLabel, setTrackLabel] = useState(null);

  useEffect(() => {
    const player = new ChiptuneJsPlayer({ repeatCount: 0 });
    chiptuneRef.current = player;

    player.onInitialized(() => setReady(true));
    player.onError(() => {
      // Capture session at the time the error fires to check staleness
      // (sessionRef holds current value; any mismatch means we've moved on)
    });
    player.onEnded(() => {
      playTrack(pickRandom(currentTrackRef.current));
    });

    return () => {
      sessionRef.current++;
      player.stop();
      stopAudio();
    };
  }, []);

  function stopAudio() {
    if (audioRef.current) {
      const a = audioRef.current;
      audioRef.current = null;
      a.onended = null;
      a.onerror = null;
      a.pause();
    }
  }

  function stopAll() {
    sessionRef.current++;
    if (chiptuneRef.current) {
      chiptuneRef.current.setVol(0); // silence immediately (gain node is sync)
      chiptuneRef.current.stop();    // async worklet message — arrives later
    }
    stopAudio();
  }

  function playTrack(track) {
    stopAll();
    const session = sessionRef.current;

    currentTrackRef.current = track;
    setTrackLabel(track.label);

    if (track.type === 'mod') {
      chiptuneRef.current.setVol(1);
      chiptuneRef.current.context.resume().then(() => {
        if (session !== sessionRef.current) return;
        chiptuneRef.current.load(BASE + track.file);
      });
    } else {
      const audio = new Audio(BASE + track.file);
      audioRef.current = audio;

      audio.onended = () => {
        if (session !== sessionRef.current) return;
        playTrack(pickRandom(currentTrackRef.current));
      };
      audio.onerror = () => {
        if (session !== sessionRef.current) return;
        // Skip to next track silently — error events can fire spuriously
        // (e.g. aborted loads) even when audio subsequently plays fine.
        playTrack(pickRandom(currentTrackRef.current));
      };
      audio.play().catch(() => {});
    }
  }

  const toggle = () => {
    if (!ready) return;
    if (playing) {
      stopAll();
      setPlaying(false);
      setTrackLabel(null);
    } else {
      playTrack(pickRandom());
      setPlaying(true);
    }
  };

  const skip = () => {
    if (!ready || !playing) return;
    playTrack(pickRandom(currentTrackRef.current));
  };

  return (
    <div className="music-player">
      <button
        className={`music-btn ${playing ? 'playing' : ''}`}
        onClick={toggle}
        disabled={!ready}
        title={playing ? 'Stop music' : 'Play Sensible Soccer music'}
      >
        {playing ? '⏹ Stop Music' : '▶ Play Music'}
      </button>
      {playing && (
        <button
          className="music-btn"
          onClick={skip}
          title="Skip to next track"
        >
          ⏭ Skip
        </button>
      )}
      {playing && trackLabel && (
        <span className="music-track">{trackLabel}</span>
      )}
    </div>
  );
}
