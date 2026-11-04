// Shared form logic: photo preview, client-side compression, validation, submit to FormSubmit (multipart)
(function () {
  const form = document.querySelector('form[data-task]');
  if (!form) return;
  const err = document.getElementById('form-error');
  const btn = form.querySelector('button[type=submit]');
  const MAX_SIDE = 1600, QUALITY = 0.82;

  // where FormSubmit should return after sending
  const next = form.querySelector('input[name=_next]');
  if (next) next.value = new URL('thanks.html?task=' + form.dataset.task, location.href).href;

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

  function compress(file) {
    return new Promise(resolve => {
      if (!file.type.startsWith('image/')) return resolve(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => {
          if (!b || b.size >= file.size) return resolve(file);
          resolve(new File([b], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified }));
        }, 'image/jpeg', QUALITY);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.hidden = true;
    // required checks with friendly text
    for (const el of form.querySelectorAll('[required]')) {
      const empty = el.type === 'radio' ? !form.querySelector(`input[name="${el.name}"]:checked`)
        : el.type === 'file' ? !(el.files && el.files.length) : !el.value.trim();
      if (empty) { showError(el.dataset.msg || 'Заполните все поля.'); return; }
    }
    btn.disabled = true; btn.textContent = 'Отправляем…';
    try {
      for (const input of form.querySelectorAll('input[type=file]')) {
        const f = input.files && input.files[0];
        if (!f) continue;
        const small = await compress(f);
        if (small !== f && window.DataTransfer) {
          try { const dt = new DataTransfer(); dt.items.add(small); input.files = dt.files; } catch (_) {}
        }
        const sent = input.files[0];
        if (sent.size > 9.5 * 1024 * 1024) { throw new Error('Фото слишком большое (больше 10 МБ). Сделайте снимок поменьше или скриншот фото.'); }
      }
      HTMLFormElement.prototype.submit.call(form);
    } catch (ex) {
      btn.disabled = false; btn.textContent = 'Отправить';
      showError(ex.message || 'Не получилось отправить. Попробуйте ещё раз.');
    }
  });
})();
