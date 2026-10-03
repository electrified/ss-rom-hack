import { describe, it, expect, vi } from 'vitest';
// @ts-expect-error JavaScript browser integration
import { createPlayback } from '../playback';
const flush = () => new Promise(r => setTimeout(r, 0));
function deferred<T>() { let resolve!: (value: T) => void;const promise = new Promise<T>(r => resolve=r);return {promise,resolve}; }
function setup() {
  const loads: ReturnType<typeof deferred<any>>[]=[];const players:any[]=[];const contexts:any[]=[];
  const onState=vi.fn(),onEnded=vi.fn();
  const controller=createPlayback({onState,onEnded,initTimeout:20,
    createContext:()=>{const c={audioWorklet:{},destination:{},state:'running',resume:vi.fn(async()=>{}),close:vi.fn(async()=>{c.state='closed';})};contexts.push(c);return c;},
    createPlayer:()=>{const p:any={play:vi.fn(),stop:vi.fn(),setVol:vi.fn(),gain:{connect:vi.fn(),disconnect:vi.fn()},processNode:{disconnect:vi.fn(),port:{}},onInitialized:(fn:any)=>p.init=fn,onError:(fn:any)=>p.error=fn,onEnded:(fn:any)=>p.end=fn};players.push(p);return p;},
    createAudio:()=>({play:vi.fn(async()=>{}),pause:vi.fn(),load:vi.fn(),removeAttribute:vi.fn()}),
    fetchTrack:()=>{const d=deferred<any>();loads.push(d);return d.promise;}});
  return {controller,loads,players,contexts,onState,onEnded};
}
const track={type:'mod',label:'test'};
const response=(n:number)=>({ok:true,arrayBuffer:async()=>new Uint8Array([n]).buffer});
describe('playback lifecycle',()=>{
  it('only plays the newest fetch and ignores late end/error callbacks',async()=>{
    const s=setup();const a=s.controller.play(track,'a');s.players[0].init();
    const b=s.controller.play(track,'b');s.players[1].init();s.loads[1].resolve(response(2));await b;
    s.loads[0].resolve(response(1));await a;
    expect(s.players[0].play).not.toHaveBeenCalled();expect(s.players[1].play).toHaveBeenCalledTimes(1);expect(s.players[1].gain.connect).toHaveBeenCalledWith(s.contexts[1].destination);expect(s.contexts[0].close).toHaveBeenCalled();
    s.players[0].end();s.players[0].error();expect(s.onEnded).not.toHaveBeenCalled();
    s.controller.stop();s.players[1].end();expect(s.onEnded).not.toHaveBeenCalled();expect(s.contexts[1].state).toBe('closed');
  });
  it('disposes a pending initialization, even if it completes after stopping',async()=>{
    const s=setup();const pending=s.controller.play(track,'a');s.controller.stop(false);s.players[0].init();s.loads[0].resolve(response(1));await pending;
    expect(s.players[0].play).not.toHaveBeenCalled();expect(s.contexts[0].state).toBe('closed');expect(s.players[0].processNode.disconnect).toHaveBeenCalled();
  });
  it('reports initialization timeout and network failure without leaking contexts',async()=>{
    const s=setup();const pending=s.controller.play(track,'a');s.loads[0].resolve(response(1));await pending;
    expect(s.onState.mock.calls.slice(-1)[0]?.[0].error).toMatch(/timed out/);expect(s.contexts[0].state).toBe('closed');
    const again=s.controller.play(track,'b');s.players[1].init();s.loads[1].resolve({ok:false,status:404});await again;
    expect(s.onState.mock.calls.slice(-1)[0]?.[0].error).toMatch(/404/);expect(s.contexts[1].state).toBe('closed');
  });
  it('keeps errors in the optional audio subsystem',async()=>{
    const onState=vi.fn();const c=createPlayback({createContext:()=>{throw Error('Unavailable')},onState});await c.play(track,'a');expect(onState.mock.calls.slice(-1)[0]?.[0]).toMatchObject({playing:false,error:'Unavailable'});c.stop(false);
  });
});
