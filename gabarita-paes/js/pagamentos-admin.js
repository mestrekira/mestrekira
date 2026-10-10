(() => {
 'use strict';
 const $=id=>document.getElementById(id), uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 let token=null,preview=null,busy=false;
 const say=text=>$('message').textContent=text;
 const date=value=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Não informado';
 function clear(){preview=null;$('preview').hidden=true;$('reversal').reset();buttons();}
 function buttons(){for(const button of document.querySelectorAll('button'))button.disabled=busy; $('record').disabled=busy||!preview||!$('acknowledge').checked;}
 function reset(){token=null;clear();$('charges').replaceChildren();$('admin-panel').hidden=true;$('login').hidden=false;}
 async function request(path,body){
  const response=await fetch('https://mestrekira-api.onrender.com'+path,{method:body===undefined?'GET':'POST',cache:'no-store',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if(response.status===401){reset();throw Error('Sessão administrativa inválida ou expirada. Entre novamente.');}
  let data;try{data=await response.json();}catch{throw Error('Resposta inválida. Consulte novamente antes de repetir uma operação.');}
  if(!response.ok)throw Error(typeof data.message==='string'?data.message:'Não foi possível concluir a operação.');return data;
 }
 async function run(action){if(busy)return;busy=true;buttons();try{await action();}catch(error){say(error.message||'Falha de conexão. Consulte o pedido antes de tentar novamente.');}finally{busy=false;buttons();}}
 async function list(){
  clear();const id=$('user-id').value.trim();if(!uuid.test(id))throw Error('Informe uma UUID válida do usuário.');
  const result=await request(`/payments/infinitepay/admin/users/${encodeURIComponent(id)}/charges`);
  if(!Array.isArray(result.charges))throw Error('Lista de pedidos inválida.');$('charges').replaceChildren();
  for(const row of result.charges){
   const card=document.createElement('div');card.className='charge';const text=document.createElement('p');
   text.textContent=`Pedido ${row.id} · R$ ${Number(row.amount).toFixed(2)} · ${row.pilot?'Piloto':'Comercial'} · ${row.revokedAt?'Devolução registrada':row.status} · Transação: ${row.transactionNsu||'Não informada'} · Pagamento: ${date(row.paidAt)}`;card.append(text);
   if(row.status==='PAID'&&!row.revokedAt&&uuid.test(row.id)){
    const button=document.createElement('button');button.type='button';button.textContent='Ver prévia de devolução';button.addEventListener('click',()=>run(async()=>{
     clear();const data=await request(`/payments/infinitepay/admin/charges/${encodeURIComponent(row.id)}/reversal-preview`,{});
     if(data.alreadyRecorded){await list();say('A devolução já foi registrada.');return;}
     if(!uuid.test(data.charge?.id)||!Number.isFinite(data.removedAccessMs)||data.removedAccessMs<0||!Number.isSafeInteger(data.expires)||typeof data.previewToken!=='string')throw Error('Prévia inválida.');
     preview=data;$('preview-text').textContent=`Pedido: ${data.charge.id}\nTransação: ${data.charge.transactionNsu||'Não informada'}\nValor: R$ ${Number(data.charge.amount).toFixed(2)}\nDias futuros a retirar: ${(data.removedAccessMs/86400000).toFixed(2)}\nValidade atual: ${date(data.currentPremiumUntil)}\nValidade estimada após ajuste: ${date(data.proposedPremiumUntil)}\nBenefício escolar preservado até: ${date(data.schoolAccessUntil)}`;
     $('preview').hidden=false;say('Prévia consultada. Nenhum acesso foi alterado.');$('preview').scrollIntoView({behavior:'smooth',block:'start'});
    }));card.append(button);
   }$('charges').append(card);
  }
  say(result.charges.length?`${result.charges.length} pedidos exibidos (limite de 100 mais recentes).`:'Nenhum pedido encontrado.');
 }
 $('login').addEventListener('submit',event=>{event.preventDefault();run(async()=>{const result=await request('/admin/auth/login',{email:$('email').value.trim(),password:$('password').value});$('password').value='';if(typeof result.token!=='string'||!result.token)throw Error('Sessão administrativa não retornada.');token=result.token;$('login').hidden=true;$('admin-panel').hidden=false;say('Administração conectada. Consulte uma conta para começar.');});});
 $('lookup').addEventListener('submit',event=>{event.preventDefault();run(list);});
 $('acknowledge').addEventListener('change',buttons);
 $('cancel').addEventListener('click',()=>{clear();say('Prévia cancelada. Nenhuma alteração realizada.');});
 $('reversal').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
  if(!preview||!$('acknowledge').checked)throw Error('Consulte e confira a prévia primeiro.');if(Date.now()>preview.expires){clear();throw Error('Prévia expirada. Consulte novamente.');}
  const data=preview;preview=null;buttons();
  await request(`/payments/infinitepay/admin/charges/${encodeURIComponent(data.charge.id)}/reversal`,{reason:$('reason').value,reference:$('reference').value.trim(),confirmFullReversal:true,expires:data.expires,previewToken:data.previewToken});
  await list();say('Devolução registrada e acesso ajustado. O benefício escolar foi preservado. Nenhum dinheiro foi transferido por esta página.');
 });});
 $('logout').addEventListener('click',()=>run(async()=>{try{if(token)await request('/admin/auth/logout',{});}finally{reset();say('Sessão administrativa encerrada nesta página.');}}));
 buttons();
})();
