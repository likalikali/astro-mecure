import test from 'node:test';
import assert from 'node:assert/strict';
import { editorState } from '../../public/admin/editor-state.js';
test('new, saved draft, published and pending edits expose different actions',()=>{
 const fresh={kind:'post',sha:'',published:false};
 assert.equal(editorState(fresh,false).canPublish,false);
 assert.equal(editorState(fresh,true).draftLabel,'暂存草稿');
 assert.equal(editorState({...fresh,sha:'saved'},false).canPublish,true);
 const published={...fresh,sha:'saved',published:true};
 assert.equal(editorState(published,false).canPublish,false);
 assert.equal(editorState(published,true).work,'有未保存的修改');
 assert.equal(editorState(published,true).canWithdraw,false);
 assert.equal(editorState({...published,hasDraft:true},false).canPublish,true);
 assert.equal(editorState({...published,hasDraft:true},false).work,'修改已暂存，尚未发布');
 assert.equal(editorState({...published,kind:'page'},false).canWithdraw,false);
 for(const state of [fresh,published,{...published,hasDraft:true}]){
  const loading=editorState(state,true,'正在发布…');
  assert.equal(loading.canDraft,false);assert.equal(loading.canPublish,false);assert.equal(loading.canWithdraw,false);
 }
});
