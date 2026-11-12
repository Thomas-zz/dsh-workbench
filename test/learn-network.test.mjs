import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Store } from '../src/store.js'
import { applyOps, migrateState } from '../src/ops.js'
import { startLearning, recordLearningEvent, syncLearningEntry, validateLinks } from '../src/learn/network.js'
import { readLearningFile, listLearningReports, writeDailyReport } from '../src/learn/obsidian.js'
import { collectContextSignals } from '../src/learn/collect.js'
import { registerLearnTools } from '../src/learn/tools.js'

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(),'wb-network-'))
  t.after(() => rm(dir,{recursive:true,force:true}))
  const vault = join(dir,'vault');await mkdir(join(vault,'.obsidian'),{recursive:true})
  const store = new Store(join(dir,'state'))
  await store.mutate('seed', (state) => {
    state.learn.config.vaultPath = vault
    state.learn.config.sources = {zcode:false,dsh:false,claude:false,codex:false}
    applyOps(state,[{op:'learn_write',items:[{id:'root',title:'数据库连接',question:'JDBC 是什么',answer:'JDBC 是 Java 应用程序访问关系型数据库的一组标准接口。',category:'term',concept:'JDBC',key:'root'}]}])
  })
  return {dir,vault,store}
}

test('追问有标题和上下文，后续用户问题自动延伸，答案落盘，重放不重复', async (t) => {
  const {store,vault} = await fixture(t)
  const calls = []
  const ctx = {sessionController:{create:async()=>({sessionId:'learn-1'}),rename:async (request)=>calls.push(request),resolveAgent:async()=>({agent:{session:{id:'learn-1'},followup:(message)=>calls.push(message)}})},sessions:{flush:async()=>{}}}
  const started = await startLearning(ctx,store,{entryId:'root',question:'连接池为什么能提高性能',quote:'标准接口'})
  assert.equal(calls[0].title,'学习 · 连接池为什么能提高性能')
  assert.match(calls[1].content[0].text,/标准接口/)
  assert.match(calls[1].content[0].text,/不要登记工作待办/)
  const initial = (await store.read()).learn.entries.find((row)=>row.id===started.entryId)
  assert.deepEqual(initial.parentIds,['root']);assert.equal(initial.learningSessionId,'learn-1')
  await recordLearningEvent(store,'learn-1',{type:'user/message',seq:1,data:{source:{kind:'cordis-host-runner'},content:[{type:'text',text:'trigger'}]}})
  assert.equal((await store.read()).learn.entries.length,2)
  await recordLearningEvent(store,'learn-1',{type:'assistant/message',seq:2,data:{message:{content:[{type:'text',text:'连接池通过复用数据库连接减少建立连接的开销。'}]}}})
  const follow = {type:'user/message',seq:3,surfaceOp:'append',data:{id:'u2',source:{kind:'user'},content:[{type:'text',text:'那连接池大小应该怎样确定？'}]}}
  const childId = await recordLearningEvent(store,'learn-1',follow)
  await recordLearningEvent(store,'learn-1',follow)
  await recordLearningEvent(store,'unrelated',follow)
  assert.equal((await store.read()).learn.entries.length,3)
  await recordLearningEvent(store,'learn-1',{type:'assistant/message',seq:4,data:{message:{content:[{type:'text',text:'连接池大小应结合数据库容量、请求并发和查询耗时，通过压测确定。'}]}}})
  await syncLearningEntry(store,childId)
  const state = await new Store(store.root).read()
  const child = state.learn.entries.find((row)=>row.id===childId)
  assert.deepEqual(child.parentIds,[started.entryId]);assert.match(child.answer,/压测/)
  assert.equal(state.learn.sessions['learn-1'].currentId,childId)
  assert.match(await readFile(join(vault,child.notePath),'utf8'),/学习脉络/)
  assert.throws(()=>validateLinks(state,'root',[childId]),/循环/)
})

