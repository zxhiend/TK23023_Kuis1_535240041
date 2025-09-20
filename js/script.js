/**
 * @param {string} email
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // regex buat validasi email
  return re.test(String(email).toLowerCase());
}

/**
 * @param {string} name
 */
function isValidName(name) {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 32) return false;
  const re = /^[A-Za-zÁÉÍÓÚÂÊÎÔÛàâçéèêëîïôûùüÿñæœ\s]+$/u; // regex validasi nama dan spasi
  return re.test(trimmed);
}

/**
 * @param {string} phone
 */
function isValidPhone(phone) {
  const re = /^08\d{8,14}$/; // regex validasi nomor handphone
  return re.test(phone);
}

function getUsers() {
  try {
    const data = localStorage.getItem('users'); // get user data from localStorage
    if (!data) return [];
    const parsed = JSON.parse(data);
    // normalize: ensure we always return an array of user objects
    if (Array.isArray(parsed)) {
      return parsed.filter((u) => u && typeof u === 'object');
    }
    if (parsed && typeof parsed === 'object') {
      // legacy single-object storage -> wrap into array
      return [parsed];
    }
    // unknown/malformed storage, reset to empty
    console.warn('getUsers: malformed users in localStorage, ignoring.');
    return [];
  } catch (e) {
    return [];
  }
}

/**
 * @param {Array} users
 */
function saveUsers(users) {
  // make sure we store an array
  const toSave = Array.isArray(users) ? users : [users];
  localStorage.setItem('users', JSON.stringify(toSave)); // save user data to localStorage
}

// to prevent storing plaintext password in localStorage
// Helper: produce a SHA-256 hex digest of a password using SubtleCrypto
async function hashPassword(password) {
  if (typeof password !== 'string') return '';
  // normalize to UTF-8 bytes
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  // convert buffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function isHashedPassword(pw) {
  return typeof pw === 'string' && /^[a-f0-9]{64}$/i.test(pw);
}

// Migrate any plaintext passwords in localStorage to hashed form
async function migrateStoredPasswords() {
  try {
    const users = getUsers();
    let changed = false;
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      if (!u || typeof u !== 'object') continue;
      if (!u.password) continue;
      if (!isHashedPassword(u.password)) {
        // password currently stored in plaintext -> hash and replace
        const hashed = await hashPassword(String(u.password));
        users[i].password = hashed;
        changed = true;
      }
    }
    if (changed) saveUsers(users);
  } catch (err) {
    console.warn('migrateStoredPasswords error', err);
  }
}

/**
 * @param {HTMLElement} container
 * @param {string} message
 * @param {boolean} isSuccess
 */
function showMessage(container, message, isSuccess = true) {
  container.textContent = message;
  container.className = isSuccess ? 'success-message' : 'error-message';
  container.style.display = 'block';
}

/**
 * @param {Event} event
 * fungsinya buat handle form signup
 */
function handleSignup(event) { 
  event.preventDefault();
  const form = event.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;
  const fullName = form.fullName.value.trim();
  const phone = form.phone.value.trim();

  const msgContainer = form.querySelector('.form-message');
  msgContainer.style.display = 'none';

  // clear message error sebelumnya
  form.querySelectorAll('.error-message').forEach((el) => {
    el.textContent = '';
  });

  let hasError = false;

  // validasi email
  if (!email) {
    form.email.nextElementSibling.textContent = 'Email wajib diisi';
    hasError = true;
  } else if (!isValidEmail(email)) {
    form.email.nextElementSibling.textContent = 'Format email tidak valid';
    hasError = true;
  }

  // validasi password
  if (!password) {
    form.password.nextElementSibling.textContent = 'Kata sandi wajib diisi';
    hasError = true;
  } else if (password.length < 8) {
    form.password.nextElementSibling.textContent = 'Kata sandi minimal 8 karakter';
    hasError = true;
  }

  // validasi konfirmasi password
  if (!confirmPassword) {
    form.confirmPassword.nextElementSibling.textContent = 'Konfirmasi kata sandi wajib diisi';
    hasError = true;
  } else if (password !== confirmPassword) {
    form.confirmPassword.nextElementSibling.textContent = 'Konfirmasi kata sandi tidak cocok';
    hasError = true;
  }

  // validasi nama lengkap
  if (!fullName) {
    form.fullName.nextElementSibling.textContent = 'Nama lengkap wajib diisi';
    hasError = true;
  } else if (!isValidName(fullName)) {
    form.fullName.nextElementSibling.textContent = 'Nama lengkap harus 3–32 karakter dan tidak boleh mengandung angka';
    hasError = true;
  }

  // validasi nomor handphone
  if (!phone) {
    form.phone.nextElementSibling.textContent = 'Nomor handphone wajib diisi';
    hasError = true;
  } else if (!isValidPhone(phone)) {
    form.phone.nextElementSibling.textContent = 'Nomor handphone harus diawali 08 dan panjang 10–16 digit';
    hasError = true;
  }

  if (hasError) return;

  // cek email sudah terdaftar (defensive)
  // reload users (in case another tab changed storage) and normalize comparisons
  let users = getUsers();
  const normalizedEmail = String(email).trim().toLowerCase();
  console.debug('handleSignup: users from storage:', users);
  console.debug('handleSignup: normalizedEmail:', normalizedEmail);
  const existing = users.find((u) => {
    try {
      if (!u) return false;
      // legacy: user might be stored as a plain string (just the email)
      if (typeof u === 'string') return u.trim().toLowerCase() === normalizedEmail;
      // usual case: object with email property
      if (typeof u === 'object' && u.email) return String(u.email).trim().toLowerCase() === normalizedEmail;
      // fallback: some data might use 'username' or other field -> ignore unless it matches
      if (typeof u === 'object' && u.username) return String(u.username).trim().toLowerCase() === normalizedEmail;
      return false;
    } catch (err) {
      return false;
    }
  });
  if (existing) {
    showMessage(msgContainer, 'Email sudah terdaftar. Silakan gunakan email lain.', false);
    return;
  }

  // simpan user baru (simpan hash password bukan plaintext)
  const saveNewUser = async () => {
    const hashed = await hashPassword(password);
    // re-load users one more time to avoid race conditions, then push
    users = getUsers();
    users.push({ email: String(email).trim(), password: hashed, fullName, phone });
    saveUsers(users);
    showMessage(msgContainer, 'Registrasi berhasil! Silakan login.');
    form.reset();
    // redirect to login page after short delay so user sees the message
    setTimeout(() => { window.location.href = 'login.html'; }, 900);
  };
  saveNewUser();
}

