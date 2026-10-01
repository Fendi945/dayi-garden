// Workbench-only navigation shell; the public customer page stays unchanged.
(function (root) {
  const document = root.document;
  const link = document.querySelector('#tab-design a[href="../direction-feedback/"]');
  if (!link) return;
  let dialog = null;
  function close() { if (dialog?.open) dialog.close(); }
  root.Day1ClientPreview = {close};
  link.addEventListener('click', event => {
    if (event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (document.querySelector('#appView').classList.contains('hidden')) return;
    event.preventDefault();
    if (dialog?.open) return;
    dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', '庭院方向反馈 · 客户端预览');
    dialog.style.cssText = 'position:fixed;inset:0;width:100%;max-width:none;height:100dvh;max-height:none;margin:0;padding:0;border:0;background:#F8F6F3;color:#222222;';
    const shell = document.createElement('div');
    shell.style.cssText = 'height:100%;display:flex;flex-direction:column;';
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'flex:none;display:flex;align-items:center;gap:12px;padding:calc(8px + env(safe-area-inset-top)) 18px 8px;border-bottom:1px solid #DDD7CD;';
    const back = document.createElement('button');
    back.type = 'button'; back.className = 'btn ghost';
    back.textContent = '← 返回设计 / 生图';
    back.addEventListener('click', close);
    const label = document.createElement('span');
    label.className = 'note'; label.textContent = '客户端预览';
    toolbar.append(back, label);
    const frame = document.createElement('iframe');
    frame.title = '庭院方向反馈客户端';
    frame.style.cssText = 'flex:1;min-height:0;width:100%;border:0;background:#F8F6F3;';
    // Fixed existing same-origin route; never forward credentials or order capabilities.
    frame.src = '../direction-feedback/';
    shell.append(toolbar, frame); dialog.append(shell); document.body.append(dialog);
    dialog.addEventListener('close', () => {
      frame.src = 'about:blank'; dialog.remove(); dialog = null;
      if (!document.querySelector('#appView').classList.contains('hidden')) link.focus();
    }, {once:true});
    dialog.showModal(); back.focus();
  });
})(window);
