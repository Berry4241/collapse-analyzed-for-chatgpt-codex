/* Collapse Analyzed for ChatGPT & Codex v1.6
 * No polling, remote requests, or persistent page access.
 * Avoid unbounded work if the user rapidly clicks the toolbar icon.
 */
const running = new Map();

async function showBadge(tabId, text, color, title) {
  try {
    await chrome.action.setBadgeBackgroundColor({tabId, color});
    await chrome.action.setBadgeText({tabId, text});
    await chrome.action.setTitle({tabId, title});
  } catch {
    // The tab may have been closed while the scan was running.
  }
}

async function runOnce(tabId) {
  await showBadge(tabId, "…", "#505e73", "Collapsing expanded Analyzed panels…");
  let result;
  try {
    const values = await chrome.scripting.executeScript({
      target: {tabId},
      files: ["collapse.js"],
      world: "ISOLATED"
    });
    result = values?.[0]?.result ||
      {status:"error",message:"No response from the page"};
  } catch (err) {
    result = {status:"error",message:String(err?.message || err)};
  }
  if(result.status!=="ok") {
    await showBadge(tabId, "!", "#b42318",
      `Could not collapse: ${result.message || "unknown error"}`);
  } else {
    const badge=result.collapsed>999?"999+":String(result.collapsed);
    await showBadge(tabId,badge,result.collapsed?"#197850":"#505e73",
      `${result.collapsed} confirmed collapses (${result.native} native, ${result.visual} visual). `+
      `${result.closed} closed; ${result.unknown} unverified; ${result.errors} failed.`);
  }
}

function enqueue(tabId) {
  const existing=running.get(tabId);
  if(existing) {
    // A second click while busy requests ONE final fresh scan, never a
    // backlog of dozens of expensive full-document scans.
    existing.rescan=true;
    return;
  }
  const state={rescan:false};
  running.set(tabId,state);
  (async () => {
    try {
      do {
        state.rescan=false;
        await runOnce(tabId);
      } while(state.rescan);
    } finally {
      running.delete(tabId);
    }
  })().catch(async err=>{
    await showBadge(tabId,"!","#b42318",String(err?.message || err));
    running.delete(tabId);
  });
}

chrome.action.onClicked.addListener(tab=>{
  if(Number.isInteger(tab?.id)) enqueue(tab.id);
});
