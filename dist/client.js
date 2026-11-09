window.__ModuleLoader__.load({id:"dsh-workbench",factory:(require)=>{const module={exports:{}};const exports=module.exports;
var ke=Object.create;var j=Object.defineProperty;var Ee=Object.getOwnPropertyDescriptor;var Ne=Object.getOwnPropertyNames;var Ie=Object.getPrototypeOf,$e=Object.prototype.hasOwnProperty;var Te=(e,t)=>{for(var a in t)j(e,a,{get:t[a],enumerable:!0})},X=(e,t,a,o)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of Ne(t))!$e.call(e,r)&&r!==a&&j(e,r,{get:()=>t[r],enumerable:!(o=Ee(t,r))||o.enumerable});return e};var $=(e,t,a)=>(a=e!=null?ke(Ie(e)):{},X(t||!e||!e.__esModule?j(a,"default",{value:e,enumerable:!0}):a,e)),Se=e=>X(j({},"__esModule",{value:!0}),e);var tt={};Te(tt,{apply:()=>et,inject:()=>qe});module.exports=Se(tt);var f=$(require("react"),1);var q=`/* \u4E2A\u4EBA\u5DE5\u4F5C\u53F0\u6837\u5F0F\uFF1A\u53EA\u7528\u5BBF\u4E3B --dsw-alias-* \u4E3B\u9898 token\uFF0C\u8DDF\u968F\u660E\u6697\u4E3B\u9898\u3002 */

.wb-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: 13px/1.55 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
}

.wb-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  flex: none;
}

.wb-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

.wb-nav {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
}

.wb-nav button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  border-radius: 6px;
  padding: 4px 12px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  cursor: pointer;
}

.wb-nav button:hover { color: var(--dsw-alias-label-primary); }

.wb-nav button.is-on {
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 0 0 1px var(--dsw-alias-border-l1);
}

.wb-badge {
  font-style: normal;
  font-size: 11px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);
  color: var(--dsw-alias-brand-primary);
}

.wb-badge.is-warn {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 20%, transparent);
  color: var(--dsw-alias-state-warn-primary);
}

.wb-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}

.wb-iconbtn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.wb-iconbtn:disabled { opacity: 0.4; cursor: default; }
.wb-iconbtn.is-danger:hover { color: var(--dsw-alias-state-error-primary); }

.wb-strip {
  flex: none;
  padding: 6px 16px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px 40px;
}

.wb-page { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

/* \u2014\u2014 \u5FEB\u901F\u6355\u83B7 \u2014\u2014 */
.wb-capture {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
}

.wb-capture input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  outline: none;
}

.wb-capture-kind { display: inline-flex; gap: 2px; background: var(--dsw-alias-bg-layer-2); border-radius: 7px; padding: 2px; }

.wb-capture-kind button {
  border: 0; border-radius: 5px; padding: 3px 10px; background: transparent;
  color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer;
}

.wb-capture-kind button.is-on { background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); }

.wb-filter {
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  padding: 6px 10px;
  outline: none;
}

.wb-filter:focus { border-color: var(--dsw-alias-brand-primary); }

/* \u2014\u2014 \u5206\u7EC4\u4E0E\u4EFB\u52A1\u884C \u2014\u2014 */
.wb-section { display: flex; flex-direction: column; gap: 4px; }

.wb-section h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--dsw-alias-label-secondary);
}

.wb-count {
  font-weight: 400;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-layer-2);
  border-radius: 8px;
  padding: 0 7px;
  font-size: 11px;
}

.wb-task {
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}

.wb-task.is-open { border-color: var(--dsw-alias-border-l2); }

.wb-task-main {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  user-select: none;
}

.wb-task-main:hover { background: var(--dsw-alias-bg-layer-2); }

.wb-check {
  flex: none;
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-bg-base);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.wb-check:hover { border-color: var(--dsw-alias-state-success-primary); }

.wb-check.is-on { background: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }

.wb-task-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wb-task.is-done .wb-task-title { color: var(--dsw-alias-label-secondary); text-decoration: line-through; }

.wb-task-meta { display: inline-flex; align-items: center; gap: 4px; flex: none; max-width: 55%; overflow: hidden; }

.wb-chip {
  font-size: 11px;
  line-height: 1;
  padding: 3px 7px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
}

.wb-chip.is-warn { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 18%, transparent); color: var(--dsw-alias-state-warn-primary); }
.wb-chip.is-error { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, transparent); color: var(--dsw-alias-state-error-primary); }
.wb-chip.is-brand { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); color: var(--dsw-alias-brand-primary); }
.wb-chip.is-idle { opacity: 0.85; }

.wb-chipbtn {
  border: 0;
  font: inherit;
  cursor: pointer;
}

.wb-chipbtn:hover {
  color: var(--dsw-alias-brand-primary);
  opacity: 1;
}

.wb-meta { font-size: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }

/* \u2014\u2014 \u884C\u5185\u7F16\u8F91 \u2014\u2014 */
.wb-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
}

.wb-field { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--dsw-alias-label-secondary); }

.wb-field input, .wb-field textarea, .wb-field select {
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  padding: 5px 8px;
  outline: none;
  resize: vertical;
}

.wb-field input:focus, .wb-field textarea:focus, .wb-field select:focus { border-color: var(--dsw-alias-brand-primary); }

.wb-field-row { display: flex; gap: 8px; }
.wb-field-row .wb-field { flex: 1; }

.wb-editor-foot { display: flex; align-items: center; gap: 8px; }

/* \u2014\u2014 \u8001\u677F\u89C6\u56FE\uFF1A\u6267\u884C\u8005 / \u73AF\u8282\u65F6\u95F4\u7EBF / \u6302\u9760\u6267\u884C \u2014\u2014 */
.wb-boss {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border: 1px dashed var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
}

.wb-boss-row { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }

.wb-boss-label {
  flex: none;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  padding-top: 3px;
  min-width: 3em;
}

.wb-boss-actors { display: inline-flex; flex-wrap: wrap; gap: 4px; }

.wb-timeline {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.wb-timeline-item { display: flex; align-items: baseline; gap: 8px; min-width: 0; }

.wb-timeline-item::before {
  content: '';
  flex: none;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--dsw-alias-border-l2);
  align-self: center;
}

.wb-timeline-note {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-run { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; flex-wrap: wrap; }

.wb-run-kind { font-size: 11px; color: var(--dsw-alias-label-secondary); flex: none; }

.wb-run-title {
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* \u2014\u2014 \u9A8C\u6536\u5361\u6458\u8981 \u2014\u2014 */
.wb-review.is-open { border-color: var(--dsw-alias-border-l2); }

.wb-review-detail { display: flex; flex-direction: column; gap: 4px; min-width: 0; }

.wb-review-task { margin: 0; font-size: 12px; color: var(--dsw-alias-label-secondary); }

.wb-review-summary {
  margin: 0;
  padding: 6px 8px;
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 160px;
  overflow: auto;
}

/* \u2014\u2014 \u6668\u62A5\u5361 \u2014\u2014 */
.wb-brief {
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}

.wb-brief-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  cursor: pointer;
  color: var(--dsw-alias-label-secondary);
}

.wb-brief-head:hover { background: var(--dsw-alias-bg-layer-2); }

.wb-brief-date { flex: none; font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-primary); }

.wb-brief-summary { flex: 1; min-width: 0; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wb-brief-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 10px 8px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}

.wb-brief-body p { margin: 0; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.wb-brief-body p.is-warn { color: var(--dsw-alias-state-warn-primary); }

/* \u2014\u2014 \u4F1A\u8BDD\u5185\u505C\u9760\u6761 \u2014\u2014 */
.wb-dock {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  overflow-x: auto;
}

.wb-dock-label {
  flex: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--dsw-alias-brand-primary);
  white-space: nowrap;
}

.wb-dock-item {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  max-width: 200px;
}

.wb-dock-done {
  flex: none;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-bg-base);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.wb-dock-done:hover { border-color: var(--dsw-alias-state-success-primary); background: var(--dsw-alias-state-success-primary); }

.wb-dock-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-primary); }

.wb-dock-item.is-more { color: var(--dsw-alias-label-secondary); }

/* \u2014\u2014 \u6309\u94AE \u2014\u2014 */
.wb-btn {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  padding: 5px 12px;
  cursor: pointer;
  white-space: nowrap;
}

.wb-btn:hover { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.wb-btn:disabled { opacity: 0.45; cursor: default; }

.wb-btn.is-primary {
  background: var(--dsw-alias-brand-primary);
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-bg-base);
}

.wb-btn.is-primary:hover { color: var(--dsw-alias-bg-base); filter: brightness(1.08); }

.wb-btn.is-ghost { border-color: transparent; background: transparent; color: var(--dsw-alias-label-secondary); }
.wb-btn.is-ghost:hover { color: var(--dsw-alias-label-primary); }

.wb-btn.is-danger:hover { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }

/* \u2014\u2014 \u9A8C\u6536\u5361\u4E0E\u7075\u611F \u2014\u2014 */
.wb-review, .wb-idea {
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-1);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.wb-review-main { display: flex; align-items: center; gap: 8px; min-width: 0; }

.wb-kind {
  flex: none;
  font-size: 11px;
  padding: 3px 7px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent);
  color: var(--dsw-alias-brand-primary);
}

.wb-review-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wb-review-actions { display: flex; gap: 6px; justify-content: flex-end; }

.wb-idea-main { display: flex; align-items: center; gap: 8px; min-width: 0; cursor: pointer; color: var(--dsw-alias-label-secondary); }

.wb-idea-main:hover { color: var(--dsw-alias-label-primary); }

.wb-idea-text { flex: 1; min-width: 0; color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wb-idea-note { margin: 0; padding: 0 2px; font-size: 12px; color: var(--dsw-alias-label-secondary); white-space: pre-wrap; }

/* \u2014\u2014 \u5176\u4ED6 \u2014\u2014 */
.wb-empty { margin: 8px 2px; color: var(--dsw-alias-label-secondary); font-size: 12px; }

.wb-toast {
  position: absolute;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l2);
  box-shadow: 0 6px 24px color-mix(in srgb, var(--dsw-alias-border-l2) 45%, transparent);
  border-radius: 9px;
  padding: 7px 14px;
  font-size: 12px;
  max-width: 70%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: wb-pop 0.18s ease-out;
  z-index: 10;
}

.wb-toast.is-error { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }

@keyframes wb-pop {
  from { opacity: 0; transform: translate(-50%, 6px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .wb-toast { animation: none; }
}
`;var ne=$(require("react"),1);var V={zh:{\u5DE5\u4F5C\u53F0:"\u5DE5\u4F5C\u53F0",\u4ECA\u5929:"\u4ECA\u5929",\u5168\u90E8:"\u5168\u90E8",\u6536\u4EF6\u7BB1:"\u6536\u4EF6\u7BB1","\u8BB0\u4E00\u53E5\u8BDD\uFF0C\u56DE\u8F66\u6536\u8FDB\u7075\u611F\u6536\u4EF6\u7BB1":"\u8BB0\u4E00\u53E5\u8BDD\uFF0C\u56DE\u8F66\u6536\u8FDB\u7075\u611F\u6536\u4EF6\u7BB1",\u7075\u611F:"\u7075\u611F",\u4EFB\u52A1:"\u4EFB\u52A1",\u6536\u8FDB\u6536\u4EF6\u7BB1:"\u6536\u8FDB\u6536\u4EF6\u7BB1",\u76F4\u63A5\u5EFA\u4EFB\u52A1:"\u76F4\u63A5\u5EFA\u4EFB\u52A1",\u8FDB\u884C\u4E2D:"\u8FDB\u884C\u4E2D",\u4ECA\u5929\u5230\u671F:"\u4ECA\u5929\u5230\u671F",\u903E\u671F:"\u903E\u671F",\u7126\u70B9:"\u7126\u70B9","\u4ECA\u65E5\u5B8C\u6210 {n} \u4EF6":"\u4ECA\u65E5\u5B8C\u6210 {n} \u4EF6",\u5F85\u529E:"\u5F85\u529E",\u53D7\u963B:"\u53D7\u963B",\u5DF2\u5B8C\u6210:"\u5DF2\u5B8C\u6210",\u5F85\u9A8C\u6536:"\u5F85\u9A8C\u6536",\u9A8C\u6536:"\u9A8C\u6536",\u5FFD\u7565:"\u5FFD\u7565",\u8F6C\u4EFB\u52A1:"\u8F6C\u4EFB\u52A1",\u5B50\u4EE3\u7406:"\u5B50\u4EE3\u7406",\u5DE5\u4F5C\u6D41:"\u5DE5\u4F5C\u6D41",\u540E\u53F0\u4EFB\u52A1:"\u540E\u53F0\u4EFB\u52A1","\u5DF2\u505C\u9760\u7075\u611F\u300C{text}\u300D":"\u5DF2\u505C\u9760\u7075\u611F\u300C{text}\u300D",\u5DF2\u4E22\u5F03\u7075\u611F:"\u5DF2\u4E22\u5F03\u7075\u611F","\u7075\u611F\u5DF2\u8F6C\u4E3A\u4EFB\u52A1\u300C{title}\u300D":"\u7075\u611F\u5DF2\u8F6C\u4E3A\u4EFB\u52A1\u300C{title}\u300D","\u9A8C\u6536\u5B8C\u6210\uFF0C\u5269\u4F59 {n} \u6761":"\u9A8C\u6536\u5B8C\u6210\uFF0C\u5269\u4F59 {n} \u6761",\u6807\u9898:"\u6807\u9898",\u5907\u6CE8:"\u5907\u6CE8",\u622A\u6B62:"\u622A\u6B62",\u4F18\u5148\u7EA7:"\u4F18\u5148\u7EA7",\u4F4E:"\u4F4E",\u4E2D:"\u4E2D",\u9AD8:"\u9AD8",\u72B6\u6001:"\u72B6\u6001",\u6807\u7B7E:"\u6807\u7B7E",\u4ECA\u5929\u7126\u70B9:"\u4ECA\u5929\u7126\u70B9",\u5220\u9664:"\u5220\u9664",\u4FDD\u5B58:"\u4FDD\u5B58",\u53D6\u6D88:"\u53D6\u6D88",\u7F16\u8F91\u4EFB\u52A1:"\u7F16\u8F91\u4EFB\u52A1",\u6765\u6E90\u4F1A\u8BDD:"\u6765\u6E90\u4F1A\u8BDD",\u7075\u611F\u6536\u4EF6\u7BB1\u662F\u7A7A\u7684:"\u7075\u611F\u6536\u4EF6\u7BB1\u662F\u7A7A\u7684","\u6CA1\u6709\u5F85\u9A8C\u6536\uFF0C\u5E76\u884C\u4EFB\u52A1\u7684\u7ED3\u679C\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u51FA\u73B0\u5728\u8FD9\u91CC":"\u6CA1\u6709\u5F85\u9A8C\u6536\uFF0C\u5E76\u884C\u4EFB\u52A1\u7684\u7ED3\u679C\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u51FA\u73B0\u5728\u8FD9\u91CC","\u4ECA\u5929\u8FD8\u6CA1\u6709\u5B89\u6392\uFF1B\u5BF9\u8BDD\u91CC\u63D0\u5230\u7684\u4E8B\u60C5\u4F1A\u81EA\u52A8\u767B\u8BB0\u8FDB\u6765":"\u4ECA\u5929\u8FD8\u6CA1\u6709\u5B89\u6392\uFF1B\u5BF9\u8BDD\u91CC\u63D0\u5230\u7684\u4E8B\u60C5\u4F1A\u81EA\u52A8\u767B\u8BB0\u8FDB\u6765",\u64A4\u9500:"\u64A4\u9500","\u5DF2\u64A4\u9500\uFF1A{label}":"\u5DF2\u64A4\u9500\uFF1A{label}",\u5237\u65B0:"\u5237\u65B0","\u52A0\u8F7D\u4E2D\u2026":"\u52A0\u8F7D\u4E2D\u2026","\u5DE5\u4F5C\u53F0\u52A0\u8F7D\u5931\u8D25\uFF1A{error}":"\u5DE5\u4F5C\u53F0\u52A0\u8F7D\u5931\u8D25\uFF1A{error}",\u91CD\u8BD5:"\u91CD\u8BD5",\u521A\u521A:"\u521A\u521A","{n} \u5206\u949F\u524D":"{n} \u5206\u949F\u524D","{n} \u5C0F\u65F6\u524D":"{n} \u5C0F\u65F6\u524D","{n} \u5929\u524D":"{n} \u5929\u524D",\u4E2A\u4EBA\u5DE5\u4F5C\u53F0:"\u4E2A\u4EBA\u5DE5\u4F5C\u53F0","\u641C\u7D22\u8FC7\u6EE4\u2026":"\u641C\u7D22\u8FC7\u6EE4\u2026",\u5C55\u5F00:"\u5C55\u5F00",\u6536\u8D77:"\u6536\u8D77",\u6765\u81EA\u5BF9\u8BDD:"\u6765\u81EA\u5BF9\u8BDD",\u5DE5\u4F5C\u53F0\u9762\u677F:"\u5DE5\u4F5C\u53F0\u9762\u677F",\u6267\u884C:"\u6267\u884C",\u73AF\u8282:"\u73AF\u8282",\u6302\u9760\u6267\u884C:"\u6302\u9760\u6267\u884C",\u6302\u9760\u4EFB\u52A1:"\u6302\u9760\u4EFB\u52A1",\u5916\u90E8\u6267\u884C\u8005:"\u5916\u90E8\u6267\u884C\u8005","\u6682\u65E0\u8FDB\u5C55\u8BB0\u5F55\uFF1B\u63A5\u624B\u7684\u4F1A\u8BDD\u4F1A\u81EA\u52A8\u6C47\u62A5\u5230\u8FD9\u91CC":"\u6682\u65E0\u8FDB\u5C55\u8BB0\u5F55\uFF1B\u63A5\u624B\u7684\u4F1A\u8BDD\u4F1A\u81EA\u52A8\u6C47\u62A5\u5230\u8FD9\u91CC",\u5DF2\u9A8C\u6536:"\u5DF2\u9A8C\u6536",\u5DF2\u5FFD\u7565:"\u5DF2\u5FFD\u7565",\u8DF3\u8F6C\u4F1A\u8BDD:"\u8DF3\u8F6C\u4F1A\u8BDD","\u6765\u81EA ZCode":"\u6765\u81EA ZCode",\u6628\u65E5\u5B8C\u6210:"\u6628\u65E5\u5B8C\u6210","\uFF08\u903E\u671F\uFF09":"\uFF08\u903E\u671F\uFF09",\u5468\u65E5:"\u5468\u65E5",\u5468\u4E00:"\u5468\u4E00",\u5468\u4E8C:"\u5468\u4E8C",\u5468\u4E09:"\u5468\u4E09",\u5468\u56DB:"\u5468\u56DB",\u5468\u4E94:"\u5468\u4E94",\u5468\u516D:"\u5468\u516D","\u5DE5\u4F5C\u53F0 {n}":"\u5DE5\u4F5C\u53F0 {n}","\u5B8C\u6210\u300C{title}\u300D":"\u5B8C\u6210\u300C{title}\u300D"},en:{\u5DE5\u4F5C\u53F0:"Workbench",\u4ECA\u5929:"Today",\u5168\u90E8:"All",\u6536\u4EF6\u7BB1:"Inbox","\u8BB0\u4E00\u53E5\u8BDD\uFF0C\u56DE\u8F66\u6536\u8FDB\u7075\u611F\u6536\u4EF6\u7BB1":"Capture a thought, press Enter to park it",\u7075\u611F:"Idea",\u4EFB\u52A1:"Task",\u6536\u8FDB\u6536\u4EF6\u7BB1:"Park idea",\u76F4\u63A5\u5EFA\u4EFB\u52A1:"Create task",\u8FDB\u884C\u4E2D:"In progress",\u4ECA\u5929\u5230\u671F:"Due today",\u903E\u671F:"Overdue",\u7126\u70B9:"Focus","\u4ECA\u65E5\u5B8C\u6210 {n} \u4EF6":"{n} done today",\u5F85\u529E:"To do",\u53D7\u963B:"Blocked",\u5DF2\u5B8C\u6210:"Done",\u5F85\u9A8C\u6536:"To review",\u9A8C\u6536:"Accept",\u5FFD\u7565:"Dismiss",\u8F6C\u4EFB\u52A1:"To task",\u5B50\u4EE3\u7406:"Subagent",\u5DE5\u4F5C\u6D41:"Workflow",\u540E\u53F0\u4EFB\u52A1:"Job","\u5DF2\u505C\u9760\u7075\u611F\u300C{text}\u300D":"Parked idea \u201C{text}\u201D",\u5DF2\u4E22\u5F03\u7075\u611F:"Idea dropped","\u7075\u611F\u5DF2\u8F6C\u4E3A\u4EFB\u52A1\u300C{title}\u300D":"Idea promoted to task \u201C{title}\u201D","\u9A8C\u6536\u5B8C\u6210\uFF0C\u5269\u4F59 {n} \u6761":"Reviewed, {n} left",\u6807\u9898:"Title",\u5907\u6CE8:"Note",\u622A\u6B62:"Due",\u4F18\u5148\u7EA7:"Priority",\u4F4E:"Low",\u4E2D:"Med",\u9AD8:"High",\u72B6\u6001:"Status",\u6807\u7B7E:"Tags",\u4ECA\u5929\u7126\u70B9:"Today focus",\u5220\u9664:"Delete",\u4FDD\u5B58:"Save",\u53D6\u6D88:"Cancel",\u7F16\u8F91\u4EFB\u52A1:"Edit task",\u6765\u6E90\u4F1A\u8BDD:"Source session",\u7075\u611F\u6536\u4EF6\u7BB1\u662F\u7A7A\u7684:"The idea inbox is empty","\u6CA1\u6709\u5F85\u9A8C\u6536\uFF0C\u5E76\u884C\u4EFB\u52A1\u7684\u7ED3\u679C\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u51FA\u73B0\u5728\u8FD9\u91CC":"Nothing to review. Finished parallel runs will land here automatically.","\u4ECA\u5929\u8FD8\u6CA1\u6709\u5B89\u6392\uFF1B\u5BF9\u8BDD\u91CC\u63D0\u5230\u7684\u4E8B\u60C5\u4F1A\u81EA\u52A8\u767B\u8BB0\u8FDB\u6765":"Nothing planned today. Tasks mentioned in chats land here automatically.",\u64A4\u9500:"Undo","\u5DF2\u64A4\u9500\uFF1A{label}":"Undone: {label}",\u5237\u65B0:"Refresh","\u52A0\u8F7D\u4E2D\u2026":"Loading\u2026","\u5DE5\u4F5C\u53F0\u52A0\u8F7D\u5931\u8D25\uFF1A{error}":"Workbench failed to load: {error}",\u91CD\u8BD5:"Retry",\u521A\u521A:"just now","{n} \u5206\u949F\u524D":"{n}m ago","{n} \u5C0F\u65F6\u524D":"{n}h ago","{n} \u5929\u524D":"{n}d ago",\u4E2A\u4EBA\u5DE5\u4F5C\u53F0:"Personal workbench","\u641C\u7D22\u8FC7\u6EE4\u2026":"Filter\u2026",\u5C55\u5F00:"Expand",\u6536\u8D77:"Collapse",\u6765\u81EA\u5BF9\u8BDD:"from chat",\u5DE5\u4F5C\u53F0\u9762\u677F:"Workbench panel",\u6267\u884C:"Runners",\u73AF\u8282:"Progress",\u6302\u9760\u6267\u884C:"Linked runs",\u6302\u9760\u4EFB\u52A1:"Attached task",\u5916\u90E8\u6267\u884C\u8005:"External runner","\u6682\u65E0\u8FDB\u5C55\u8BB0\u5F55\uFF1B\u63A5\u624B\u7684\u4F1A\u8BDD\u4F1A\u81EA\u52A8\u6C47\u62A5\u5230\u8FD9\u91CC":"No progress yet; sessions that take this task will report here automatically.",\u5DF2\u9A8C\u6536:"Accepted",\u5DF2\u5FFD\u7565:"Dismissed",\u8DF3\u8F6C\u4F1A\u8BDD:"Open session","\u6765\u81EA ZCode":"from ZCode",\u6628\u65E5\u5B8C\u6210:"Done yesterday","\uFF08\u903E\u671F\uFF09":" (overdue)",\u5468\u65E5:"Sun",\u5468\u4E00:"Mon",\u5468\u4E8C:"Tue",\u5468\u4E09:"Wed",\u5468\u56DB:"Thu",\u5468\u4E94:"Fri",\u5468\u516D:"Sat","\u5DE5\u4F5C\u53F0 {n}":"Workbench {n}","\u5B8C\u6210\u300C{title}\u300D":"Complete \u201C{title}\u201D"}},ee="zh";function te(e){ee=String(e||"").toLowerCase().startsWith("en")?"en":"zh"}function n(e,t){let o=(V[ee]??V.zh)[e]??V.zh[e]??e;return t?o.replace(/\{(\w+)\}/g,(r,c)=>c in t?String(t[c]):r):o}var Ce="wb/",De=15e3,L={state:null,canUndo:!1,error:null,view:"today",expandedId:null,captureKind:"idea",filter:"",toastObj:null,refreshing:!1},F=new Set;function re(){return L}function x(e){L={...L,...typeof e=="function"?e(L):e},F.forEach(t=>t())}function Ae(e){return F.add(e),()=>F.delete(e)}function g(e){return ne.default.useSyncExternalStore(Ae,()=>e(L))}async function O(e,t){let a=await fetch(Ce+e,t===void 0?{}:{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(t)}),o=await a.json().catch(()=>({}));if(!a.ok)throw new Error(o.error||`\u8BF7\u6C42\u5931\u8D25\uFF08${a.status}\uFF09`);return o}var ae=null;function R(e,{error:t=!1}={}){clearTimeout(ae),x({toastObj:{text:e,error:t,key:Date.now()}}),ae=setTimeout(()=>x({toastObj:null}),3200)}function se(e){R(e.message||String(e),{error:!0})}async function K(){try{let e=await O("state");x({state:e.state,canUndo:e.canUndo,error:null})}catch(e){x({error:e.message})}}async function S(){try{let e=await O("state");re().error?x({state:e.state,canUndo:e.canUndo,error:null}):x({state:e.state,canUndo:e.canUndo})}catch{}}async function E(e,{label:t="\u64CD\u4F5C",undoable:a=!0,silent:o=!1}={}){try{let r=await O("ops",{ops:e,label:t,undoable:a});return x({state:r.state,canUndo:r.canUndo||re().canUndo}),r.errors?.length?R(r.errors[0],{error:!0}):!o&&r.receipts?.[0]&&R(r.receipts[0].text),r}catch(r){return se(r),null}}async function oe(){try{let e=await O("undo",{});x({state:e.state,canUndo:e.canUndo,toastObj:null}),e.label&&R(n("\u5DF2\u64A4\u9500\uFF1A{label}",{label:e.label}))}catch(e){se(e)}}var le=(e,t)=>E([{op:"add_task",...e}],{label:t}),ie=(e,t,a)=>E([{op:"update_task",id:e,...t}],{label:a}),M=(e,t,a)=>E([{op:"update_task",id:e,status:t}],{label:`${t==="done"?"\u5B8C\u6210":"\u66F4\u65B0"}\u300C${(a||"").slice(0,16)}\u300D`}),ce=(e,t)=>E([{op:"delete_task",id:e}],{label:`\u5220\u9664\u300C${(t||"").slice(0,16)}\u300D`}),de=(e,t)=>E([{op:"capture_idea",text:e,note:t,source:"ui"}],{label:"\u505C\u9760\u7075\u611F"}),pe=(e,t)=>E([{op:"promote_idea",id:e,...t?{title:t}:{}}],{label:"\u7075\u611F\u8F6C\u4EFB\u52A1"}),be=e=>E([{op:"drop_idea",id:e}],{label:"\u4E22\u5F03\u7075\u611F"}),P=(e,t,a)=>E([{op:"decide_review",id:e,action:t,...a?{taskTitle:a}:{}}],{label:"\u5904\u7F6E\u9A8C\u6536"});function T(e=new Date){let t=a=>String(a).padStart(2,"0");return`${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())}`}function Z(e){let t=new Date(e);return Number.isNaN(t.getTime())?"":T(t)}function U(e,t=new Date){let a=T(t),o=s=>s.status!=="done",r=[],c=new Set,d=(s,w,v)=>{let A=v.filter(m=>c.has(m.id)?!1:(c.add(m.id),!0));A.length&&r.push({key:s,title:w,tasks:A})};d("doing","\u8FDB\u884C\u4E2D",e.tasks.filter(s=>o(s)&&s.status==="doing")),d("due","\u4ECA\u5929\u5230\u671F",e.tasks.filter(s=>o(s)&&s.due&&s.due<=a).sort((s,w)=>s.due<w.due?-1:1)),d("focus","\u7126\u70B9",e.tasks.filter(s=>o(s)&&s.focus&&s.status!=="doing"&&!(s.due&&s.due<=a)));let l=e.tasks.filter(s=>s.status==="done"&&s.completedAt&&Z(s.completedAt)===a);return{sections:r,doneToday:l,today:a}}function z(e,t=Date.now()){let a=t-Date.parse(e);return!Number.isFinite(a)||a<6e4?"\u521A\u521A":a<36e5?n("{n} \u5206\u949F\u524D",{n:Math.floor(a/6e4)}):a<864e5?n("{n} \u5C0F\u65F6\u524D",{n:Math.floor(a/36e5)}):n("{n} \u5929\u524D",{n:Math.floor(a/864e5)})}function Le(){let e=setInterval(S,De),t=()=>{document.visibilityState==="visible"&&S()};return document.addEventListener("visibilitychange",t),()=>{clearInterval(e),document.removeEventListener("visibilitychange",t)}}var H=0,W=null;function B(){return H++===0&&(W=Le()),()=>{--H>0||(H=0,W?.(),W=null)}}var Y=null,me=null;function ue({openSession:e,sessionLabel:t}={}){Y=typeof e=="function"?e:null,me=typeof t=="function"?t:null}function we(e){if(!(!e||!Y))try{Y(e)}catch{}}function C(e){if(!e)return"";try{let t=me?.(e);if(typeof t=="string"&&t)return t}catch{}return`#${e.slice(0,6)}`}var N=$(require("react"),1);var _e=4;function je(e,t){return!e||!t?[]:e.tasks.filter(a=>a.status!=="done"&&(a.origin?.sessionId===t||(a.progress??[]).some(o=>o.sessionId===t)))}function fe({sessionId:e}){let t=g(c=>c.state);N.default.useEffect(()=>(S(),B()),[]);let a=je(t,e);if(!a.length)return null;let o=a.slice(0,_e),r=a.length-o.length;return N.default.createElement("div",{className:"wb-dock"},N.default.createElement("span",{className:"wb-dock-label"},n("\u5DE5\u4F5C\u53F0 {n}",{n:a.length})),o.map(c=>N.default.createElement("span",{key:c.id,className:"wb-dock-item"},N.default.createElement("button",{type:"button",className:"wb-dock-done",title:n("\u5B8C\u6210\u300C{title}\u300D",{title:c.title}),"aria-label":n("\u5B8C\u6210\u300C{title}\u300D",{title:c.title}),onClick:()=>M(c.id,"done",c.title)},"\u2713"),N.default.createElement("span",{className:"wb-dock-title",title:c.title},c.title))),r>0?N.default.createElement("span",{className:"wb-dock-item is-more"},`+${r}`):null)}var I=$(require("react"),1);var i=$(require("react"),1);var ge={check:"M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 12-12L20.1 5.6z",plus:"M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z",trash:"M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z",undo:"M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z",refresh:"M17.6 6.4A8 8 0 1 0 19.5 14h-2.1a6 6 0 1 1-1-6.4L13 11h7V4z",inbox:"M4 4h16v10h-5a3 3 0 0 1-6 0H4zm0 12h4.6a5 5 0 0 0 6.8 0H20v4H4z",calendar:"M7 2v2H4v18h16V4h-3V2h-2v2H9V2zm-1 8h12v8H6zm2 2v2h3v-2z",flag:"M6 2v20h2v-8h9l-2-5 2-5H8V2z",star:"m12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z",chat:"M4 4h16v12H7l-3 3z",focus:"M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0-6 2 4h-4zm0 20-2-4h4zM2 12l4-2v4zm16 0 4-2v4z"};function h({name:e,size:t=16}){return i.default.createElement("svg",{viewBox:"0 0 24 24",width:t,height:t,"aria-hidden":!0,focusable:!1,style:{display:"block",fill:"currentColor"}},i.default.createElement("path",{d:ge[e]??ge.check}))}function Q({icon:e,label:t,onClick:a,danger:o=!1,disabled:r=!1}){return i.default.createElement("button",{type:"button",className:`wb-iconbtn${o?" is-danger":""}`,title:t,"aria-label":t,onClick:a,disabled:r},i.default.createElement(h,{name:e,size:16}))}function y({children:e,tone:t="plain",title:a}){return i.default.createElement("span",{className:`wb-chip is-${t}`,title:a},e)}var G={subagent:"\u5B50\u4EE3\u7406",workflow:"\u5DE5\u4F5C\u6D41",job:"\u540E\u53F0\u4EFB\u52A1"};function D({sessionId:e,label:t,title:a}){if(!e)return null;let o=t??C(e);return i.default.createElement("button",{type:"button",className:"wb-chip is-idle wb-chipbtn",title:a??`${n("\u6765\u6E90\u4F1A\u8BDD")} \xB7 ${o}`,onClick:r=>{r.stopPropagation(),we(e)}},o)}var Re={todo:"\u5F85\u529E",doing:"\u8FDB\u884C\u4E2D",blocked:"\u53D7\u963B",done:"\u5DF2\u5B8C\u6210"},Oe=["\u4F4E","\u4E2D","\u9AD8"];var Me={pending:"\u5F85\u9A8C\u6536",accepted:"\u5DF2\u9A8C\u6536",dismissed:"\u5DF2\u5FFD\u7565"},Pe={pending:"warn",accepted:"plain",dismissed:"idle"};function Ue({task:e}){let t=g(s=>s.state),a=e.progress??[],o=new Map,r=(s,w)=>{let v=o.get(s);(!v||w.at>v.at)&&o.set(s,w)};e.origin?.sessionId&&r(`s:${e.origin.sessionId}`,{at:e.createdAt,sessionId:e.origin.sessionId});for(let s of a)s.sessionId&&r(`s:${s.sessionId}`,{at:s.at,sessionId:s.sessionId}),s.actor&&r(`a:${s.actor}`,{at:s.at,actor:s.actor});let c=[...o.values()].sort((s,w)=>s.at<w.at?1:-1),d=(t?.reviews??[]).filter(s=>s.taskId===e.id).sort((s,w)=>s.createdAt<w.createdAt?1:-1).slice(0,8),l=(s,w)=>i.default.createElement("div",{className:"wb-boss-row"},i.default.createElement("span",{className:"wb-boss-label"},s),w);return i.default.createElement("div",{className:"wb-boss"},c.length?l(n("\u6267\u884C"),i.default.createElement("span",{className:"wb-boss-actors"},c.map(s=>s.sessionId?i.default.createElement(D,{key:`s:${s.sessionId}`,sessionId:s.sessionId}):i.default.createElement(y,{key:`a:${s.actor}`,tone:"idle",title:n("\u5916\u90E8\u6267\u884C\u8005")},s.actor)))):null,l(n("\u73AF\u8282"),a.length?i.default.createElement("ul",{className:"wb-timeline"},a.slice(-12).reverse().map((s,w)=>i.default.createElement("li",{key:`${s.at}-${w}`,className:"wb-timeline-item"},i.default.createElement("span",{className:"wb-timeline-note"},s.note),i.default.createElement("span",{className:"wb-meta"},s.actor??(s.sessionId?C(s.sessionId):"")," \xB7 ",z(s.at))))):i.default.createElement("span",{className:"wb-meta"},n("\u6682\u65E0\u8FDB\u5C55\u8BB0\u5F55\uFF1B\u63A5\u624B\u7684\u4F1A\u8BDD\u4F1A\u81EA\u52A8\u6C47\u62A5\u5230\u8FD9\u91CC"))),d.length?l(n("\u6302\u9760\u6267\u884C"),d.map(s=>i.default.createElement("div",{key:s.id,className:"wb-run"},i.default.createElement(y,{tone:Pe[s.status]??"idle"},n(Me[s.status]??"\u5F85\u9A8C\u6536")),i.default.createElement("span",{className:"wb-run-kind"},n(G[s.kind]??"\u540E\u53F0\u4EFB\u52A1")),i.default.createElement("span",{className:"wb-run-title",title:s.title},s.title),s.sessionId?i.default.createElement(D,{sessionId:s.sessionId}):null))):null)}function Be({task:e,close:t}){let[a,o]=i.default.useState({title:e.title,note:e.note??"",due:e.due??"",priority:e.priority,status:e.status,tags:(e.tags??[]).join(" ")}),r=l=>o(s=>({...s,...l})),c=async()=>{await ie(e.id,{title:a.title,note:a.note,due:a.due||null,priority:a.priority,status:a.status,tags:a.tags.split(/[\s,，]+/).filter(Boolean)},`\u66F4\u65B0\u300C${e.title.slice(0,16)}\u300D`),t()},d=(l,s)=>i.default.createElement("label",{className:"wb-field"},i.default.createElement("span",null,l),s);return i.default.createElement("div",{className:"wb-editor",onClick:l=>l.stopPropagation()},d(n("\u6807\u9898"),i.default.createElement("input",{value:a.title,onChange:l=>r({title:l.target.value})})),d(n("\u5907\u6CE8"),i.default.createElement("textarea",{rows:2,value:a.note,onChange:l=>r({note:l.target.value})})),i.default.createElement("div",{className:"wb-field-row"},d(n("\u622A\u6B62"),i.default.createElement("input",{type:"date",value:a.due,onChange:l=>r({due:l.target.value})})),d(n("\u4F18\u5148\u7EA7"),i.default.createElement("select",{value:a.priority,onChange:l=>r({priority:Number(l.target.value)})},[0,1,2].map(l=>i.default.createElement("option",{key:l,value:l},n(Oe[l]))))),d(n("\u72B6\u6001"),i.default.createElement("select",{value:a.status,onChange:l=>r({status:l.target.value})},["todo","doing","blocked","done"].map(l=>i.default.createElement("option",{key:l,value:l},n(Re[l])))))),d(n("\u6807\u7B7E"),i.default.createElement("input",{value:a.tags,placeholder:"\u7A7A\u683C\u5206\u9694",onChange:l=>r({tags:l.target.value})})),i.default.createElement(Ue,{task:e}),i.default.createElement("div",{className:"wb-editor-foot"},i.default.createElement("span",{className:"wb-meta"},e.origin?.sessionId?i.default.createElement(i.default.Fragment,null,`${n("\u6765\u6E90\u4F1A\u8BDD")} `,i.default.createElement(D,{sessionId:e.origin.sessionId})," \xB7 "):e.origin?.kind==="zcode"?`${n("\u6765\u81EA ZCode")} \xB7 `:"",z(e.createdAt)),i.default.createElement("span",{style:{flex:1}}),i.default.createElement("button",{type:"button",className:"wb-btn is-danger",onClick:async()=>{await ce(e.id,e.title),t()}},n("\u5220\u9664")),i.default.createElement("button",{type:"button",className:"wb-btn",onClick:t},n("\u53D6\u6D88")),i.default.createElement("button",{type:"button",className:"wb-btn is-primary",onClick:c},n("\u4FDD\u5B58"))))}function _({task:e,today:t}){let o=g(d=>d.expandedId)===e.id,r=e.status==="done",c=!r&&e.due&&e.due<t;return i.default.createElement("div",{className:`wb-task${r?" is-done":""}${o?" is-open":""}`},i.default.createElement("div",{className:"wb-task-main",role:"button",tabIndex:0,onClick:()=>x({expandedId:o?null:e.id}),onKeyDown:d=>{(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),x({expandedId:o?null:e.id}))}},i.default.createElement("button",{type:"button",className:`wb-check${r?" is-on":""}`,role:"checkbox","aria-checked":r,"aria-label":r?"\u6807\u8BB0\u4E3A\u672A\u5B8C\u6210":"\u6807\u8BB0\u4E3A\u5B8C\u6210",onClick:d=>{d.stopPropagation(),M(e.id,r?"todo":"done",e.title)}},r?i.default.createElement(h,{name:"check",size:13}):null),i.default.createElement("span",{className:"wb-task-title"},e.title),i.default.createElement("span",{className:"wb-task-meta"},e.due?i.default.createElement(y,{tone:c?"error":"plain",title:n("\u622A\u6B62")},`${c?`${n("\u903E\u671F")} `:""}${e.due.slice(5)}`):null,e.priority===2?i.default.createElement(y,{tone:"warn"},n("\u9AD8")):null,e.focus?i.default.createElement(y,{tone:"brand"},n("\u7126\u70B9")):null,e.status==="blocked"?i.default.createElement(y,{tone:"error"},n("\u53D7\u963B")):null,e.origin?.kind==="chat"&&e.origin?.sessionId?i.default.createElement(D,{sessionId:e.origin.sessionId,label:n("\u6765\u81EA\u5BF9\u8BDD"),title:`${C(e.origin.sessionId)} \xB7 ${n("\u8DF3\u8F6C\u4F1A\u8BDD")}`}):e.origin?.kind==="chat"?i.default.createElement(y,{tone:"idle"},n("\u6765\u81EA\u5BF9\u8BDD")):null,e.origin?.kind==="zcode"?i.default.createElement(y,{tone:"idle",title:n("\u6765\u81EA ZCode")},"Zcode"):null,(e.tags??[]).slice(0,3).map(d=>i.default.createElement(y,{key:d,tone:"idle"},d)))),o?i.default.createElement(Be,{task:e,close:()=>x({expandedId:null})}):null)}function k({text:e}){return i.default.createElement("p",{className:"wb-empty"},e)}function xe(){let e=g(t=>t.toastObj);return e?i.default.createElement("div",{className:`wb-toast${e.error?" is-error":""}`,key:e.key},e.text):null}var Ve=[["doing","\u8FDB\u884C\u4E2D","focus"],["todo","\u5F85\u529E","inbox"],["blocked","\u53D7\u963B","flag"],["done","\u5DF2\u5B8C\u6210","check"]];function he(){let e=g(l=>l.state),t=g(l=>l.filter),a=T(),o=t.trim().toLowerCase(),r=l=>!o||l.title.toLowerCase().includes(o)||(l.note??"").toLowerCase().includes(o)||(l.tags??[]).some(s=>s.toLowerCase().includes(o)),c=Ve.map(([l,s])=>({status:l,label:s,rows:e.tasks.filter(w=>w.status===l&&r(w))})),d=c.reduce((l,s)=>l+s.rows.length,0);return I.default.createElement("div",{className:"wb-page"},I.default.createElement("input",{className:"wb-filter",value:t,placeholder:n("\u641C\u7D22\u8FC7\u6EE4\u2026"),onChange:l=>x({filter:l.target.value})}),d===0?I.default.createElement(k,{text:n("\u4ECA\u5929\u8FD8\u6CA1\u6709\u5B89\u6392\uFF1B\u5BF9\u8BDD\u91CC\u63D0\u5230\u7684\u4E8B\u60C5\u4F1A\u81EA\u52A8\u767B\u8BB0\u8FDB\u6765")}):null,c.filter(l=>l.rows.length).map(l=>I.default.createElement("section",{key:l.status,className:"wb-section"},I.default.createElement("h3",null,n(l.label),I.default.createElement("span",{className:"wb-count"},l.rows.length)),l.rows.map(s=>I.default.createElement(_,{key:s.id,task:s,today:a})))))}var p=$(require("react"),1);function He({review:e}){let[t,a]=p.default.useState(!1),o=g(c=>c.state),r=e.taskId?o?.tasks?.find(c=>c.id===e.taskId):void 0;return p.default.createElement("div",{className:`wb-review${t?" is-open":""}`},p.default.createElement("div",{className:"wb-review-main",role:"button",tabIndex:0,onClick:()=>a(!t),onKeyDown:c=>{(c.key==="Enter"||c.key===" ")&&(c.preventDefault(),a(!t))}},p.default.createElement("span",{className:"wb-kind"},n(G[e.kind]??"\u540E\u53F0\u4EFB\u52A1")),p.default.createElement("span",{className:"wb-review-title"},e.title),p.default.createElement("span",{className:"wb-meta"},z(e.createdAt)),e.sessionId?p.default.createElement(D,{sessionId:e.sessionId,title:`${C(e.sessionId)} \xB7 ${n("\u8DF3\u8F6C\u4F1A\u8BDD")}`}):null),t&&(e.summary||r)?p.default.createElement("div",{className:"wb-review-detail"},r?p.default.createElement("p",{className:"wb-review-task"},`${n("\u6302\u9760\u4EFB\u52A1")}\uFF1A${r.title}`):null,e.summary?p.default.createElement("p",{className:"wb-review-summary"},e.summary):null):null,p.default.createElement("div",{className:"wb-review-actions"},p.default.createElement("button",{type:"button",className:"wb-btn",onClick:()=>P(e.id,"accept")},n("\u9A8C\u6536")),p.default.createElement("button",{type:"button",className:"wb-btn",onClick:()=>P(e.id,"promote")},n("\u8F6C\u4EFB\u52A1")),p.default.createElement("button",{type:"button",className:"wb-btn is-ghost",onClick:()=>P(e.id,"dismiss")},n("\u5FFD\u7565"))))}function We({idea:e}){let[t,a]=p.default.useState(!1);return p.default.createElement("div",{className:"wb-idea"},p.default.createElement("div",{className:"wb-idea-main",role:"button",tabIndex:0,onClick:()=>a(!t),onKeyDown:o=>{o.key==="Enter"&&a(!t)}},p.default.createElement(h,{name:"chat",size:13}),p.default.createElement("span",{className:"wb-idea-text"},e.text),p.default.createElement("span",{className:"wb-meta"},z(e.createdAt),e.source==="chat"?` \xB7 ${n("\u6765\u81EA\u5BF9\u8BDD")}`:"")),t&&e.note?p.default.createElement("p",{className:"wb-idea-note"},e.note):null,p.default.createElement("div",{className:"wb-review-actions"},p.default.createElement("button",{type:"button",className:"wb-btn",onClick:()=>pe(e.id)},n("\u8F6C\u4EFB\u52A1")),p.default.createElement("button",{type:"button",className:"wb-btn is-ghost",onClick:()=>be(e.id)},n("\u5FFD\u7565"))))}function ye(){let e=g(o=>o.state),t=e.reviews.filter(o=>o.status==="pending").sort((o,r)=>o.createdAt<r.createdAt?-1:1),a=e.ideas.filter(o=>o.status==="parked");return p.default.createElement("div",{className:"wb-page"},p.default.createElement("section",{className:"wb-section"},p.default.createElement("h3",null,p.default.createElement(h,{name:"inbox",size:14}),n("\u5F85\u9A8C\u6536"),t.length?p.default.createElement(y,{tone:"warn"},t.length):null),t.length?t.map(o=>p.default.createElement(He,{key:o.id,review:o})):p.default.createElement(k,{text:n("\u6CA1\u6709\u5F85\u9A8C\u6536\uFF0C\u5E76\u884C\u4EFB\u52A1\u7684\u7ED3\u679C\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u51FA\u73B0\u5728\u8FD9\u91CC")})),p.default.createElement("section",{className:"wb-section"},p.default.createElement("h3",null,p.default.createElement(h,{name:"star",size:14}),n("\u7075\u611F"),a.length?p.default.createElement(y,{tone:"idle"},a.length):null),a.length?a.map(o=>p.default.createElement(We,{key:o.id,idea:o})):p.default.createElement(k,{text:n("\u7075\u611F\u6536\u4EF6\u7BB1\u662F\u7A7A\u7684")})))}var b=$(require("react"),1);var Fe=["\u5468\u65E5","\u5468\u4E00","\u5468\u4E8C","\u5468\u4E09","\u5468\u56DB","\u5468\u4E94","\u5468\u516D"],Ke={doing:"focus",due:"calendar",focus:"star"};function Ze({state:e}){let[t,a]=b.default.useState(!1),o=new Date,r=T(o),c=T(new Date(o.getTime()-864e5)),d=e.tasks.filter(u=>u.status==="done"&&u.completedAt&&Z(u.completedAt)===c),l=e.tasks.filter(u=>u.status!=="done"&&u.due&&u.due<=r),s=e.tasks.filter(u=>u.status==="blocked"),w=e.reviews.filter(u=>u.status==="pending"),v=e.ideas.filter(u=>u.status==="parked").length;if(!(d.length||l.length||s.length||w.length))return null;let m=[`${n("\u6628\u65E5\u5B8C\u6210")} ${d.length}`,`${n("\u4ECA\u5929\u5230\u671F")} ${l.length}`,s.length?`${n("\u53D7\u963B")} ${s.length}`:"",w.length?`${n("\u5F85\u9A8C\u6536")} ${w.length}`:"",v?`${n("\u7075\u611F")} ${v}`:""].filter(Boolean).join(" \xB7 ");return b.default.createElement("div",{className:"wb-brief"},b.default.createElement("div",{className:"wb-brief-head",role:"button",tabIndex:0,onClick:()=>a(!t),onKeyDown:u=>{(u.key==="Enter"||u.key===" ")&&(u.preventDefault(),a(!t))}},b.default.createElement(h,{name:"calendar",size:13}),b.default.createElement("span",{className:"wb-brief-date"},`${r.slice(5)} ${n(Fe[o.getDay()])}`),b.default.createElement("span",{className:"wb-brief-summary"},m),b.default.createElement("span",{className:"wb-count"},t?"\u2212":"+")),t?b.default.createElement("div",{className:"wb-brief-body"},d.length?b.default.createElement("p",null,`${n("\u6628\u65E5\u5B8C\u6210")} ${d.length}\uFF1A`,d.map(u=>u.title).join("\uFF1B")):null,l.length?b.default.createElement("p",null,`${n("\u4ECA\u5929\u5230\u671F")} ${l.length}\uFF1A`,l.map(u=>`${u.title}${u.due<r?n("\uFF08\u903E\u671F\uFF09"):""}`).join("\uFF1B")):null,s.length?b.default.createElement("p",{className:"is-warn"},`${n("\u53D7\u963B")} ${s.length}\uFF1A`,s.map(u=>u.title).join("\uFF1B")):null,w.length?b.default.createElement("p",null,`${n("\u5F85\u9A8C\u6536")} ${w.length}`):null):null)}function Ye(){let e=g(r=>r.captureKind),[t,a]=b.default.useState(""),o=async r=>{r.preventDefault();let c=t.trim();c&&(a(""),e==="task"?await le({title:c,status:"todo"},`\u65B0\u5EFA\u300C${c.slice(0,16)}\u300D`):await de(c))};return b.default.createElement("form",{className:"wb-capture",onSubmit:o},b.default.createElement("input",{value:t,onChange:r=>a(r.target.value),"aria-label":n("\u8BB0\u4E00\u53E5\u8BDD\uFF0C\u56DE\u8F66\u6536\u8FDB\u7075\u611F\u6536\u4EF6\u7BB1"),placeholder:n("\u8BB0\u4E00\u53E5\u8BDD\uFF0C\u56DE\u8F66\u6536\u8FDB\u7075\u611F\u6536\u4EF6\u7BB1")}),b.default.createElement("div",{className:"wb-capture-kind",role:"tablist"},["idea","task"].map(r=>b.default.createElement("button",{key:r,type:"button",role:"tab","aria-selected":e===r,className:e===r?"is-on":"",onClick:()=>x({captureKind:r})},n(r==="idea"?"\u7075\u611F":"\u4EFB\u52A1")))),b.default.createElement("button",{type:"submit",className:"wb-btn is-primary",disabled:!t.trim()},n(e==="idea"?"\u6536\u8FDB\u6536\u4EF6\u7BB1":"\u76F4\u63A5\u5EFA\u4EFB\u52A1")))}function J(){let e=g(d=>d.state),[t,a]=b.default.useState(!1),{sections:o,doneToday:r,today:c}=U(e);return b.default.createElement("div",{className:"wb-page"},b.default.createElement(Ze,{state:e}),b.default.createElement(Ye,null),o.length===0&&!r.length?b.default.createElement(k,{text:n("\u4ECA\u5929\u8FD8\u6CA1\u6709\u5B89\u6392\uFF1B\u5BF9\u8BDD\u91CC\u63D0\u5230\u7684\u4E8B\u60C5\u4F1A\u81EA\u52A8\u767B\u8BB0\u8FDB\u6765")}):null,o.map(d=>b.default.createElement("section",{key:d.key,className:"wb-section"},b.default.createElement("h3",null,b.default.createElement(h,{name:Ke[d.key]??"calendar",size:14}),n(d.title),b.default.createElement("span",{className:"wb-count"},d.tasks.length)),d.tasks.map(l=>b.default.createElement(_,{key:l.id,task:l,today:c})))),r.length?b.default.createElement("section",{className:"wb-section"},b.default.createElement("h3",{onClick:()=>a(!t),style:{cursor:"pointer"}},b.default.createElement(h,{name:"check",size:14}),n("\u4ECA\u65E5\u5B8C\u6210 {n} \u4EF6",{n:r.length}),b.default.createElement("span",{className:"wb-count"},t?"\u2212":"+")),t?r.map(d=>b.default.createElement(_,{key:d.id,task:d,today:c})):null):null)}var ve="workbench",Qe={today:J,all:he,inbox:ye},Ge=[["today","\u4ECA\u5929","calendar"],["all","\u5168\u90E8","inbox"],["inbox","\u6536\u4EF6\u7BB1","star"]];function Je(){let e=g(m=>!!m.state),t=g(m=>m.error),a=g(m=>m.view),o=g(m=>m.canUndo),r=g(m=>m.state);f.default.useEffect(()=>(K(),B()),[]);let c=r?.reviews?.filter(m=>m.status==="pending").length??0,d=r?.ideas?.filter(m=>m.status==="parked").length??0,{sections:l,doneToday:s,today:w}=r?U(r):{sections:[],doneToday:[],today:""},v=l.reduce((m,u)=>m+u.tasks.length,0),A=Qe[a]??J;return f.default.createElement("div",{className:"wb-root"},f.default.createElement("style",null,q),f.default.createElement("header",{className:"wb-topbar"},f.default.createElement("span",{className:"wb-title"},f.default.createElement(h,{name:"check",size:15}),n("\u4E2A\u4EBA\u5DE5\u4F5C\u53F0")),f.default.createElement("nav",{className:"wb-nav","aria-label":n("\u5DE5\u4F5C\u53F0\u9762\u677F")},Ge.map(([m,u])=>f.default.createElement("button",{key:m,type:"button",className:a===m?"is-on":"","aria-current":a===m?"page":void 0,onClick:()=>x({view:m,expandedId:null})},n(u),m==="today"&&v?f.default.createElement("i",{className:"wb-badge"},v):null,m==="inbox"&&c?f.default.createElement("i",{className:"wb-badge is-warn"},c):null))),f.default.createElement("span",{style:{flex:1}}),o?f.default.createElement(Q,{icon:"undo",label:n("\u64A4\u9500"),onClick:oe}):null,f.default.createElement(Q,{icon:"refresh",label:n("\u5237\u65B0"),onClick:S})),f.default.createElement("div",{className:"wb-strip"},`${n("\u4ECA\u5929")} ${v} \xB7 ${n("\u8FDB\u884C\u4E2D")} ${r?.tasks?.filter(m=>m.status==="doing").length??0} \xB7 ${n("\u4ECA\u65E5\u5B8C\u6210 {n} \u4EF6",{n:s.length})}`+(c?` \xB7 ${n("\u5F85\u9A8C\u6536")} ${c}`:"")+(d?` \xB7 ${n("\u7075\u611F")} ${d}`:"")),f.default.createElement("main",{className:"wb-content"},t&&!r?f.default.createElement("div",{className:"wb-page"},f.default.createElement("p",{className:"wb-empty"},n("\u5DE5\u4F5C\u53F0\u52A0\u8F7D\u5931\u8D25\uFF1A{error}",{error:t})),f.default.createElement("button",{type:"button",className:"wb-btn",onClick:K},n("\u91CD\u8BD5"))):e?f.default.createElement(A,null):f.default.createElement(k,{text:n("\u52A0\u8F7D\u4E2D\u2026")})),f.default.createElement(xe,null))}function Xe({size:e}){return f.default.createElement(h,{name:"inbox",size:e})}var qe=["slots"];function et(e){ue({openSession:o=>{try{let r=(typeof e.get=="function"?e.get("uiWorkspace"):void 0)||(typeof e.uiWorkspace=="object"?e.uiWorkspace:void 0);if(r&&typeof r.openSession=="function"){r.openSession(o);return}console.warn("[dsh-workbench] uiWorkspace \u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u8DF3\u8F6C\u4F1A\u8BDD")}catch(r){console.warn("[dsh-workbench] \u8DF3\u8F6C\u4F1A\u8BDD\u5931\u8D25\uFF1A",r)}},sessionLabel:o=>{try{let c=(typeof e.get=="function"?e.get("sessions"):void 0)?.list?.getSnapshot?.()?.byId?.[o];return typeof c?.displayTitle=="string"?c.displayTitle:typeof c?.title=="string"?c.title:""}catch{return""}}}),e.slots.inject("main",()=>e.slots.register({name:"main",key:ve},Je)),e.slots.inject("conversation.input.dock",()=>e.slots.register({name:"conversation.input.dock",id:"workbench-open",order:30,inject:o=>({sessionId:String(o??"")})},fe)),e.effect(()=>{let o=null;(()=>{o?.(),o=e.slots.inject("sidebar.panellist",()=>e.slots.register({name:"sidebar.panellist",id:ve,order:5,label:()=>n("\u4E2A\u4EBA\u5DE5\u4F5C\u53F0")},Xe))})();try{let c=e.get("locale");if(c&&typeof c.getLocale=="function"){let d=c.getLocale();te(d?.id??d)}}catch{}return()=>{o?.()}},"dsh-workbench: sidebar entry")}
return module.exports}})
