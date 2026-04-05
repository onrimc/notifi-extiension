chrome.action.onClicked.addListener(async () => {
  const notesPageUrl = chrome.runtime.getURL("notes.html");

  await chrome.tabs.create({
    url: notesPageUrl
  });
});