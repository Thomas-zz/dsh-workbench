window.__ModuleLoader__.load({id:"dsh-workbench",factory:(require)=>{const module={exports:{}};const exports=module.exports;
var lt=Object.create;var ae=Object.defineProperty;var dt=Object.getOwnPropertyDescriptor;var pt=Object.getOwnPropertyNames;var ct=Object.getPrototypeOf,bt=Object.prototype.hasOwnProperty;var ut=(e,a)=>{for(var n in a)ae(e,n,{get:a[n],enumerable:!0})},ve=(e,a,n,i)=>{if(a&&typeof a=="object"||typeof a=="function")for(let r of pt(a))!bt.call(e,r)&&r!==n&&ae(e,r,{get:()=>a[r],enumerable:!(i=dt(a,r))||i.enumerable});return e};var q=(e,a,n)=>(n=e!=null?lt(ct(e)):{},ve(a||!e||!e.__esModule?ae(n,"default",{value:e,enumerable:!0}):n,e)),mt=e=>ve(ae({},"__esModule",{value:!0}),e);var Yt={};ut(Yt,{apply:()=>Kt,inject:()=>Ft});module.exports=mt(Yt);var S=q(require("react"),1);var ne=`/* \u4E2A\u4EBA\u5DE5\u4F5C\u53F0\u6837\u5F0F\uFF1A\u53EA\u7528\u5BBF\u4E3B --dsw-alias-* \u4E3B\u9898 token\uFF0C\u8DDF\u968F\u660E\u6697\u4E3B\u9898\u3002 */

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

/* \u2014\u2014 \u4F1A\u8BDD\u5185\u6D6E\u52A8\u5361\u7247\uFF08\u951A\u5B9A\u6D88\u606F\u533A\u5DE6\u4E0A\u89D2\uFF09\u2014\u2014 */
.wb-float {
  position: fixed;
  z-index: 60;
  display: flex;
  flex-direction: column;
  min-width: 170px;
  max-width: 260px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.wb-float.is-collapsed { min-width: 0; max-width: 150px; }

.wb-float-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.wb-float-label {
  flex: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--dsw-alias-brand-primary);
  white-space: nowrap;
}

.wb-float-chevron { margin-left: auto; font-size: 10px; color: var(--dsw-alias-label-secondary); }

.wb-float-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
  padding: 6px 10px 8px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}

.wb-float-row { display: flex; align-items: center; gap: 6px; min-width: 0; }

.wb-float-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--dsw-alias-label-primary); }

.wb-float-more { font-size: 11px; color: var(--dsw-alias-label-secondary); }

/* \u2014\u2014 \u4F1A\u8BDD\u5185\u505C\u9760\u6761\uFF08\u627E\u4E0D\u5230\u951A\u70B9\u65F6\u7684\u9000\u5316\u5F62\u6001\uFF09\u2014\u2014 */
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

/* \u2014\u2014 \u5DE5\u4F5C\u53F0\uFF1A\u66F4\u660E\u786E\u7684\u9875\u9762\u4E0E\u5F85\u529E\u5C42\u7EA7 \u2014\u2014 */
.wb-root { font-family: 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.wb-topbar { padding: 14px 22px; gap: 18px; }
.wb-title { font-size: 15px; letter-spacing: .01em; }
.wb-nav { gap: 4px; padding: 4px; border-radius: 11px; }
.wb-nav button { padding: 6px 14px; border-radius: 8px; font-weight: 600; }
.wb-strip { padding: 8px 24px; }
.wb-content { padding: 26px 28px 54px; }
.wb-page { max-width: 850px; gap: 22px; }
.wb-section { gap: 8px; }
.wb-section h3 { margin: 0 0 6px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
.wb-task { border-radius: 12px; transition: border-color .18s, box-shadow .18s, transform .18s; }
.wb-task:hover { border-color: var(--dsw-alias-border-l2); box-shadow: 0 6px 22px rgba(0,0,0,.06); transform: translateY(-1px); }
.wb-task-main { min-height: 52px; padding: 10px 15px; gap: 12px; }
.wb-task-main:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 5%, var(--dsw-alias-bg-layer-1)); }
.wb-check { width: 20px; height: 20px; border-radius: 7px; }
.wb-task-title { font-size: 13px; font-weight: 560; }
.wb-task-meta { max-width: 50%; }
.wb-btn { min-height: 30px; border-radius: 8px; font-weight: 600; }

/* \u2014\u2014 \u5B66\u4E60\u5BA4\uFF1A\u9605\u8BFB\u548C\u590D\u4E60\u4F18\u5148 \u2014\u2014 */
.wb-study-page { max-width: 1120px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
.wb-study-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 26px 30px; border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 24%, var(--dsw-alias-border-l1)); border-radius: 18px; background: linear-gradient(125deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, var(--dsw-alias-bg-layer-1)), var(--dsw-alias-bg-layer-1) 65%); }
.wb-study-eyebrow { display: block; margin-bottom: 7px; color: var(--dsw-alias-brand-primary); font-size: 10px; font-weight: 800; letter-spacing: .18em; }
.wb-study-hero h1 { margin: 0; font-size: clamp(20px, 3vw, 28px); font-weight: 700; letter-spacing: -.035em; line-height: 1.25; }
.wb-study-hero p { margin: 10px 0 0; color: var(--dsw-alias-label-secondary); line-height: 1.65; }
.wb-study-hero-actions { display: flex; gap: 8px; flex: none; }
.wb-study-overview { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); border: 1px solid var(--dsw-alias-border-l1); border-radius: 14px; background: var(--dsw-alias-bg-layer-1); overflow: hidden; }
.wb-study-overview > div { display: flex; flex-direction: column; gap: 1px; padding: 16px 20px; border-right: 1px solid var(--dsw-alias-border-l1); }
.wb-study-overview > div:last-child { border-right: 0; }
.wb-study-overview strong { font-size: 27px; line-height: 1.1; font-weight: 650; font-variant-numeric: tabular-nums; }
.wb-study-overview span { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.wb-study-location { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; margin-top: -13px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.wb-study-location strong { font-weight: 550; color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; }
.wb-study-capture { display: flex; gap: 12px; align-items: center; padding: 8px 10px 8px 17px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); }
.wb-study-capture > span { color: var(--dsw-alias-brand-primary); font-size: 24px; font-weight: 300; }
.wb-study-capture input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; }
.wb-study-section { display: flex; flex-direction: column; gap: 14px; }
.wb-study-section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 15px; }
.wb-study-section-head h2 { margin: 0; font-size: 18px; line-height: 1.25; }
.wb-study-section-head h2 em { font-size: 12px; font-style: normal; font-weight: 500; color: var(--dsw-alias-label-secondary); }
.wb-study-section-head .wb-filter { width: min(270px, 45%); }
.wb-study-tabs { display: flex; gap: 20px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.wb-study-tabs button { padding: 5px 1px 11px; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--dsw-alias-label-secondary); font: inherit; font-weight: 600; cursor: pointer; }
.wb-study-tabs button.is-on { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); }
.wb-study-tabs span { font-size: 10px; margin-left: 4px; color: var(--dsw-alias-label-secondary); }
.wb-study-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
.wb-study-card { min-width: 0; display: flex; flex-direction: column; gap: 10px; padding: 20px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 14px; background: var(--dsw-alias-bg-layer-1); box-shadow: 0 5px 20px rgba(0,0,0,.035); }
.wb-study-card.is-quiet { opacity: .74; }
.wb-study-card-top { display: flex; gap: 8px; align-items: center; min-width: 0; }
.wb-study-kind { padding: 3px 8px; border-radius: 5px; background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); color: var(--dsw-alias-brand-primary); font-size: 10px; font-weight: 700; }
.wb-study-kind.is-weak { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 15%, transparent); color: var(--dsw-alias-state-warn-primary); }
.wb-study-source { color: var(--dsw-alias-label-secondary); font-size: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.wb-study-due { margin-left: auto; color: var(--dsw-alias-brand-primary); font-size: 10px; font-weight: 700; white-space: nowrap; }
.wb-study-card h3 { margin: 2px 0 0; font-size: 17px; line-height: 1.4; }
.wb-study-question { margin: 0; line-height: 1.65; color: var(--dsw-alias-label-secondary); }
.wb-study-answer { padding: 14px 16px; border-left: 3px solid var(--dsw-alias-brand-primary); border-radius: 0 8px 8px 0; background: var(--dsw-alias-bg-layer-2); }
.wb-study-answer p { margin: 5px 0 0; line-height: 1.75; white-space: pre-wrap; }
.wb-study-answer .wb-study-why { margin-top: 12px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.wb-study-kicker { color: var(--dsw-alias-brand-primary); font-size: 11px; font-weight: 700; }
.wb-study-card-foot { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin-top: auto; padding-top: 5px; }
.wb-study-spacer { flex: 1; }
.wb-study-empty { padding: 40px 20px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 14px; text-align: center; color: var(--dsw-alias-label-secondary); }
.wb-study-empty strong { color: var(--dsw-alias-label-primary); font-size: 15px; }
.wb-study-empty p { margin: 8px 0 0; }
.wb-study-inbox { border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); overflow: hidden; }
.wb-study-inbox-item { display: flex; align-items: center; gap: 12px; padding: 12px 15px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.wb-study-inbox-item:last-child { border-bottom: 0; }
.wb-study-inbox-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--dsw-alias-brand-primary); }
.wb-study-inbox-item > div { flex: 1; min-width: 0; }
.wb-study-inbox-item strong { display: block; font-weight: 550; }
.wb-study-inbox-item small, .wb-study-inbox-item > span:not(.wb-study-inbox-dot) { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.wb-study-settings { padding: 20px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 14px; background: var(--dsw-alias-bg-layer-1); display: flex; flex-direction: column; gap: 18px; }
.wb-study-settings-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 15px; }
.wb-study-settings .wb-field small { font-size: 10px; color: var(--dsw-alias-label-secondary); }
.wb-study-switch, .wb-study-source-options label { display: flex; gap: 6px; align-items: center; cursor: pointer; }
.wb-study-source-options { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; }
.wb-study-source-options > span { color: var(--dsw-alias-label-secondary); }
.wb-study-settings-foot { display: flex; align-items: center; justify-content: space-between; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.wb-study-candidates { padding: 14px 18px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); }
.wb-study-candidates summary { cursor: pointer; font-weight: 600; }
.wb-study-candidates summary span { margin-left: 5px; color: var(--dsw-alias-brand-primary); }
.wb-study-candidates summary small { margin-left: 10px; font-size: 11px; color: var(--dsw-alias-label-secondary); font-weight: 400; }
.wb-study-candidates ul { list-style: none; margin: 12px 0 0; padding: 0; }
.wb-study-candidates li { display: flex; gap: 12px; padding: 9px 0; border-top: 1px solid var(--dsw-alias-border-l1); }
.wb-study-candidates li b { flex: none; width: 74px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.wb-study-candidates li span { line-height: 1.6; }
@media (max-width: 760px) { .wb-content { padding: 16px 13px 40px; } .wb-topbar { padding: 10px 12px; gap: 7px; } .wb-title { display: none; } .wb-nav button { padding: 6px 9px; } .wb-study-hero { padding: 20px; flex-direction: column; align-items: stretch; } .wb-study-overview { grid-template-columns: repeat(2,minmax(0,1fr)); } .wb-study-overview > div:nth-child(2) { border-right: 0; } .wb-study-overview > div:nth-child(-n+2) { border-bottom: 1px solid var(--dsw-alias-border-l1); } .wb-study-grid, .wb-study-settings-grid { grid-template-columns: 1fr; } .wb-study-section-head { align-items: stretch; flex-direction: column; } .wb-study-section-head .wb-filter { width: 100%; } .wb-task-meta { max-width: 42%; } }

/* \u5B66\u4E60\u7F51\u7EDC\uFF1A\u5DE6\u4FA7\u95EE\u9898\u8109\u7EDC\u3001\u53F3\u4FA7\u9605\u8BFB\u4E0E\u8FFD\u95EE\uFF0C\u590D\u7528\u5BBF\u4E3B\u4E3B\u9898\u3002 */
.wb-learning-header { display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0 16px; }
.wb-learning-header h1 { font-size:22px;margin:0 0 6px;letter-spacing:-.02em; }
.wb-learning-header p { margin:0;color:var(--dsw-alias-label-secondary); }
.wb-learning-header > div:last-child { display:flex;gap:8px;flex-shrink:0; }
.wb-learning-workspace { display:grid;grid-template-columns:minmax(220px,29%) minmax(0,1fr);border-top:1px solid var(--dsw-alias-border-l1);min-height:380px; }
.wb-learning-outline { padding:20px 16px 20px 0;border-right:1px solid var(--dsw-alias-border-l1);min-width:0; }
.wb-learning-outline .wb-filter { width:100%;box-sizing:border-box; }
.wb-learning-outline > p { font-size:12px;color:var(--dsw-alias-label-secondary); }
.wb-learning-outline ul { list-style:none;padding:0;margin:0; }
.wb-learning-outline ul ul { margin-left:10px;padding-left:10px;border-left:1px solid var(--dsw-alias-border-l1); }
.wb-branch-row { width:100%;display:flex;gap:9px;text-align:left;align-items:flex-start;padding:10px 8px;background:transparent;border:0;border-radius:6px;color:inherit;font:inherit;cursor:pointer; }
.wb-branch-row:hover,.wb-branch-row.is-selected { background:var(--dsw-alias-bg-layer-2); }
.wb-branch-row.is-selected { color:var(--dsw-alias-brand-primary);font-weight:600; }
.wb-branch-row span:last-child { min-width:0;overflow-wrap:anywhere; }
.wb-branch-row small { display:block;font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary);margin-top:3px; }
.wb-branch-dot { width:6px;height:6px;border:1px solid currentColor;border-radius:50%;margin-top:6px;flex-shrink:0; }
.wb-branch-dot.is-suggested { border-style:dashed; }
.wb-learning-outline summary { font-size:11px;cursor:pointer;color:var(--dsw-alias-label-secondary);padding:3px 8px 8px; }
.wb-knowledge-detail { padding:24px 0 24px 28px;min-width:0; }
.wb-knowledge-detail h2 { font-size:22px;line-height:1.4;margin:10px 0 18px;overflow-wrap:anywhere; }
.wb-knowledge-path { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;font-size:12px;color:var(--dsw-alias-label-secondary); }
.wb-knowledge-heading { display:flex;justify-content:space-between;gap:12px;font-size:12px;color:var(--dsw-alias-label-secondary); }
.wb-knowledge-question { white-space:pre-wrap;font-weight:500;margin:0 0 20px;overflow-wrap:anywhere; }
.wb-learning-prose { white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.85;max-width:75ch;user-select:text;font-size:14px; }
.wb-learning-prose h3 { font-size:16px;margin:18px 0 8px; }
.wb-learning-evidence { padding:12px;background:var(--dsw-alias-bg-layer-1);border-radius:6px;line-height:1.7; }
.wb-knowledge-actions { display:flex;flex-wrap:wrap;gap:8px;margin:20px 0; }
.wb-learning-followup { margin:24px 0;padding:18px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px; }
.wb-learning-followup > label { font-size:15px;font-weight:600; }
.wb-learning-followup p,.wb-learning-followup small { color:var(--dsw-alias-label-secondary);font-size:12px; }
.wb-learning-followup textarea { width:100%;min-height:84px;box-sizing:border-box;resize:vertical;padding:10px;color:inherit;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;font:inherit; }
.wb-learning-followup > div:last-child { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px; }
.wb-learning-quote blockquote { margin:10px 0;padding:8px 0;white-space:pre-wrap; }
.wb-learning-links { margin:24px 0; }
.wb-learning-links h3 { font-size:14px;margin:0 0 10px; }
.wb-learning-links > button { width:100%;display:flex;justify-content:space-between;gap:8px;text-align:left;border:0;border-bottom:1px solid var(--dsw-alias-border-l1);background:transparent;color:inherit;font:inherit;cursor:pointer;padding:12px 0; }
.wb-learning-links > button:hover { color:var(--dsw-alias-brand-primary); }
.wb-learning-storage { border-top:1px solid var(--dsw-alias-border-l1);padding-top:15px;font-size:12px;overflow-wrap:anywhere; }
.wb-learning-storage summary { cursor:pointer;color:var(--dsw-alias-label-secondary); }
.wb-learning-storage button { margin:4px 6px 10px 0; }
.wb-text-link { display:inline;border:0;background:transparent;color:var(--dsw-alias-brand-primary);padding:0;font:inherit;cursor:pointer;text-align:left;text-decoration:underline;text-underline-offset:3px; }
.wb-learning-reports { display:grid;grid-template-columns:180px minmax(0,1fr);gap:24px;padding:20px 0; }
.wb-learning-report-list { display:flex;flex-direction:column;gap:8px;align-items:stretch; }
.wb-learning-report-list h2 { font-size:16px;margin:0 0 8px; }
.wb-learning-empty-answer { color:var(--dsw-alias-label-secondary);padding:18px 0; }
.wb-branch-row:focus-visible,.wb-text-link:focus-visible,.wb-learning-links button:focus-visible { outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px; }
@media(max-width:760px) {
 .wb-learning-workspace,.wb-learning-reports { grid-template-columns:1fr; }
 .wb-learning-outline { border-right:0;border-bottom:1px solid var(--dsw-alias-border-l1);max-height:280px;overflow:auto;padding:16px 0; }
 .wb-knowledge-detail { padding:20px 0; }
 .wb-learning-header { align-items:flex-start;flex-wrap:wrap; }
 .wb-learning-followup > div:last-child { align-items:flex-start;flex-direction:column; }
 .wb-learning-report-list { flex-direction:row;flex-wrap:wrap; }
 .wb-study-tabs { flex-wrap:wrap; }
}
`;var ze=q(require("react"),1);var de={zh:{\u5DE5\u4F5C\u53F0:"\u5DE5\u4F5C\u53F0",\u4ECA\u5929:"\u4ECA\u5929",\u5168\u90E8:"\u5168\u90E8",\u6536\u4EF6\u7BB1:"\u6536\u4EF6\u7BB1","\u8BB0\u4E00\u53E5\u8BDD\uFF0C\u56DE\u8F66\u6536\u8FDB\u7075\u611F\u6536\u4EF6\u7BB1":"\u8BB0\u4E00\u53E5\u8BDD\uFF0C\u56DE\u8F66\u6536\u8FDB\u7075\u611F\u6536\u4EF6\u7BB1",\u7075\u611F:"\u7075\u611F",\u4EFB\u52A1:"\u4EFB\u52A1",\u6536\u8FDB\u6536\u4EF6\u7BB1:"\u6536\u8FDB\u6536\u4EF6\u7BB1",\u76F4\u63A5\u5EFA\u4EFB\u52A1:"\u76F4\u63A5\u5EFA\u4EFB\u52A1",\u8FDB\u884C\u4E2D:"\u8FDB\u884C\u4E2D",\u4ECA\u5929\u5230\u671F:"\u4ECA\u5929\u5230\u671F",\u903E\u671F:"\u903E\u671F",\u7126\u70B9:"\u7126\u70B9","\u4ECA\u65E5\u5B8C\u6210 {n} \u4EF6":"\u4ECA\u65E5\u5B8C\u6210 {n} \u4EF6",\u5F85\u529E:"\u5F85\u529E",\u53D7\u963B:"\u53D7\u963B",\u5DF2\u5B8C\u6210:"\u5DF2\u5B8C\u6210",\u5F85\u9A8C\u6536:"\u5F85\u9A8C\u6536",\u9A8C\u6536:"\u9A8C\u6536",\u5FFD\u7565:"\u5FFD\u7565",\u8F6C\u4EFB\u52A1:"\u8F6C\u4EFB\u52A1",\u5B50\u4EE3\u7406:"\u5B50\u4EE3\u7406",\u5DE5\u4F5C\u6D41:"\u5DE5\u4F5C\u6D41",\u540E\u53F0\u4EFB\u52A1:"\u540E\u53F0\u4EFB\u52A1","\u5DF2\u505C\u9760\u7075\u611F\u300C{text}\u300D":"\u5DF2\u505C\u9760\u7075\u611F\u300C{text}\u300D",\u5DF2\u4E22\u5F03\u7075\u611F:"\u5DF2\u4E22\u5F03\u7075\u611F","\u7075\u611F\u5DF2\u8F6C\u4E3A\u4EFB\u52A1\u300C{title}\u300D":"\u7075\u611F\u5DF2\u8F6C\u4E3A\u4EFB\u52A1\u300C{title}\u300D","\u9A8C\u6536\u5B8C\u6210\uFF0C\u5269\u4F59 {n} \u6761":"\u9A8C\u6536\u5B8C\u6210\uFF0C\u5269\u4F59 {n} \u6761",\u6807\u9898:"\u6807\u9898",\u5907\u6CE8:"\u5907\u6CE8",\u622A\u6B62:"\u622A\u6B62",\u4F18\u5148\u7EA7:"\u4F18\u5148\u7EA7",\u4F4E:"\u4F4E",\u4E2D:"\u4E2D",\u9AD8:"\u9AD8",\u72B6\u6001:"\u72B6\u6001",\u6807\u7B7E:"\u6807\u7B7E",\u4ECA\u5929\u7126\u70B9:"\u4ECA\u5929\u7126\u70B9",\u5220\u9664:"\u5220\u9664",\u4FDD\u5B58:"\u4FDD\u5B58",\u53D6\u6D88:"\u53D6\u6D88",\u7F16\u8F91\u4EFB\u52A1:"\u7F16\u8F91\u4EFB\u52A1",\u6765\u6E90\u4F1A\u8BDD:"\u6765\u6E90\u4F1A\u8BDD",\u7075\u611F\u6536\u4EF6\u7BB1\u662F\u7A7A\u7684:"\u7075\u611F\u6536\u4EF6\u7BB1\u662F\u7A7A\u7684","\u6CA1\u6709\u5F85\u9A8C\u6536\uFF0C\u5E76\u884C\u4EFB\u52A1\u7684\u7ED3\u679C\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u51FA\u73B0\u5728\u8FD9\u91CC":"\u6CA1\u6709\u5F85\u9A8C\u6536\uFF0C\u5E76\u884C\u4EFB\u52A1\u7684\u7ED3\u679C\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u51FA\u73B0\u5728\u8FD9\u91CC","\u4ECA\u5929\u8FD8\u6CA1\u6709\u5B89\u6392\uFF1B\u5BF9\u8BDD\u91CC\u63D0\u5230\u7684\u4E8B\u60C5\u4F1A\u81EA\u52A8\u767B\u8BB0\u8FDB\u6765":"\u4ECA\u5929\u8FD8\u6CA1\u6709\u5B89\u6392\uFF1B\u5BF9\u8BDD\u91CC\u63D0\u5230\u7684\u4E8B\u60C5\u4F1A\u81EA\u52A8\u767B\u8BB0\u8FDB\u6765",\u64A4\u9500:"\u64A4\u9500","\u5DF2\u64A4\u9500\uFF1A{label}":"\u5DF2\u64A4\u9500\uFF1A{label}",\u5237\u65B0:"\u5237\u65B0","\u52A0\u8F7D\u4E2D\u2026":"\u52A0\u8F7D\u4E2D\u2026","\u5DE5\u4F5C\u53F0\u52A0\u8F7D\u5931\u8D25\uFF1A{error}":"\u5DE5\u4F5C\u53F0\u52A0\u8F7D\u5931\u8D25\uFF1A{error}",\u91CD\u8BD5:"\u91CD\u8BD5",\u521A\u521A:"\u521A\u521A","{n} \u5206\u949F\u524D":"{n} \u5206\u949F\u524D","{n} \u5C0F\u65F6\u524D":"{n} \u5C0F\u65F6\u524D","{n} \u5929\u524D":"{n} \u5929\u524D",\u4E2A\u4EBA\u5DE5\u4F5C\u53F0:"\u4E2A\u4EBA\u5DE5\u4F5C\u53F0","\u641C\u7D22\u8FC7\u6EE4\u2026":"\u641C\u7D22\u8FC7\u6EE4\u2026",\u5C55\u5F00:"\u5C55\u5F00",\u6536\u8D77:"\u6536\u8D77",\u6765\u81EA\u5BF9\u8BDD:"\u6765\u81EA\u5BF9\u8BDD",\u5DE5\u4F5C\u53F0\u9762\u677F:"\u5DE5\u4F5C\u53F0\u9762\u677F",\u6267\u884C:"\u6267\u884C",\u73AF\u8282:"\u73AF\u8282",\u6302\u9760\u6267\u884C:"\u6302\u9760\u6267\u884C",\u6302\u9760\u4EFB\u52A1:"\u6302\u9760\u4EFB\u52A1",\u5916\u90E8\u6267\u884C\u8005:"\u5916\u90E8\u6267\u884C\u8005","\u6682\u65E0\u8FDB\u5C55\u8BB0\u5F55\uFF1B\u63A5\u624B\u7684\u4F1A\u8BDD\u4F1A\u81EA\u52A8\u6C47\u62A5\u5230\u8FD9\u91CC":"\u6682\u65E0\u8FDB\u5C55\u8BB0\u5F55\uFF1B\u63A5\u624B\u7684\u4F1A\u8BDD\u4F1A\u81EA\u52A8\u6C47\u62A5\u5230\u8FD9\u91CC",\u5DF2\u9A8C\u6536:"\u5DF2\u9A8C\u6536",\u5DF2\u5FFD\u7565:"\u5DF2\u5FFD\u7565",\u8DF3\u8F6C\u4F1A\u8BDD:"\u8DF3\u8F6C\u4F1A\u8BDD","\u6765\u81EA ZCode":"\u6765\u81EA ZCode",\u6628\u65E5\u5B8C\u6210:"\u6628\u65E5\u5B8C\u6210","\uFF08\u903E\u671F\uFF09":"\uFF08\u903E\u671F\uFF09",\u5468\u65E5:"\u5468\u65E5",\u5468\u4E00:"\u5468\u4E00",\u5468\u4E8C:"\u5468\u4E8C",\u5468\u4E09:"\u5468\u4E09",\u5468\u56DB:"\u5468\u56DB",\u5468\u4E94:"\u5468\u4E94",\u5468\u516D:"\u5468\u516D","\u5DE5\u4F5C\u53F0 {n}":"\u5DE5\u4F5C\u53F0 {n}","\u5B8C\u6210\u300C{title}\u300D":"\u5B8C\u6210\u300C{title}\u300D",\u5B66\u4E60:"\u5B66\u4E60",\u8BBE\u7F6E:"\u8BBE\u7F6E",\u7ACB\u5373\u6574\u7406:"\u7ACB\u5373\u6574\u7406",\u7B14\u8BB0:"\u7B14\u8BB0",\u5DF2\u638C\u63E1:"\u5DF2\u638C\u63E1",\u5F31\u9879\u8865\u5F3A:"\u5F31\u9879\u8865\u5F3A",\u4E86\u89E3\u5373\u53EF:"\u4E86\u89E3\u5373\u53EF",\u540D\u8BCD\u89E3\u91CA:"\u540D\u8BCD\u89E3\u91CA",\u5F85\u590D\u4E60:"\u5F85\u590D\u4E60",\u4E22\u5F03:"\u4E22\u5F03",\u53CD\u590D\u95EE:"\u53CD\u590D\u95EE",\u70B9\u51FB\u8FC7\u6EE4:"\u70B9\u51FB\u8FC7\u6EE4",\u4ECA\u65E5\u65B0\u589E:"\u4ECA\u65E5\u65B0\u589E",\u5F85\u6574\u7406:"\u5F85\u6574\u7406","\u5F85\u6574\u7406\uFF08\u624B\u52A8\u8BB0\u5F55\uFF09":"\u5F85\u6574\u7406\uFF08\u624B\u52A8\u8BB0\u5F55\uFF09",\u5B66\u4E60\u6761\u76EE:"\u5B66\u4E60\u6761\u76EE",\u8FD1\u671F\u63D0\u95EE\u5019\u9009:"\u8FD1\u671F\u63D0\u95EE\u5019\u9009","\u5F31\u9879\u6982\u5FF5\uFF08\u6309\u51FA\u73B0\u6B21\u6570\uFF09":"\u5F31\u9879\u6982\u5FF5\uFF08\u6309\u51FA\u73B0\u6B21\u6570\uFF09","\u8FD1 {n} \u5C0F\u65F6 \xB7 \u6574\u7406\u65F6\u81EA\u52A8\u5224\u65AD\u5206\u7C7B":"\u8FD1 {n} \u5C0F\u65F6 \xB7 \u6574\u7406\u65F6\u81EA\u52A8\u5224\u65AD\u5206\u7C7B",\u8FD1\u671F\u6CA1\u6709\u626B\u5230\u63D0\u95EE\u5019\u9009:"\u8FD1\u671F\u6CA1\u6709\u626B\u5230\u63D0\u95EE\u5019\u9009","\u626B\u63CF\u5931\u8D25\uFF1A{error}":"\u626B\u63CF\u5931\u8D25\uFF1A{error}","\u95EE\u4E86 {n} \u6B21\uFF0C\u6700\u8FD1 {at}":"\u95EE\u4E86 {n} \u6B21\uFF0C\u6700\u8FD1 {at}","\u641C\u6982\u5FF5 / \u95EE\u9898\u2026":"\u641C\u6982\u5FF5 / \u95EE\u9898\u2026","\u8FD8\u6CA1\u6709\u5B66\u4E60\u6761\u76EE\uFF1B\u5BF9\u8BDD\u91CC\u8BF4\u300C\u8BB0\u4E00\u4E0B\u8FD9\u4E2A\u95EE\u9898\u300D\uFF0C\u6216\u7B49\u6BCF\u665A\u81EA\u52A8\u6574\u7406":"\u8FD8\u6CA1\u6709\u5B66\u4E60\u6761\u76EE\uFF1B\u5BF9\u8BDD\u91CC\u8BF4\u300C\u8BB0\u4E00\u4E0B\u8FD9\u4E2A\u95EE\u9898\u300D\uFF0C\u6216\u7B49\u6BCF\u665A\u81EA\u52A8\u6574\u7406","\u7B14\u8BB0\u76EE\u5F55\uFF08vault \u5185\u76F8\u5BF9\u8DEF\u5F84\uFF0C\u81EA\u52A8\u521B\u5EFA\uFF09":"\u7B14\u8BB0\u76EE\u5F55\uFF08vault \u5185\u76F8\u5BF9\u8DEF\u5F84\uFF0C\u81EA\u52A8\u521B\u5EFA\uFF09","\u6BCF\u65E5\u6574\u7406\u65F6\u95F4\uFF08\u5C0F\u65F6\uFF0C\u95F2\u65F6\u534A\u4EF7\u65F6\u6BB5\uFF09":"\u6BCF\u65E5\u6574\u7406\u65F6\u95F4\uFF08\u5C0F\u65F6\uFF0C\u95F2\u65F6\u534A\u4EF7\u65F6\u6BB5\uFF09",\u626B\u63CF\u54EA\u4E9B\u5DE5\u5177\u7684\u63D0\u95EE:"\u626B\u63CF\u54EA\u4E9B\u5DE5\u5177\u7684\u63D0\u95EE","\u6539\u52A8\u7ACB\u5373\u751F\u6548\uFF1B\u76EE\u5F55\u6539\u52A8\u53EA\u5F71\u54CD\u4E4B\u540E\u5199\u7684\u7B14\u8BB0":"\u6539\u52A8\u7ACB\u5373\u751F\u6548\uFF1B\u76EE\u5F55\u6539\u52A8\u53EA\u5F71\u54CD\u4E4B\u540E\u5199\u7684\u7B14\u8BB0","\u5DF2\u63A8\u9001\u5230\u4F1A\u8BDD\uFF0C\u6574\u7406\u7ED3\u679C\u7A0D\u540E\u51FA\u73B0\u5728\u5B66\u4E60\u89C6\u56FE":"\u5DF2\u63A8\u9001\u5230\u4F1A\u8BDD\uFF0C\u6574\u7406\u7ED3\u679C\u7A0D\u540E\u51FA\u73B0\u5728\u5B66\u4E60\u89C6\u56FE",\u6253\u5F00\u7B14\u8BB0\u5931\u8D25:"\u6253\u5F00\u7B14\u8BB0\u5931\u8D25","\u5B66\u4E60\u4EFB\u52A1\uFF1A\u4E0B\u4E00\u6761\u6D88\u606F\u96F6\u6210\u672C\u8BB0\u4E3A\u5B66\u4E60\u63D0\u95EE":"\u5B66\u4E60\u4EFB\u52A1\uFF1A\u4E0B\u4E00\u6761\u6D88\u606F\u96F6\u6210\u672C\u8BB0\u4E3A\u5B66\u4E60\u63D0\u95EE","\u5F00\u542F\u540E\uFF0C\u672C\u4F1A\u8BDD\u4F60\u53D1\u9001\u7684\u4E0B\u4E00\u6761\u6D88\u606F\u4F1A\u88AB\u76F4\u63A5\u8BB0\u5F55\u4E3A\u5B66\u4E60\u63D0\u95EE\uFF08\u4E0D\u89E6\u53D1\u6A21\u578B\u56DE\u590D\uFF09\uFF0C\u8BB0\u5F55\u4F1A\u5728\u6BCF\u665A\u6574\u7406\u65F6\u5199\u8FDB Obsidian\u3002":"\u5F00\u542F\u540E\uFF0C\u672C\u4F1A\u8BDD\u4F60\u53D1\u9001\u7684\u4E0B\u4E00\u6761\u6D88\u606F\u4F1A\u88AB\u76F4\u63A5\u8BB0\u5F55\u4E3A\u5B66\u4E60\u63D0\u95EE\uFF08\u4E0D\u89E6\u53D1\u6A21\u578B\u56DE\u590D\uFF09\uFF0C\u8BB0\u5F55\u4F1A\u5728\u6BCF\u665A\u6574\u7406\u65F6\u5199\u8FDB Obsidian\u3002"},en:{\u5DE5\u4F5C\u53F0:"Workbench",\u4ECA\u5929:"Today",\u5168\u90E8:"All",\u6536\u4EF6\u7BB1:"Inbox","\u8BB0\u4E00\u53E5\u8BDD\uFF0C\u56DE\u8F66\u6536\u8FDB\u7075\u611F\u6536\u4EF6\u7BB1":"Capture a thought, press Enter to park it",\u7075\u611F:"Idea",\u4EFB\u52A1:"Task",\u6536\u8FDB\u6536\u4EF6\u7BB1:"Park idea",\u76F4\u63A5\u5EFA\u4EFB\u52A1:"Create task",\u8FDB\u884C\u4E2D:"In progress",\u4ECA\u5929\u5230\u671F:"Due today",\u903E\u671F:"Overdue",\u7126\u70B9:"Focus","\u4ECA\u65E5\u5B8C\u6210 {n} \u4EF6":"{n} done today",\u5F85\u529E:"To do",\u53D7\u963B:"Blocked",\u5DF2\u5B8C\u6210:"Done",\u5F85\u9A8C\u6536:"To review",\u9A8C\u6536:"Accept",\u5FFD\u7565:"Dismiss",\u8F6C\u4EFB\u52A1:"To task",\u5B50\u4EE3\u7406:"Subagent",\u5DE5\u4F5C\u6D41:"Workflow",\u540E\u53F0\u4EFB\u52A1:"Job","\u5DF2\u505C\u9760\u7075\u611F\u300C{text}\u300D":"Parked idea \u201C{text}\u201D",\u5DF2\u4E22\u5F03\u7075\u611F:"Idea dropped","\u7075\u611F\u5DF2\u8F6C\u4E3A\u4EFB\u52A1\u300C{title}\u300D":"Idea promoted to task \u201C{title}\u201D","\u9A8C\u6536\u5B8C\u6210\uFF0C\u5269\u4F59 {n} \u6761":"Reviewed, {n} left",\u6807\u9898:"Title",\u5907\u6CE8:"Note",\u622A\u6B62:"Due",\u4F18\u5148\u7EA7:"Priority",\u4F4E:"Low",\u4E2D:"Med",\u9AD8:"High",\u72B6\u6001:"Status",\u6807\u7B7E:"Tags",\u4ECA\u5929\u7126\u70B9:"Today focus",\u5220\u9664:"Delete",\u4FDD\u5B58:"Save",\u53D6\u6D88:"Cancel",\u7F16\u8F91\u4EFB\u52A1:"Edit task",\u6765\u6E90\u4F1A\u8BDD:"Source session",\u7075\u611F\u6536\u4EF6\u7BB1\u662F\u7A7A\u7684:"The idea inbox is empty","\u6CA1\u6709\u5F85\u9A8C\u6536\uFF0C\u5E76\u884C\u4EFB\u52A1\u7684\u7ED3\u679C\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u51FA\u73B0\u5728\u8FD9\u91CC":"Nothing to review. Finished parallel runs will land here automatically.","\u4ECA\u5929\u8FD8\u6CA1\u6709\u5B89\u6392\uFF1B\u5BF9\u8BDD\u91CC\u63D0\u5230\u7684\u4E8B\u60C5\u4F1A\u81EA\u52A8\u767B\u8BB0\u8FDB\u6765":"Nothing planned today. Tasks mentioned in chats land here automatically.",\u64A4\u9500:"Undo","\u5DF2\u64A4\u9500\uFF1A{label}":"Undone: {label}",\u5237\u65B0:"Refresh","\u52A0\u8F7D\u4E2D\u2026":"Loading\u2026","\u5DE5\u4F5C\u53F0\u52A0\u8F7D\u5931\u8D25\uFF1A{error}":"Workbench failed to load: {error}",\u91CD\u8BD5:"Retry",\u521A\u521A:"just now","{n} \u5206\u949F\u524D":"{n}m ago","{n} \u5C0F\u65F6\u524D":"{n}h ago","{n} \u5929\u524D":"{n}d ago",\u4E2A\u4EBA\u5DE5\u4F5C\u53F0:"Personal workbench","\u641C\u7D22\u8FC7\u6EE4\u2026":"Filter\u2026",\u5C55\u5F00:"Expand",\u6536\u8D77:"Collapse",\u6765\u81EA\u5BF9\u8BDD:"from chat",\u5DE5\u4F5C\u53F0\u9762\u677F:"Workbench panel",\u6267\u884C:"Runners",\u73AF\u8282:"Progress",\u6302\u9760\u6267\u884C:"Linked runs",\u6302\u9760\u4EFB\u52A1:"Attached task",\u5916\u90E8\u6267\u884C\u8005:"External runner","\u6682\u65E0\u8FDB\u5C55\u8BB0\u5F55\uFF1B\u63A5\u624B\u7684\u4F1A\u8BDD\u4F1A\u81EA\u52A8\u6C47\u62A5\u5230\u8FD9\u91CC":"No progress yet; sessions that take this task will report here automatically.",\u5DF2\u9A8C\u6536:"Accepted",\u5DF2\u5FFD\u7565:"Dismissed",\u8DF3\u8F6C\u4F1A\u8BDD:"Open session","\u6765\u81EA ZCode":"from ZCode",\u6628\u65E5\u5B8C\u6210:"Done yesterday","\uFF08\u903E\u671F\uFF09":" (overdue)",\u5468\u65E5:"Sun",\u5468\u4E00:"Mon",\u5468\u4E8C:"Tue",\u5468\u4E09:"Wed",\u5468\u56DB:"Thu",\u5468\u4E94:"Fri",\u5468\u516D:"Sat","\u5DE5\u4F5C\u53F0 {n}":"Workbench {n}","\u5B8C\u6210\u300C{title}\u300D":"Complete \u201C{title}\u201D",\u5B66\u4E60:"Learn",\u8BBE\u7F6E:"Settings",\u7ACB\u5373\u6574\u7406:"Organize now",\u7B14\u8BB0:"Note",\u5DF2\u638C\u63E1:"Mastered",\u5F31\u9879\u8865\u5F3A:"Weak spot",\u4E86\u89E3\u5373\u53EF:"Good to know",\u540D\u8BCD\u89E3\u91CA:"Term",\u5F85\u590D\u4E60:"To review",\u4E22\u5F03:"Drop",\u53CD\u590D\u95EE:"asked again",\u70B9\u51FB\u8FC7\u6EE4:"click to filter",\u4ECA\u65E5\u65B0\u589E:"New today",\u5F85\u6574\u7406:"To organize","\u5F85\u6574\u7406\uFF08\u624B\u52A8\u8BB0\u5F55\uFF09":"To organize (manual)",\u5B66\u4E60\u6761\u76EE:"Learning entries",\u8FD1\u671F\u63D0\u95EE\u5019\u9009:"Recent question candidates","\u5F31\u9879\u6982\u5FF5\uFF08\u6309\u51FA\u73B0\u6B21\u6570\uFF09":"Weak concepts (by frequency)","\u8FD1 {n} \u5C0F\u65F6 \xB7 \u6574\u7406\u65F6\u81EA\u52A8\u5224\u65AD\u5206\u7C7B":"last {n}h \xB7 classified during nightly run",\u8FD1\u671F\u6CA1\u6709\u626B\u5230\u63D0\u95EE\u5019\u9009:"No question candidates recently","\u626B\u63CF\u5931\u8D25\uFF1A{error}":"Scan failed: {error}","\u95EE\u4E86 {n} \u6B21\uFF0C\u6700\u8FD1 {at}":"asked {n} times, last {at}","\u641C\u6982\u5FF5 / \u95EE\u9898\u2026":"Search concept / question\u2026","\u8FD8\u6CA1\u6709\u5B66\u4E60\u6761\u76EE\uFF1B\u5BF9\u8BDD\u91CC\u8BF4\u300C\u8BB0\u4E00\u4E0B\u8FD9\u4E2A\u95EE\u9898\u300D\uFF0C\u6216\u7B49\u6BCF\u665A\u81EA\u52A8\u6574\u7406":"No entries yet; say \u201C\u8BB0\u4E00\u4E0B\u8FD9\u4E2A\u95EE\u9898\u201D in a chat, or wait for the nightly run.","\u7B14\u8BB0\u76EE\u5F55\uFF08vault \u5185\u76F8\u5BF9\u8DEF\u5F84\uFF0C\u81EA\u52A8\u521B\u5EFA\uFF09":"Notes dir (relative to vault, auto-created)","\u6BCF\u65E5\u6574\u7406\u65F6\u95F4\uFF08\u5C0F\u65F6\uFF0C\u95F2\u65F6\u534A\u4EF7\u65F6\u6BB5\uFF09":"Daily organize hour (off-peak)",\u626B\u63CF\u54EA\u4E9B\u5DE5\u5177\u7684\u63D0\u95EE:"Which harnesses to scan","\u6539\u52A8\u7ACB\u5373\u751F\u6548\uFF1B\u76EE\u5F55\u6539\u52A8\u53EA\u5F71\u54CD\u4E4B\u540E\u5199\u7684\u7B14\u8BB0":"Applies immediately; dir changes affect future notes only","\u5DF2\u63A8\u9001\u5230\u4F1A\u8BDD\uFF0C\u6574\u7406\u7ED3\u679C\u7A0D\u540E\u51FA\u73B0\u5728\u5B66\u4E60\u89C6\u56FE":"Pushed; results will appear in the Learn view",\u6253\u5F00\u7B14\u8BB0\u5931\u8D25:"Failed to open note","\u5B66\u4E60\u4EFB\u52A1\uFF1A\u4E0B\u4E00\u6761\u6D88\u606F\u96F6\u6210\u672C\u8BB0\u4E3A\u5B66\u4E60\u63D0\u95EE":"Learn task: record next message as a question","\u5F00\u542F\u540E\uFF0C\u672C\u4F1A\u8BDD\u4F60\u53D1\u9001\u7684\u4E0B\u4E00\u6761\u6D88\u606F\u4F1A\u88AB\u76F4\u63A5\u8BB0\u5F55\u4E3A\u5B66\u4E60\u63D0\u95EE\uFF08\u4E0D\u89E6\u53D1\u6A21\u578B\u56DE\u590D\uFF09\uFF0C\u8BB0\u5F55\u4F1A\u5728\u6BCF\u665A\u6574\u7406\u65F6\u5199\u8FDB Obsidian\u3002":"After enabling, your next message in this chat is recorded as a learning question (no model reply); notes are written to Obsidian at the nightly run."}},ke="zh";function Ee(e){ke=String(e||"").toLowerCase().startsWith("en")?"en":"zh"}function s(e,a){let i=(de[ke]??de.zh)[e]??de.zh[e]??e;return a?i.replace(/\{(\w+)\}/g,(r,p)=>p in a?String(a[p]):r):i}var gt="wb/",ft=15e3,X={state:null,canUndo:!1,error:null,view:"today",expandedId:null,captureKind:"idea",filter:"",toastObj:null,refreshing:!1},be=new Set;function Se(){return X}function C(e){X={...X,...typeof e=="function"?e(X):e},be.forEach(a=>a())}function xt(e){return be.add(e),()=>be.delete(e)}function N(e){return ze.default.useSyncExternalStore(xt,()=>e(X))}async function D(e,a){let n=await fetch(gt+e,a===void 0?{}:{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(a)}),i=await n.json().catch(()=>({}));if(!n.ok)throw new Error(i.error||`\u8BF7\u6C42\u5931\u8D25\uFF08${n.status}\uFF09`);return i}var Ne=null;function U(e,{error:a=!1}={}){clearTimeout(Ne),C({toastObj:{text:e,error:a,key:Date.now()}}),Ne=setTimeout(()=>C({toastObj:null}),3200)}function B(e){U(e.message||String(e),{error:!0})}async function Z(){try{let e=await D("state");C({state:e.state,canUndo:e.canUndo,error:null})}catch(e){C({error:e.message})}}async function Y(){try{let e=await D("state");Se().error?C({state:e.state,canUndo:e.canUndo,error:null}):C({state:e.state,canUndo:e.canUndo})}catch{}}async function L(e,{label:a="\u64CD\u4F5C",undoable:n=!0,silent:i=!1}={}){try{let r=await D("ops",{ops:e,label:a,undoable:n});return C({state:r.state,canUndo:r.canUndo||Se().canUndo}),r.errors?.length?U(r.errors[0],{error:!0}):!i&&r.receipts?.[0]&&U(r.receipts[0].text),r}catch(r){return B(r),null}}async function Ce(){try{let e=await D("undo",{});C({state:e.state,canUndo:e.canUndo,toastObj:null}),e.label&&U(s("\u5DF2\u64A4\u9500\uFF1A{label}",{label:e.label}))}catch(e){B(e)}}var Ie=(e,a)=>L([{op:"add_task",...e}],{label:a}),$e=(e,a,n)=>L([{op:"update_task",id:e,...a}],{label:n}),re=(e,a,n)=>L([{op:"update_task",id:e,status:a}],{label:`${a==="done"?"\u5B8C\u6210":"\u66F4\u65B0"}\u300C${(n||"").slice(0,16)}\u300D`}),Te=(e,a)=>L([{op:"delete_task",id:e}],{label:`\u5220\u9664\u300C${(a||"").slice(0,16)}\u300D`}),De=(e,a)=>L([{op:"capture_idea",text:e,note:a,source:"ui"}],{label:"\u505C\u9760\u7075\u611F"}),Le=(e,a)=>L([{op:"promote_idea",id:e,...a?{title:a}:{}}],{label:"\u7075\u611F\u8F6C\u4EFB\u52A1"}),Ae=e=>L([{op:"drop_idea",id:e}],{label:"\u4E22\u5F03\u7075\u611F"}),se=(e,a,n)=>L([{op:"decide_review",id:e,action:a,...n?{taskTitle:n}:{}}],{label:"\u5904\u7F6E\u9A8C\u6536"}),Me=(e,a)=>L([{op:"learn_capture",question:e,context:a,source:"ui"}],{label:"\u8BB0\u5F55\u5B66\u4E60\u63D0\u95EE"}),Oe=e=>L([{op:"learn_drop_inbox",id:e}],{label:"\u4E22\u5F03\u5B66\u4E60\u63D0\u95EE"}),Pe=(e,a,n)=>L([{op:"learn_decide",id:e,action:a}],{label:`\u5904\u7F6E\u5B66\u4E60\u300C${(n||"").slice(0,16)}\u300D`});async function _e(e){try{return await D("learn/validate-storage",{vaultPath:e.vaultPath,notesDir:e.notesDir}),L([{op:"learn_config",patch:e}],{label:"\u5B66\u4E60\u8BBE\u7F6E"})}catch(a){return B(a),null}}var je=(e,a)=>L([{op:"learn_arm",sessionId:e,on:a}],{label:a?"\u5F00\u542F\u5B66\u4E60\u8BB0\u5F55":"\u5173\u95ED\u5B66\u4E60\u8BB0\u5F55",undoable:!1});async function Ue(){return D("learn/preview")}async function He(){return D("learn/models")}async function qe(){try{let e=await D("learn/run-now",{});return U(s("\u5DF2\u63A8\u9001\u5230\u4F1A\u8BDD\uFF0C\u6574\u7406\u7ED3\u679C\u7A0D\u540E\u51FA\u73B0\u5728\u5B66\u4E60\u89C6\u56FE")),e}catch(e){return B(e),null}}async function Be(e){try{let a=await D(`learn/uri?path=${encodeURIComponent(e)}`),n=document.createElement("a");n.href=a.uri,n.target="_blank",n.rel="noopener",document.body.appendChild(n),n.click(),n.remove(),U(s("\u5DF2\u8BF7\u6C42\u6253\u5F00 Obsidian\uFF1B\u5982\u672A\u54CD\u5E94\uFF0C\u8BF7\u5728\u672C\u673A\u68C0\u67E5\u5E94\u7528\u5173\u8054\u3002"))}catch(a){B(a)}}function K(e=new Date){let a=n=>String(n).padStart(2,"0");return`${e.getFullYear()}-${a(e.getMonth()+1)}-${a(e.getDate())}`}function ue(e){let a=new Date(e);return Number.isNaN(a.getTime())?"":K(a)}function oe(e,a=new Date){let n=K(a),i=o=>o.status!=="done",r=[],p=new Set,d=(o,w,y)=>{let g=y.filter(f=>p.has(f.id)?!1:(p.add(f.id),!0));g.length&&r.push({key:o,title:w,tasks:g})};d("doing","\u8FDB\u884C\u4E2D",e.tasks.filter(o=>i(o)&&o.status==="doing")),d("due","\u4ECA\u5929\u5230\u671F",e.tasks.filter(o=>i(o)&&o.due&&o.due<=n).sort((o,w)=>o.due<w.due?-1:1)),d("focus","\u7126\u70B9",e.tasks.filter(o=>i(o)&&o.focus&&o.status!=="doing"&&!(o.due&&o.due<=n)));let l=e.tasks.filter(o=>o.status==="done"&&o.completedAt&&ue(o.completedAt)===n);return{sections:r,doneToday:l,today:n}}function G(e,a=Date.now()){let n=a-Date.parse(e);return!Number.isFinite(n)||n<6e4?"\u521A\u521A":n<36e5?s("{n} \u5206\u949F\u524D",{n:Math.floor(n/6e4)}):n<864e5?s("{n} \u5C0F\u65F6\u524D",{n:Math.floor(n/36e5)}):s("{n} \u5929\u524D",{n:Math.floor(n/864e5)})}function ht(){let e=setInterval(Y,ft),a=()=>{document.visibilityState==="visible"&&Y()};return document.addEventListener("visibilitychange",a),()=>{clearInterval(e),document.removeEventListener("visibilitychange",a)}}var pe=0,ce=null;function ie(){return pe++===0&&(ce=ht()),()=>{--pe>0||(pe=0,ce?.(),ce=null)}}async function We(e,a,n=""){try{let i=await D("learn/explore",{entryId:e,question:a,quote:n});return await Z(),i.error&&U(`\u4F1A\u8BDD\u5DF2\u521B\u5EFA\uFF0C\u4F46\u672A\u5F00\u59CB\u56DE\u7B54\uFF1A${i.error}`,{error:!0}),i}catch(i){return B(i),null}}async function Ve(e,a){try{return await D("learn/highlight",{entryId:e,text:a}),await Z(),U("\u5212\u7EBF\u5DF2\u4FDD\u5B58"),!0}catch(n){return B(n),!1}}async function Fe(e){try{await D("learn/sync",{entryId:e}),await Z(),U("\u7B14\u8BB0\u5DF2\u540C\u6B65")}catch(a){B(a)}}var Ke=()=>D("learn/reports"),Ye=e=>D(`learn/report?id=${encodeURIComponent(e)}`),Ze=e=>D(`learn/note?id=${encodeURIComponent(e)}`);var me=null,Ge=null;function Qe({openSession:e,sessionLabel:a}={}){me=typeof e=="function"?e:null,Ge=typeof a=="function"?a:null}function R(e){if(!(!e||!me))try{me(e)}catch{}}function Q(e){if(!e)return"";try{let a=Ge?.(e);if(typeof a=="string"&&a)return a}catch{}return`#${e.slice(0,6)}`}var z=q(require("react"),1);var yt=4,Je="wb.dockCollapsed";function vt(e,a){return!e||!a?[]:e.tasks.filter(n=>n.status!=="done"&&(n.origin?.sessionId===a||(n.progress??[]).some(i=>i.sessionId===a)))}function kt(e){return e?.closest?.("[data-conversation-scroll]")??null}function Xe({sessionId:e}){let a=N(k=>k.state),[n,i]=z.default.useState(()=>{try{return localStorage.getItem(Je)==="1"}catch{return!1}}),[r,p]=z.default.useState("measure"),[d,l]=z.default.useState(null),o=z.default.useRef(null),w=z.default.useRef(null);z.default.useEffect(()=>(Y(),ie()),[]);let y=vt(a,e),g=y.length>0;if(z.default.useEffect(()=>{let k=o.current;if(!g||!k)return;let $=()=>{let h=w.current,I=kt(k);if(!h||!I)return;let j=I.getBoundingClientRect(),H=h.offsetParent,ye=H?H.getBoundingClientRect():{left:0,top:0},ot=ye.left+(H?.clientLeft??0),it=ye.top+(H?.clientTop??0),le={left:Math.round(j.left+12-ot),top:Math.round(j.top+12-it)};p(F=>F==="fallback"?F:"float"),l(F=>F&&Math.abs(F.left-le.left)<1&&Math.abs(F.top-le.top)<1?F:le),I!==V&&(V=I,_.observe(I)),H&&H!==m&&(m=H,_.observe(H))},_=new ResizeObserver(()=>$()),V=null,m=null;$();let T=[setTimeout($,300),setTimeout($,900)],O=setTimeout(()=>p(h=>h==="float"?h:"fallback"),1200),te=()=>$();return window.addEventListener("resize",te),()=>{T.forEach(clearTimeout),clearTimeout(O),window.removeEventListener("resize",te),_.disconnect()}},[g]),!y.length)return null;let f=y.slice(0,yt),c=y.length-f.length,u=k=>z.default.createElement("button",{type:"button",className:"wb-dock-done",title:s("\u5B8C\u6210\u300C{title}\u300D",{title:k.title}),"aria-label":s("\u5B8C\u6210\u300C{title}\u300D",{title:k.title}),onClick:()=>re(k.id,"done",k.title)},"\u2713"),E=z.default.createElement("button",{type:"button",className:"wb-float-head","aria-expanded":!n,title:n?s("\u5C55\u5F00"):s("\u6536\u8D77"),onClick:()=>i(k=>{let $=!k;try{localStorage.setItem(Je,$?"1":"0")}catch{}return $})},z.default.createElement("span",{className:"wb-float-label"},s("\u5DE5\u4F5C\u53F0 {n}",{n:y.length})),z.default.createElement("span",{className:"wb-float-chevron","aria-hidden":!0},n?"\u25B8":"\u25BE"));return z.default.createElement("div",{ref:o,style:r==="float"?{height:0}:void 0},z.default.createElement("style",null,ne),r!=="fallback"?z.default.createElement("div",{ref:w,className:`wb-float${n?" is-collapsed":""}`,style:d?{left:d.left,top:d.top}:{visibility:"hidden"}},E,n?null:z.default.createElement("div",{className:"wb-float-list"},f.map(k=>z.default.createElement("div",{key:k.id,className:"wb-float-row"},u(k),z.default.createElement("span",{className:"wb-float-title",title:k.title},k.title))),c>0?z.default.createElement("span",{className:"wb-float-more"},`+${c}`):null)):z.default.createElement("div",{className:"wb-dock"},z.default.createElement("span",{className:"wb-dock-label"},s("\u5DE5\u4F5C\u53F0 {n}",{n:y.length})),f.map(k=>z.default.createElement("span",{key:k.id,className:"wb-dock-item"},u(k),z.default.createElement("span",{className:"wb-dock-title",title:k.title},k.title))),c>0?z.default.createElement("span",{className:"wb-dock-item is-more"},`+${c}`):null))}var W=q(require("react"),1);var b=q(require("react"),1);var Re={check:"M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 12-12L20.1 5.6z",plus:"M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z",trash:"M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z",undo:"M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z",refresh:"M17.6 6.4A8 8 0 1 0 19.5 14h-2.1a6 6 0 1 1-1-6.4L13 11h7V4z",inbox:"M4 4h16v10h-5a3 3 0 0 1-6 0H4zm0 12h4.6a5 5 0 0 0 6.8 0H20v4H4z",calendar:"M7 2v2H4v18h16V4h-3V2h-2v2H9V2zm-1 8h12v8H6zm2 2v2h3v-2z",flag:"M6 2v20h2v-8h9l-2-5 2-5H8V2z",star:"m12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z",chat:"M4 4h16v12H7l-3 3z",focus:"M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0-6 2 4h-4zm0 20-2-4h4zM2 12l4-2v4zm16 0 4-2v4z"};function A({name:e,size:a=16}){return b.default.createElement("svg",{viewBox:"0 0 24 24",width:a,height:a,"aria-hidden":!0,focusable:!1,style:{display:"block",fill:"currentColor"}},b.default.createElement("path",{d:Re[e]??Re.check}))}function we({icon:e,label:a,onClick:n,danger:i=!1,disabled:r=!1}){return b.default.createElement("button",{type:"button",className:`wb-iconbtn${i?" is-danger":""}`,title:a,"aria-label":a,onClick:n,disabled:r},b.default.createElement(A,{name:e,size:16}))}function M({children:e,tone:a="plain",title:n}){return b.default.createElement("span",{className:`wb-chip is-${a}`,title:n},e)}var ge={subagent:"\u5B50\u4EE3\u7406",workflow:"\u5DE5\u4F5C\u6D41",job:"\u540E\u53F0\u4EFB\u52A1"};function J({sessionId:e,label:a,title:n}){if(!e)return null;let i=a??Q(e);return b.default.createElement("button",{type:"button",className:"wb-chip is-idle wb-chipbtn",title:n??`${s("\u6765\u6E90\u4F1A\u8BDD")} \xB7 ${i}`,onClick:r=>{r.stopPropagation(),R(e)}},i)}var Et={todo:"\u5F85\u529E",doing:"\u8FDB\u884C\u4E2D",blocked:"\u53D7\u963B",done:"\u5DF2\u5B8C\u6210"},Nt=["\u4F4E","\u4E2D","\u9AD8"];var zt={pending:"\u5F85\u9A8C\u6536",accepted:"\u5DF2\u9A8C\u6536",dismissed:"\u5DF2\u5FFD\u7565"},St={pending:"warn",accepted:"plain",dismissed:"idle"};function Ct({task:e}){let a=N(o=>o.state),n=e.progress??[],i=new Map,r=(o,w)=>{let y=i.get(o);(!y||w.at>y.at)&&i.set(o,w)};e.origin?.sessionId&&r(`s:${e.origin.sessionId}`,{at:e.createdAt,sessionId:e.origin.sessionId});for(let o of n)o.sessionId&&r(`s:${o.sessionId}`,{at:o.at,sessionId:o.sessionId}),o.actor&&r(`a:${o.actor}`,{at:o.at,actor:o.actor});let p=[...i.values()].sort((o,w)=>o.at<w.at?1:-1),d=(a?.reviews??[]).filter(o=>o.taskId===e.id).sort((o,w)=>o.createdAt<w.createdAt?1:-1).slice(0,8),l=(o,w)=>b.default.createElement("div",{className:"wb-boss-row"},b.default.createElement("span",{className:"wb-boss-label"},o),w);return b.default.createElement("div",{className:"wb-boss"},p.length?l(s("\u6267\u884C"),b.default.createElement("span",{className:"wb-boss-actors"},p.map(o=>o.sessionId?b.default.createElement(J,{key:`s:${o.sessionId}`,sessionId:o.sessionId}):b.default.createElement(M,{key:`a:${o.actor}`,tone:"idle",title:s("\u5916\u90E8\u6267\u884C\u8005")},o.actor)))):null,l(s("\u73AF\u8282"),n.length?b.default.createElement("ul",{className:"wb-timeline"},n.slice(-12).reverse().map((o,w)=>b.default.createElement("li",{key:`${o.at}-${w}`,className:"wb-timeline-item"},b.default.createElement("span",{className:"wb-timeline-note"},o.note),b.default.createElement("span",{className:"wb-meta"},o.actor??(o.sessionId?Q(o.sessionId):"")," \xB7 ",G(o.at))))):b.default.createElement("span",{className:"wb-meta"},s("\u6682\u65E0\u8FDB\u5C55\u8BB0\u5F55\uFF1B\u63A5\u624B\u7684\u4F1A\u8BDD\u4F1A\u81EA\u52A8\u6C47\u62A5\u5230\u8FD9\u91CC"))),d.length?l(s("\u6302\u9760\u6267\u884C"),d.map(o=>b.default.createElement("div",{key:o.id,className:"wb-run"},b.default.createElement(M,{tone:St[o.status]??"idle"},s(zt[o.status]??"\u5F85\u9A8C\u6536")),b.default.createElement("span",{className:"wb-run-kind"},s(ge[o.kind]??"\u540E\u53F0\u4EFB\u52A1")),b.default.createElement("span",{className:"wb-run-title",title:o.title},o.title),o.sessionId?b.default.createElement(J,{sessionId:o.sessionId}):null))):null)}function It({task:e,close:a}){let[n,i]=b.default.useState({title:e.title,note:e.note??"",due:e.due??"",priority:e.priority,status:e.status,tags:(e.tags??[]).join(" ")}),r=l=>i(o=>({...o,...l})),p=async()=>{await $e(e.id,{title:n.title,note:n.note,due:n.due||null,priority:n.priority,status:n.status,tags:n.tags.split(/[\s,，]+/).filter(Boolean)},`\u66F4\u65B0\u300C${e.title.slice(0,16)}\u300D`),a()},d=(l,o)=>b.default.createElement("label",{className:"wb-field"},b.default.createElement("span",null,l),o);return b.default.createElement("div",{className:"wb-editor",onClick:l=>l.stopPropagation()},d(s("\u6807\u9898"),b.default.createElement("input",{value:n.title,onChange:l=>r({title:l.target.value})})),d(s("\u5907\u6CE8"),b.default.createElement("textarea",{rows:2,value:n.note,onChange:l=>r({note:l.target.value})})),b.default.createElement("div",{className:"wb-field-row"},d(s("\u622A\u6B62"),b.default.createElement("input",{type:"date",value:n.due,onChange:l=>r({due:l.target.value})})),d(s("\u4F18\u5148\u7EA7"),b.default.createElement("select",{value:n.priority,onChange:l=>r({priority:Number(l.target.value)})},[0,1,2].map(l=>b.default.createElement("option",{key:l,value:l},s(Nt[l]))))),d(s("\u72B6\u6001"),b.default.createElement("select",{value:n.status,onChange:l=>r({status:l.target.value})},["todo","doing","blocked","done"].map(l=>b.default.createElement("option",{key:l,value:l},s(Et[l])))))),d(s("\u6807\u7B7E"),b.default.createElement("input",{value:n.tags,placeholder:"\u7A7A\u683C\u5206\u9694",onChange:l=>r({tags:l.target.value})})),b.default.createElement(Ct,{task:e}),b.default.createElement("div",{className:"wb-editor-foot"},b.default.createElement("span",{className:"wb-meta"},e.origin?.sessionId?b.default.createElement(b.default.Fragment,null,`${s("\u6765\u6E90\u4F1A\u8BDD")} `,b.default.createElement(J,{sessionId:e.origin.sessionId})," \xB7 "):e.origin?.kind==="zcode"?`${s("\u6765\u81EA ZCode")} \xB7 `:"",G(e.createdAt)),b.default.createElement("span",{style:{flex:1}}),b.default.createElement("button",{type:"button",className:"wb-btn is-danger",onClick:async()=>{await Te(e.id,e.title),a()}},s("\u5220\u9664")),b.default.createElement("button",{type:"button",className:"wb-btn",onClick:a},s("\u53D6\u6D88")),b.default.createElement("button",{type:"button",className:"wb-btn is-primary",onClick:p},s("\u4FDD\u5B58"))))}function ee({task:e,today:a}){let i=N(d=>d.expandedId)===e.id,r=e.status==="done",p=!r&&e.due&&e.due<a;return b.default.createElement("div",{className:`wb-task${r?" is-done":""}${i?" is-open":""}`},b.default.createElement("div",{className:"wb-task-main",role:"button",tabIndex:0,onClick:()=>C({expandedId:i?null:e.id}),onKeyDown:d=>{(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),C({expandedId:i?null:e.id}))}},b.default.createElement("button",{type:"button",className:`wb-check${r?" is-on":""}`,role:"checkbox","aria-checked":r,"aria-label":r?"\u6807\u8BB0\u4E3A\u672A\u5B8C\u6210":"\u6807\u8BB0\u4E3A\u5B8C\u6210",onClick:d=>{d.stopPropagation(),re(e.id,r?"todo":"done",e.title)}},r?b.default.createElement(A,{name:"check",size:13}):null),b.default.createElement("span",{className:"wb-task-title"},e.title),b.default.createElement("span",{className:"wb-task-meta"},e.due?b.default.createElement(M,{tone:p?"error":"plain",title:s("\u622A\u6B62")},`${p?`${s("\u903E\u671F")} `:""}${e.due.slice(5)}`):null,e.priority===2?b.default.createElement(M,{tone:"warn"},s("\u9AD8")):null,e.focus?b.default.createElement(M,{tone:"brand"},s("\u7126\u70B9")):null,e.status==="blocked"?b.default.createElement(M,{tone:"error"},s("\u53D7\u963B")):null,e.origin?.kind==="chat"&&e.origin?.sessionId?b.default.createElement(J,{sessionId:e.origin.sessionId,label:s("\u6765\u81EA\u5BF9\u8BDD"),title:`${Q(e.origin.sessionId)} \xB7 ${s("\u8DF3\u8F6C\u4F1A\u8BDD")}`}):e.origin?.kind==="chat"?b.default.createElement(M,{tone:"idle"},s("\u6765\u81EA\u5BF9\u8BDD")):null,e.origin?.kind==="zcode"?b.default.createElement(M,{tone:"idle",title:s("\u6765\u81EA ZCode")},"Zcode"):null,(e.tags??[]).slice(0,3).map(d=>b.default.createElement(M,{key:d,tone:"idle"},d)))),i?b.default.createElement(It,{task:e,close:()=>C({expandedId:null})}):null)}function P({text:e}){return b.default.createElement("p",{className:"wb-empty"},e)}function et(){let e=N(a=>a.toastObj);return e?b.default.createElement("div",{className:`wb-toast${e.error?" is-error":""}`,key:e.key},e.text):null}var $t=[["doing","\u8FDB\u884C\u4E2D","focus"],["todo","\u5F85\u529E","inbox"],["blocked","\u53D7\u963B","flag"],["done","\u5DF2\u5B8C\u6210","check"]];function tt(){let e=N(l=>l.state),a=N(l=>l.filter),n=K(),i=a.trim().toLowerCase(),r=l=>!i||l.title.toLowerCase().includes(i)||(l.note??"").toLowerCase().includes(i)||(l.tags??[]).some(o=>o.toLowerCase().includes(i)),p=$t.map(([l,o])=>({status:l,label:o,rows:e.tasks.filter(w=>w.status===l&&r(w))})),d=p.reduce((l,o)=>l+o.rows.length,0);return W.default.createElement("div",{className:"wb-page"},W.default.createElement("input",{className:"wb-filter",value:a,placeholder:s("\u641C\u7D22\u8FC7\u6EE4\u2026"),onChange:l=>C({filter:l.target.value})}),d===0?W.default.createElement(P,{text:s("\u4ECA\u5929\u8FD8\u6CA1\u6709\u5B89\u6392\uFF1B\u5BF9\u8BDD\u91CC\u63D0\u5230\u7684\u4E8B\u60C5\u4F1A\u81EA\u52A8\u767B\u8BB0\u8FDB\u6765")}):null,p.filter(l=>l.rows.length).map(l=>W.default.createElement("section",{key:l.status,className:"wb-section"},W.default.createElement("h3",null,s(l.label),W.default.createElement("span",{className:"wb-count"},l.rows.length)),l.rows.map(o=>W.default.createElement(ee,{key:o.id,task:o,today:n})))))}var x=q(require("react"),1);function Tt({review:e}){let[a,n]=x.default.useState(!1),i=N(p=>p.state),r=e.taskId?i?.tasks?.find(p=>p.id===e.taskId):void 0;return x.default.createElement("div",{className:`wb-review${a?" is-open":""}`},x.default.createElement("div",{className:"wb-review-main",role:"button",tabIndex:0,onClick:()=>n(!a),onKeyDown:p=>{(p.key==="Enter"||p.key===" ")&&(p.preventDefault(),n(!a))}},x.default.createElement("span",{className:"wb-kind"},s(ge[e.kind]??"\u540E\u53F0\u4EFB\u52A1")),x.default.createElement("span",{className:"wb-review-title"},e.title),x.default.createElement("span",{className:"wb-meta"},G(e.createdAt)),e.sessionId?x.default.createElement(J,{sessionId:e.sessionId,title:`${Q(e.sessionId)} \xB7 ${s("\u8DF3\u8F6C\u4F1A\u8BDD")}`}):null),a&&(e.summary||r)?x.default.createElement("div",{className:"wb-review-detail"},r?x.default.createElement("p",{className:"wb-review-task"},`${s("\u6302\u9760\u4EFB\u52A1")}\uFF1A${r.title}`):null,e.summary?x.default.createElement("p",{className:"wb-review-summary"},e.summary):null):null,x.default.createElement("div",{className:"wb-review-actions"},x.default.createElement("button",{type:"button",className:"wb-btn",onClick:()=>se(e.id,"accept")},s("\u9A8C\u6536")),x.default.createElement("button",{type:"button",className:"wb-btn",onClick:()=>se(e.id,"promote")},s("\u8F6C\u4EFB\u52A1")),x.default.createElement("button",{type:"button",className:"wb-btn is-ghost",onClick:()=>se(e.id,"dismiss")},s("\u5FFD\u7565"))))}function Dt({idea:e}){let[a,n]=x.default.useState(!1);return x.default.createElement("div",{className:"wb-idea"},x.default.createElement("div",{className:"wb-idea-main",role:"button",tabIndex:0,onClick:()=>n(!a),onKeyDown:i=>{i.key==="Enter"&&n(!a)}},x.default.createElement(A,{name:"chat",size:13}),x.default.createElement("span",{className:"wb-idea-text"},e.text),x.default.createElement("span",{className:"wb-meta"},G(e.createdAt),e.source==="chat"?` \xB7 ${s("\u6765\u81EA\u5BF9\u8BDD")}`:"")),a&&e.note?x.default.createElement("p",{className:"wb-idea-note"},e.note):null,x.default.createElement("div",{className:"wb-review-actions"},x.default.createElement("button",{type:"button",className:"wb-btn",onClick:()=>Le(e.id)},s("\u8F6C\u4EFB\u52A1")),x.default.createElement("button",{type:"button",className:"wb-btn is-ghost",onClick:()=>Ae(e.id)},s("\u5FFD\u7565"))))}function at(){let e=N(i=>i.state),a=e.reviews.filter(i=>i.status==="pending").sort((i,r)=>i.createdAt<r.createdAt?-1:1),n=e.ideas.filter(i=>i.status==="parked");return x.default.createElement("div",{className:"wb-page"},x.default.createElement("section",{className:"wb-section"},x.default.createElement("h3",null,x.default.createElement(A,{name:"inbox",size:14}),s("\u5F85\u9A8C\u6536"),a.length?x.default.createElement(M,{tone:"warn"},a.length):null),a.length?a.map(i=>x.default.createElement(Tt,{key:i.id,review:i})):x.default.createElement(P,{text:s("\u6CA1\u6709\u5F85\u9A8C\u6536\uFF0C\u5E76\u884C\u4EFB\u52A1\u7684\u7ED3\u679C\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u51FA\u73B0\u5728\u8FD9\u91CC")})),x.default.createElement("section",{className:"wb-section"},x.default.createElement("h3",null,x.default.createElement(A,{name:"star",size:14}),s("\u7075\u611F"),n.length?x.default.createElement(M,{tone:"idle"},n.length):null),n.length?n.map(i=>x.default.createElement(Dt,{key:i.id,idea:i})):x.default.createElement(P,{text:s("\u7075\u611F\u6536\u4EF6\u7BB1\u662F\u7A7A\u7684")})))}var t=q(require("react"),1);var xe={zcode:"ZCode",dsh:"DSH",claude:"Claude Code",codex:"Codex",chat:"\u5BF9\u8BDD",command:"\u5B66\u4E60\u4EFB\u52A1",cli:"CLI",ui:"\u5DE5\u4F5C\u53F0"};function Lt({learn:e,close:a}){let[n,i]=t.default.useState({vaultPath:e.config.vaultPath||e.resolvedVaultPath||"",notesDir:e.config.notesDir,reportHour:e.config.reportHour,organizeModel:e.config.organizeModel||null,reportSessionId:e.config.reportSessionId||"",reportPush:e.config.reportPush,sources:{...e.config.sources}}),[r,p]=t.default.useState(null),[d,l]=t.default.useState("");t.default.useEffect(()=>{let u=!0;return He().then(E=>{u&&p(E)}).catch(E=>{u&&l(E.message)}),()=>{u=!1}},[]);let o=u=>u?JSON.stringify([u.provider,u.model]):"",w=(r?.groups||[]).flatMap(u=>u.models.map(E=>({provider:u.id,model:E.id,label:`${u.name} / ${E.name}`}))),[y,g]=t.default.useState(!1),f=u=>i(E=>({...E,...u})),c=async()=>{g(!0);let u=await _e(n);g(!1),u&&!u.errors?.length&&a()};return t.default.createElement("section",{className:"wb-study-settings"},t.default.createElement("div",{className:"wb-study-section-head"},t.default.createElement("div",null,t.default.createElement("span",{className:"wb-study-eyebrow"},"STORAGE & ROUTINE"),t.default.createElement("h2",null,s("\u5B66\u4E60\u8BBE\u7F6E"))),t.default.createElement("button",{type:"button",className:"wb-btn is-ghost",onClick:a},s("\u5173\u95ED"))),t.default.createElement("div",{className:"wb-study-settings-grid"},t.default.createElement("label",{className:"wb-field"},t.default.createElement("span",null,s("Obsidian \u5E93\u8DEF\u5F84")),t.default.createElement("input",{value:n.vaultPath,onChange:u=>f({vaultPath:u.target.value}),placeholder:"/Users/\u2026/My Vault"}),t.default.createElement("small",null,s("\u9009\u62E9\u672C\u673A\u5DF2\u6709\u7684 Obsidian \u5E93\uFF1B\u4FDD\u5B58\u65F6\u9A8C\u8BC1 .obsidian \u76EE\u5F55\u3002"))),t.default.createElement("label",{className:"wb-field"},t.default.createElement("span",null,s("\u7B14\u8BB0\u76EE\u5F55\uFF08\u5E93\u5185\uFF09")),t.default.createElement("input",{value:n.notesDir,onChange:u=>f({notesDir:u.target.value}),placeholder:"AI/Agent\u5B66\u4E60"}),t.default.createElement("small",null,s("\u77E5\u8BC6\u5361\u4E0E\u65E5\u62A5\u5C06\u5199\u5230\u8FD9\u4E2A\u76EE\u5F55\u3002"))),t.default.createElement("label",{className:"wb-field"},t.default.createElement("span",null,s("\u6BCF\u65E5\u6574\u7406\u65F6\u95F4")),t.default.createElement("input",{type:"number",min:"0",max:"23",value:n.reportHour,onChange:u=>f({reportHour:Number(u.target.value)})})),t.default.createElement("label",{className:"wb-field"},t.default.createElement("span",null,s("\u6574\u7406\u6A21\u578B")),t.default.createElement("select",{value:o(n.organizeModel),onChange:u=>{let E=u.target.value,k=E?JSON.parse(E):null;f({organizeModel:k?{provider:k[0],model:k[1]}:null})}},t.default.createElement("option",{value:""},s("\u8DDF\u968F\u76EE\u6807\u4F1A\u8BDD")),n.organizeModel&&!w.some(u=>o(u)===o(n.organizeModel))&&t.default.createElement("option",{value:o(n.organizeModel)},n.organizeModel.provider," / ",n.organizeModel.model,"\uFF08",r?s("\u4E0D\u53EF\u7528"):s("\u52A0\u8F7D\u4E2D\u2026"),"\uFF09"),w.map(u=>t.default.createElement("option",{key:o(u),value:o(u)},u.label))),t.default.createElement("small",null,d||(r?s("\u9009\u62E9\u6A21\u578B\u540E\u5728\u72EC\u7ACB DSH \u4F1A\u8BDD\u4E2D\u6574\u7406\uFF1B\u53EF\u9009\u62E9\u5DF2\u63A5\u5165\u7684 GLM 5.3\u3002"):s("\u6B63\u5728\u52A0\u8F7D DSH \u6A21\u578B\u2026"))),r?.failures?.length>0&&t.default.createElement("small",{role:"alert"},s("\u90E8\u5206\u6A21\u578B\u6765\u6E90\u52A0\u8F7D\u5931\u8D25"),"\uFF1A",r.failures.map(u=>u.name).join("\u3001"))),!n.organizeModel&&t.default.createElement("label",{className:"wb-field"},t.default.createElement("span",null,s("\u76EE\u6807\u4F1A\u8BDD ID")),t.default.createElement("input",{value:n.reportSessionId,onChange:u=>f({reportSessionId:u.target.value})}),t.default.createElement("small",null,s("\u7559\u7A7A\u5219\u4F7F\u7528\u6700\u8FD1\u6D3B\u8DC3\u7684\u5DE5\u4F5C\u53F0\u4EFB\u52A1\u4F1A\u8BDD\u3002"))),t.default.createElement("label",{className:"wb-study-switch"},t.default.createElement("input",{type:"checkbox",checked:n.reportPush,onChange:u=>f({reportPush:u.target.checked})}),s("\u6BCF\u5929\u81EA\u52A8\u6574\u7406"))),t.default.createElement("div",{className:"wb-study-source-options"},t.default.createElement("span",null,s("\u626B\u63CF\u6765\u6E90")),Object.keys(n.sources).map(u=>t.default.createElement("label",{key:u},t.default.createElement("input",{type:"checkbox",checked:n.sources[u],onChange:E=>f({sources:{...n.sources,[u]:E.target.checked}})}),xe[u]||u))),t.default.createElement("div",{className:"wb-study-settings-foot"},t.default.createElement("span",null,s("\u8DEF\u5F84\u53D8\u66F4\u53EA\u5F71\u54CD\u4E4B\u540E\u65B0\u5199\u5165\u7684\u7B14\u8BB0\u3002")),t.default.createElement("button",{type:"button",className:"wb-btn is-primary",disabled:y,onClick:c},y?s("\u68C0\u67E5\u4E2D\u2026"):s("\u4FDD\u5B58\u8BBE\u7F6E"))))}function At({rows:e}){return e.length?t.default.createElement("section",{className:"wb-study-section"},t.default.createElement("div",{className:"wb-study-section-head"},t.default.createElement("div",null,t.default.createElement("span",{className:"wb-study-eyebrow"},"INBOX"),t.default.createElement("h2",null,s("\u5F85\u6574\u7406\u7684\u5B66\u4E60\u95EE\u9898")," ",t.default.createElement("em",null,e.length)))),t.default.createElement("div",{className:"wb-study-inbox"},e.map(a=>t.default.createElement("div",{key:a.id,className:"wb-study-inbox-item"},t.default.createElement("span",{className:"wb-study-inbox-dot"}),t.default.createElement("div",null,t.default.createElement("strong",null,a.question),a.context&&t.default.createElement("small",null,a.context)),t.default.createElement("span",null,xe[a.source]||a.source),t.default.createElement("button",{type:"button",className:"wb-btn is-ghost",onClick:()=>Oe(a.id)},s("\u79FB\u9664")))))):null}function Mt(){let[e,a]=t.default.useState(null);return t.default.useEffect(()=>{Ue().then(a).catch(()=>a(null))},[]),e?t.default.createElement("details",{className:"wb-study-candidates"},t.default.createElement("summary",null,s("\u67E5\u770B\u8FD1\u671F\u626B\u63CF\u5019\u9009")," ",t.default.createElement("span",null,e.candidates.length),t.default.createElement("small",null,s("\u4EC5\u4F5C\u9884\u89C8\uFF0C\u6574\u7406\u65F6\u8FD8\u4F1A\u5224\u65AD\u662F\u5426\u503C\u5F97\u8BB0\u5F55"))),e.errors?.length>0&&t.default.createElement("p",null,s("\u90E8\u5206\u6765\u6E90\u626B\u63CF\u5931\u8D25"),"\uFF1A",e.errors.map(n=>n.source).join("\u3001")),e.candidates.length?t.default.createElement("ul",null,e.candidates.slice(0,20).map(n=>t.default.createElement("li",{key:n.key},t.default.createElement("b",null,xe[n.source]||n.source),t.default.createElement("span",null,n.text)))):t.default.createElement("p",null,s("\u8FD1\u671F\u6CA1\u6709\u5019\u9009\u95EE\u9898"))):null}function fe({text:e,entries:a,select:n}){return t.default.createElement("div",{className:"wb-learning-prose"},String(e||"").split(`
`).map((i,r)=>{let p=i.split(/(\[\[[^\]]+\]\])/g).map((l,o)=>{if(!l.startsWith("[["))return l.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((f,c)=>f.startsWith("**")?t.default.createElement("strong",{key:c},f.slice(2,-2)):f.startsWith("`")?t.default.createElement("code",{key:c},f.slice(1,-1)):f);let[w,y]=l.slice(2,-2).split("|"),g=a.find(f=>f.notePath?.replace(/\.md$/,"")===w||f.title===w);return g?t.default.createElement("button",{className:"wb-text-link",key:o,onClick:()=>n(g.id)},y||g.title):y||w});return i.match(/^(#{1,3}) /)?t.default.createElement("h3",{key:r},i.replace(/^#+ /,"")):t.default.createElement("div",{key:r},p.length===1&&!i?"\xA0":p)}))}function nt({entry:e,entries:a,selected:n,select:i,seen:r=[]}){if(r.includes(e.id)||r.length>14)return null;let p=a.filter(o=>o.parentIds?.includes(e.id)),d=new Set,l=[n];for(;l.length;){let o=l.pop();d.has(o)||(d.add(o),l.push(...a.find(w=>w.id===o)?.parentIds||[]))}return t.default.createElement("li",null,t.default.createElement("button",{type:"button",className:`wb-branch-row ${n===e.id?"is-selected":""}`,onClick:()=>i(e.id),"aria-current":n===e.id?"true":void 0},t.default.createElement("span",{className:`wb-branch-dot is-${e.kind||"question"}`}),t.default.createElement("span",null,e.title,t.default.createElement("small",null,e.kind==="suggested"?"\u5EFA\u8BAE\u63A2\u7D22":e.answer?e.status==="mastered"?"\u5DF2\u638C\u63E1":e.concept||"\u5DF2\u8BB0\u5F55":"\u5F85\u56DE\u7B54"))),p.length>0&&t.default.createElement("details",{open:r.length<1||d.has(e.id)},t.default.createElement("summary",null,p.length," \u4E2A\u5EF6\u4F38\u95EE\u9898"),t.default.createElement("ul",null,p.map(o=>t.default.createElement(nt,{key:o.id,entry:o,entries:a,selected:n,select:i,seen:[...r,e.id]})))))}function Ot({entry:e,entries:a,select:n,review:i=!1}){let[r,p]=t.default.useState(!i),[d,l]=t.default.useState(""),[o,w]=t.default.useState(""),[y,g]=t.default.useState(!1),[f,c]=t.default.useState(null),[u,E]=t.default.useState(""),k=t.default.useRef(null),$=()=>{let h=window.getSelection();if(h&&k.current?.contains(h.anchorNode)&&k.current?.contains(h.focusNode)){let I=h.toString().trim().slice(0,2e3);I&&[e.answer,e.question].some(j=>j.includes(I))&&w(I)}},_=async h=>{if(h.preventDefault(),y||!d.trim())return;g(!0);let I=await We(e.id,d,o);g(!1),I&&(n(I.entryId),R(I.sessionId))},V=async h=>{g(!0),await Pe(e.id,h,e.title),g(!1)},T=(h=>a.filter(I=>h?.includes(I.id)))(e.parentIds),O=a.filter(h=>h.parentIds?.includes(e.id)),te=a.filter(h=>e.relatedIds?.includes(h.id)||h.relatedIds?.includes(e.id));return t.default.createElement("article",{className:"wb-knowledge-detail"},t.default.createElement("nav",{className:"wb-knowledge-path","aria-label":"\u77E5\u8BC6\u6765\u6E90"},T.length?T.map(h=>t.default.createElement("button",{key:h.id,className:"wb-text-link",onClick:()=>n(h.id)},h.title," \u2192")):t.default.createElement("span",null,"\u5B66\u4E60\u8D77\u70B9")),t.default.createElement("div",{className:"wb-knowledge-heading"},t.default.createElement("span",null,e.kind==="suggested"?"AI \u5EFA\u8BAE \xB7 \u5F85\u4F60\u5224\u65AD":e.kind==="followup"?"\u6211\u7684\u8FFD\u95EE":"\u6211\u7684\u77E5\u8BC6\u70B9"),t.default.createElement("span",null,e.concept)),t.default.createElement("h2",null,e.title),e.evidence&&t.default.createElement("p",{className:"wb-learning-evidence"},e.kind==="suggested"?"\u5EFA\u8BAE\u4F9D\u636E\uFF1A":"\u6765\u6E90\uFF1A",e.evidence),t.default.createElement("div",{ref:k,onMouseUp:$,onKeyUp:$},t.default.createElement("p",{className:"wb-knowledge-question"},e.question),i&&!r?t.default.createElement("div",{className:"wb-learning-recall"},t.default.createElement("p",null,"\u5148\u8BD5\u7740\u7528\u81EA\u5DF1\u7684\u8BDD\u56DE\u7B54\uFF0C\u518D\u5C55\u5F00\u6838\u5BF9\u3002"),t.default.createElement("button",{className:"wb-btn",onClick:()=>p(!0)},"\u770B\u7B54\u6848")):e.answer?t.default.createElement(fe,{text:e.answer,entries:a,select:n}):t.default.createElement("p",{className:"wb-learning-empty-answer"},"\u8FD9\u4E2A\u8FFD\u95EE\u5DF2\u8BB0\u5F55\u3002\u5BF9\u8BDD\u4E2D\u7684\u56DE\u7B54\u4F1A\u81EA\u52A8\u56DE\u5230\u8FD9\u91CC\uFF1B\u82E5\u56DE\u7B54\u4E2D\u65AD\uFF0C\u53EF\u7EE7\u7EED\u8FDB\u5165\u539F\u5BF9\u8BDD\u3002")),e.lastRunError&&t.default.createElement("p",{role:"alert",className:"wb-learning-evidence"},"\u8FD9\u8F6E\u56DE\u7B54\u672A\u5B8C\u6210\uFF1A",e.lastRunError,"\u3002\u95EE\u9898\u5DF2\u4FDD\u7559\uFF0C\u53EF\u7EE7\u7EED\u539F\u5BF9\u8BDD\u91CD\u8BD5\u3002"),e.why&&t.default.createElement("p",{className:"wb-study-why"},e.why),t.default.createElement("div",{className:"wb-knowledge-actions"},e.learningSessionId&&t.default.createElement("button",{className:"wb-btn",onClick:()=>R(e.learningSessionId)},"\u7EE7\u7EED\u539F\u5BF9\u8BDD \u2197"),r&&e.answer&&e.kind!=="suggested"&&e.status==="recorded"&&t.default.createElement("button",{className:"wb-btn",disabled:y,onClick:()=>V("reviewed")},"\u5DF2\u590D\u4E60"),t.default.createElement("button",{className:"wb-btn is-ghost",disabled:y,onClick:()=>V(e.status==="mastered"?"reopen":"mastered")},e.status==="mastered"?"\u91CD\u65B0\u5B66\u4E60":"\u5DF2\u638C\u63E1"),t.default.createElement("button",{className:"wb-btn is-ghost",disabled:y,onClick:()=>V(e.status==="ignored"?"reopen":"ignored")},e.status==="ignored"?"\u6062\u590D\u8BB0\u5F55":"\u6682\u4E0D\u5B66\u4E60")),t.default.createElement("form",{className:"wb-learning-followup",onSubmit:_},t.default.createElement("label",{htmlFor:"wb-followup"},"\u7EE7\u7EED\u63A2\u7D22\u8FD9\u4E2A\u95EE\u9898"),t.default.createElement("p",null,"\u8FFD\u95EE\u4F1A\u5728\u65B0\u7684 DSH \u5BF9\u8BDD\u4E2D\u5C55\u5F00\uFF1B\u65B0\u7684\u95EE\u9898\u548C\u56DE\u7B54\u4F1A\u7559\u5728\u8FD9\u6761\u5B66\u4E60\u8109\u7EDC\u91CC\u3002"),o&&t.default.createElement("div",{className:"wb-learning-quote"},t.default.createElement("blockquote",null,o),t.default.createElement("button",{type:"button",className:"wb-btn",onClick:()=>Ve(e.id,o)},"\u4FDD\u5B58\u5212\u7EBF"),t.default.createElement("button",{type:"button",className:"wb-btn is-ghost",onClick:()=>w("")},"\u6E05\u9664\u9009\u4E2D")),t.default.createElement("textarea",{id:"wb-followup",value:d,maxLength:12e3,onChange:h=>l(h.target.value),placeholder:o?"\u8FD9\u6BB5\u8BDD\u54EA\u91CC\u4E0D\u7406\u89E3\uFF1F":"\u4F8B\u5982\uFF1A\u5B83\u4E3A\u4EC0\u4E48\u8FD9\u6837\u8BBE\u8BA1\uFF1F\u80FD\u7ED9\u6211\u4E00\u4E2A\u5B9E\u9645\u4F8B\u5B50\u5417\uFF1F"}),t.default.createElement("div",null,t.default.createElement("small",null,"\u53EF\u9009\u4E2D\u4E0A\u65B9\u539F\u95EE\u9898\u6216\u7B54\u6848\u4E2D\u7684\u6587\u5B57\u8FFD\u95EE\uFF0C\u4E5F\u53EF\u76F4\u63A5\u8F93\u5165\u95EE\u9898\u3002"),t.default.createElement("button",{type:"submit",className:"wb-btn is-primary",disabled:y||!d.trim()},y?"\u6B63\u5728\u521B\u5EFA\u2026":"\u65B0\u5EFA\u5BF9\u8BDD\u8FFD\u95EE \u2197"))),e.highlights?.length>0&&t.default.createElement("section",{className:"wb-learning-links"},t.default.createElement("h3",null,"\u6211\u7684\u5212\u7EBF"),e.highlights.map(h=>t.default.createElement("button",{className:"wb-highlight",key:h.id,onClick:()=>{w(h.text),l("\u8BF7\u7ED3\u5408\u4F8B\u5B50\u8FDB\u4E00\u6B65\u89E3\u91CA\u8FD9\u6BB5\u8BDD")}},h.text))),[["\u5EF6\u4F38\u95EE\u9898",O],["\u5173\u8054\u77E5\u8BC6",te]].map(([h,I])=>I.length>0&&t.default.createElement("section",{className:"wb-learning-links",key:h},t.default.createElement("h3",null,h," ",t.default.createElement("small",null,I.length)),I.map(j=>t.default.createElement("button",{key:j.id,onClick:()=>n(j.id)},t.default.createElement("span",null,j.kind==="suggested"?"\u5EFA\u8BAE\u63A2\u7D22 \xB7 ":"",j.title),t.default.createElement("span",null,"\u2192"))))),t.default.createElement("details",{className:"wb-learning-storage"},t.default.createElement("summary",null,"\u7B14\u8BB0\u6587\u4EF6\u4E0E\u540C\u6B65"),t.default.createElement("p",null,e.syncError||e.notePath||"\u5BF9\u8BDD\u5B8C\u6210\u540E\u540C\u6B65\u5230\u7B14\u8BB0\u5E93"),t.default.createElement("button",{className:"wb-btn",onClick:()=>Fe(e.id)},"\u540C\u6B65\u7B14\u8BB0"),e.notePath&&t.default.createElement(t.default.Fragment,null,t.default.createElement("button",{className:"wb-btn",onClick:async()=>{try{c(await Ze(e.id)),E("")}catch(h){E(h.message)}}},"\u5728\u6B64\u67E5\u770B\u7B14\u8BB0\u539F\u6587"),t.default.createElement("button",{className:"wb-btn is-ghost",onClick:()=>Be(e.notePath)},"\u5728 Obsidian \u6253\u5F00 \u2197")),u&&t.default.createElement("p",{role:"alert"},u),f&&t.default.createElement(fe,{text:f.content,entries:a,select:n})))}function Pt({entries:e,select:a}){let[n,i]=t.default.useState([]),[r,p]=t.default.useState(null),[d,l]=t.default.useState(""),[o,w]=t.default.useState(!0);t.default.useEffect(()=>{let g=!0;return Ke().then(f=>{g&&i(f.reports)}).catch(f=>{g&&l(f.message)}).finally(()=>{g&&w(!1)}),()=>{g=!1}},[]);let y=async g=>{w(!0),l("");try{p(await Ye(g))}catch(f){l(f.message)}finally{w(!1)}};return t.default.createElement("section",{className:"wb-learning-reports"},t.default.createElement("div",{className:"wb-learning-report-list"},t.default.createElement("h2",null,"\u5B66\u4E60\u65E5\u62A5"),n.map(g=>t.default.createElement("button",{className:`wb-btn ${r?.id===g.id?"is-primary":""}`,key:g.id,onClick:()=>y(g.id)},g.date))),t.default.createElement("div",null,d&&t.default.createElement("p",{role:"alert"},d),o?t.default.createElement("p",null,"\u6B63\u5728\u8BFB\u53D6\u65E5\u62A5\u2026"):r?t.default.createElement(fe,{text:r.content,entries:e,select:a}):t.default.createElement("p",null,n.length?"\u9009\u62E9\u65E5\u671F\uFF0C\u5728\u5DE5\u4F5C\u53F0\u5185\u67E5\u770B\u65E5\u62A5\u3002\u70B9\u51FB\u77E5\u8BC6\u94FE\u63A5\u53EF\u8FDB\u5165\u5B66\u4E60\u8109\u7EDC\u3002":"\u8FD8\u6CA1\u6709\u5B66\u4E60\u65E5\u62A5\uFF1B\u5B8C\u6210\u4E00\u8F6E\u6574\u7406\u540E\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002")))}function rt(){let e=N(m=>m.state),a=N(m=>m.filter),n=N(m=>m.learnSettings),i=N(m=>m.learnSelectedId),[r,p]=t.default.useState("library"),[d,l]=t.default.useState(""),[o,w]=t.default.useState(!1),y=e?.learn;if(!y)return t.default.createElement(P,{text:s("\u52A0\u8F7D\u4E2D\u2026")});let g=y.entries||[],f=g.filter(m=>m.status==="recorded"&&m.kind!=="suggested"&&m.answer&&(!m.nextReviewAt||Date.parse(m.nextReviewAt)<=Date.now())),c=a.trim().toLowerCase(),u=g.filter(m=>r==="ignored"?m.status==="ignored":m.status!=="ignored"),E=(r==="review"?f:r==="suggested"?u.filter(m=>m.kind==="suggested"):u).filter(m=>!c||[m.title,m.question,m.concept,m.answer].some(T=>String(T).toLowerCase().includes(c))),k=E.filter(m=>!m.parentIds?.some(T=>E.some(O=>O.id===T))),$=E.find(m=>m.id===i)||E.find(m=>m.kind!=="suggested")||E[0],_=m=>{C({learnSelectedId:m}),(r==="reports"||!E.some(T=>T.id===m))&&p("library")};return t.default.createElement("div",{className:"wb-study-page"},t.default.createElement("header",{className:"wb-learning-header"},t.default.createElement("div",null,t.default.createElement("h1",null,"\u5B66\u4E60\u8109\u7EDC"),t.default.createElement("p",null,"\u4ECE\u4E00\u4E2A\u95EE\u9898\u51FA\u53D1\uFF0C\u628A\u8FFD\u95EE\u3001\u7406\u89E3\u4E0E\u590D\u4E60\u8FDE\u5728\u4E00\u8D77\u3002")),t.default.createElement("div",null,t.default.createElement("button",{className:"wb-btn",disabled:o,onClick:async()=>{w(!0),await qe(),w(!1)}},o?"\u6B63\u5728\u63D0\u4EA4\u2026":"\u7ACB\u5373\u6574\u7406"),t.default.createElement("button",{className:"wb-btn is-ghost",onClick:()=>C({learnSettings:!n})},"\u8BBE\u7F6E"))),n&&t.default.createElement(Lt,{learn:y,close:()=>C({learnSettings:!1})}),t.default.createElement("form",{className:"wb-study-capture",onSubmit:async m=>{m.preventDefault();let T=d.trim();if(!T)return;let O=await Me(T);O&&!O.errors?.length&&l("")}},t.default.createElement("input",{value:d,onChange:m=>l(m.target.value),placeholder:"\u8BB0\u4E0B\u4E00\u4E2A\u60F3\u5F04\u61C2\u7684\u95EE\u9898\u2026","aria-label":"\u8BB0\u4E0B\u4E00\u4E2A\u60F3\u5F04\u61C2\u7684\u95EE\u9898"}),t.default.createElement("button",{className:"wb-btn",disabled:!d.trim()},"\u52A0\u5165\u5F85\u6574\u7406")),t.default.createElement(At,{rows:y.inbox}),t.default.createElement("nav",{className:"wb-study-tabs","aria-label":"\u5B66\u4E60\u89C6\u56FE"},[["library","\u5B66\u4E60\u7F51\u7EDC",u.length],["review","\u4ECA\u65E5\u590D\u4E60",f.length],["suggested","\u5EFA\u8BAE\u63A2\u7D22",g.filter(m=>m.kind==="suggested"&&m.status!=="ignored").length],["reports","\u5B66\u4E60\u65E5\u62A5",null],["ignored","\u6682\u4E0D\u5B66\u4E60",g.filter(m=>m.status==="ignored").length]].map(([m,T,O])=>t.default.createElement("button",{key:m,className:r===m?"is-on":"","aria-current":r===m?"page":void 0,onClick:()=>p(m)},T,O!==null&&t.default.createElement("span",null,O)))),r==="reports"?t.default.createElement(Pt,{entries:g,select:_}):t.default.createElement("div",{className:"wb-learning-workspace"},t.default.createElement("aside",{className:"wb-learning-outline"},t.default.createElement("input",{className:"wb-filter","aria-label":"\u641C\u7D22\u5B66\u4E60\u5185\u5BB9",value:a,placeholder:"\u641C\u7D22\u95EE\u9898\u3001\u6982\u5FF5\u6216\u7B54\u6848",onChange:m=>C({filter:m.target.value})}),t.default.createElement("p",null,r==="review"?"\u5F85\u590D\u4E60\u7684\u95EE\u9898":r==="suggested"?"\u5EFA\u8BAE\u4E0D\u662F\u7ED3\u8BBA\uFF0C\u53EF\u9009\u62E9\u63A2\u7D22\u6216\u6682\u4E0D\u5B66\u4E60":"\u95EE\u9898\u4E0E\u5EF6\u4F38\u5206\u652F"),t.default.createElement("ul",null,k.map(m=>t.default.createElement(nt,{key:m.id,entry:m,entries:E,selected:$?.id,select:_}))),!E.length&&t.default.createElement("p",null,"\u8FD9\u91CC\u6682\u65F6\u6CA1\u6709\u8BB0\u5F55\u3002\u8BB0\u5F55\u95EE\u9898\u6216\u6574\u7406\u5386\u53F2\u5BF9\u8BDD\u540E\uFF0C\u518D\u4ECE\u77E5\u8BC6\u70B9\u5F00\u59CB\u8FFD\u95EE\u3002")),$?t.default.createElement(Ot,{key:`${$.id}:${r}`,entry:$,entries:g,select:_,review:r==="review"}):t.default.createElement("div",{className:"wb-study-empty"},t.default.createElement("h2",null,"\u4ECE\u4E00\u4E2A\u60F3\u5F04\u61C2\u7684\u95EE\u9898\u5F00\u59CB"),t.default.createElement("p",null,"\u6574\u7406\u5DF2\u6709\u63D0\u95EE\u540E\uFF0C\u9009\u62E9\u77E5\u8BC6\u70B9\u9605\u8BFB\u3001\u5212\u7EBF\u6216\u8FFD\u95EE\uFF0C\u5EF6\u4F38\u7684\u95EE\u9898\u4F1A\u5728\u5DE6\u4FA7\u8FDE\u8D77\u6765\u3002"))),t.default.createElement(Mt,null))}var v=q(require("react"),1);var _t=["\u5468\u65E5","\u5468\u4E00","\u5468\u4E8C","\u5468\u4E09","\u5468\u56DB","\u5468\u4E94","\u5468\u516D"],jt={doing:"focus",due:"calendar",focus:"star"};function Ut({state:e}){let[a,n]=v.default.useState(!1),i=new Date,r=K(i),p=K(new Date(i.getTime()-864e5)),d=e.tasks.filter(c=>c.status==="done"&&c.completedAt&&ue(c.completedAt)===p),l=e.tasks.filter(c=>c.status!=="done"&&c.due&&c.due<=r),o=e.tasks.filter(c=>c.status==="blocked"),w=e.reviews.filter(c=>c.status==="pending"),y=e.ideas.filter(c=>c.status==="parked").length;if(!(d.length||l.length||o.length||w.length))return null;let f=[`${s("\u6628\u65E5\u5B8C\u6210")} ${d.length}`,`${s("\u4ECA\u5929\u5230\u671F")} ${l.length}`,o.length?`${s("\u53D7\u963B")} ${o.length}`:"",w.length?`${s("\u5F85\u9A8C\u6536")} ${w.length}`:"",y?`${s("\u7075\u611F")} ${y}`:""].filter(Boolean).join(" \xB7 ");return v.default.createElement("div",{className:"wb-brief"},v.default.createElement("div",{className:"wb-brief-head",role:"button",tabIndex:0,onClick:()=>n(!a),onKeyDown:c=>{(c.key==="Enter"||c.key===" ")&&(c.preventDefault(),n(!a))}},v.default.createElement(A,{name:"calendar",size:13}),v.default.createElement("span",{className:"wb-brief-date"},`${r.slice(5)} ${s(_t[i.getDay()])}`),v.default.createElement("span",{className:"wb-brief-summary"},f),v.default.createElement("span",{className:"wb-count"},a?"\u2212":"+")),a?v.default.createElement("div",{className:"wb-brief-body"},d.length?v.default.createElement("p",null,`${s("\u6628\u65E5\u5B8C\u6210")} ${d.length}\uFF1A`,d.map(c=>c.title).join("\uFF1B")):null,l.length?v.default.createElement("p",null,`${s("\u4ECA\u5929\u5230\u671F")} ${l.length}\uFF1A`,l.map(c=>`${c.title}${c.due<r?s("\uFF08\u903E\u671F\uFF09"):""}`).join("\uFF1B")):null,o.length?v.default.createElement("p",{className:"is-warn"},`${s("\u53D7\u963B")} ${o.length}\uFF1A`,o.map(c=>c.title).join("\uFF1B")):null,w.length?v.default.createElement("p",null,`${s("\u5F85\u9A8C\u6536")} ${w.length}`):null):null)}function Ht(){let e=N(r=>r.captureKind),[a,n]=v.default.useState(""),i=async r=>{r.preventDefault();let p=a.trim();p&&(n(""),e==="task"?await Ie({title:p,status:"todo"},`\u65B0\u5EFA\u300C${p.slice(0,16)}\u300D`):await De(p))};return v.default.createElement("form",{className:"wb-capture",onSubmit:i},v.default.createElement("input",{value:a,onChange:r=>n(r.target.value),"aria-label":s("\u8BB0\u4E00\u53E5\u8BDD\uFF0C\u56DE\u8F66\u6536\u8FDB\u7075\u611F\u6536\u4EF6\u7BB1"),placeholder:s("\u8BB0\u4E00\u53E5\u8BDD\uFF0C\u56DE\u8F66\u6536\u8FDB\u7075\u611F\u6536\u4EF6\u7BB1")}),v.default.createElement("div",{className:"wb-capture-kind",role:"tablist"},["idea","task"].map(r=>v.default.createElement("button",{key:r,type:"button",role:"tab","aria-selected":e===r,className:e===r?"is-on":"",onClick:()=>C({captureKind:r})},s(r==="idea"?"\u7075\u611F":"\u4EFB\u52A1")))),v.default.createElement("button",{type:"submit",className:"wb-btn is-primary",disabled:!a.trim()},s(e==="idea"?"\u6536\u8FDB\u6536\u4EF6\u7BB1":"\u76F4\u63A5\u5EFA\u4EFB\u52A1")))}function he(){let e=N(d=>d.state),[a,n]=v.default.useState(!1),{sections:i,doneToday:r,today:p}=oe(e);return v.default.createElement("div",{className:"wb-page"},v.default.createElement(Ut,{state:e}),v.default.createElement(Ht,null),i.length===0&&!r.length?v.default.createElement(P,{text:s("\u4ECA\u5929\u8FD8\u6CA1\u6709\u5B89\u6392\uFF1B\u5BF9\u8BDD\u91CC\u63D0\u5230\u7684\u4E8B\u60C5\u4F1A\u81EA\u52A8\u767B\u8BB0\u8FDB\u6765")}):null,i.map(d=>v.default.createElement("section",{key:d.key,className:"wb-section"},v.default.createElement("h3",null,v.default.createElement(A,{name:jt[d.key]??"calendar",size:14}),s(d.title),v.default.createElement("span",{className:"wb-count"},d.tasks.length)),d.tasks.map(l=>v.default.createElement(ee,{key:l.id,task:l,today:p})))),r.length?v.default.createElement("section",{className:"wb-section"},v.default.createElement("h3",{onClick:()=>n(!a),style:{cursor:"pointer"}},v.default.createElement(A,{name:"check",size:14}),s("\u4ECA\u65E5\u5B8C\u6210 {n} \u4EF6",{n:r.length}),v.default.createElement("span",{className:"wb-count"},a?"\u2212":"+")),a?r.map(d=>v.default.createElement(ee,{key:d.id,task:d,today:p})):null):null)}var st="workbench",qt={today:he,all:tt,inbox:at,learn:rt},Bt=[["today","\u4ECA\u5929","calendar"],["all","\u5168\u90E8","inbox"],["inbox","\u6536\u4EF6\u7BB1","star"],["learn","\u5B66\u4E60","focus"]];function Wt(){let e=N(c=>!!c.state),a=N(c=>c.error),n=N(c=>c.view),i=N(c=>c.canUndo),r=N(c=>c.state);S.default.useEffect(()=>(Z(),ie()),[]);let p=r?.reviews?.filter(c=>c.status==="pending").length??0,d=r?.ideas?.filter(c=>c.status==="parked").length??0,l=r?.learn?.inbox?.length??0,{sections:o,doneToday:w,today:y}=r?oe(r):{sections:[],doneToday:[],today:""},g=o.reduce((c,u)=>c+u.tasks.length,0),f=qt[n]??he;return S.default.createElement("div",{className:"wb-root"},S.default.createElement("style",null,ne),S.default.createElement("header",{className:"wb-topbar"},S.default.createElement("span",{className:"wb-title"},S.default.createElement(A,{name:"check",size:15}),s("\u4E2A\u4EBA\u5DE5\u4F5C\u53F0")),S.default.createElement("nav",{className:"wb-nav","aria-label":s("\u5DE5\u4F5C\u53F0\u9762\u677F")},Bt.map(([c,u])=>S.default.createElement("button",{key:c,type:"button",className:n===c?"is-on":"","aria-current":n===c?"page":void 0,onClick:()=>C({view:c,expandedId:null})},s(u),c==="today"&&g?S.default.createElement("i",{className:"wb-badge"},g):null,c==="inbox"&&p?S.default.createElement("i",{className:"wb-badge is-warn"},p):null,c==="learn"&&l?S.default.createElement("i",{className:"wb-badge is-warn"},l):null))),S.default.createElement("span",{style:{flex:1}}),i?S.default.createElement(we,{icon:"undo",label:s("\u64A4\u9500"),onClick:Ce}):null,S.default.createElement(we,{icon:"refresh",label:s("\u5237\u65B0"),onClick:Y})),S.default.createElement("div",{className:"wb-strip"},`${s("\u4ECA\u5929")} ${g} \xB7 ${s("\u8FDB\u884C\u4E2D")} ${r?.tasks?.filter(c=>c.status==="doing").length??0} \xB7 ${s("\u4ECA\u65E5\u5B8C\u6210 {n} \u4EF6",{n:w.length})}`+(p?` \xB7 ${s("\u5F85\u9A8C\u6536")} ${p}`:"")+(d?` \xB7 ${s("\u7075\u611F")} ${d}`:"")),S.default.createElement("main",{className:"wb-content"},a&&!r?S.default.createElement("div",{className:"wb-page"},S.default.createElement("p",{className:"wb-empty"},s("\u5DE5\u4F5C\u53F0\u52A0\u8F7D\u5931\u8D25\uFF1A{error}",{error:a})),S.default.createElement("button",{type:"button",className:"wb-btn",onClick:Z},s("\u91CD\u8BD5"))):e?S.default.createElement(f,null):S.default.createElement(P,{text:s("\u52A0\u8F7D\u4E2D\u2026")})),S.default.createElement(et,null))}function Vt({size:e}){return S.default.createElement(A,{name:"inbox",size:e})}var Ft=["slots"];function Kt(e){Qe({openSession:r=>{try{let p=(typeof e.get=="function"?e.get("uiWorkspace"):void 0)||(typeof e.uiWorkspace=="object"?e.uiWorkspace:void 0);if(p&&typeof p.openSession=="function"){p.openSession(r);return}console.warn("[dsh-workbench] uiWorkspace \u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u8DF3\u8F6C\u4F1A\u8BDD")}catch(p){console.warn("[dsh-workbench] \u8DF3\u8F6C\u4F1A\u8BDD\u5931\u8D25\uFF1A",p)}},sessionLabel:r=>{try{let d=(typeof e.get=="function"?e.get("sessions"):void 0)?.list?.getSnapshot?.()?.byId?.[r];return typeof d?.displayTitle=="string"?d.displayTitle:typeof d?.title=="string"?d.title:""}catch{return""}}});let i=typeof e.get=="function"?e.get("commandUi"):void 0;i&&typeof i.register=="function"&&e.effect(()=>i.register({name:"\u5B66\u4E60\u4EFB\u52A1",label:()=>s("\u5B66\u4E60\u4EFB\u52A1\uFF1A\u4E0B\u4E00\u6761\u6D88\u606F\u96F6\u6210\u672C\u8BB0\u4E3A\u5B66\u4E60\u63D0\u95EE"),description:()=>s("\u5F00\u542F\u540E\uFF0C\u672C\u4F1A\u8BDD\u4F60\u53D1\u9001\u7684\u4E0B\u4E00\u6761\u6D88\u606F\u4F1A\u88AB\u76F4\u63A5\u8BB0\u5F55\u4E3A\u5B66\u4E60\u63D0\u95EE\uFF08\u4E0D\u89E6\u53D1\u6A21\u578B\u56DE\u590D\uFF09\uFF0C\u8BB0\u5F55\u4F1A\u5728\u6BCF\u665A\u6574\u7406\u65F6\u5199\u8FDB Obsidian\u3002"),available:()=>!0,ui:{kind:"action",run:r=>{let p=typeof r?.sessionId=="string"?r.sessionId:"";p&&je(p,!0)}}}),"dsh-workbench: learn command"),e.slots.inject("main",()=>e.slots.register({name:"main",key:st},Wt)),e.slots.inject("conversation.input.dock",()=>e.slots.register({name:"conversation.input.dock",id:"workbench-open",order:30,inject:r=>({sessionId:String(r??"")})},Xe)),e.effect(()=>{let r=null;(()=>{r?.(),r=e.slots.inject("sidebar.panellist",()=>e.slots.register({name:"sidebar.panellist",id:st,order:5,label:()=>s("\u4E2A\u4EBA\u5DE5\u4F5C\u53F0")},Vt))})();try{let d=e.get("locale");if(d&&typeof d.getLocale=="function"){let l=d.getLocale();Ee(l?.id??l)}}catch{}return()=>{r?.()}},"dsh-workbench: sidebar entry")}
return module.exports}})
