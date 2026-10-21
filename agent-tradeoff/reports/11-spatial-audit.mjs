// Audit the expanded world: node agent-tradeoff/reports/11-spatial-audit.mjs
import { createServer } from 'vite';
const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
  const [{cast,claims},{villageMap},{createSimulation},{createTalk},{createWorld,createMover}] = await Promise.all(
    ['content/cast/index','content/map/index','sim/engine','sim/talk/index','sim/world/index'].map(p=>server.ssrLoadModule('/apps/rumortown/src/'+p+'.ts')));
  const world={...createWorld(villageMap),createMover};
  const added=new Set(cast.slice(24).map(d=>d.id));
  const result={villagers:cast.length,places:villageMap.places.length,tiles:villageMap.tiles.length,blocked:[],bridgeOccupancy:{old:0,commons:0},newSpeakers:[],crossTownSpeechEvents:0};
  const speakers=new Set();
  for(let seed=1;seed<=5;seed++) {
    const sim=createSimulation({seed,cast,claims,world,talk:createTalk(cast),interventions:[{tick:130,listener:'mira',claimId:'suri-village-rumor'}]});
    for(let t=0;t<2700;t++) {
      if(t%180===0) sim.movePlayer(world.place(['woodland','gardens','east-market','bakery'][Math.floor(t/180)%4]).door);
      sim.step();const snap=sim.snapshot();
      for(const v of [...snap.villagers,{id:'player',pos:snap.player.pos}]) {
        if(!world.isWalkable(v.pos.x,v.pos.y)) result.blocked.push({seed,t,id:v.id,pos:v.pos});
        if(Math.floor(v.pos.x)===41){ if(Math.floor(v.pos.y)===15)result.bridgeOccupancy.old++; if(Math.floor(v.pos.y)===36)result.bridgeOccupancy.commons++; }
      }
    }
    for(const e of sim.events(0)) if(e.kind==='line') {
      if(added.has(e.speaker))speakers.add(e.speaker);
      if(e.listeners.some(id=>added.has(id)!==added.has(e.speaker)))result.crossTownSpeechEvents++;
    }
  }
  result.newSpeakers=[...speakers].sort();
  if(result.blocked.length||speakers.size!==12||!result.bridgeOccupancy.old||!result.bridgeOccupancy.commons||!result.crossTownSpeechEvents)throw new Error(JSON.stringify(result));
  console.log(JSON.stringify(result,null,2));
} finally {await server.close();}
