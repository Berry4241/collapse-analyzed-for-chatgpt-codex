/* v1.6.0: collapse-only, batched, yield-to-browser, verified. */
(async () => {
  "use strict";
  const VERSION = "1.6.0";
  const GLOBAL = "__caFastV16";
  const ROW = "data-ca16-row";
  const FOLD = "data-ca16-fold";
  const PRIOR = "data-ca16-before";
  const LABEL = /^analy[sz]ed$/i;
  const CODE = "pre,[data-testid*='code' i],[class*='code-block' i],[class*='codeblock' i],.cm-editor";
  const STOP = "figure,img,picture,canvas,video,table,iframe,[data-message-author-role='user']";
  const TOAST = "ca16-toast";
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const text = s => String(s || "").replace(/\s+/g, " ").trim();
  // A scan reads the same boxes many times. Memoize ONLY while the DOM is
  // stable; never retain geometry across a click or a hide batch.
  let rectMemo = null, visibleMemo = null;
  const rect = el => {
    if (!rectMemo) return el.getBoundingClientRect();
    let found = rectMemo.get(el);
    if (!found) { found=el.getBoundingClientRect(); rectMemo.set(el,found); }
    return found;
  };
  const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));
  const BATCH = 10;
  const SCAN_BATCH = 50;
  const resetScanMemo = () => {
    rectMemo=new WeakMap();
    visibleMemo=new WeakMap();
  };
  const isEl = n => n?.nodeType === 1;
  const escaped = s => CSS.escape(s);
  const isVisible = el => {
    if (!isEl(el) || !el.isConnected) return false;
    if (visibleMemo?.has(el)) return visibleMemo.get(el);
    let ok = !el.closest("[hidden]");
    if (ok && el.checkVisibility) ok=el.checkVisibility({visibilityProperty:true});
    if (ok) {
      const r=rect(el);
      ok=r.height>2 && r.width>2;
    }
    visibleMemo?.set(el,ok);
    return ok;
  };
  const currentRoot = n => n.getRootNode();

  function headings() {
    const result=[], seen=new Set();
    function walk(root) {
      const tw=document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let t; (t=tw.nextNode());) {
        if (t.nodeValue.length>35 || !LABEL.test(text(t.nodeValue))) continue;
        const label=t.parentElement;
        if (!label || seen.has(label) || !isVisible(label) ||
            label.closest("pre,code,kbd,samp,textarea,input,script,style,[contenteditable='true'],[data-ca16-toast]") ||
            label.closest("[data-message-author-role='user']")) continue;
        seen.add(label);
        result.push(label);
      }
      for (const el of root.querySelectorAll("*")) if (el.shadowRoot) walk(el.shadowRoot);
    }
    walk(document.body);
    return result;
  }
  function countsFor(labels) {
    const count=new Map();
    for (const l of labels)
      for (let e=l; e && e!==document.body; e=e.parentElement)
        count.set(e,(count.get(e)||0)+1);
    return count;
  }
  function otherHeading(el, label, counts) {
    return (counts.get(el)||0)>(el.contains(label)?1:0);
  }
  function selectTrigger(label, counts) {
    // Prefer a real disclosure element containing this exact text.
    for (let e=label, depth=0; e && depth<8; e=e.parentElement,depth++) {
      if (e===document.body || otherHeading(e,label,counts)) break;
      if (e.matches("summary,button,[role='button'],[aria-expanded]") &&
          isVisible(e) && rect(e).height<125 && text(e.innerText).length<110) return e;
    }
    // Many ChatGPT controls are clickable divs without aria-expanded.
    // Keep the header bounded: never click a containing response or tool body.
    let row=label;
    for(let e=label.parentElement,depth=0; e && depth<7; e=e.parentElement,depth++){
      if (e===document.body || otherHeading(e,label,counts) || !isVisible(e)) break;
      const r=rect(e), s=text(e.innerText);
      if(r.height>82 || s.length>105 || e.querySelector(CODE) || e.querySelector("pre,table,figure,p")) break;
      row=e;
    }
    return row;
  }
  function state(trigger,label) {
    const det=trigger.matches("summary") ? trigger.closest("details") : label.closest("details");
    if (det) return det.open;
    let cur=trigger;
    if(!cur.hasAttribute("aria-expanded") && !cur.hasAttribute("aria-controls")) {
      cur=trigger.querySelector?.("[aria-expanded]:not([aria-haspopup]),[aria-controls]:not([aria-haspopup])") || trigger;
    }
    if (cur.hasAttribute("aria-haspopup")) return null;
    if (cur.hasAttribute("aria-expanded")) return cur.getAttribute("aria-expanded")==="true";
    if (cur.hasAttribute("aria-controls")) {
      if(cur.getAttribute("data-state")==="open") return true;
      if(cur.getAttribute("data-state")==="closed") return false;
    }
    return null;
  }
  function associated(el,heading,allHeadings) {
    if(!isVisible(el) || el.contains(heading.label)) return false;
    const er=rect(el), hr=rect(heading.trigger);
    if(er.top < hr.bottom-12 || er.top > hr.bottom+260) return false;
    if(er.right<hr.left-100 || er.left>hr.right+650) return false;
    for(const h of allHeadings) {
      if(h===heading) continue;
      const r=rect(h.trigger);
      // If another header is between the candidate and this header, it's not ours.
      if (r.top>=hr.top-2 && r.top<er.top-2 && r.top>hr.top+1 &&
          r.right>er.left-110 && r.left<er.right+100) return false;
    }
    if(el.closest("[data-message-author-role='user']"))return false;
    return true;
  }
  function hasOutputCaption(n) {
    const t=text(n.innerText);
    return /^(stdout\s*(?:\/\s*stderr)?|stderr|result)$/i.test(t);
  }
  function toolCardPre(pre) {
    // A code card is a code region with an explicit language or copy UI,
    // not a code sample in a final answer.
    for(let p=pre.parentElement,d=0;p && d<5;p=p.parentElement,d++){
      if(p.matches("article,[data-message-author-role],main")) break;
      const t=text(p.innerText);
      if(t.length>14000 || p.querySelector("table,figure,img,canvas")) break;
      if(p.querySelector("button[aria-label*='copy' i],[data-testid*='copy' i]") ||
         /^(python|javascript|typescript|bash|shell|sql|json|result|stdout\/stderr)\b/i.test(t.slice(0,50)))
        return p;
    }
    return null;
  }
  function outputCaptions() {
    const found=[], walk=root=>{
      const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      for(let t;(t=w.nextNode());) {
        if(t.nodeValue.length>45 || !/^(?:STDOUT\s*\/\s*STDERR|STDOUT|STDERR)$/i.test(text(t.nodeValue)))continue;
        const e=t.parentElement;
        if(e && isVisible(e) && !e.closest("pre,code,script,style") && !found.includes(e))found.push(e);
      }
      for(const host of root.querySelectorAll("*"))if(host.shadowRoot)walk(host.shadowRoot);
    };
    walk(document.body);
    return found;
  }
  function outputRegion(caption,h,heads,counts) {
    // Move only within the output block. Never absorb a surrounding answer,
    // next Analyzed header, image, chart, table or long prose paragraph.
    let candidate=caption;
    const origin=rect(caption);
    for(let e=caption.parentElement,depth=0;e && depth<5;e=e.parentElement,depth++){
      if(e===document.body || e.matches("article,main,[data-message-author-role]") ||
         otherHeading(e,h.label,counts) || e.querySelector(STOP) ||
         [...e.querySelectorAll("p")].some(p=>text(p.innerText).length>130))break;
      const r=rect(e);
      if(r.top<origin.top-100 || r.height>5000 || r.width>1800)break;
      candidate=e;
      // If the block has a <pre> containing the result, this is enough.
      if(e.querySelector("pre"))break;
    }
    return candidate;
  }
  function plausibleNodes(h, heads, counts, stdout=[]) {
    const nodes=[], seen=new Set();
    function add(e) {
      if(e && isVisible(e) && !seen.has(e) && !otherHeading(e,h.label,counts) &&
        !e.querySelector(STOP) && !e.matches(STOP)) {seen.add(e);nodes.push(e);}
    }
    // Explicitly controlled region is strong evidence even without <pre>.
    const ctl=h.trigger.hasAttribute("aria-controls")?h.trigger:
      h.trigger.querySelector?.("[aria-controls]:not([aria-haspopup])");
    const id=ctl?.getAttribute("aria-controls");
    if(id) {
      const region=h.label.getRootNode().getElementById?.(id) || document.getElementById(id);
      if(region && region!==h.trigger && isVisible(region) && !region.contains(h.label)
         && !otherHeading(region,h.label,counts)) {
        // The button owns this content. It is safe to use for native verification.
        add(region);
      }
    }
    const det=h.trigger.matches("summary")?h.trigger.closest("details"):h.label.closest("details");
    if(det?.open) for(const c of det.children) if(c!==det.querySelector("summary")) add(c);

    // Look at siblings of successively larger wrappers, but never hide a whole
    // answer: count only code cards and STDOUT regions, not mixed prose.
    let child=h.trigger;
    for(let depth=0;depth<12;depth++){
      let parent=child.parentElement;
      if(!parent || parent===document.body || parent.matches("article,[data-message-author-role='user']")) break;
      for(let e=child.nextElementSibling;e;e=e.nextElementSibling) {
        if(otherHeading(e,h.label,counts)) break;
        const s=text(e.innerText);
        if(e.matches(STOP) || e.querySelector(STOP) || (e.matches("p") && s.length>20)) break;
        if(!isVisible(e))continue;
        if(e.matches(CODE) || e.querySelector(CODE)) {
          // Never group a final answer's paragraph with the panel.
          const longPara=[...e.querySelectorAll("p")].some(p=>text(p.innerText).length>130);
          if(!longPara) add(e);
          else for(const pre of e.querySelectorAll(CODE))add(pre);
        } else if(hasOutputCaption(e) || /^(stdout\/stderr|stderr)(?:\s|$)/i.test(s.slice(0,18))) add(e);
        else if(s.length>40 && !/^(python|result|stdout\/stderr)/i.test(s.slice(0,20))) break;
      }
      if(nodes.length)break;
      child=parent;
    }

    // Spatial fallback: code card directly below *this* heading, not the
    // following heading. Useful when React wraps the panel at another level.
    if(nodes.length===0) {
      const scope=h.label.getRootNode();
      for(const pre of scope.querySelectorAll("pre")) {
        if(!associated(pre,h,heads)) continue;
        let p=toolCardPre(pre);
        // A plain <pre> is accepted only if the header is explicitly open.
        if(!p && h.nativeState!==true) continue;
        if(p && !associated(p,h,heads)) p=pre;
        add(p||pre);
        break;
      }
    }
    // Separate STDOUT/STDERR sometimes sits outside the code card. Verify it
    // too: otherwise hiding one <pre> could create a false 'success'.
    for(const caption of stdout) {
      add(outputRegion(caption,h,heads,counts));
    }
    return nodes;
  }
  function currentEvidence(h, heads, counts, stdout) {
    return plausibleNodes(h,heads,counts,stdout).filter(isVisible);
  }
  async function scan() {
    resetScanMemo();
    const labels=headings();
    const counts=countsFor(labels);
    const heads=[];
    for(let index=0;index<labels.length;index++){
      const label=labels[index];
      const trigger=selectTrigger(label,counts);
      heads.push({label,trigger,index,nativeState:state(trigger,label)});
      if((index+1)%SCAN_BATCH===0) {
        await yieldToBrowser();
        resetScanMemo();
      }
    }
    const stdout=outputCaptions();
    // One spatial index for captions, rather than checking every caption
    // against every heading. Chat threads are laid out vertically.
    const ordered=[...heads].sort((a,b)=>rect(a.trigger).top-rect(b.trigger).top);
    for(let i=0;i<ordered.length;i++) {
      ordered[i].nextTop=i+1<ordered.length?rect(ordered[i+1].trigger).top:Infinity;
      ordered[i].captions=[];
    }
    for(const caption of stdout) {
      const cr=rect(caption);
      let lo=0,hi=ordered.length;
      while(lo<hi) {
        const mid=(lo+hi)>>1;
        if(rect(ordered[mid].trigger).bottom-6<=cr.top)lo=mid+1;
        else hi=mid;
      }
      const target=ordered[lo-1];
      if(!target)continue;
      const hr=rect(target.trigger);
      if(cr.top<target.nextTop-2 && cr.right>=hr.left-110 &&
         cr.left<=hr.right+650) target.captions.push(caption);
    }
    for(let i=0;i<heads.length;i++) {
      const h=heads[i];
      h.nodes=currentEvidence(h,heads,counts,h.captions);
      if((i+1)%SCAN_BATCH===0) {
        await yieldToBrowser();
        resetScanMemo();
      }
    }
    // Never allow stale geometry to survive beyond a scan.
    rectMemo=null;
    visibleMemo=null;
    return {heads,counts};
  }
  function canClick(h) {
    if(h.nativeState===false) return false;
    // Do not click an unknown-state header that has no evidence below it.
    return h.nativeState===true || h.nodes.length>0;
  }
  const foldCache=new WeakMap();
  function cachedFold(h) {
    const id=h.trigger?.getAttribute(ROW);
    if (!id) return null;
    const root=h.label.getRootNode();
    let ids=foldCache.get(root);
    if(!ids) {
      ids=new Set([...root.querySelectorAll(`[${FOLD}]`)]
        .map(el=>el.getAttribute(FOLD)));
      foldCache.set(root,ids);
    }
    return ids.has(id)?id:null;
  }
  function knownHiddenBody(h, heads, counts) {
    // A *present but hidden* panel containing block code is reliable closed
    // evidence; no inference from absent sections or final answer content.
    let child=h.trigger;
    for(let i=0;i<9;i++) {
      const parent=child.parentElement;
      if(!parent || parent===document.body || parent.matches("article,[data-message-author-role]")) break;
      for(let e=child.nextElementSibling;e;e=e.nextElementSibling) {
        if(otherHeading(e,h.label,counts))return false;
        if(e.querySelector(CODE) && !isVisible(e) && !e.querySelector(STOP))return true;
        if(isVisible(e) && text(e.innerText).length>30)return false;
      }
      child=parent;
    }
    return false;
  }
  function nodeContainsProseOrMedia(e) {
    if(e.matches(STOP) || e.querySelector(STOP)) return true;
    if(otherMessage(e)) return true;
    if([...e.querySelectorAll("p")].some(p=>text(p.innerText).length>130))return true;
    return false;
  }
  function otherMessage(e) {
    return !!e.querySelector("[data-message-author-role='user'],article,[data-message-id]");
  }
  let countId=0;
  function prepareFold(nodes,h) {
    // Read all geometry before any hide writes, avoiding forced reflow after
    // every card on long pages (read/write layout thrashing).
    const safe=nodes.filter(el=>isVisible(el) && !nodeContainsProseOrMedia(el) &&
      !el.contains(h.label));
    if(!safe.length) return null;
    return {id:`ca16-${Date.now().toString(36)}-${++countId}`,nodes:safe,heading:h};
  }
  function applyFold(fold) {
    const {nodes,heading:h,id}=fold;
    for(const el of nodes) {
      el.setAttribute(PRIOR,JSON.stringify([
        el.style.getPropertyValue("display"),el.style.getPropertyPriority("display")
      ]));
      el.setAttribute(FOLD,id);
      el.style.setProperty("display","none","important");
    }
    h.trigger.setAttribute(ROW,id);
  }
  function restoreNode(el){
    let old;
    try{old=JSON.parse(el.getAttribute(PRIOR)||'["",""]');}catch{old=["",""];}
    if(old[0])el.style.setProperty("display",old[0],old[1]);
    else el.style.removeProperty("display");
    el.removeAttribute(PRIOR);el.removeAttribute(FOLD);
  }
  function restoreFold(id,root) {
    for(const el of root.querySelectorAll(`[${FOLD}="${escaped(id)}"]`))restoreNode(el);
    for(const el of root.querySelectorAll(`[${ROW}="${escaped(id)}"]`))el.removeAttribute(ROW);
  }
  function beforeManualClick(event){
    const path=event.composedPath?.() || [];
    const row=path.find(n=>isEl(n)&&n.hasAttribute?.(ROW));
    if(!row)return;
    const id=row.getAttribute(ROW),root=row.getRootNode();
    if(!root.querySelector(`[${FOLD}="${escaped(id)}"]`)) {row.removeAttribute(ROW);return;}
    restoreFold(id,root);
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  }
  function getAlive(h,newScan) {
    // Original index is stable across simple react collapses: headings stay,
    // only their bodies are unmounted. Never map based on the shifting Y.
    const matched=newScan.heads[h.index];
    return matched && LABEL.test(text(matched.label.textContent)) ? matched : null;
  }
  function removedVerified(h, updated) {
    if(!updated) return false;
    if(updated.nativeState===false && updated.nodes.length===0)return true;
    if(h.nodes.length && updated.nodes.length===0)return true;
    return false;
  }
  function summaryToast(msg){
    document.getElementById(TOAST)?.remove();
    const e=document.createElement("div");
    e.id=TOAST;e.setAttribute("data-ca16-toast","");e.setAttribute("role","status");
    e.textContent=msg;
    Object.assign(e.style,{
      all:"initial",position:"fixed",zIndex:"2147483647",
      bottom:"20px",right:"18px",maxWidth:"500px",pointerEvents:"none",
      color:"white",background:"#1f2937",border:"1px solid #475569",
      padding:"11px 14px",borderRadius:"10px",font:"13px/1.45 system-ui,sans-serif",
      boxShadow:"0 6px 24px #0008"
    });
    document.body.appendChild(e);
    setTimeout(()=>e.remove(),7000);
  }
  try {
    if(!document.body)return {status:"error",message:"No document body"};
    const manager=globalThis[GLOBAL]||={listener:beforeManualClick};
    globalThis[GLOBAL]=manager;
    document.removeEventListener("click",manager.listener,true);
    document.addEventListener("click",manager.listener,true);
    const before=await scan();
    const result={
      status:"ok",version:VERSION,
      found:before.heads.length,open:0,collapsed:0,native:0,visual:0,
      closed:0,unknown:0,errors:0
    };
    const candidates=[];
    for(const h of before.heads) {
      if(cachedFold(h)) {result.closed++;continue;}
      if(h.nativeState===false || knownHiddenBody(h,before.heads,before.counts)) {result.closed++;continue;}
      if(canClick(h)) {candidates.push(h); result.open++;continue;}
      result.unknown++;
    }
    // IMPORTANT: v1.5 called scan() once after EACH visual hide. Each scan
    // rescanned every header/pre/output and forced layout, O(open * page-size).
    // v1.6 makes at most THREE full scans regardless of open panel count:
    // initial, after native clicks, and after all visual fallbacks.
    //
    // Yield every BATCH clicks. React may synchronously re-render a full chat
    // on click; never hold the browser's main thread for hundreds of clicks.
    // Unknown-state plain divs usually do not expose a real disclosure
    // handler. In the user's live page v1.5 performed 135 such clicks with
    // ZERO native collapses. Skip speculative clicks to avoid React work.
    // Still try actual controls, including divs with an onclick handler.
    const nativeTargets=candidates.filter(h=>
      h.nativeState===true ||
      h.trigger.matches("button,summary,[role='button'],[aria-controls]") ||
      typeof h.trigger.onclick==="function"
    );
    for(let i=0;i<nativeTargets.length;i+=BATCH) {
      for(const h of nativeTargets.slice(i,i+BATCH)) {
        try {
          if(h.trigger.isConnected) h.trigger.click();
          else if(h.label.isConnected) h.label.click();
        } catch { result.errors++; }
      }
      if(i+BATCH<nativeTargets.length) await yieldToBrowser();
    }
    if(nativeTargets.length) await wait(90);
    // No clickable native disclosures? Reuse the initial evidence instead of
    // performing an expensive redundant full-page rescan.
    let after=nativeTargets.length?await scan():before;
    const visualCandidates=[];
    for(const h of candidates) {
      const updated=getAlive(h,after);
      if(removedVerified(h,updated)) {
        result.collapsed++;result.native++;
      } else if(updated && updated.nativeState!==false && updated.nodes.length) {
        visualCandidates.push(updated);
      } else {
        result.errors++;
      }
    }
    // Plan all fallbacks from the SAME fresh snapshot, so hiding one block
    // cannot change which code/output region a later heading is assigned to.
    const folds=[];
    for(const h of visualCandidates) {
      const fold=prepareFold(h.nodes,h);
      if(fold)folds.push(fold);
      else result.errors++;
    }
    for(let i=0;i<folds.length;i+=BATCH) {
      for(const fold of folds.slice(i,i+BATCH)) applyFold(fold);
      if(i+BATCH<folds.length) await yieldToBrowser();
    }
    if(folds.length) {
      // Let layout settle ONCE, not after every panel.
      await yieldToBrowser();
      const verified=await scan();
      for(const fold of folds) {
        const latest=getAlive(fold.heading,verified);
        // Original content must genuinely disappear, and the scanner must
        // not see additional associated visible code/output for that heading.
        const oldInvisible=fold.nodes.every(el=>!isVisible(el));
        if(oldInvisible && latest && latest.nodes.length===0) {
          result.collapsed++;result.visual++;
        } else {
          // Undo any unverified visual hide. Do not claim success.
          restoreFold(fold.id,fold.heading.label.getRootNode());
          result.errors++;
        }
      }
    }
    summaryToast(`Collapsed ${result.collapsed}/${result.open} detected open Analyzed ` +
      `(${result.native} native, ${result.visual} visual; ${result.closed} closed; ` +
      `${result.unknown} unknown; ${result.errors} failed).`);
    return result;
  } catch(err) {
    const message=String(err?.stack||err).slice(0,340);
    try{summaryToast(`Collapse failed: ${message}`);}catch{}
    return {status:"error",message};
  }
})();
