/** A playback session owns its fetch, callbacks, audio node and context. */
export function createPlayback({ createPlayer, createContext, createAudio, fetchTrack, onState, onEnded, initTimeout = 8000 }) {
  let current = null;
  function dispose(session) {
    if (!session) return;
    session.abort.abort();
    clearTimeout(session.timer);
    session.cancelInit?.();
    if (session.audio) {
      session.audio.onended = null;
      session.audio.onerror = null;
      session.audio.pause();
      session.audio.removeAttribute('src');
      session.audio.load();
    }
    if (session.player) {
      session.player.setVol(0);
      session.player.stop();
      session.player.processNode?.disconnect();
      if (session.player.processNode?.port) session.player.processNode.port.onmessage = null;
      session.player.gain?.disconnect();
    }
    if (session.context && session.context.state !== 'closed') session.context.close().catch(() => {});
  }
  function stop(notify = true) {
    const old = current; current = null; dispose(old);
    if (notify) onState({playing: false, label: null, error: null});
  }
  function fail(session, error) {
    if (session !== current) return;
    stop(false);
    onState({playing: false, label: null, error: error.message || 'Music could not be played.'});
  }
  async function play(track, url) {
    stop(false);
    const session = {abort: new AbortController()}; current = session;
    onState({playing: true, label: track.label, error: null});
    const ended = () => { if (current === session) onEnded(track); };
    try {
      if (track.type === 'mod') {
        session.context = createContext();
        if (!session.context.audioWorklet) throw new Error('MOD music is unavailable in this browser. Try a different track.');
        const player = session.player = createPlayer(session.context);
        // chiptune3 leaves routing to the caller when supplied an AudioContext.
        player.gain.connect(session.context.destination);
        const initialized = new Promise((resolve, reject) => {
          session.cancelInit = () => reject(new Error('Playback cancelled'));
          session.timer = setTimeout(() => reject(new Error('Music initialization timed out.')), initTimeout);
          player.onInitialized(() => {
            clearTimeout(session.timer);
            if (current !== session) { dispose(session); return; }
            resolve();
          });
          player.onError(() => { reject(new Error('MOD music could not be decoded.')); fail(session, new Error('MOD music could not be decoded.')); });
          player.onEnded(ended);
        });
        const load = fetchTrack(url, {signal: session.abort.signal}).then(response => {
          if (!response.ok) throw new Error(`Music request failed (${response.status}).`);
          return response.arrayBuffer();
        });
        const [, data] = await Promise.all([initialized, load, session.context.resume()]);
        if (current !== session) return;
        player.play(data);
      } else {
        const audio = session.audio = createAudio(url);
        audio.onended = ended;
        audio.onerror = () => fail(session, new Error('Music could not be loaded.'));
        await audio.play();
      }
    } catch (error) { fail(session, error); }
  }
  return {play, stop};
}
