// All inputs stay in memory. catalogue.js is built from the same published guide cards and tax slabs as the local app.
import {catalogue as c} from './catalogue.js';

const stop = new Set(c.stop);
function features(text) {
  const result = new Map(), add = (s, n) => result.set(s, (result.get(s) || 0) + n);
  for (const w of text.toLowerCase().match(/[a-z0-9\u0900-\u097f]+/g) || []) {
    if (w.length < 2 || stop.has(w)) continue;
    add('w:' + w, 3);
    const s = '^' + w + '$';
    for (let i=0; i+3<=s.length; ++i) add('c:' + s.slice(i,i+3), 1);
  }
  return result;
}
const docs = Object.entries(c.examples).flatMap(([topic, phrases])=>phrases.map(p=>[topic,features(p)]));
const df = new Map();
for(const [,bag] of docs) for(const key of bag.keys()) df.set(key,(df.get(key)||0)+1);
function vector(bag){
  const v=new Map();let norm=0;
  for(const [k,n] of bag) if(df.has(k)){
    const w=(1+Math.log(n))*(1+Math.log((docs.length+1)/(df.get(k)+1)));v.set(k,w);norm+=w*w;
  }
  for(const [k,w] of v) v.set(k,w/Math.sqrt(norm));return v;
}
const index=docs.map(([topic,bag])=>[topic,vector(bag)]);
function retrieve(text){
  const q=vector(features(text));
  if(![...q.keys()].some(k=>k.startsWith('w:')))return 'clarify';
  const scores=new Map();
  for(const [topic,v] of index){
    let score=0;for(const [k,w] of q) score+=w*(v.get(k)||0);
    scores.set(topic,Math.max(score,scores.get(topic)||0));
  }
  const [a,b]=[...scores].sort((a,b)=>b[1]-a[1]);
  return a[1]>=.22 && a[1]-b[1]>=.035?a[0]:'clarify';
}
const idPattern=/\b[A-Z]{5}\d{4}[A-Z]\b|(?<!\d)(?:\d{4}[- ]?){2}\d{4}(?!\d)|(?<!\d)(?:\+?91[ -]?)?[6-9]\d{9}(?!\d)|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i;
export function guidance({question,lang='mix',year='unknown',income='unknown',topic='auto'}){
  if(typeof question!=='string') throw Error('Please write a short question.');
  const t=question.trim().normalize('NFKC').toLowerCase();
  if(t.length<5 || t.length>700) throw Error('Please use 5–700 characters.');
  if(idPattern.test(t)) throw Error('Remove PAN, Aadhaar, phone numbers and emails. Use an anonymous example.');
  if(!c.langs.includes(lang)||!c.years.includes(year)||!c.incomes.includes(income)||!(topic==='auto'||Object.hasOwn(c.guides,topic))) throw Error('Choose a supported language, year, income type or guide.');
  const notice=/\b(notice|notis|summons|intimation|appeal|scrutiny|hearing)\b|नोटिस|सुनवाई|अपील/.test(t);
  const gst=/\bgst(in)?\b|जीएसटी/.test(t), tax=/\b(tax|itr|tds|cpc|assessment)\b|आयकर|टैक्स|कर विभाग/.test(t);
  const housing=/landlord|tenant|eviction|kiray|makaan|मकान|किराय|बेदखल/.test(t);
  const business=/freelanc|side (gig|income)|व्यवसाय|फ्रीलांस|business income/.test(t);
  const special=/capital gain|crypto|nri\b|non[- ]resident|foreign income|senior citizen|rental income|tax refund|income tax.{0,12}refund|पूंजीगत|पूँजीगत|विदेशी आय|वरिष्ठ नागरिक/.test(t);
  const salary=/salar|वेतन|सैलरी|naukri|नौकरी|form ?16\b|\bhra\b|paycheck|payroll/.test(t);
  if(income==='unknown'&&/salary (?:plus|and also|and|ke saath|\+) (?:freelanc|business income)|(?:वेतन|नौकरी) के साथ (?:फ्रीलांस|कारोबार)/.test(t))income='mixed';
  if(year==='unknown'){
    const m=t.match(/(?:\bfy\b|financial year|वित्त वर्ष)\s*(20\d\d)\s*[-–/]\s*(\d{2}|\d{4})\b/);
    if(m&&Number(m[2].slice(-2))===(Number(m[1])+1)%100){const named=m[1]+'-'+m[2].slice(-2);year=c.years.includes(named)?named:'other';}
  }
  let k;
  if(/immediate danger|being attacked|unsafe right now|अभी खतरा|jaan ko khatra/.test(t))k='urgent';
  else if(/fake (bill|invoice|receipt)|hide (my |cash )?income|income (chhupa|chupa)|फर्जी (बिल|रसीद)|आय छिपा/.test(t))k='lawful';
  else if(notice&&gst)k='gst_notice';else if(notice&&tax&&!housing)k='notice';else if(notice&&housing)k='tenancy';
  else if(notice&&topic==='auto')k='clarify';else if(topic!=='auto')k=topic;else if(gst)k='gst';else k=retrieve(t);
  if(!['urgent','lawful'].includes(k)&&!notice&&(special||['salary','business','tax_review','clarify'].includes(k)||(k==='consumer'&&tax))){
    if(special||(income==='other'&&tax))k='tax_review';
    else if((tax||['salary','business','tax_review'].includes(k))&&(business||['business','mixed'].includes(income)))k='business';
    else if((tax||k==='tax_review')&&income==='salary')k='salary';
    else if(topic==='auto'&&tax&&['salary','clarify'].includes(k)&&!salary)k='tax_review';
  }
  const base={topic:k,lang,year,income};
  if(!Object.hasOwn(c.guides,k)) return {...base,...c.special[k][lang],role:null,steps:[],sources:[],calculator:false};
  const g=c.guides[k],sources=['salary','business'].includes(k)&&year==='2025-26'?['salary',...g.sources.filter(s=>s!=='it')]:g.sources;
  const followup=k==='business'&&income==='mixed'?c.mixed[year==='unknown'?'unknown':'known'][lang]:g.question[lang];
  return {...base,title:g.title[lang],reason:g.reason[lang],steps:g.actions.map(a=>a[lang]),question:followup,
    role:g.route,fee:c.fees[g.route],sources:sources.map(s=>c.sources[s]),calculator:k==='salary'&&income==='salary'&&year===c.fy};
}