/**
 * fungsinya buat handle form login
 * @param {Event} event
 */
function handleLogin(event) {
  event.preventDefault();
  const form = event.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  const msgContainer = form.querySelector('.form-message');
  msgContainer.style.display = 'none';

  // hapus pesan error sebelumnya
  form.querySelectorAll('.error-message').forEach((el) => {
    el.textContent = '';
  });

  let hasError = false;
  // validasi email
  if (!email) {
    form.email.nextElementSibling.textContent = 'Email wajib diisi';
    hasError = true;
  } else if (!isValidEmail(email)) {
    form.email.nextElementSibling.textContent = 'Format email tidak valid';
    hasError = true;
  }
  // validasi password
  if (!password) {
    form.password.nextElementSibling.textContent = 'Kata sandi wajib diisi';
    hasError = true;
  }
  if (hasError) return;

  // cek email dan password (bandingkan hash)
  (async () => {
    try {
      const users = getUsers();
      const hashedInput = await hashPassword(password);
      const match = users.find((u) => u && u.email && u.email.toLowerCase() === email.toLowerCase() && u.password === hashedInput);
      if (match) {
        showMessage(msgContainer, `Selamat datang, ${match.fullName}! Login berhasil.`);
        // simpan sesi pengguna saat login
        setCurrentUser(match.email);
        form.reset();
        // setelah login berhasil, arahkan ke beranda
        setTimeout(() => { window.location.href = 'index.html'; }, 800);
      } else {
        // show error, clear password, focus, then reload after short delay to avoid stuck form
        showMessage(msgContainer, 'Email atau kata sandi salah.', false);
        const pwdEl = form.password;
        if (pwdEl) { pwdEl.value = ''; pwdEl.focus(); }
        // reload after short delay so user can read the message
        setTimeout(() => { window.location.reload(); }, 1200);
      }
    } catch (err) {
      console.warn('login flow error', err);
      showMessage(msgContainer, 'Terjadi kesalahan saat proses login. Silakan coba lagi.', false);
      const pwdEl = form.password;
      if (pwdEl) { pwdEl.value = ''; pwdEl.focus(); }
      setTimeout(() => { window.location.reload(); }, 1200);
    }
  })();
}

// fungsi untuk mengatur dan mendapatkan sesi pengguna
function setCurrentUser(email) {
  localStorage.setItem('currentUser', email);
}
function getCurrentUser() {
  return localStorage.getItem('currentUser');
}
function logoutUser() {
  localStorage.removeItem('currentUser');
}

// Render sidenav user area (name, avatar, status, and login/logout link)
function renderSidenavUserInfo() {
  const nameEl = document.getElementById('sidenavUserName');
  const avatarWrap = document.getElementById('sidenavAvatar');
  const avatarImg = avatarWrap ? avatarWrap.querySelector('img') : null;
  const statusEl = document.getElementById('sidenavUserStatus');
  const loginLogoutLink = document.getElementById('loginLogoutLink');

  const currentEmail = getCurrentUser();
  if (!nameEl || !statusEl) return;

  // small helper: svg used for the login/logout icon (kept identical so layout doesn't jump)
  const iconHtml = '<span class="sidenav-icon"> <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4" stroke="#2563eb" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 17l5-5-5-5" stroke="#2563eb" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 12H3" stroke="#2563eb" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

  if (currentEmail) {
    // find user
    const users = getUsers();
    const user = users.find((u) => u.email && u.email.toLowerCase() === currentEmail.toLowerCase());
    const displayName = (user && user.fullName) ? user.fullName : currentEmail;
    nameEl.textContent = displayName;
    // avatar
    if (user && user.avatar) {
      if (avatarImg) { avatarImg.src = user.avatar; avatarImg.style.display = 'block'; }
      avatarWrap && (avatarWrap.style.background = 'transparent');
    } else if (avatarImg) {
      avatarImg.style.display = 'none';
      avatarWrap && (avatarWrap.style.background = '#e5e7eb');
    }
    // status blinking green
    statusEl.classList.add('blink');
    // make link show Logout and preserve icon markup
    if (loginLogoutLink) {
      // replace node to remove old listeners then set proper innerHTML + listener
      const parent = loginLogoutLink.parentNode;
      const newLink = loginLogoutLink.cloneNode(true);
      newLink.innerHTML = iconHtml + 'Logout';
      newLink.href = '#';
      parent.replaceChild(newLink, loginLogoutLink);
      newLink.addEventListener('click', (e) => { e.preventDefault(); handleLogout(); });
      // hide "Daftar" (signup) link when logged in
      const signupLink = parent.querySelector('.sidenav-link[href="signup.html"]');
      if (signupLink) signupLink.style.display = 'none';
    }
  } else {
    nameEl.textContent = 'Belum login';
    if (avatarImg) { avatarImg.style.display = 'none'; }
    statusEl.classList.remove('blink');
    // link to Login
    if (loginLogoutLink) {
      const parent = loginLogoutLink.parentNode;
      const newLink = loginLogoutLink.cloneNode(true);
      newLink.innerHTML = iconHtml + 'Login';
      newLink.href = 'login.html';
      parent.replaceChild(newLink, loginLogoutLink);
      // ensure the signup link is visible when logged out
      const signupLink = parent.querySelector('.sidenav-link[href="signup.html"]');
      if (signupLink) signupLink.style.display = '';
    }
  }
}

