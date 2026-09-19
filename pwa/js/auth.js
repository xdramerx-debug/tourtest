/* Аутентификация (§5.16): Firebase Auth в проде; демо-режим — гостевой/имитация ролей.
   IN: email/пароль. OUT: Auth.currentUser {uid,name,role,guest}. */
(function () {
  'use strict';
  var hasFirebase = typeof firebase !== 'undefined' && window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && firebase.auth;

  var state = { user: null, loaded: false };
  var subs = [];

  function emit() { subs.forEach(function (f) { try { f(state.user); } catch (e) {} }); }
  function guestUser() { return { uid: null, guest: true, name: null, role: null }; }
  function demoUser(name) { return { uid: 'local-' + Math.random().toString(36).slice(2, 8), guest: false, name: name, role: null }; }
  function setLocal(u) { state.user = u; try { localStorage.setItem('pc.user', u ? JSON.stringify(u) : ''); } catch (e) {} emit(); }

  window.Auth = {
    onChange: function (fn) { subs.push(fn); if (state.loaded) fn(state.user); return function () { subs.splice(subs.indexOf(fn), 1); }; },
    signIn: function (email, password) {
      if (hasFirebase) {
        return firebase.auth().signInWithEmailAndPassword(email, password).then(function (cred) {
          return window.DB.get('users/' + cred.user.uid).then(function (u) {
            var role = u && u.role === 'admin' ? 'admin' : null;
            setLocal({ uid: cred.user.uid, guest: false, name: (u && u.name) || email, role: role, genderSteps: true, gender: u && u.gender });
            return state.user;
          });
        });
      }
      // демо: учётные из seed + «admin@/admin» для входа админа в демо (см. README; прод — правила Firebase)
      return new Promise(function (resolve, reject) {
        if (email === 'admin' || email === 'admin@pestovo.local') {
          if (password !== 'admin') return reject(new Error('демо-пароль: admin'));
          setLocal({ uid: 'admin-demo', guest: false, name: 'Админ (демо)', role: 'admin' });
        } else {
          var users = Object.entries((window.__rtdbUsers || {}));
          setLocal(demoUser(email.split('@')[0]));
        }
        resolve(state.user);
      });
    },
    signUp: function (data) {
      if (hasFirebase) {
        return firebase.auth().createUserWithEmailAndPassword(data.email, data.password).then(function (cred) {
          var rec = { name: data.name, gender: data.gender, handicap: data.handicap == null ? null : Number(String(data.handicap).replace(',', '.')), defaultTee: null, email: data.email, createdAt: Date.now() };
          return window.DB.set('users/' + cred.user.uid, rec).then(function () {
            setLocal({ uid: cred.user.uid, guest: false, name: data.name, role: null }); return state.user;
          });
        });
      }
      return new Promise(function (resolve) {
        var u = demoUser(data.name); u.profile = { name: data.name, gender: data.gender, handicap: data.handicap };
        setLocal(u); resolve(u);
      });
    },
    signOut: function () {
      if (hasFirebase) firebase.auth().signOut();
      setLocal(null); try { localStorage.removeItem('pc.user'); } catch (e) {}
    },
    isAdmin: function () { return state.user && state.user.role === 'admin'; },
    current: function () { return state.user; }
  };

  // инициализация
  if (hasFirebase) {
    firebase.auth().onAuthStateChanged(function (u) {
      state.loaded = true;
      if (!u) { state.user = null; emit(); return; }
      window.DB.get('users/' + u.uid).then(function (d) {
        state.user = { uid: u.uid, guest: false, name: (d && d.name) || u.email, role: d && d.role === 'admin' ? 'admin' : null, gender: d && d.gender };
        emit();
      });
    });
  } else {
    try { var saved = localStorage.getItem('pc.user'); if (saved) state.user = JSON.parse(saved); } catch (e) {}
    state.loaded = true;
    setTimeout(function () { subs.forEach(function (f) { f(state.user); }); }, 0);
  }
})();
