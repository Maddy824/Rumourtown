// From the repository root: node agent-tradeoff/reports/09-spatial-audit.mjs
import {createServer} from 'vite';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
const [{cast,claims},{villageMap},{createSimulation},{createTalk},{createWorld,createMover}]=await Promise.all(['content/cast/index','content/map/index','sim/engine','sim/talk/index','sim/world/index'].map(p=>server.ssrLoadModule('/apps/rumortown/src/'+p+'.ts')));
const world={...createWorld(villageMap),createMover};let bad=[];let crossings=0,lines=0;
for(let seed=1;seed<=5;seed++){
const sim=createSimulation({seed,cast,claims,world,talk:createTalk(cast),interventions:[{tick:130,listener:'mira',claimId:'tom-stole-bread'}]});
for(let t=0;t<2700;t++){
if(t%100===0)sim.movePlayer(world.place(t%200===0?'orchard':'bakery').door);
sim.step();const snap=sim.snapshot();
for(const v of [...snap.villagers,{id:'player',pos:snap.player.pos}]){
if(!world.isWalkable(v.pos.x,v.pos.y)&&bad.length<20)bad.push({seed,t,id:v.id,pos:v.pos,tile:villageMap.tiles[Math.floor(v.pos.y)*48+Math.floor(v.pos.x)]});
if(Math.floor(v.pos.x)===41)crossings++;
}
}
const spoken=sim.events(0).filter(e=>e.kind==='line');lines+=spoken.length;
if(spoken.some(e=>!e.at))throw new Error('line without location');
}
console.log(JSON.stringify({bad,crossings,lines},null,2));
}finally{await server.close();}
