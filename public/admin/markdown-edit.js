const marks={bold:'**',italic:'*',strike:'~~',code:'`'};
export function markdownEdit(value,start,end,action){
 const selected=value.slice(start,end);
 if(action==='link'){
  const label=selected||'链接文字',text=`[${label}](https://)`;
  return {start,end,text,selectionStart:start+label.length+3,selectionEnd:start+text.length-1};
 }
 const mark=marks[action];if(!mark)return null;
 const n=mark.length;
 if(start>=n&&value.slice(start-n,start)===mark&&value.slice(end,end+n)===mark){
  return {start:start-n,end:end+n,text:selected,selectionStart:start-n,selectionEnd:end-n};
 }
 if(selected.length>=2*n&&selected.startsWith(mark)&&selected.endsWith(mark)){
  return {start,end,text:selected.slice(n,-n),selectionStart:start,selectionEnd:end-2*n};
 }
 return {start,end,text:mark+selected+mark,selectionStart:start+n,selectionEnd:end+n};
}
export function installMarkdownEditing(textarea,toolbar){
 function apply(action){
  if(textarea.disabled||textarea.readOnly)return;
  const edit=markdownEdit(textarea.value,textarea.selectionStart,textarea.selectionEnd,action);if(!edit)return;
  const scroll=textarea.scrollTop;textarea.focus();textarea.setSelectionRange(edit.start,edit.end);
  // Native insertion keeps formatting in the browser's undo/redo history.
  if(!document.execCommand('insertText',false,edit.text)){
   textarea.setRangeText(edit.text,edit.start,edit.end,'end');
   textarea.dispatchEvent(new Event('input',{bubbles:true}));
  }
  textarea.setSelectionRange(edit.selectionStart,edit.selectionEnd);textarea.scrollTop=scroll;
 }
 textarea.addEventListener('keydown',event=>{
  if(event.isComposing||event.altKey||!(event.ctrlKey||event.metaKey))return;
  const key=event.key.toLowerCase();
  const action=event.shiftKey?(key==='x'?'strike':null):({b:'bold',i:'italic',k:'link','`':'code'})[key];
  if(action){event.preventDefault();apply(action);}
 });
 toolbar.addEventListener('mousedown',event=>{if(event.target.closest('button'))event.preventDefault();});
 toolbar.addEventListener('click',event=>{const button=event.target.closest('button[data-format]');if(button)apply(button.dataset.format);});
}
