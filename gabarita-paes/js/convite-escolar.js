(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const token=new URLSearchParams(window.location.hash.slice(1)).get('token');
 const valid=typeof token==='string' && /^[a-f0-9]{64}$/.test(token);
 if(!valid){$('notice').textContent='Abra o link completo que recebeu por e-mail para aceitar o convite.';return;}
 if(window.api?.getToken()){$('accept').hidden=false;$('guest-actions').hidden=true;}
 else $('notice').textContent='Depois de confirmar o cadastro e fazer login, retorne a este convite.';
 $('accept').addEventListener('click',async()=>{
  $('accept').disabled=true;
  try{
   const result=await window.api.post('/school-invites/accept',{token});
   if(!result)return;
   $('notice').textContent=result.alreadyAccepted?'Seu convite já está aceito. O benefício permanece registrado na conta.':'Convite aceito! Seu acesso escolar está garantido até 29/11/2026, às 23h59 (horário de Brasília).';
   $('profile').hidden=false;$('accept').hidden=true;
   window.history.replaceState(null,'',window.location.pathname);
  }catch(error){$('notice').textContent=error.message || 'Não foi possível aceitar. Confira a conta utilizada e a verificação do e-mail.';}
  finally{$('accept').disabled=false;}
 });
})();
