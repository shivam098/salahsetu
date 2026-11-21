import {guidance,estimate} from './public-engine.js';
import {catalogue} from './catalogue.js';
const $=id=>document.getElementById(id);
const make=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
const roles={ca:'Chartered accountant',advocate:'Advocate',joint:'CA + advocate'};
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
let answer, original;
function render(input){
  answer=guidance(input);
  const a=answer;
  for(const id of ['answer-title','reason','steps','follow'])$(id).lang=a.lang==='mix'?'hi-Latn':a.lang;
  $('answer-title').textContent=a.title;$('reason').textContent=a.reason;
  $('steps').replaceChildren(...a.steps.map(s=>make('li',s)));$('follow').textContent=a.question;$('follow').hidden=!a.question;
  $('sources').replaceChildren(...a.sources.map(([label,url])=>{
    const link=make('a',label+' ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';return link;
  }));
  $('facts').hidden=!['tax_review','salary','business','gst','gst_notice','notice'].includes(a.topic);
  $('year').value=a.year;$('income').value=a.income;$('to-tax').hidden=!a.calculator;
  $('choose').hidden=a.topic!=='clarify';
  $('topic').replaceChildren(make('option','Choose a topic…'),...Object.entries(catalogue.guides).map(([id,g])=>{
    const o=make('option',g.title[a.lang]);o.value=id;return o;
  }));
  $('topic').options[0].value='auto';
  $('refine').hidden=$('facts').hidden&&$('choose').hidden;
  $('role-box').hidden=!a.role;
  if(a.role){$('role').textContent=roles[a.role];$('scope').textContent=`Example fee: ${money(a.fee)} for a first review and written next step. Filing, representation and third-party costs excluded.`;}
  $('answer').hidden=false;$('answer').focus({preventScroll:true});$('answer').scrollIntoView();$('guide-error').textContent='';
}
$('ask').addEventListener('submit',e=>{
  e.preventDefault();
  try {const input={question:$('q').value,lang:$('lang').value};render(input);original=input;}
  catch(err){$('answer').hidden=true;original=answer=undefined;$('guide-error').textContent=err.message;}
});
$('refine').onclick=()=>{
  if(!original)return;
  const input={...original,year:$('year').value,income:$('income').value,
    topic:$('choose').hidden?(original.topic||'auto'):$('topic').value};
  try{render(input);original=input;}catch(err){$('guide-error').textContent=err.message;}
};
for(const id of ['q','lang'])$(id).addEventListener('input',()=>{original=answer=undefined;$('answer').hidden=true;});
const samples={salary:'Salary pe tax bachane ke liye kaunsa regime sahi hai?',notice:'Income tax ka notice aaya hai aur demand match nahi karti. Kya karun?',consumer:'Online order kharab nikla aur seller refund nahi de raha. Kya karun?'};
document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{
  $('q').value=samples[b.dataset.example];$('q').dispatchEvent(new Event('input'));$('q').focus();
});
$('save').onclick=()=>{
  if(!answer?.role)return;
  const a=answer,text=['SalahSetu · private preparation checklist',a.title,'',a.reason,'',...a.steps.map((s,i)=>`${i+1}. ${s}`),a.question,'',
    `Possible reviewer: ${roles[a.role]}`,...a.sources.map(([name,url])=>`${name}: ${url}`),'','General guidance. No case opened, appointment made or payment taken.'].join('\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='SalahSetu-checklist.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
};
function clearTax(){$('totals').textContent='Enter amounts and confirm the assumptions to see the breakdown.';$('comparison').textContent='Your comparison';$('calc-error').textContent='';}
$('calc').oninput=clearTax;
$('sample').onclick=()=>{$('salary').value='1500000';$('deductions').value='150000';$('eligible').checked=false;clearTax();};
$('calc').onsubmit=e=>{
  e.preventDefault();
  try{
    const r=estimate({year:'2025-26',eligible:$('eligible').checked,salary:$('salary').valueAsNumber,deductions:$('deductions').valueAsNumber});
    $('comparison').textContent=r.lower==='same'?'The estimates match.':`${r.lower==='old'?'Old':'New'} is ${money(r.difference)} lower.`;
    const table=document.createElement('table'),header=table.createTHead().insertRow(),body=table.createTBody();
    for(const s of ['Annual amount','Old','New']){const th=make('th',s);th.scope='col';header.append(th);}
    for(const [k,s] of Object.entries({standard:'Standard deduction',extra:'Other reductions',taxable:'Rounded taxable income',slabTax:'Slab tax',rebate:'Rebate',marginalRelief:'Marginal relief',cess:'Cess',total:'Estimated total'})){
      const tr=body.insertRow(),th=make('th',s);th.scope='row';tr.append(th,make('td',money(r.old[k])),make('td',money(r.new[k])));
    }
    $('totals').replaceChildren(table);$('calc-error').textContent='';
  }catch(err){clearTax();$('calc-error').textContent=err.message;}
};
$('submit-guide').disabled=$('submit-calc').disabled=false;