function handleLogout() {
  logoutUser();
  // re-render sidenav
  renderSidenavUserInfo();
  // redirect to homepage
  window.location.href = 'index.html';
}

// Profile page handlers
function loadProfilePageIfPresent() {
  const profileForm = document.getElementById('profileForm');
  if (!profileForm) return;
  const currentEmail = getCurrentUser();
  if (!currentEmail) {
    alert('Anda harus login untuk melihat profil.');
    window.location.href = 'login.html';
    return;
  }
  const users = getUsers();
  const userIndex = users.findIndex((u) => u.email && u.email.toLowerCase() === currentEmail.toLowerCase());
  if (userIndex === -1) {
    alert('Pengguna tidak ditemukan.');
    logoutUser();
    window.location.href = 'login.html';
    return;
  }
  const user = users[userIndex];
  // populate fields
  const avatarPreview = document.getElementById('profileAvatarPreview');
  const avatarInput = document.getElementById('profileAvatar');
  const fullNameInput = document.getElementById('profileFullName');
  const emailInput = document.getElementById('profileEmail');
  const oldPassInput = document.getElementById('oldPassword');
  const newPassInput = document.getElementById('newPassword');

  if (avatarPreview && user.avatar) { avatarPreview.src = user.avatar; avatarPreview.style.display = 'block'; }
  if (fullNameInput) fullNameInput.value = user.fullName || '';
  if (emailInput) emailInput.value = user.email || '';

  // avatar file selection handler: preview and store as dataURL on save
  if (avatarInput) {
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files && avatarInput.files[0];
      const errEl = document.getElementById('profileAvatarError');
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        if (errEl) { errEl.textContent = 'File harus berupa gambar.'; errEl.style.display = 'block'; }
        avatarInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = function(e) {
        avatarPreview.src = e.target.result;
        avatarPreview.style.display = 'block';
        if (errEl) { errEl.style.display = 'none'; }
      };
      reader.readAsDataURL(file);
    });
  }

  const saveBtn = document.getElementById('saveProfileBtn');
  const cancelBtn = document.getElementById('cancelProfileBtn');
  // create or locate delete account button
  let deleteBtn = document.getElementById('deleteAccountBtn');
  if (!deleteBtn) {
    // try to place it next to cancel button if present
    deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.id = 'deleteAccountBtn';
    deleteBtn.className = 'danger-btn';
    deleteBtn.textContent = 'Hapus Akun';
    deleteBtn.style.marginLeft = '0.5rem';
    if (cancelBtn && cancelBtn.parentNode) {
      cancelBtn.parentNode.insertBefore(deleteBtn, cancelBtn.nextSibling);
    } else if (saveBtn && saveBtn.parentNode) {
      saveBtn.parentNode.appendChild(deleteBtn);
    }
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      // validations
      const newFullName = fullNameInput.value.trim();
      const newEmail = emailInput.value.trim().toLowerCase();
      const oldPass = oldPassInput.value;
      const newPass = newPassInput.value;
      const avatarData = avatarPreview.src && avatarPreview.style.display !== 'none' ? avatarPreview.src : null;

      // clear errors
      document.getElementById('profileFullNameError').style.display = 'none';
      document.getElementById('profileEmailError').style.display = 'none';
      document.getElementById('profilePasswordError').style.display = 'none';

      if (!isValidName(newFullName)) {
        const el = document.getElementById('profileFullNameError'); el.textContent = 'Nama tidak valid (3-32 karakter).'; el.style.display = 'block'; return;
      }
      if (!isValidEmail(newEmail)) {
        const el = document.getElementById('profileEmailError'); el.textContent = 'Email tidak valid.'; el.style.display = 'block'; return;
      }
      // check if email is taken by another user
      const usersNow = getUsers();
      const conflict = usersNow.some((u, idx) => idx !== userIndex && u.email && u.email.toLowerCase() === newEmail);
      if (conflict) {
        const el = document.getElementById('profileEmailError'); el.textContent = 'Email sudah dipakai oleh pengguna lain.'; el.style.display = 'block'; return;
      }
      // if changing password, verify old password
      if (newPass) {
        if (!oldPass) { const el = document.getElementById('profilePasswordError'); el.textContent = 'Masukkan kata sandi lama untuk mengganti kata sandi.'; el.style.display = 'block'; return; }
        // compare hashed old password (support migrated plain-text users too)
        const verifyOld = async () => {
          const stored = usersNow[userIndex] && usersNow[userIndex].password ? usersNow[userIndex].password : '';
          const oldIsHashed = isHashedPassword(stored);
          if (oldIsHashed) {
            const hashedOld = await hashPassword(oldPass);
            if (hashedOld !== stored) { const el = document.getElementById('profilePasswordError'); el.textContent = 'Kata sandi lama salah.'; el.style.display = 'block'; return false; }
          } else {
            // legacy: stored plaintext (unlikely after migration) - compare directly
            if (oldPass !== stored) { const el = document.getElementById('profilePasswordError'); el.textContent = 'Kata sandi lama salah.'; el.style.display = 'block'; return false; }
          }
          if (newPass.length < 8) { const el = document.getElementById('profilePasswordError'); el.textContent = 'Kata sandi baru minimal 8 karakter.'; el.style.display = 'block'; return false; }
          return true;
        };
        const ok = await verifyOld();
        if (!ok) return;
      }

      // apply changes
      usersNow[userIndex].fullName = newFullName;
      usersNow[userIndex].email = newEmail;
      if (avatarData) usersNow[userIndex].avatar = avatarData;
      if (newPass) {
        // store hashed new password
        const hashedNew = await hashPassword(newPass);
        usersNow[userIndex].password = hashedNew;
      }
      saveUsers(usersNow);
      // update session if email changed
      setCurrentUser(newEmail);
      alert('Perubahan profil tersimpan.');
      // re-render sidenav
      renderSidenavUserInfo();
    });
  }
  if (cancelBtn) { cancelBtn.addEventListener('click', () => { window.location.href = 'index.html'; }); }
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      // confirm destructive action
      const ok = confirm('Anda yakin ingin menghapus akun ini? Tindakan ini tidak dapat dibatalkan.');
      if (!ok) return;
      // remove user from storage
      const allUsers = getUsers();
      const remaining = allUsers.filter((u) => !(u && u.email && u.email.toLowerCase() === currentEmail.toLowerCase()));
      saveUsers(remaining);
      // clear session and rerender
      logoutUser();
      renderSidenavUserInfo();
      alert('Akun berhasil dihapus.');
      // redirect to homepage
      window.location.href = 'index.html';
    });
  }
}

