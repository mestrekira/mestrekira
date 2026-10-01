(() => {
 'use strict'; const $=id=>document.getElementById(id);let token=null,links=[],busy=false;
 const notice=text=>$('notice').textContent=text;
 async function request(path,body){
  const response=await fetch(`${window.api.BASE_URL}${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw Error(Array.isArray(data.message)?data.message.join(' '):data.message || 'Não foi possível concluir.');return data;
 }
 async function run(fn){if(busy)return;busy=true;for(const b of document.querySelectorAll('button'))b.disabled=true;try{await fn();}catch(error){notice(error.message);}finally{busy=false;for(const b of document.querySelectorAll('button'))b.disabled=false;}}
 function showLinks(items){links=items;$('links').replaceChildren();for(const item of items){const row=document.createElement('div');row.className='list-row';const email=document.createElement('strong');email.textContent=item.email;const url=document.createElement('p');url.textContent=item.url;row.append(email,url);$('links').append(row);}$('download').hidden=!items.length;}
 async function refresh(){
  const data=await request('/school-invites/admin');$('campaign').textContent=`${data.reserved} de ${data.capacity} vagas reservadas. Benefício até 29/11/2026.`;
  $('participants').replaceChildren();for(const item of data.invites){const row=document.createElement('div');row.className='list-row';const text=document.createElement('p');text.textContent=`${item.email} — ${item.acceptedAt?'Convite aceito':'Aguardando aceitação'}`;row.append(text);
  if(!item.acceptedAt){const button=document.createElement('button');button.type='button';button.className='btn btn-secondary';button.textContent='Gerar novo link';button.addEventListener('click',()=>run(async()=>{if(button.dataset.confirm!=='true'){button.dataset.confirm='true';button.textContent='Confirmar substituição do link anterior';return;}const result=await request(`/school-invites/admin/${encodeURIComponent(item.id)}/reissue`,{});showLinks([result]);notice('Novo link gerado. Guarde-o antes de sair.');}));row.append(button);}$('participants').append(row);}
 }
 $('admin-login').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
 const data=await request('/admin/auth/login',{email:$('admin-email').value,password:$('admin-password').value});$('admin-password').value='';token=data.token;
 await refresh();$('admin-login').hidden=true;$('admin-panel').hidden=false;notice('Administração conectada. Os links serão gerados sem envio de e-mails.');
 });});
 $('import').addEventListener('click',()=>run(async()=>{
 const emails=$('emails').value.split(/[\n;,]+/).map(v=>v.trim()).filter(Boolean);
 const data=await request('/school-invites/admin/import',{emails});showLinks(data.created);await refresh();
 notice(`${data.created.length} convites gerados; ${data.alreadyReserved.length} e-mails já estavam reservados. Baixe os links: eles não ficam armazenados em texto aberto no servidor.`);
 }));
 $('refresh').addEventListener('click',()=>run(refresh));
 $('logout').addEventListener('click',()=>{token=null;links=[];$('links').replaceChildren();$('participants').replaceChildren();$('admin-panel').hidden=true;$('admin-login').hidden=false;notice('Sessão administrativa encerrada nesta página.');});
 $('download').addEventListener('click',()=>{const escape=v=>'"'+v.replace(/"/g,'""')+'"';const csv='\ufeffemail,link\r\n'+links.map(v=>[v.email,v.url].map(escape).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='convites-gabarita-paes.csv';a.click();URL.revokeObjectURL(url);});
 // Leitura de CSV com campos entre aspas, quebras de linha e delimitador vírgula/ponto e vírgula.
 $('csv').addEventListener('change',()=>run(async()=>{
 const file=$('csv').files[0];if(!file)return;if(file.size>1000000)throw Error('Use um CSV com até 1 MB.');
 const text=(await file.text()).replace(/^\uFEFF/,'');const delimiter=text.split(/\r?\n/)[0].includes(';')?';':',';
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(!quoted&&c===delimiter){row.push(field);field='';}else if(!quoted&&c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('CSV com aspas não fechadas.');if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
 const header=rows.shift()||[];const col=header.findIndex(v=>/e-?mail/i.test(v)&&!/confirm/i.test(v));if(col<0)throw Error('Não localizei a coluna de e-mail. Cole os selecionados manualmente.');
 const emails=[...new Set(rows.map(v=>(v[col]||'').trim().toLowerCase()).filter(Boolean))];$('emails').value=emails.join('\n');notice(`${emails.length} endereços carregados. Revise e selecione até 50 antes de gerar os convites.`);
 }));
})();
