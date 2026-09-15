// Content script'ler ES module olamaz; asıl kod eklenti paketinden dinamik import ile yüklenir.
(async () => {
  try {
    const { main } = await import(chrome.runtime.getURL('src/content/main.js'));
    await main({ cssUrl: chrome.runtime.getURL('src/viewer/viewer.css') });
  } catch (error) {
    console.warn('[eksi-stories] başlatılamadı:', error);
  }
})();