// fungsi memastikan user sudah login sebelum mengakses halaman tertentu
function ensureLoggedIn() {
  const user = getCurrentUser();
  if (!user) {
    // arahkan pengguna ke halaman login dengan peringatan
    alert('Anda harus login terlebih dahulu untuk melanjutkan.');
    window.location.href = 'login.html';
  }
}

// utilitas untuk menyimpan dan mengambil histori pembelian
function getPurchaseHistory() {
  try {
    const data = localStorage.getItem('purchaseHistory');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}
function savePurchaseHistory(history) {
  localStorage.setItem('purchaseHistory', JSON.stringify(history));
}
function addPurchaseToHistory(purchase) {
  const history = getPurchaseHistory();
  history.push(purchase);
  savePurchaseHistory(history);
}

// format angka ke mata uang rupiah
function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value);
}

// Compute premium based on rules shown in assignment screenshots
function computePremium({ age, smoke, hyper, diabetes, base = 2000000 }) {
  // determine m (age factor)
  let m = 0.1;
  if (age > 20 && age <= 30) m = 0.2;
  else if (age > 30 && age <= 40) m = 0.25;
  else if (age > 40) m = 0.4;

  const k1 = smoke === 'Ya' || smoke === 'Merokok' ? 1 : 0;
  const k2 = hyper === 'Ya' || hyper === 'Ya' ? 1 : 0;
  const k3 = diabetes === 'Ya' || diabetes === 'Ya' ? 1 : 0;

  const p = base;
  const parts = {};
  parts.base = p;
  parts.ageFactor = m * p;
  parts.smoke = k1 * 0.5 * p;
  parts.hyper = k2 * 0.4 * p;
  parts.diabetes = k3 * 0.5 * p;
  parts.total = parts.base + parts.ageFactor + parts.smoke + parts.hyper + parts.diabetes;
  return parts;
}

// event handler untuk form asuransi kesehatan
function handleHealthForm(event) {
  event.preventDefault();
  const form = event.target;
  const fullName = form.fullName.value.trim();
  const dob = form.dob.value;
  const job = form.job.value.trim();
  const smoke = form.smoke.value;
  const hyper = form.hyper.value;
  const diabetes = form.diabetes.value;
  // validasi sederhana: pastikan nama tidak kosong
  if (!fullName || !dob || !job) {
    const err = getOrCreateFormErrorEl(form);
    if (err) {
      err.textContent = 'Harap lengkapi semua data.';
      err.style.display = 'block';
    }
    return;
  }
  // hitung umur
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  // faktor usia α
  let alpha = 0.1;
  if (age > 20 && age <= 30) alpha = 0.2;
  else if (age > 30 && age <= 40) alpha = 0.25;
  else if (age > 40) alpha = 0.4;
  // faktor risiko
  const x = smoke === 'Ya' ? 1 : 0;
  const y = hyper === 'Ya' ? 1 : 0;
  const z = diabetes === 'Ya' ? 1 : 0;
  const base = 2000000;
  const premium = base + base * alpha + base * (x * 0.5 + y * 0.4 + z * 0.5);
  const plan = new URLSearchParams(window.location.search).get('plan') || 'Kesehatan';
  const purchase = {
    product: 'Asuransi Kesehatan',
    plan: plan,
    user: getCurrentUser(),
    date: new Date().toISOString(),
    premium: premium,
    status: 'Belum Dibayar',
    details: {
      fullName,
      dob,
      job,
      smoke,
      hyper,
      diabetes
    }
  };
  localStorage.setItem('currentPurchase', JSON.stringify(purchase));
  window.location.href = 'checkout.html';
}

