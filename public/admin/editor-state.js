export function editorState(doc, dirty, busy = '') {
  if(!doc)return null;
  const published=doc.published===true, pending=published&&doc.hasDraft, fresh=!doc.sha;
  return {
    publication:published?(pending?'已发布 · 待更新':'已发布'):(fresh?'新文章':'未发布草稿'),
    work:busy||(dirty?'有未保存的修改':fresh?'尚未保存':pending?'修改已暂存，尚未发布':published?'当前内容与线上一致':'草稿已保存，尚未发布'),
    hint:published?'暂存仅保存到后台，线上版本保持不变；发布更新才会替换线上内容。':'暂存后只有你能在后台看到；发布后访客才能访问。',
    draftLabel:published?'暂存修改':'暂存草稿',publishLabel:published?'发布更新':'发布文章',
    canDraft:dirty&&!busy,canPublish:!busy&&(dirty||pending||!published&&!fresh),
    canWithdraw:published&&doc.kind==='post'&&!dirty&&!busy,canDiscard:pending&&!dirty&&!busy,
  };
}
