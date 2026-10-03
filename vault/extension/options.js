const input = document.getElementById('token');

chrome.storage.sync.get('token', ({ token }) => {
  if (token) input.value = token;
});

document.getElementById('save').addEventListener('click', () => {
  chrome.storage.sync.set({ token: input.value.trim() }, () => {
    window.close();
  });
});
