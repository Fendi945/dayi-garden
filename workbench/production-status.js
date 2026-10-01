/* Read-only adapter for the existing owner production status contract. */
(function(root){
  const types=['毛坯庭院','硬化庭院','已有植物庭院'];
  function create({api,document=root.document}){
    let epoch=0,pending=null,panel=null,message,button,values;
    const visible=()=>!document.querySelector('#appView').classList.contains('hidden');
    function element(tag,text,className){const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;}
    function mount(){
      if(panel)return;
      panel=element('div',null,'card');panel.id='productionStatus';
      panel.append(element('h2','生产服务 · 实时状态'));
      values={};
      for(const [key,label] of [['connection','模型接入'],['automatic','自动生产'],['calibration','现场验证']]){
        const row=element('div',null,'kv'),value=element('span','待读取');values[key]=value;row.append(element('span',label),value);panel.append(row);
      }
      message=element('div','状态读取不触发出图。','status');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
      button=element('button','刷新生产状态','btn ghost');button.type='button';button.addEventListener('click',refresh);
      panel.append(message,button);document.querySelector('#tab-design .section').append(panel);
    }
    function clear(){epoch++;pending=null;panel?.remove();panel=null;values=null;}
    function refresh(){
      if(!visible())return Promise.resolve();
      if(pending)return pending;
      mount();const captured=epoch;button.disabled=true;message.textContent='正在读取实际生产状态…';
      Object.values(values).forEach(n=>n.textContent='读取中');
      const request=(async()=>{
        try{
          const x=await api({action:'admin_status'});
          if(captured!==epoch||!visible())return;
          if(typeof x?.image_key_configured!=='boolean'||typeof x.config?.enabled!=='boolean'||!Array.isArray(x.calibration?.approved_types))throw Error('invalid_status');
          const approved=types.filter(t=>x.calibration.approved_types.includes(t));
          values.connection.textContent=x.image_key_configured?'已配置，调用尚需验证':'待完成服务接入';
          values.automatic.textContent=x.config.enabled?'已开启':'已关闭 / 待验证';
          values.calibration.textContent=approved.length+' / 3 类通过';
          message.textContent=types.map(t=>t+'：'+(approved.includes(t)?'已通过':'待验证')).join('；');
        }catch{
          if(captured!==epoch||!visible())return;
          Object.values(values).forEach(n=>n.textContent='未能确认');
          message.textContent='生产状态暂时无法读取，请检查登录或网络后点击刷新。';
        }finally{if(captured===epoch&&panel){button.disabled=false;pending=null;}}
      })();pending=request;return request;
    }
    return {refresh,clear};
  }
  root.Day1ProductionStatus={create};
})(globalThis);
