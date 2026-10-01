// Harden the two existing recovery routes; no automatic email or password change.
(function (root) {
  const base='https://fhvhnibznphatfnbvvnb.supabase.co';
  const key='sb_publishable_8_ElUXtWKbEM9Of37zdYug_mdWjcV4B';
  const legacy=root.location.pathname.endsWith('/reset.html');
  const redirect='https://fendi945.github.io/dayi-garden/workbench/'+(legacy?'reset.html':'recover-v2.html');
  const q=s=>root.document.querySelector(s);
  const send=q(legacy?'#send':'#sendBtn'),save=q(legacy?'#save':'#saveBtn');
  const requestCard=q(legacy?'#requestCard':'#sendCard'),sendMsg=q(legacy?'#requestMsg':'#sendMsg');
  const setCard=q('#setCard'),setMsg=q('#setMsg');
  const hash=new URLSearchParams(root.location.hash.slice(1));
  const query=new URLSearchParams(root.location.search);
  let token=hash.get('access_token'),verified=false,saving=false,verifying=false,sending=false;
  const hasError=hash.has('error_code')||hash.has('error_description')||query.has('error_code')||query.has('error_description');
  // Remove callback credentials/errors before any Auth fetch; keep only an in-memory token.
  if(root.location.hash||root.location.search)root.history.replaceState(null,'',root.location.pathname);
  if(!token&&legacy){try{token=JSON.parse(root.localStorage.getItem('day1_mobile_session_v1')||'null')?.access_token||null;}catch{}}
  const note=(el,message,error=false)=>{el.className='msg '+(error?'err':'ok');el.textContent=message;};
  const inputs=enabled=>{q('#p1').disabled=!enabled;q('#p2').disabled=!enabled;};
  const call=(path,options)=>root.Day1Session.fetchWithTimeout(base+path,{...options,headers:{apikey:key,'Content-Type':'application/json',...options.headers}},30000);
  function discard(){token=null;verified=false;inputs(false);setCard.classList.add('hidden');requestCard.classList.remove('hidden');}
  async function verify(){
    if(verifying||!token)return;
    verifying=true;save.disabled=true;save.textContent='正在验证…';inputs(false);
    setCard.classList.remove('hidden');requestCard.classList.add('hidden');
    note(setMsg,'正在验证恢复凭证…');
    try{
      const r=await call('/auth/v1/user',{method:'GET',headers:{Authorization:'Bearer '+token}});
      if(r.status===401||r.status===403){discard();note(sendMsg,'恢复凭证已失效，请发送新的重置邮件。',true);return;}
      const user=await r.json();if(!r.ok||!user.id)throw Error('verification_failed');
      verified=true;inputs(true);note(setMsg,'凭证已通过服务器验证，可以设置新密码。');
    }catch{note(setMsg,'暂时无法验证凭证，请检查网络后点“重试验证”。',true);}
    finally{verifying=false;save.disabled=false;save.textContent=verified?'保存新密码':'重试验证';}
  }
  const retryKey='day1.auth.recoveryRetryAt.v1';let retryAt=0,timer=null;
  function readDeadline(){try{const n=Number(root.localStorage.getItem(retryKey));return Number.isFinite(n)&&n>Date.now()&&n<=Date.now()+60000?n:0;}catch{return 0;}}
  function renderSend(){
    retryAt=Math.max(retryAt,readDeadline());
    const seconds=Math.max(0,Math.ceil((retryAt-Date.now())/1000));
    if(timer!==null)root.clearTimeout(timer);timer=null;
    send.disabled=sending||seconds>0;
    send.textContent=sending?'正在发送…':seconds?'重新发送（'+seconds+'秒）':'发送新的重置邮件';
    if(seconds)timer=root.setTimeout(renderSend,Math.min(1000,retryAt-Date.now()));
  }
  send.onclick=async()=>{
    retryAt=Math.max(retryAt,readDeadline());if(sending||retryAt>Date.now()){renderSend();return;}
    const email=q('#email').value.trim();if(!email){note(sendMsg,'请填写邮箱。',true);return;}
    sending=true;retryAt=Date.now()+60000;
    try{root.localStorage.setItem(retryKey,String(retryAt));}catch{}
    renderSend();
    try{
      const r=await call('/auth/v1/recover?redirect_to='+encodeURIComponent(redirect),{method:'POST',body:JSON.stringify({email})});
      if(r.status===429){note(sendMsg,'发送过于频繁，请先查看最新邮件或稍后重试。服务器限额可能仍未恢复。',true);return;}
      if(!r.ok){note(sendMsg,'重置邮件未发送成功，请检查邮箱后稍后重试。',true);return;}
      note(sendMsg,'重置邮件请求已提交。请查看最新一封邮件；收到并打开后才可设置密码。');
    }catch{note(sendMsg,'暂时无法确认邮件是否发出。请先查看收件箱，再尝试重发。',true);}
    finally{sending=false;renderSend();}
  };
  save.onclick=async()=>{
    if(saving||verifying)return;
    if(!verified){await verify();return;}
    const a=q('#p1').value,b=q('#p2').value;
    if(a.length<10){note(setMsg,'新密码至少 10 位。',true);return;}
    if(a!==b){note(setMsg,'两次输入的密码不一致。',true);return;}
    saving=true;save.disabled=true;save.textContent='正在保存…';
    try{
      const r=await call('/auth/v1/user',{method:'PUT',headers:{Authorization:'Bearer '+token},body:JSON.stringify({password:a})});
      if(r.status===401||r.status===403){discard();note(sendMsg,'恢复凭证已失效，请发送新的重置邮件。',true);return;}
      if(!r.ok){note(setMsg,'密码未保存成功，请检查密码要求后重试。',true);return;}
      token=null;verified=false;q('#p1').value='';q('#p2').value='';inputs(false);
      try{root.localStorage.removeItem('day1_mobile_session_v1');}catch{}
      note(setMsg,'密码已更新成功。请点击页面底部“返回 DAY1 手机工作台”登录。');
    }catch{note(setMsg,'暂时无法确认密码是否保存。请先返回工作台验证新密码，避免重复提交。',true);}
    finally{saving=false;save.disabled=!token;save.textContent=token?'保存新密码':'已结束';}
  };
  inputs(false);renderSend();
  if(token)verify();
  else if(hasError)note(sendMsg,'这封恢复邮件已失效，请发送新的重置邮件并使用最新链接。',true);
})(window);
