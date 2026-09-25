// Keep drafts accessible only to this extension's trusted pages, not injected scripts.
chrome.runtime.onInstalled.addListener(()=>{
  void chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
});
