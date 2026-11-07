import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownEdit} from '../../public/admin/markdown-edit.js';
function apply(value,start,end,action){const e=markdownEdit(value,start,end,action);return {...e,value:value.slice(0,e.start)+e.text+value.slice(e.end)};}
test('wrap selected Chinese text, toggle it off, and preserve surrounding paragraphs',()=>{
 const a=apply('前文\n团子日记\n后文',3,7,'bold');assert.equal(a.value,'前文\n**团子日记**\n后文');
 const b=apply(a.value,a.selectionStart,a.selectionEnd,'bold');assert.equal(b.value,'前文\n团子日记\n后文');
});
test('empty selection leaves caret inside markers; selecting markers can unwrap',()=>{
 const a=apply('日记',2,2,'bold');assert.equal(a.value,'日记****');assert.equal(a.selectionStart,4);assert.equal(a.selectionEnd,4);
 assert.equal(apply('**日记**',0,6,'bold').value,'日记');
});
test('link selection targets URL, and other inline formatting handles multiline selection',()=>{
 const a=apply('团子',0,2,'link');assert.equal(a.value,'[团子](https://)');assert.equal(a.value.slice(a.selectionStart,a.selectionEnd),'https://');
 for(const [action,mark] of [['italic','*'],['strike','~~'],['code','`']])assert.equal(apply('a\nb',0,3,action).value,mark+'a\nb'+mark);
});