// event handler untuk form asuransi mobil
function handleCarForm(event) {
  event.preventDefault();
  const form = event.target;
  const merk = form.merk.value.trim();
  const jenis = form.jenis.value.trim();
  const tahun = parseInt(form.tahun.value, 10);
  const harga = parseFloat(form.harga.value);
  const plat = form.plat.value.trim();
  const mesin = form.mesin.value.trim();
  const rangka = form.rangka.value.trim();
  const pemilik = form.pemilik.value.trim();
  if (!merk || !jenis || !tahun || !harga || !plat || !mesin || !rangka || !pemilik) {
    const err = getOrCreateFormErrorEl(form);
    if (err) {
      err.textContent = 'Harap lengkapi semua data kendaraan.';
      err.style.display = 'block';
    }
    return;
  }
  const currentYear = new Date().getFullYear();
  const age = currentYear - tahun;
  let premium = 0;
  if (age <= 3) {
    premium = harga * 0.025;
  } else if (age > 3 && age <= 5) {
    if (harga < 200000000) premium = harga * 0.04;
    else premium = harga * 0.03;
  } else {
    premium = harga * 0.05;
  }
  const urlParams = new URLSearchParams(window.location.search);
  const plan = urlParams.get('plan') || 'Mobil';
  const purchase = {
    product: 'Asuransi Mobil',
    plan: plan,
    user: getCurrentUser(),
    date: new Date().toISOString(),
    premium: premium,
    status: 'Belum Dibayar',
    details: {
      merk,
      jenis,
      tahun,
      harga,
      plat,
      mesin,
      rangka,
      pemilik
    }
  };
  localStorage.setItem('currentPurchase', JSON.stringify(purchase));
  window.location.href = 'checkout.html';
}

// event handler untuk form asuransi jiwa
function handleLifeForm(event) {
  event.preventDefault();
  const form = event.target;
  const fullName = form.fullName.value.trim();
  const dob = form.dob.value;
  const coverage = parseFloat(form.coverage.value);
  if (!fullName || !dob || !coverage) {
    const err = getOrCreateFormErrorEl(form);
    if (err) {
      err.textContent = 'Harap lengkapi semua data.';
      err.style.display = 'block';
    }
    return;
  }
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  let rate = 0.002;
  if (age > 35 && age <= 50) rate = 0.004;
  else if (age > 50) rate = 0.01;
  const premium = (coverage * rate) / 12;
  const urlParams = new URLSearchParams(window.location.search);
  const plan = urlParams.get('plan') || 'Jiwa';
  const purchase = {
    product: 'Asuransi Jiwa',
    plan: plan,
    user: getCurrentUser(),
    date: new Date().toISOString(),
    premium: premium,
    status: 'Belum Dibayar',
    details: {
      fullName,
      dob,
      coverage
    }
  };
  localStorage.setItem('currentPurchase', JSON.stringify(purchase));
  window.location.href = 'checkout.html';
}

// halaman checkout: isi detail pembelian dan bayar
function loadCheckoutPage() {
  const container = document.getElementById('checkoutContent');
  const raw = localStorage.getItem('currentPurchase');
  if (!raw) {
    container.innerHTML = '<p>Tidak ada transaksi yang diproses.</p>';
    return;
  }
  const purchase = JSON.parse(raw);
  // tampilkan ringkasan pembelian
  const detailsHtml = [];
  detailsHtml.push(`<p style="margin-bottom:0.75rem;"><strong>Produk:</strong> ${purchase.product} (${purchase.plan})</p>`);
  detailsHtml.push(`<p style="margin-bottom:0.75rem;"><strong>Premi:</strong> ${formatRupiah(purchase.premium)}</p>`);
  // optional: tampilkan beberapa detail kunci
  if (purchase.product === 'Asuransi Kesehatan') {
    detailsHtml.push(`<p style="margin-bottom:0.75rem;"><strong>Nama:</strong> ${purchase.details.fullName}</p>`);
    detailsHtml.push(`<p style="margin-bottom:0.75rem;"><strong>Usia:</strong> ${new Date().getFullYear() - new Date(purchase.details.dob).getFullYear()} tahun</p>`);
  }
  if (purchase.product === 'Asuransi Mobil') {
    detailsHtml.push(`<p style="margin-bottom:0.75rem;"><strong>Merk:</strong> ${purchase.details.merk} ${purchase.details.jenis}</p>`);
    detailsHtml.push(`<p style="margin-bottom:0.75rem;"><strong>Tahun:</strong> ${purchase.details.tahun}</p>`);
  }
  if (purchase.product === 'Asuransi Jiwa') {
    detailsHtml.push(`<p style="margin-bottom:0.75rem;"><strong>Nama:</strong> ${purchase.details.fullName}</p>`);
    detailsHtml.push(`<p style="margin-bottom:0.75rem;"><strong>Pertanggungan:</strong> ${formatRupiah(purchase.details.coverage)}</p>`);
  }
  // metode pembayaran
  const paymentHtml = `
    <h3 style="margin-top:1rem; margin-bottom:0.5rem;">Pilih Metode Pembayaran</h3>
    <div style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem;">
      <label><input type="radio" name="payment" value="Bank Transfer" checked> Bank Transfer (BCA, BNI, Mandiri)</label>
      <label><input type="radio" name="payment" value="Kartu Kredit"> Kartu Kredit</label>
      <label><input type="radio" name="payment" value="E-Wallet"> E-Wallet (OVO, GoPay, DANA)</label>
    </div>
    <button id="payButton" class="submit-btn" style="width:100%;">Bayar Sekarang</button>
  `;
  container.innerHTML = detailsHtml.join('') + paymentHtml;
  // event pembayaran
  const payBtn = document.getElementById('payButton');
  payBtn.addEventListener('click', () => {
    // update status dan simpan ke histori
    purchase.status = 'Lunas';
    addPurchaseToHistory(purchase);
    localStorage.removeItem('currentPurchase');
    alert('Pembayaran berhasil!');
    window.location.href = 'history.html';
  });
}

