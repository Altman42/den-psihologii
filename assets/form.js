// Shared form logic: photo preview, client-side compression, validation, submit to Google Apps Script (JSON)
const ENDPOINT = '__APPS_SCRIPT_URL__';

(function () {
  const form = document.querySelector('form[data-task]');
  if (!form) return;
  const err = document.getElementById('form-error');
  const btn = form.querySelector('button[type=submit]');
  const MAX_SIDE = 1600, QUALITY = 0.82;

  function showError(text) { err.textContent = text; err.hidden = false; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

  // photo preview + "taken today" hint
  form.querySelectorAll('.photo input[type=file]').forEach(input => {
    const box = input.closest('.photo');
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      box.querySelectorAll('img').forEach(i => i.remove());
      const warn = document.getElementById('date-warn');
      if (!f) return;
      const img = document.createElement('img');
      img.alt = 'Выбранное фото';
      img.src = URL.createObjectURL(f);
      box.querySelector('.photo-hint').hidden = true;
      box.prepend(img);
      if (warn && f.lastModified) {
        const d = new Date(f.lastModified), now = new Date();
        warn.hidden = d.toDateString() === now.toDateString();
      }
    });
  });

  // resize to MAX_SIDE and return base64 JPEG (without the data: prefix)
  function toJpegBase64(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', QUALITY).split(',')[1]);
      };
      img.onerror = () => reject(new Error('Не получилось открыть фото. Попробуйте выбрать другое или сделать скриншот фото.'));
      img.src = URL.createObjectURL(file);
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.hidden = true;
    for (const el of form.querySelectorAll('[required]')) {
      const empty = el.type === 'radio' ? !form.querySelector(`input[name="${el.name}"]:checked`)
        : el.type === 'file' ? !(el.files && el.files.length) : !el.value.trim();
      if (empty) { showError(el.dataset.msg || 'Заполните все поля.'); return; }
    }
    btn.disabled = true; btn.textContent = 'Отправляем…';
    try {
      const payload = { task: form.dataset.title, fields: [], hp: (form.querySelector('[name=_honey]') || {}).value || '' };
      for (const el of form.elements) {
        if (!el.name || el.name.startsWith('_') || el.type === 'file' || el.type === 'submit') continue;
        if (el.type === 'radio' && !el.checked) continue;
        payload.fields.push([el.name, el.value.trim()]);
      }
      const fileInput = form.querySelector('input[type=file]');
      if (fileInput) payload.photo = await toJpegBase64(fileInput.files[0]);

      const res = await fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(payload) });
      const out = await res.json().catch(() => ({}));
      if (!out.ok) throw new Error('Сервер не принял ответ. Попробуйте ещё раз через минуту.');
      location.href = 'thanks.html';
    } catch (ex) {
      btn.disabled = false; btn.textContent = 'Отправить';
      showError(ex instanceof TypeError ? 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.' : ex.message);
    }
  });
})();
