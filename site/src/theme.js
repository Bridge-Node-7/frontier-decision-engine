const key='fde.theme',root=document.documentElement,button=document.querySelector('#theme-toggle');
function storage(){try{return window.localStorage}catch{return null}}
function read(){try{return storage()?.getItem(key)||'system'}catch{return 'system'}}
function write(value){try{storage()?.setItem(key,value)}catch{/* appearance still works for this page */}}
function apply(value){const theme=['light','dark'].includes(value)?value:'system';if(theme==='system')root.removeAttribute('data-theme');else root.dataset.theme=theme;if(button){button.textContent=theme==='dark'?'Light appearance':theme==='light'?'System appearance':'Dark appearance';button.setAttribute('aria-label',`Current appearance: ${theme}. Change appearance.`);}}
apply(read());
button?.addEventListener('click',()=>{const current=read(),next=current==='system'?'dark':current==='dark'?'light':'system';write(next);apply(next);});