function regime(salary,extra,fresh){
  const standard=Math.min(salary,fresh?75000:50000), taxable=Math.floor((salary-standard-extra+5)/10)*10;
  const slabs=fresh?c.newSlabs:c.oldSlabs;
  let before=0;
  for(let i=0;i<slabs.length;i++){
    const [start,rate]=slabs[i],end=slabs[i+1]?.[0]??taxable;
    before+=Math.max(0,Math.min(taxable,end)-start)*rate; // integer paise
  }
  const threshold=fresh?1200000:500000;
  const rebate=taxable<=threshold?Math.min(before,(fresh?60000:12500)*100):0;
  const marginal=fresh&&taxable>threshold?Math.max(0,before-(taxable-threshold)*100):0;
  const after=before-rebate-marginal;
  return {standard,extra,taxable,slabTax:before/100,rebate:rebate/100,marginalRelief:marginal/100,cess:after*4/10000,
    total:Math.floor((after*104+50000)/100000)*10};
}
export function estimate({salary,deductions,eligible,year}){
  if(eligible!==true||year!==c.fy) throw Error('Confirm the FY 2025–26 salary-only assumptions before comparing.');
  if(!Number.isSafeInteger(salary)||salary<1||salary>5000000) throw Error('Gross salary must be ₹1–₹50,00,000 in whole rupees.');
  if(!Number.isSafeInteger(deductions)||deductions<0||deductions>Math.max(0,salary-50000)) throw Error('Old-regime reductions cannot exceed salary after its standard deduction.');
  const old=regime(salary,deductions,false), fresh=regime(salary,0,true);
  return {old,new:fresh,difference:Math.abs(old.total-fresh.total),lower:old.total===fresh.total?'same':old.total<fresh.total?'old':'new'};
}