// halaman histori: render tabel pembelian
function loadHistoryPage() {
  const tbody = document.getElementById('historyTableBody');
  const history = getPurchaseHistory();
  const user = getCurrentUser();
  const filtered = history.filter((h) => h.user === user);
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:1rem; text-align:center;">Belum ada histori pembelian.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  filtered.forEach((item) => {
    const tr = document.createElement('tr');
    // use data-label attributes so CSS can display a stacked label/value layout on small screens
    tr.innerHTML = `
      <td data-label="Produk">${item.product}</td>
      <td data-label="Jenis">${item.plan}</td>
      <td data-label="Tanggal Pembelian">${new Date(item.date).toLocaleDateString('id-ID')}</td>
      <td data-label="Harga">${formatRupiah(item.premium)}</td>
      <td data-label="Status">${item.status}</td>
    `;
    tbody.appendChild(tr);
  });
}

// inisialisasi event listener setelah dom siap
document.addEventListener('DOMContentLoaded', async () => {
  // ensure stored users are migrated (hash plaintext passwords, normalize shapes) before using forms
  try {
    await migrateStoredPasswords();
  } catch (err) {
    console.warn('Error migrating stored passwords on startup', err);
  }

  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});

/* Sidenav and client slider initialization moved from inline HTML */
function initSidenav() {
  const menuBtn = document.getElementById('menuBtn');
  const sidenav = document.getElementById('sidenav');
  const closeBtn = document.getElementById('closeSidenav');
  const overlay = document.getElementById('sidenavOverlay');
  if (!menuBtn || !sidenav) return;

  let closedRight = window.innerWidth <= 480 ? `-${Math.round(window.innerWidth * 0.8)}px` : '-280px';
  sidenav.style.right = closedRight;

  function openNav() {
    sidenav.style.right = '0';
    if (overlay) { overlay.style.opacity = '1'; overlay.style.visibility = 'visible'; }
    document.body.style.overflow = 'hidden';
  }
  function closeNav() {
    sidenav.style.right = closedRight;
    if (overlay) { overlay.style.opacity = '0'; overlay.style.visibility = 'hidden'; }
    document.body.style.overflow = '';
    // also close any open dropdowns
    document.querySelectorAll('.sidenav-group.open').forEach((g) => {
      g.classList.remove('open');
      const toggle = g.querySelector('.sidenav-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  menuBtn.addEventListener('click', openNav);
  closeBtn && closeBtn.addEventListener('click', closeNav);
  overlay && overlay.addEventListener('click', closeNav);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });

  window.addEventListener('resize', () => {
    closedRight = window.innerWidth <= 480 ? `-${Math.round(window.innerWidth * 0.8)}px` : '-280px';
    if (sidenav.style.right !== '0') sidenav.style.right = closedRight;
  });
}

function initSidenavDropdowns() {
  document.querySelectorAll('.sidenav-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.sidenav-group');
      const isOpen = group.classList.contains('open');
      // close other groups (optional: only one open at a time)
      document.querySelectorAll('.sidenav-group.open').forEach((g) => {
        if (g !== group) {
          g.classList.remove('open');
          const t = g.querySelector('.sidenav-toggle');
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      });
      if (isOpen) {
        group.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        group.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
    // also enable keyboard activation
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });
}

function initClientSlider() {
  const list = document.getElementById('clientList');
  if (!list) return; // no slider on this page
  let clientIndex = 0;

  // choose client dataset based on data-type attribute on the container
  const type = (list.getAttribute('data-type') || 'kesehatan').toLowerCase();
  let clients = [];
  if (type === 'mobil') {
    // companies
    clients = [
      { name: 'PT. Trans Nusantara', avatar: 'images/logo/health_logo.png', asuransi: 'Fleet Management' },
      { name: 'CV. Mitra Logistik', avatar: 'images/logo/health_logo.png', asuransi: 'Corporate Fleet' },
      { name: 'PT. Sinar Raya', avatar: 'images/logo/health_logo.png', asuransi: 'Transport Fleet' },
      { name: 'PT. Kargo Indonesia', avatar: 'images/logo/health_logo.png', asuransi: 'Logistics' },
      { name: 'PT. Armada Sejahtera', avatar: 'images/logo/health_logo.png', asuransi: 'Commercial Vehicles' },
    ];
  } else {
    // default / kesehatan / jiwa: use person-style clients
    clients = [
      { name: 'Andi Wijaya', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', asuransi: 'Rawat Inap' },
      { name: 'Siti Rahma', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', asuransi: 'Kesehatan Keluarga' },
      { name: 'Budi Santoso', avatar: 'https://randomuser.me/api/portraits/men/65.jpg', asuransi: 'Rawat Jalan' },
      { name: 'Maria Ulfa', avatar: 'https://randomuser.me/api/portraits/women/68.jpg', asuransi: 'Rawat Inap' },
      { name: 'Rizky Pratama', avatar: 'https://randomuser.me/api/portraits/men/12.jpg', asuransi: 'Kesehatan Keluarga' },
      { name: 'Dewi Lestari', avatar: 'https://randomuser.me/api/portraits/women/21.jpg', asuransi: 'Rawat Jalan' },
    ];
  }

  function showClients() {
    list.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const idx = (clientIndex + i) % clients.length;
      const c = clients[idx];
      const card = document.createElement('div');
      card.className = 'client-card';
      // if this is a company dataset, mark avatar with .company so CSS can treat it like a logo
      const isCompany = type === 'mobil';
      const avatarClass = isCompany ? 'client-avatar company' : 'client-avatar';
      card.innerHTML = `<img src="${c.avatar}" alt="${c.name}" class="${avatarClass}"><div>${c.name}</div><small style='color:#2563eb; font-size:0.95rem; margin-top:0.25rem;'>${c.asuransi}</small>`;
      list.appendChild(card);
    }
  }

  function slideClients(dir) {
    clientIndex = (clientIndex + dir + clients.length) % clients.length;
    showClients();
  }

  // bind buttons
  document.querySelectorAll('.slider-btn[data-dir]').forEach((btn) => {
    btn.addEventListener('click', () => slideClients(parseInt(btn.getAttribute('data-dir'), 10)));
  });

  showClients();
}

document.addEventListener('DOMContentLoaded', async () => {
  // migrate any legacy plaintext passwords to hashed values first
  try { await migrateStoredPasswords(); } catch (e) { /* silent */ }
  // render user info if sidenav is present
  try { renderSidenavUserInfo(); } catch (e) { /* silent */ }
  try { loadProfilePageIfPresent(); } catch (e) { /* silent */ }
  initSidenav();
  initSidenavDropdowns();
  initClientSlider();
  // jika ada form signup/login, listener sudah didaftarkan di atas
  const healthForm = document.getElementById('healthForm');
  if (healthForm) {
    ensureLoggedIn();
    healthForm.addEventListener('submit', handleHealthForm);
  }
  const carForm = document.getElementById('carForm');
  if (carForm) {
    ensureLoggedIn();
    carForm.addEventListener('submit', handleCarForm);
  }
  const lifeForm = document.getElementById('lifeForm');
  if (lifeForm) {
    ensureLoggedIn();
    lifeForm.addEventListener('submit', handleLifeForm);
  }

  // Premium compare handler for kesehatan page
  const premiForm = document.getElementById('premiForm');
  const compareBtn = document.getElementById('compareBtn');
  if (premiForm && compareBtn) {
    setupCompareForm(premiForm, compareBtn, document.getElementById('premiumResult'), () => {
      const form = premiForm;
      const age = parseInt(form.age.value, 10) || 0;
      const smoke = form.querySelector('input[name="smoking"]:checked') ? form.querySelector('input[name="smoking"]:checked').value : 'Tidak';
      const hyper = form.querySelector('input[name="hypertension"]:checked') ? form.querySelector('input[name="hypertension"]:checked').value : 'Tidak';
      const diabetes = form.querySelector('input[name="diabetic"]:checked') ? form.querySelector('input[name="diabetic"]:checked').value : 'Tidak';
      const result = computePremium({ age, smoke, hyper, diabetes });
      const container = document.getElementById('premiumResult');
      container.innerHTML = `
        <div class="line"><div>Premi dasar (P)</div><div>${formatRupiah(result.base)}</div></div>
        <div class="line"><div>Faktor usia (m × P)</div><div>${formatRupiah(result.ageFactor)}</div></div>
        <div class="line"><div>Merokok (k1 × 0.5P)</div><div>${formatRupiah(result.smoke)}</div></div>
        <div class="line"><div>Hipertensi (k2 × 0.4P)</div><div>${formatRupiah(result.hyper)}</div></div>
        <div class="line"><div>Diabetes (k3 × 0.5P)</div><div>${formatRupiah(result.diabetes)}</div></div>
        <div class="total"><div>Total Premi per Tahun</div><div>${formatRupiah(result.total)}</div></div>
      `;
      container.style.display = 'block';
      const purchase = {
        product: 'Asuransi Kesehatan',
        plan: 'Kesehatan',
        user: getCurrentUser(),
        date: new Date().toISOString(),
        premium: result.total,
        status: 'Belum Dibayar',
        details: {
          fullName: form.fullName ? form.fullName.value : '',
          dob: '',
          job: '',
          smoke,
          hyper,
          diabetes
        }
      };
      localStorage.setItem('currentPurchase', JSON.stringify(purchase));
    }, { errorMessage: 'Harap lengkapi semua data.' });
  }

  // Health compare already wired above via computePremium

  // Car premium calculation
  function computeCarPremium({ tahun, harga }) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - (parseInt(tahun, 10) || currentYear);
    let premium = 0;
    if (age <= 3) {
      premium = harga * 0.025;
    } else if (age > 3 && age <= 5) {
      if (harga < 200000000) premium = harga * 0.04;
      else premium = harga * 0.03;
    } else {
      premium = harga * 0.05;
    }
    return premium;
  }

  // Life premium calculation (monthly = m * t where m depends on age)
  function computeLifePremium({ dob, age, coverage }) {
    let computedAge = null;
    if (typeof age !== 'undefined' && age !== null && age !== '') {
      computedAge = parseInt(age, 10);
    } else if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      computedAge = today.getFullYear() - birthDate.getFullYear();
      const mth = today.getMonth() - birthDate.getMonth();
      if (mth < 0 || (mth === 0 && today.getDate() < birthDate.getDate())) computedAge--;
    }
    if (computedAge === null || Number.isNaN(computedAge)) computedAge = 0;
    let rate = 0.002; // 0.2%
    if (computedAge > 30 && computedAge <= 50) rate = 0.004; // 0.4%
    else if (computedAge > 50) rate = 0.01; // 1%
    // Monthly premium = m * t
    const monthly = rate * (parseFloat(coverage) || 0);
    return { age: computedAge, rate, monthly, annual: monthly * 12 };
  }

  // Helper: create or return a form-level inline error element
  function getOrCreateFormErrorEl(formEl) {
    if (!formEl) return null;
    let el = formEl.querySelector('.form-error');
    if (!el) {
      el = document.createElement('div');
      el.className = 'form-error';
      el.style.display = 'none';
      formEl.insertBefore(el, formEl.firstChild);
    }
    return el;
  }

  // Helper: unify compare button behavior across forms
  // options: { validateFn: () => boolean, errorMessage: string }
  function setupCompareForm(formEl, btnEl, resEl, onCompare, options = {}) {
    if (!formEl || !btnEl) return;
    const opts = Object.assign({ errorMessage: 'Harap isi semua kolom pada formulir terlebih dahulu.' }, options);
    const errorEl = getOrCreateFormErrorEl(formEl);

    function updateState() {
      const nativeValid = typeof formEl.checkValidity === 'function' ? formEl.checkValidity() : true;
      const customValid = typeof opts.validateFn === 'function' ? !!opts.validateFn() : true;
      const valid = nativeValid && customValid;
      btnEl.disabled = !valid;
      btnEl.classList.toggle('btn-disabled', !valid);
      if (valid && errorEl) errorEl.style.display = 'none';
    }

    // initial state
    updateState();

    // update on user input
    formEl.addEventListener('input', updateState);
    formEl.addEventListener('change', updateState);

    btnEl.addEventListener('click', (e) => {
      const nativeValid = typeof formEl.checkValidity === 'function' ? formEl.checkValidity() : true;
      const customValid = typeof opts.validateFn === 'function' ? !!opts.validateFn() : true;
      const valid = nativeValid && customValid;
      if (!valid) {
        // show native messages when possible
        if (typeof formEl.reportValidity === 'function') formEl.reportValidity();
        if (errorEl) {
          errorEl.textContent = opts.errorMessage;
          errorEl.style.display = 'block';
        }
        return;
      }
      if (errorEl) errorEl.style.display = 'none';
      // success handler provided by caller is responsible for rendering results and persisting purchase
      try {
        onCompare();
      } catch (err) {
        console.error('onCompare handler error', err);
      }
    });
  }

  // Car compare button
  const carCompareFormEl = document.getElementById('carCompareForm');
  const carCompareBtnEl = document.getElementById('carCompareBtn');
  const carCompareResEl = document.getElementById('carCompareResult');
  if (carCompareFormEl && carCompareBtnEl) {
    setupCompareForm(carCompareFormEl, carCompareBtnEl, carCompareResEl, () => {
      const jenis = (carCompareFormEl.jenis && carCompareFormEl.jenis.value || '').trim();
      const tahun = carCompareFormEl.tahun && carCompareFormEl.tahun.value;
      const harga = parseFloat(carCompareFormEl.harga && carCompareFormEl.harga.value);
      const premium = computeCarPremium({ tahun, harga });
      carCompareResEl.innerHTML = `<div class="line"><div>Perkiraan Premi per Tahun</div><div>${formatRupiah(premium)}</div></div>`;
      carCompareResEl.style.display = 'block';
      const purchase = { product: 'Asuransi Mobil', plan: 'Mobil', user: getCurrentUser(), date: new Date().toISOString(), premium, status: 'Belum Dibayar', details: { jenis, tahun, harga } };
      localStorage.setItem('currentPurchase', JSON.stringify(purchase));
    }, { errorMessage: 'Harap isi semua kolom pada formulir asuransi mobil terlebih dahulu.' });
  }

  // Life compare button
  const lifeCompareFormEl = document.getElementById('lifeCompareForm');
  const lifeCompareBtnEl = document.getElementById('lifeCompareBtn');
  const lifeCompareResEl = document.getElementById('lifeCompareResult');
  if (lifeCompareFormEl && lifeCompareBtnEl) {
    setupCompareForm(lifeCompareFormEl, lifeCompareBtnEl, lifeCompareResEl, () => {
      const fullName = (lifeCompareFormEl.fullName && lifeCompareFormEl.fullName.value || '').trim();
      const age = lifeCompareFormEl.age && lifeCompareFormEl.age.value;
      const coverage = lifeCompareFormEl.coverage && lifeCompareFormEl.coverage.value;
      const result = computeLifePremium({ age, coverage });
      lifeCompareResEl.innerHTML = `
        <div class="line"><div>Usia</div><div>${result.age} tahun</div></div>
        <div class="line"><div>Tarif (m)</div><div>${(result.rate * 100).toFixed(2)}%</div></div>
        <div class="line"><div>Premi per Bulan</div><div>${formatRupiah(result.monthly)}</div></div>
        <div class="line"><div>Premi per Tahun</div><div>${formatRupiah(result.annual)}</div></div>
      `;
      lifeCompareResEl.style.display = 'block';
      const purchase = { product: 'Asuransi Jiwa', plan: 'Jiwa', user: getCurrentUser(), date: new Date().toISOString(), premium: result.annual, status: 'Belum Dibayar', details: { fullName, age: parseInt(age, 10), coverage: parseFloat(coverage) } };
      localStorage.setItem('currentPurchase', JSON.stringify(purchase));
    }, { errorMessage: 'Harap lengkapi semua kolom pada formulir asuransi jiwa terlebih dahulu.' });
  }
  const checkoutContainer = document.getElementById('checkoutContent');
  if (checkoutContainer) {
    ensureLoggedIn();
    loadCheckoutPage();
  }
  const historyBody = document.getElementById('historyTableBody');
  if (historyBody) {
    ensureLoggedIn();
    loadHistoryPage();
  }
});