test('模型启动失败保留已创建的会话和问题，笔记同步失败不丢答案', async(t)=>{
  const {store,vault} = await fixture(t)
  const ctx={sessionController:{create:async()=>({sessionId:'failed'}),rename:async()=>{},resolveAgent:async()=>({error:new Error('provider offline')})},sessions:{flush:async()=>{}}}
  const result=await startLearning(ctx,store,{entryId:'root',question:'失败之后可以继续吗？'})
  assert.equal(result.error,'provider offline')
  await rm(join(vault,'.obsidian'),{recursive:true})
  await syncLearningEntry(store,result.entryId)
  const node=(await store.read()).learn.entries.find((row)=>row.id===result.entryId)
  assert.match(node.syncError,/找不到/);assert.equal(node.question,'失败之后可以继续吗？')
})

test('控制台日报列出并读取实际文件，路径有空格也可生成绝对 Obsidian URI，拒绝越界',async(t)=>{
  const {store,vault,dir}=await fixture(t);const state=await store.read();const target={vaultPath:vault,notesDir:'AI/Agent 学习'}
  const report=await writeDailyReport(target,state)
  const list=await listLearningReports(state,target)
  assert.equal(list.length,1);assert.equal(list[0].path,report.path)
  const file=await readLearningFile(vault,list[0].path)
  assert.match(file.content,/学习日报/);assert.equal(new URL(file.uri).searchParams.get('path'),await realpath(join(vault,report.path)))
  await assert.rejects(readLearningFile(vault,'../bad.md'),/无效/)
  await writeFile(join(dir,'secret.md'),'outside');await symlink(join(dir,'secret.md'),join(vault,'outside.md'))
  await assert.rejects(readLearningFile(vault,'outside.md'),/超出/)
  await assert.rejects(readLearningFile(vault,'missing.md'),/工作台阅读/)
})

test('上下文线索保留非问句、相邻输入与来源，不把推测当成知识缺口',()=>{
  const state=migrateState({});const at=new Date().toISOString()
  const signals=collectContextSignals([{text:'我不太理解连接池与数据库连接的关系',source:'dsh',sessionId:'s',at},{text:'刚才在讨论 JDBC',source:'dsh',sessionId:'s',at},{text:'<environment_context>不要扫描',source:'codex',sessionId:'other',at}],state)
  assert.equal(signals.length,2);assert.equal(signals[0].nearby.length,1);assert.match(signals[1].signal,/不代表/);assert.equal(signals[0].source,'dsh')
})

test('AI 建议有依据与关系才写入，元数据迁移后仍保留',async(t)=>{
  const {store}=await fixture(t);const tools={};registerLearnTools({tools:{register(def){tools[def.name]=def;return()=>{}}}},store)
  const item={title:'连接池与线程池',question:'连接池与线程池有什么关系',answer:'它们分别复用连接和线程，都是通过管理有限资源来控制并发。',category:'know',kind:'suggested',parentIds:['root']}
  assert.equal((await tools.workbench_learn_write.execute({items:[item]})).ok,false)
  const written=await tools.workbench_learn_write.execute({items:[{...item,evidence:'用户追问连接复用，可进一步比较其他资源池'}]})
  assert.equal(written.ok,true);assert.ok(written.reportAbsolutePath.startsWith('/'))
  const state=await new Store(store.root).read();const row=state.learn.entries.find(row=>row.kind==='suggested')
  assert.deepEqual(row.parentIds,['root']);assert.match(row.evidence,/连接复用/)
})


test('后台学习记录到达后，撤销旧操作不会抹掉新问题', async(t)=>{
 const {store}=await fixture(t)
 await store.mutate('设置变更',(draft)=>{draft.learn.config.reportHour=21})
 await store.mutate('新学习会话',(draft)=>{draft.learn.sessions.new={rootId:'root',currentId:'root'}},{undoable:false})
 assert.equal(store.canUndo(),false)
 await assert.rejects(store.undoLast(),/当前内容已保留/)
 assert.ok((await store.read()).learn.sessions.new)
})


test('collect 的模型可见结果包含完整材料而非只有计数',async(t)=>{
 const {store}=await fixture(t);const tools={}
 registerLearnTools({tools:{register(def){tools[def.name]=def;return()=>{}}}},store)
 const result=await tools.workbench_learn_collect.execute({})
 const rendered=tools.workbench_learn_collect.output.render({},result).map(row=>row.text).join('')
 assert.match(rendered,/knowledge/);assert.match(rendered,/JDBC/);assert.match(rendered,/"id": "root"/);assert.match(rendered,/contextSignals/)
})
