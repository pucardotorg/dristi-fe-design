const fs=require("fs");const r=require("./review.json"),rows=require("./combined.json");
const idx=s=>{const m=String(s).match(/#(\d+)/);return m?+m[1]:null};
const P=[ // id, name, change (plain words)
["refusal","Form errors: the new refusal","Plain red text under a field becomes the new refusal: the field's red ring grows in, focus jumps to the field, the message drops in, a second press shakes the field."],
["greyed","Greyed-out submit buttons","The button stays pressable. On press it points at what's missing (the refusal above) instead of being greyed out with no reason."],
["away","Missing input told away from the field","A banner, toast or loose red text about missing input moves onto the field itself."],
["confirm-neutral","Confirms before sign, pay or file","A plain question gets a grey mark with the act's icon. 'This cannot be undone' moves to its own line with a lock."],
["confirm-danger","Confirms before remove or discard","A plain question gets a red mark with the act's icon. The button stays soft red."],
["silent","Acts that end with nothing or only a toast","Signing, sending or paying ends on a result screen in the same dialog, instead of closing silently or showing a small toast."],
["slab","Hand-built result blocks","Hand-made green or amber blocks and lines become the shared result header or the tally card."],
["words","Hand-built status lines","Hand-coloured status text becomes the shared status line (or a badge with a mark)."],
["deadend","Dead-end pages","'Not here' and 'couldn't load' pages drawn as empty states become a centred mark with the act's icon."],
["alert","Old alert and banner boxes","Old alert or banner boxes used for success or failure become the shared status line."],
["quiet","Quick acts with no feedback","A quick act that shows nothing gets a short toast."],
["tone","Right piece, wrong tone","The new piece is used, but in the wrong colour or tone, or it plays twice."],
];
const pmap={"Field refusal":"refusal","Greyed submit":"greyed","Missing input told away from the field":"away","Plain question before a sign, pay or file":"confirm-neutral","Plain removal or discard question":"confirm-danger","Court act ends silently or on a toast":"silent","Hand-built outcome slab or footer line":"slab","Hand-built status words":"words","Dead end drawn as an empty state":"deadend","Retired Alert or Banner as feedback":"alert","Quick act with no feedback":"quiet","Right piece, wrong tone, icon or copy":"tone"};
const pat={};for(const p of r.patterns){const k=pmap[p.name]||Object.entries(pmap).find(([n])=>p.name.startsWith(n.split(" ")[0]))?.[1];if(!k)throw new Error("pattern "+p.name);for(const i of p.ids)pat[idx(i)]=k}
const items=rows.map((x,i)=>{const proof=x.proof||"";const sm=proof.match(/shots\/(\w+)\/([^\s,;)]+\.(?:jpg|png))/);return {n:i,area:x.area,kind:x.kind,id:x.id,where:x.where,today:x.today,should:x.should_be,shot:sm?`/coverage-board/before/${sm[1]}/${sm[2]}`:null,codeOnly:!sm,status:x.verdict,pattern:pat[i]||null,note:null}});
const set=(i,o)=>Object.assign(items[i],o);
for(const w of r.wrong_missed)for(const s of w.rows||[])set(idx(s),{status:"removed",note:w.finding});
const fdPat={85:"silent",112:"tone",288:"tone",125:"tone",143:"tone",215:"tone",297:"tone",136:"tone"};
for(const f of r.false_done)for(const s of f.rows||[]){const i=idx(s);if(i===8)set(i,{status:"removed",note:f.finding});else set(i,{status:"missed",pattern:fdPat[i],note:f.finding})}
set(185,{status:"done",note:"Review: conforms; not part of the order-editor exception."});
set(211,{note:"Review: these files sit next to the order editor but are not order-editor.tsx. Owner to confirm whether the exception covers them."});
set(213,{status:"removed",note:"Same moment as row #158, counted twice."});
set(69,{status:"missed",pattern:"refusal",note:r.bad_exceptions.find(b=>(b.rows||[]).map(idx).includes(69)).finding});
set(171,{status:"removed",note:"Covered by the flag-composer greyed Save added from the review."});
for(const i of [117,120,145,146])set(i,{status:"removed",note:"Placeholder for a row another auditor owns; duplicate."});
for(const w of r.wrong_should_be)for(const s of w.rows||[]){const i=idx(s);items[i].note=(items[i].note?items[i].note+" ":"")+"Review: "+w.finding}
const nilPat=[ "tone","tone","tone","greyed","confirm-neutral","confirm-neutral","confirm-neutral","away","tone","tone","words","words","deadend","deadend","deadend","slab","alert","greyed","greyed","greyed","greyed","greyed","greyed","greyed","greyed","greyed","greyed","greyed","greyed","greyed","greyed","greyed","alert","tone"];
r.not_in_list.forEach((w,j)=>items.push({n:1000+j,area:/employee|scrutiny\/review|application-|cause-list|sign-order/.test(w.file)?"court":/bulk|vakalatnama|access|home/.test(w.file)?"access":"citizen",kind:"added by review",id:w.file,where:w.file,today:w.finding,should:null,shot:null,codeOnly:true,status:"missed",pattern:nilPat[j],note:"Found by the independent review; code only, no screenshot yet."}));
const miss=items.filter(x=>x.status=="missed");const unp=miss.filter(x=>!x.pattern);if(unp.length)throw new Error("unpatterned "+unp.map(x=>x.n));
const counts={};for(const x of items)counts[x.status]=(counts[x.status]||0)+1;
const byP=P.map(([id,name,change])=>({id,name,change,count:miss.filter(x=>x.pattern==id).length}));
fs.writeFileSync(process.argv[2],"// Generated from the feedback coverage audit (main 8d53f22) + independent review. Do not hand-edit.\nexport const PATTERNS = "+JSON.stringify(byP,null,1)+" as const;\nexport const ITEMS: Item[] = "+JSON.stringify(items)+";\nexport type Item = {n:number;area:string;kind:string;id:string;where:string;today:string;should:string|null;shot:string|null;codeOnly:boolean;status:string;pattern:string|null;note:string|null};\n");
console.log(counts);console.log(byP.map(p=>p.id+" "+p.count).join(" · "));console.log("missed with shot",miss.filter(x=>x.shot).length,"of",miss.length);
