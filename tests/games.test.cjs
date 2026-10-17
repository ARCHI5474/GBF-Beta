// Dependency-free integration checks with a small DOM and virtual timers.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element {
 constructor(){this.children=[];this.dataset={};this.style={setProperty(){}};this.className='';this.textContent='';this.value='';this.classList={add:(...s)=>{this.className+=' '+s.join(' ');},remove:s=>{this.className=this.className.split(' ').filter(x=>x!==s).join(' ');},toggle:(s,v)=>{if(v)this.classList.add(s);else this.classList.remove(s);}};}
 set innerHTML(s){this.html=s;this.children=[];} get innerHTML(){return this.html||'';}
 append(...els){this.children.push(...els);} setAttribute(){} addEventListener(){} focus(){} reportValidity(){return true;} showModal(){this.open=true;} close(){this.open=false;}
}
const nodes=new Map(),get=s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s);};let clock=0,uid=0;const jobs=new Map();
const context=vm.createContext({console,Date,JSON,Number,Math:Object.assign(Object.create(Math),{random:()=>.37}),Set,Array,Object,Blob,URL,confirm:()=>true,performance:{now:()=>clock},localStorage:{getItem:()=>null,setItem:(k,v)=>get('storage').value=v},document:{querySelector:get,querySelectorAll:()=>[],createElement:()=>new Element(),body:new Element(),hidden:false,addEventListener(){}},window:{addEventListener(){},removeEventListener(){}},setTimeout:(fn,ms)=>{jobs.set(++uid,{fn,time:clock+ms});return uid;},setInterval:(fn,ms)=>{jobs.set(++uid,{fn,time:clock+ms,repeat:ms});return uid;},clearTimeout:i=>jobs.delete(i),clearInterval:i=>jobs.delete(i)});
vm.runInContext(fs.readFileSync('script.js','utf8'),context);
const run=s=>vm.runInContext(s,context),board=get('#game-board'),controls=get('#game-controls'),status=get('#game-status');
function tick(ms){const until=clock+ms;for(let guard=0;guard<10000;guard++){const next=[...jobs].filter(([,j])=>j.time<=until).sort((a,b)=>a[1].time-b[1].time)[0];if(!next)break;const [id,j]=next;clock=j.time;if(j.repeat)j.time+=j.repeat;else jobs.delete(id);j.fn();}clock=until;}
function open(id){run(`openGame('${id}')`);}function click(i){board.children[i].onclick();}function submit(n){const f=controls.children[0];f.children[0].value=n;f.onsubmit({preventDefault(){}});}function ended(){return run('ended');}
assert.equal(run('games.length'),12);
for(const id of run('games.map(g=>g.id)')){open(id);assert.ok(board.children.length||board.innerHTML,id+' initialized');run('close()');assert.equal(jobs.size,0,id+' cleanup');}
// Memory: discover all cards through actual flips, then match known pairs.
open('memory');const values=[];for(let i=0;i<12;i+=2){click(i);values[i]=board.children[i].textContent;click(i+1);values[i+1]=board.children[i+1].textContent;tick(800);}for(const v of new Set(values)){const pair=values.map((x,i)=>x===v?i:-1).filter(i=>i>=0);pair.forEach(i=>{if(!board.children[i].dataset.open)click(i);});}assert.ok(ended(),'memory win');
// Puzzle: breadth-first search proves generated layout is solvable and completes it.
open('slide');let start=board.children.map(b=>String(b.textContent||0)).join(''),queue=[start],paths=new Map([[start,[]]]),solution;
for(let p=0;p<queue.length;p++){const state=queue[p],path=paths.get(state);if(state==='123456780'){solution=path;break;}const z=state.indexOf('0');for(const i of [z-3,z+3,z%3?z-1:-1,z%3<2?z+1:-1].filter(i=>i>=0&&i<9)){const a=state.split('');[a[z],a[i]]=[a[i],a[z]];const s=a.join('');if(!paths.has(s)){paths.set(s,[...path,i]);queue.push(s);}}}assert.ok(solution);solution.forEach(click);assert.ok(ended(),'slide win');
// Lights: enumerate press combinations to solve the generated board.
open('lights');let mask=board.children.reduce((m,b,i)=>b.textContent==='💡'?m|(1<<i):m,0),press;
const effects=Array.from({length:16},(_,i)=>[i,i-4,i+4,i%4?i-1:-1,i%4<3?i+1:-1].filter(j=>j>=0&&j<16).reduce((m,j)=>m^(1<<j),0));for(let m=0;m<65536;m++){let a=mask;for(let i=0;i<16;i++)if(m&(1<<i))a^=effects[i];if(!a){press=m;break;}}assert.notEqual(press,undefined);for(let i=0;i<16;i++)if(press&(1<<i))click(i);assert.ok(ended(),'lights win');
open('guess');submit(38);assert.ok(ended(),'guess win');
open('rps');for(let i=0;i<5;i++)controls.children[0].onclick();assert.ok(ended(),'rps completion');
open('reaction');click(0);tick(3000);click(0);assert.ok(ended()&&status.textContent.includes('ms'),'reaction completion');open('reaction');click(0);click(0);assert.ok(status.textContent.includes('フライング'),'reaction early tap');
open('whack');for(let i=0;i<29;i++){const j=board.children.findIndex(b=>b.textContent==='🐹');if(j>=0)click(j);tick(700);}assert.ok(ended(),'whack completion');
open('math');for(let i=0;i<10;i++)submit(10);assert.ok(ended(),'math completion');
open('sequence');for(let level=1;level<=5;level++){tick(400+level*750+1);for(let i=0;i<level;i++)click(1);if(level<5)tick(650);}assert.ok(ended()&&status.textContent.includes('クリア'),'sequence win');
open('snake');tick(2500);assert.ok(ended(),'snake collision');assert.equal(jobs.size,0);
open('mines');click(0);assert.ok(!status.textContent.includes('地雷でした'),'first mine click safe');for(let i=1;i<25&&!ended();i++)click(i);assert.ok(ended(),'mines completion');
const data=JSON.parse(get('storage').value);assert.ok(data.plays>=24);assert.ok(data.points>0);assert.equal(Object.keys(data.records).length,12);assert.ok(run('valid(saved)'));assert.equal(run('valid({})'),false);
open('whack');const plays=run('saved.plays');run("openGame('whack')");assert.equal(run('saved.plays'),plays+1);run('close()');assert.equal(jobs.size,0);
console.log('PASS: all 12 games initialize, play, finish, save, and clean up; puzzle solutions and timer lifecycle verified.');
